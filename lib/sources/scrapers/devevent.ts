import type {
  CollectContext,
  CollectedEvent,
  EventSource,
} from "../types";
import { classifyByText } from "../util/classify";
import { kstIso } from "../util/date";
import { mapWithConcurrency } from "../util/fetch";
import { extractJsonLdSchedule } from "../util/jsonld";
import type { EventType } from "@/lib/types";

// brave-people/Dev-Event — 국내 개발자 행사(컨퍼런스/세미나/해커톤)를 커뮤니티가
// 큐레이션하는 공개 GitHub 저장소. README 마크다운을 raw로 받아 파싱한다.
// 형식(월 섹션 + 항목):
//   ## `26년 09월`
//   - __[제목](URL)__
//     - 분류: `오프라인(서울 서초구)`, `무료`, `세미나`, `AI`
//     - 주최: ...
//     - 일시: 09. 09(수) 18:30 ~ 09. 09(수) 21:30   (또는 "접수: ...")
//
// 정확성 원칙: 개최일이 확인된 항목만 캘린더에 올린다. 접수 기간으로 개최일을
// 추정하지 않는다.
//
// 상세 페이지 보강: README 항목 대부분이 "일시" 없이 "접수"만 적혀 있다
// (2026-10 기준 90건 중 75건 — 대형 컨퍼런스 다수 포함). 이런 항목은 링크된 행사
// 페이지의 schema.org Event JSON-LD(주최 측 입력값)에서 개최 일시를 읽는다.
// - 조회 대상: "일시"가 없는 항목(도메인 무관) + 이벤터스·티켓타코 항목.
//   두 플랫폼은 JSON-LD가 일관돼 README "일시"보다 우선한다 — 접수 기간을 일시로
//   옮겨 적은 사례가 있다(.NET Conf: README 09.10~11.26, 상세 11.26 당일).
// - 임의 도메인이므로 조회 전 robots.txt를 실행 시점에 확인한다(util/robots.ts).
// - 본문 텍스트에서 날짜를 고르지는 않는다(접수·CFP 마감 등과 구분 불가 → 추정).
// 상세 조회가 실패하면 "일시"가 있는 항목은 그 값을 쓰고, 없는 항목은 제외한다.

const RAW_URL =
  "https://raw.githubusercontent.com/brave-people/Dev-Event/master/README.md";
const HOMEPAGE = "https://github.com/brave-people/Dev-Event";

const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
const README_TIMEOUT_MS = 10_000;
const MAX_DETAIL_LOOKUPS = 100;
const DETAIL_CONCURRENCY = 6;
const DETAIL_TIMEOUT_MS = 5_000;
// 출처 시간 예산(index.ts, 20초)을 넘기면 README 결과까지 잃는다. 수집 시작 12초 후에는
// 새 조회를 시작하지 않는다(robots 확인 뒤에도 다시 검사): 최악 12 + 5(상세 타임아웃) = 17초.
// 조회한 페이지는 캐시되므로 다음 요청에서 이어서 채워진다.
const DETAIL_PHASE_DEADLINE_MS = 12_000;

// JSON-LD가 일관돼 README "일시"보다 우선하는 행사 플랫폼. 쿼리(utm 등)는 뗀다.
const TRUSTED_DETAIL_PAGES: Array<{ host: RegExp; path: RegExp }> = [
  { host: /^(www\.)?event-us\.kr$/i, path: /^\/[A-Za-z0-9_-]+\/event\/\d+\/?$/ },
  { host: /^(www\.)?ticketa\.co$/i, path: /^\/event\/[A-Za-z0-9]+\/?$/ },
];

const MONTH_HEADER_RE = /^##\s+`(\d{2})년\s+(\d{2})월`\s*$/gm;
// 제목에 대괄호가 들어가는 경우가 있어("[KISA] DNS 운영 …") 마지막 "](" 까지를 제목으로 본다.
const ENTRY_TITLE_RE = /^-\s+__\[(.+)\]\(([^)\s]+)\)__/;

