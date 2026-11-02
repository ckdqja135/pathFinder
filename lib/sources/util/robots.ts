import { unstable_cache } from "next/cache";
import { BOT_TOKEN, DEFAULT_UA, sourceCacheTag } from "./fetch";

// 실행 시점 robots.txt 확인. 출처 목록 밖의 임의 도메인(Dev-Event 항목의 자체 행사
// 사이트 등)을 조회할 때 쓴다. 고정 출처는 등록 시 수동 확인(registry.ts)으로 충분하다.
//
// 판정 규칙(RFC 9309):
// - 우리 토큰(PathFinderBot)과 같은 User-agent 그룹이 있으면 그 그룹, 없으면 * 그룹.
// - 경로에 맞는 규칙 중 패턴이 가장 긴 것을 따르고, 길이가 같으면 Allow가 이긴다.
// - * 와일드카드와 끝 고정 $를 지원한다.
// - robots.txt가 4xx(없음)면 제한 없음, 5xx·네트워크 오류면 수집하지 않는다.
//
// 캐시: 페이지 요청마다 수집이 돌고 fetch Data Cache는 200 응답만 저장하므로,
// robots.txt가 없는(404) 사이트는 그대로 두면 매 요청 재조회된다. 원문(404는 빈
// 문자열)을 unstable_cache로 하루 저장한다. 오류는 throw되어 캐시되지 않는다.

const ROBOTS_REVALIDATE_SECONDS = 24 * 60 * 60;
// 콜드 캐시에서 여러 출처가 동시에 돌 때 3초로는 타임아웃이 났다(실측). 호출부가
// robots 확인 뒤 마감을 다시 검사하므로 이 값이 출처 시간 예산을 늘리지는 않는다.
const ROBOTS_TIMEOUT_MS = 5_000;
const ROBOTS_MAX_BYTES = 500 * 1024; // RFC 9309 권장 최소 처리 크기

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

function parseGroups(robotsTxt: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      // 그룹 밖 규칙은 무시. 빈 Disallow는 "제한 없음"이라 규칙으로 두지 않는다.
      if (current && value) {
        current.rules.push({ allow: key === "allow", pattern: value });
      }
    }
  }
  return groups;
}

function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(path);
}

/** robots.txt 원문 기준으로 token이 path(쿼리 포함)를 수집해도 되는지. */
export function isAllowedByRobots(
  robotsTxt: string,
  path: string,
  token: string = BOT_TOKEN,
): boolean {
  if (path === "/robots.txt") return true;
  const groups = parseGroups(robotsTxt);
  const me = token.toLowerCase();
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && a.split("/")[0] === me),
  );
  const applicable =
    specific.length > 0
      ? specific
      : groups.filter((g) => g.agents.includes("*"));

  let best: Rule | null = null;
  for (const rule of applicable.flatMap((g) => g.rules)) {
    if (!patternMatches(rule.pattern, path)) continue;
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

/** robots.txt 원문. 4xx는 "" (제한 없음), 5xx·네트워크 오류는 throw. */
async function fetchRobotsTxt(origin: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROBOTS_TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      headers: { "User-Agent": DEFAULT_UA, Accept: "text/plain,*/*;q=0.8" },
      redirect: "follow",
    });
    if (res.status >= 400 && res.status < 500) return "";
    if (!res.ok) throw new Error(`robots.txt HTTP ${res.status} for ${origin}`);
    return (await res.text()).slice(0, ROBOTS_MAX_BYTES);
  } finally {
    clearTimeout(timer);
  }
}

/** url을 수집해도 되는지 확인한다. robots.txt를 확인할 수 없으면 false. */
export async function robotsAllows(
  url: string,
  sourceId: string,
): Promise<boolean> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  try {
    const robotsTxt = await unstable_cache(fetchRobotsTxt, ["robots-txt"], {
      revalidate: ROBOTS_REVALIDATE_SECONDS,
      tags: [sourceCacheTag(sourceId)],
    })(target.origin);
    return isAllowedByRobots(robotsTxt, `${target.pathname}${target.search}`);
  } catch (err) {
    console.warn(
      `[events] ${sourceId}: robots.txt unavailable, skipping ${target.origin}:`,
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}
