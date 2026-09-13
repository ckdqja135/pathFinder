import { dedupEvents } from "./dedup";
import { SOURCES } from "./registry";
import type {
  CollectContext,
  CollectedEvent,
  EventSource,
  FetchedDoc,
  SourceRunResult,
} from "./types";
import { fetchDocCached } from "./util/fetch";

// 공통 수집 계층. 페이지/`/api/events`/cron이 모두 여기를 거친다.
// - 출처별 실행은 병렬이며, 한 출처의 실패가 다른 출처에 영향을 주지 않는다.
// - 출처 단위 시간 예산(SOURCE_BUDGET_MS)을 두어 전체 작업량을 제한한다.
// - fetch 캐시(1시간, stale-while-revalidate)는 util/fetch.ts에서 URL 단위로 걸린다.
//   최초 캐시 적재 이후에는 요청이 캐시 응답을 받고 재수집은 백그라운드로 돈다.

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
  return {
    ctx: { fetchDoc, now: new Date() },
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