interface DevEventEntry {
  title: string;
  link: string;
  tags: string[];
  organizer?: string;
  schedule?: string; // "일시:" 뒤 원문
  registration?: string; // "접수:" 뒤 원문
}

interface MonthSection {
  year: number;
  month: number;
  body: string;
}

export function splitMonthSections(markdown: string): MonthSection[] {
  const sections: MonthSection[] = [];
  const headers: Array<{ year: number; month: number; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = MONTH_HEADER_RE.exec(markdown)) !== null) {
    headers.push({
      year: 2000 + Number(m[1]),
      month: Number(m[2]),
      index: m.index + m[0].length,
    });
  }
  for (const header of headers) {
    const start = header.index;
    const end = markdown.indexOf("\n## ", start);
    sections.push({
      year: header.year,
      month: header.month,
      body: markdown.slice(start, end === -1 ? undefined : end),
    });
  }
  return sections;
}

function parseEntries(sectionBody: string): DevEventEntry[] {
  const entries: DevEventEntry[] = [];
  let current: DevEventEntry | null = null;

  for (const rawLine of sectionBody.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("- __")) {
      const titleM = ENTRY_TITLE_RE.exec(line.trim());
      // 제목 줄을 못 읽으면 하위 줄이 앞 항목에 덮어써지지 않도록 끊는다.
      current = titleM
        ? { title: titleM[1].trim(), link: titleM[2].trim(), tags: [] }
        : null;
      if (current) entries.push(current);
      continue;
    }
    if (!current) continue;
    const sub = line.trim();
    if (sub.startsWith("- 분류:")) {
      const tagMatches = sub.matchAll(/`([^`]+)`/g);
      current.tags = [...tagMatches].map((t) => t[1].trim());
    } else if (sub.startsWith("- 주최:")) {
      current.organizer = sub.replace(/^-\s*주최:\s*/, "").trim();
    } else if (sub.startsWith("- 일시:")) {
      current.schedule = sub.replace(/^-\s*일시:\s*/, "").trim();
    } else if (sub.startsWith("- 접수:")) {
      current.registration = sub.replace(/^-\s*접수:\s*/, "").trim();
    }
  }
  return entries;
}

// "09. 09(수) 18:30" | "09. 09(수)" — 월/일과 선택적 시:분
const DATE_PIECE_RE =
  /(\d{1,2})\.\s*(\d{1,2})\s*\([^)]*\)(?:\s*(\d{1,2}):(\d{2}))?/;

interface ParsedDateTime {
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}

function parseDatePiece(text: string): ParsedDateTime | null {
  const m = DATE_PIECE_RE.exec(text);
  if (!m) return null;
  return {
    month: Number(m[1]),
    day: Number(m[2]),
    hour: m[3] !== undefined ? Number(m[3]) : undefined,
    minute: m[4] !== undefined ? Number(m[4]) : undefined,
  };
}

export interface ParsedSchedule {
  startIso: string;
  endIso: string;
  allDay: boolean;
}

/** "09. 09(수) 18:30 ~ 09. 09(수) 21:30"을 섹션 연도 기준 KST ISO로.
 *  종료 월이 시작 월보다 작으면 해를 넘긴 것으로 본다(12월→1월). */
export function parseScheduleRange(
  raw: string,
  sectionYear: number,
): ParsedSchedule | null {
  const [startRaw, endRaw] = raw.split("~", 2).map((s) => s.trim());
  const start = parseDatePiece(startRaw ?? "");
  if (!start) return null;
  const end = endRaw ? parseDatePiece(endRaw) : null;

  const endYear =
    end && end.month < start.month ? sectionYear + 1 : sectionYear;
  const hasTime = start.hour !== undefined;

  const startIso = kstIso(
    sectionYear,
    start.month,
    start.day,
    start.hour ?? 0,
    start.minute ?? 0,
  );
  const endIso = end
    ? kstIso(
        endYear,
        end.month,
        end.day,
        end.hour ?? (end.hour === undefined && !hasTime ? 0 : 23),
        end.minute ?? (end.hour === undefined && !hasTime ? 0 : 59),
      )
    : startIso;

  return { startIso, endIso, allDay: !hasTime };
}

function eventTypeFromTags(tags: string[]): EventType {
  if (tags.some((t) => /해커톤|공모전|대회/.test(t))) return "CONTEST";
  return "CONFERENCE";
}

function locationFromTags(tags: string[]): {
  location: string;
  isOnline: boolean;
} {
  let location = "";
  let isOnline = false;
  for (const tag of tags) {
    if (/^온라인/.test(tag)) isOnline = true;
    const m = /^오프라인\s*\(([^)]+)\)/.exec(tag);
    if (m) location = m[1].trim();
    else if (tag === "오프라인" && !location) location = "";
  }
  return { location, isOnline };
}

function feeFromTags(tags: string[]): number | null {
  if (tags.includes("무료")) return 0;
  return null; // "유료" 포함 — 금액이 원문에 없으므로 미정으로 둔다
}

/** 커뮤니티 README에서 온 링크라 공개 https 도메인만 조회한다
 *  (IP 리터럴·localhost 등 내부 주소로의 요청 방지). */
function isPublicHttpsUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return (
    url.protocol === "https:" &&
    host.includes(".") &&
    !host.endsWith(".localhost") &&
    !host.endsWith(".internal") &&
    !host.startsWith("[") && // IPv6 리터럴
    !/^\d+(\.\d+){3}$/.test(host) // IPv4 리터럴
  );
}

function trustedDetailPage(url: URL): boolean {
  return TRUSTED_DETAIL_PAGES.some(
    (r) => r.host.test(url.hostname) && r.path.test(url.pathname),
  );
}

/** 링크의 상세 조회용 URL. 조회할 수 없는 링크면 null.
 *  trusted: README "일시"보다 상세 값을 우선하는 플랫폼인지 */
export function detailLookupUrl(
  link: string,
): { url: string; trusted: boolean } | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (!isPublicHttpsUrl(url)) return null;
  if (trustedDetailPage(url)) {
    return { url: `https://${url.hostname}${url.pathname}`, trusted: true };
  }
  url.hash = "";
  return { url: url.toString(), trusted: false };
}

