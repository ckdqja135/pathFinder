// 수집용 fetch: 정직한 봇 UA, 하드 타임아웃, Next Data Cache(1시간) 적용.
//
// 캐시 동작 근거 (node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md,
// how-revalidation-works.md, next/dist/server/lib/patch-fetch.js):
// - `next: { revalidate: 3600 }`이 붙은 fetch는 Data Cache에 저장되고,
//   시간 경과 후에는 stale-while-revalidate로 동작한다: 이전 성공 결과를 즉시
//   반환하면서 백그라운드에서 재수집하고, 재수집이 실패하면 이전 결과가 유지된다.
// - HTTP 200 응답만 캐시된다(patch-fetch.js). 4xx/5xx나 네트워크 오류가
//   "정상 빈 결과"로 캐시될 일은 없다.
// - 태그(`events-src:<id>`)를 붙여 출처별로 revalidateTag 가능하게 한다.

import type { FetchedDoc } from "../types";

const DEFAULT_UA =
  "Mozilla/5.0 (compatible; PathFinderBot/0.1; +https://github.com/ckdqja135/pathfinder)";

export const SOURCE_REVALIDATE_SECONDS = 3600; // 출처 캐시 기본 1시간

export function sourceCacheTag(sourceId: string): string {
  return `events-src:${sourceId}`;
}

export async function fetchDocCached(
  url: string,
  init: {
    timeoutMs?: number;
    headers?: Record<string, string>;
    /** 캐시 태그를 붙일 출처 id */
    sourceId?: string;
    revalidate?: number;
  } = {},
): Promise<FetchedDoc> {
  const {
    timeoutMs = 10_000,
    headers = {},
    sourceId,
    revalidate = SOURCE_REVALIDATE_SECONDS,
  } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept:
          "text/html,application/xhtml+xml,text/markdown,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko,en;q=0.8",
        ...headers,
      },
      redirect: "follow",
      next: {
        revalidate,
        tags: sourceId ? [sourceCacheTag(sourceId)] : undefined,
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return {
      body: await res.text(),
      // Data Cache는 응답 헤더까지 보존하므로, 캐시 히트 시에도 Date 헤더는
      // 실제 수집(캐시 생성) 시각을 가리킨다.
      fetchedAt: parseDateHeader(res.headers.get("date")),
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseDateHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

/** 동시 실행 수를 제한한 map. 개별 실패는 { error }로 담아 반환한다. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<{ value?: R; error?: unknown }>> {
  const results: Array<{ value?: R; error?: unknown }> = new Array(
    items.length,
  );
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        try {
          results[index] = { value: await fn(items[index]) };
        } catch (error) {
          results[index] = { error };
        }
      }
    },
  );
  await Promise.all(workers);
  return results;
}
