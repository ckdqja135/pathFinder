import { dedupEvents } from "./dedup";
import { SOURCES } from "./registry";
import type {
  CollectContext,
  CollectedEvent,
  EventSource,
  FetchedDoc,
  SourceRunResult,
} from "./types";
import { unstable_cache } from "next/cache";
import {
  fetchDocCached,
  SOURCE_REVALIDATE_SECONDS,
  sourceCacheTag,
} from "./util/fetch";
import { createRobotsChecker } from "./util/robots";

// 공통 수집 계층. 페이지/`/api/events`/cron이 모두 여기를 거친다.
// - 출처별 실행은 병렬이며, 한 출처의 실패가 다른 출처에 영향을 주지 않는다.
// - 출처 단위 시간 예산(SOURCE_BUDGET_MS)을 두어 전체 작업량을 제한한다.
// - fetch 캐시(1시간, stale-while-revalidate)는 util/fetch.ts에서 URL 단위로 걸린다.
//   최초 캐시 적재 이후에는 요청이 캐시 응답을 받고 재수집은 백그라운드로 돈다.
// - 상세 페이지처럼 원문이 크고 쓰는 값은 작은 조회는 ctx.cached로 결과만 캐시한다.
//   수집은 요청마다 돌고 Vercel Data Cache는 원격이라, 원문(이벤터스 상세 ~390KB)을
//   캐시하면 캐시 히트여도 요청마다 십수 MB를 읽어 응답이 2–6초 걸렸다(2026-11 실측).

const SOURCE_BUDGET_MS = 20_000;

export interface CollectionResult {
  events: CollectedEvent[];
  sources: SourceRunResult[];
}

function makeContext(sourceId: string): {
  ctx: CollectContext;
  lastFetchedAt: () => string | undefined;
} {
  let latest: string | undefined;
  const fetchDoc = async (
    url: string,
    init?: { timeoutMs?: number; headers?: Record<string, string> },
  ): Promise<FetchedDoc> => {
    const doc = await fetchDocCached(url, { ...init, sourceId });
    if (doc.fetchedAt && (!latest || doc.fetchedAt > latest)) {
      latest = doc.fetchedAt;
    }
    return doc;
  };
  // Next 16 unstable_cache: 안쪽 fetch는 no-store로 바뀌고, throw하면 캐시하지 않으며,
  // stale 재검증이 실패하면 이전 값을 유지한다(next/dist/server/web/spec-extension/
  // unstable-cache.js, server/lib/patch-fetch.js).
  // 캐시 히트면 fetch가 일어나지 않아 lastFetchedAt이 비므로, 결과와 함께 계산 당시의
  // 수집 시각을 저장했다가 히트 때 되돌려 넣는다.
  const cached = async <T>(
    key: string,
    compute: () => Promise<T>,
  ): Promise<T> => {
    const entry = await unstable_cache(
      async () => {
        const value = await compute();
        return { value, fetchedAt: latest ?? null };
      },
      ["derived", sourceId, key],
      {
        revalidate: SOURCE_REVALIDATE_SECONDS,
        tags: [sourceCacheTag(sourceId)],
      },
    )();
    if (entry.fetchedAt && (!latest || entry.fetchedAt > latest)) {
      latest = entry.fetchedAt;
    }
    return entry.value;
  };
  return {
    ctx: {
      fetchDoc,
      robotsAllows: createRobotsChecker(sourceId),
      cached,
      now: new Date(),
    },
    lastFetchedAt: () => latest,
  };
}

async function runSource(source: EventSource): Promise<{
  events: CollectedEvent[];
  status: SourceRunResult;
}> {
  const { ctx, lastFetchedAt } = makeContext(source.id);
  const budget = new Promise<never>((_, reject) => {
    const t = setTimeout(
      () => reject(new Error(`source "${source.id}" exceeded time budget`)),
      SOURCE_BUDGET_MS,
    );
    // Node에서 프로세스를 붙잡지 않도록. (Vercel 런타임에도 무해)
    if (typeof t === "object" && "unref" in t) t.unref();
  });

  try {
    const events = await Promise.race([source.collect(ctx), budget]);
    return {
      events,
      status: {
        id: source.id,
        label: source.label,
        ok: true,
        count: events.length,
        fetchedAt: lastFetchedAt(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[events] source "${source.id}" failed:`, message);
    return {
      events: [],
      status: {
        id: source.id,
        label: source.label,
        ok: false,
        count: 0,
        error: message,
      },
    };
  }
}

/** 테스트에서 가짜 출처를 주입할 수 있도록 분리 */
export async function collectFromSources(
  sources: EventSource[],
): Promise<CollectionResult> {
  const results = await Promise.all(sources.map(runSource));

  const merged = dedupEvents(results.flatMap((r) => r.events));
  merged.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return {
    events: merged,
    sources: results.map((r) => r.status),
  };
}

export async function collectFromAllSources(): Promise<CollectionResult> {
  return collectFromSources(SOURCES);
}