/** 상세 페이지를 조회할 URL 목록. "일시"가 없는 항목과 신뢰 플랫폼 항목이 대상이다.
 *  기준일(일시 시작, 없으면 접수 마감)이 수집 창(지난 60일) 밖이면 조회하지 않는다.
 *  상한을 넘으면 기준일이 지나지 않은 항목을 우선한다. */
export function detailLookupUrls(markdown: string, now: Date): string[] {
  const candidates: Array<{ url: string; upcoming: boolean }> = [];
  const seen = new Set<string>();

  for (const section of splitMonthSections(markdown)) {
    for (const entry of parseEntries(section.body)) {
      const lookup = detailLookupUrl(entry.link);
      if (!lookup || seen.has(lookup.url)) continue;
      if (entry.schedule && !lookup.trusted) continue; // 개최일이 이미 있음
      const { url } = lookup;
      const ref = entry.schedule
        ? parseScheduleRange(entry.schedule, section.year)?.startIso
        : entry.registration
          ? parseScheduleRange(entry.registration, section.year)?.endIso
          : undefined;
      const refMs = ref ? Date.parse(ref) : NaN;
      if (refMs < now.getTime() - SIXTY_DAYS) continue;
      seen.add(url);
      candidates.push({
        url,
        upcoming: !Number.isFinite(refMs) || refMs >= now.getTime(),
      });
    }
  }
  candidates.sort((a, b) => Number(b.upcoming) - Number(a.upcoming));
  return candidates.slice(0, MAX_DETAIL_LOOKUPS).map((c) => c.url);
}

