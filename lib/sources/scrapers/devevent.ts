import type {
  CollectContext,
  CollectedEvent,
  EventSource,
} from "../types";
import { classifyByText } from "../util/classify";
import { kstIso } from "../util/date";
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
// 정확성 원칙: "일시"가 명시된 항목만 캘린더에 올린다. "접수"만 있는 항목은
// 행사 개최일을 알 수 없으므로 날짜를 추정해 넣지 않고 제외한다.

const RAW_URL =
  "https://raw.githubusercontent.com/brave-people/Dev-Event/master/README.md";
const HOMEPAGE = "https://github.com/brave-people/Dev-Event";

const MONTH_HEADER_RE = /^##\s+`(\d{2})년\s+(\d{2})월`\s*$/gm;
const ENTRY_TITLE_RE = /^-\s+__\[([^\]]+)\]\(([^)]+)\)__/;

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
    const titleM = ENTRY_TITLE_RE.exec(line.trim());
    if (line.startsWith("- __") && titleM) {
      current = { title: titleM[1].trim(), link: titleM[2].trim(), tags: [] };
      entries.push(current);
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

export function parseDevEventMarkdown(
  markdown: string,
  now: Date,
): CollectedEvent[] {
  const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
  const events: CollectedEvent[] = [];
  const seen = new Set<string>();

  for (const section of splitMonthSections(markdown)) {
    for (const entry of parseEntries(section.body)) {
      if (!entry.schedule) continue; // 개최일이 명시된 항목만
      const range = parseScheduleRange(entry.schedule, section.year);
      if (!range) continue;

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

export const devEventSource: EventSource = {
  id: "devevent",
  label: "Dev Event (GitHub)",
  homepage: HOMEPAGE,
  method: "markdown",
  defaultCategory: "IT",
  async collect(ctx: CollectContext): Promise<CollectedEvent[]> {
    const { body } = await ctx.fetchDoc(RAW_URL, { timeoutMs: 10_000 });
    if (splitMonthSections(body).length === 0) {
      // 월 섹션 헤더 자체가 없으면 형식 변경 — 빈 결과로 위장하지 않는다.
      throw new Error("devevent: no month sections found (format changed?)");
    }
    return parseDevEventMarkdown(body, ctx.now);
  },
};