/** @param details 상세 조회 URL(detailLookupUrl) → 상세 페이지에서 읽은 개최 일시 */
export function parseDevEventMarkdown(
  markdown: string,
  now: Date,
  details: ReadonlyMap<string, ParsedSchedule> = new Map(),
): CollectedEvent[] {
  const events: CollectedEvent[] = [];
  const seen = new Set<string>();

  for (const section of splitMonthSections(markdown)) {
    for (const entry of parseEntries(section.body)) {
      const lookup = detailLookupUrl(entry.link);
      const range =
        (lookup ? details.get(lookup.url) : undefined) ??
        (entry.schedule
          ? parseScheduleRange(entry.schedule, section.year)
          : null);
      if (!range) continue; // 개최일이 확인된 항목만

      const startMs = Date.parse(range.startIso);
      if (!Number.isFinite(startMs) || startMs < now.getTime() - SIXTY_DAYS) {
        continue;
      }

      const externalId = entry.link;
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      const { location, isOnline } = locationFromTags(entry.tags);
      const registration = entry.registration
        ? parseScheduleRange(entry.registration, section.year)
        : null;
      const paidNote = entry.tags.includes("유료") ? " (유료)" : "";

      events.push({
        source: "devevent",
        externalId,
        title: entry.title,
        category: classifyByText(
          `${entry.title} ${entry.tags.join(" ")}`,
          "IT",
        ),
        type: eventTypeFromTags(entry.tags),
        startDate: range.startIso,
        endDate: range.endIso,
        allDay: range.allDay,
        registrationStart: registration?.startIso,
        registrationEnd: registration?.endIso,
        organizer: entry.organizer ?? "",
        location,
        isOnline,
        fee: feeFromTags(entry.tags),
        link: entry.link,
        description: `${entry.tags.filter((t) => !/^(온라인|오프라인)/.test(t)).join(" · ")}${paidNote}`.trim() ||
          entry.title,
      });
    }
  }
  return events;
}

async function fetchDetailSchedules(
  ctx: CollectContext,
  urls: string[],
  deadline: number,
): Promise<Map<string, ParsedSchedule>> {
  const results = await mapWithConcurrency(
    urls,
    DETAIL_CONCURRENCY,
    async (url) => {
      if (Date.now() > deadline) return null;
      if (!(await ctx.robotsAllows(url))) return null;
      if (Date.now() > deadline) return null; // robots 확인이 오래 걸린 경우
      const { body } = await ctx.fetchDoc(url, {
        timeoutMs: DETAIL_TIMEOUT_MS,
      });
      return extractJsonLdSchedule(body);
    },
  );

  const schedules = new Map<string, ParsedSchedule>();
  results.forEach((r, i) => {
    if (r.value) schedules.set(urls[i], r.value);
  });
  // 개별 실패는 README 값으로 폴백하므로 출처 실패로 올리지 않되, 차단·마크업 변경을
  // 알아챌 수 있게 로그는 남긴다.
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    const first = failed[0].error;
    console.warn(
      `[events] devevent: detail lookup failed ${failed.length}/${urls.length}:`,
      first instanceof Error ? first.message : String(first),
    );
  }
  return schedules;
}

export const devEventSource: EventSource = {
  id: "devevent",
  label: "Dev Event (GitHub)",
  homepage: HOMEPAGE,
  method: "markdown",
  defaultCategory: "IT",
  async collect(ctx: CollectContext): Promise<CollectedEvent[]> {
    const deadline = Date.now() + DETAIL_PHASE_DEADLINE_MS;
    const { body } = await ctx.fetchDoc(RAW_URL, {
      timeoutMs: README_TIMEOUT_MS,
    });
    if (splitMonthSections(body).length === 0) {
      // 월 섹션 헤더 자체가 없으면 형식 변경 — 빈 결과로 위장하지 않는다.
      throw new Error("devevent: no month sections found (format changed?)");
    }
    const details = await fetchDetailSchedules(
      ctx,
      detailLookupUrls(body, ctx.now),
      deadline,
    );
    return parseDevEventMarkdown(body, ctx.now, details);
  },
};
