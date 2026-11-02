import type {
  CollectContext,
  CollectedEvent,
  EventSource,
} from "../types";
import { classifyByText } from "../util/classify";
import { addDaysKst, kstIso, kstParts, type KstParts } from "../util/date";
import { DeadlineExceeded, mapWithConcurrency } from "../util/fetch";
import { clean } from "../util/html";
import type { EventType } from "@/lib/types";

// KINTEX(킨텍스) 행사 일정. robots.txt 전체 허용(/admin·/login만 차단, 2026-10 확인).
// 목록(list.do)은 GET 폼이라 기간·분류·페이지 크기를 쿼리로 넘길 수 있고, 카드에
// 분류·행사명·전시홀·기간(YYYY.MM.DD~YYYY.MM.DD)이 서버 렌더링돼 있다.
// 상세(view.do?seq=)에는 주최·입장료·홈페이지·행사품목이 있어 보강에 쓴다.
//
// 분류는 전시(11)·회의(23)만 받는다. 문화행사(12)는 게임·애니 팬 행사 위주라 제외.
// 관람 시간은 요일별로 다르게 적힌 경우가 많아 시각은 넣지 않고 종일(allDay)로 둔다.

const BASE = "https://www.kintex.com";
const SEARCH_TYPES = "11,23,"; // 사이트 폼과 같은 형식(끝 쉼표 포함)
const PAGE_UNIT = 100;
const MAX_LIST_PAGES = 3;
const LIST_TIMEOUT_MS = 12_000;
const DAYS_BACK = 60; // 다른 출처와 같은 과거 노출 범위
const DAYS_AHEAD = 183;
const DETAIL_CONCURRENCY = 4;
const DETAIL_TIMEOUT_MS = 5_000;
// 출처 시간 예산(20초) 안에서 끝나도록: 12초 이후엔 새 상세 조회를 시작하지 않는다.
const DETAIL_PHASE_DEADLINE_MS = 12_000;

function ymd(p: KstParts): string {
  return kstIso(p.year, p.month, p.day).slice(0, 10);
}

export function kintexListUrl(page: number, now: Date): string {
  const today = kstParts(now);
  const params = new URLSearchParams({
    pageIndex: String(page),
    pageUnit: String(PAGE_UNIT),
    searchType: SEARCH_TYPES,
    searchStartDt: ymd(addDaysKst(today, -DAYS_BACK)),
    searchEndDt: ymd(addDaysKst(today, DAYS_AHEAD)),
  });
  return `${BASE}/web/ko/event/list.do?${params}`;
}

export function kintexViewUrl(seq: string): string {
  return `${BASE}/web/ko/event/view.do?seq=${seq}`;
}

export interface KintexRow {
  seq: string;
  label: string; // "전시회" | "회의" …
  title: string;
  halls: string;
  startIso: string;
  endIso: string;
}

const CARD_RE = /fnView\('\.\/view\.do',\s*(\d+)\);">([\s\S]*?)<\/a>/g;
const LABEL_RE = /class="event-label-ko">([^<]+)</;
const SUBJECT_RE = /class="item-subject">([\s\S]*?)<\/div>/;
const CLIENT_RE = /class="item-client">([\s\S]*?)<\/div>/;
const PERIOD_RE =
  /class="item-date">\s*(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{4})\.(\d{2})\.(\d{2})/;

export function parseKintexList(html: string): KintexRow[] {
  const rows: KintexRow[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(CARD_RE)) {
    const [, seq, card] = m;
    if (seen.has(seq)) continue;
    const subjectM = SUBJECT_RE.exec(card);
    const periodM = PERIOD_RE.exec(card);
    if (!subjectM || !periodM) continue;
    const title = clean(subjectM[1]);
    if (!title) continue;
    const [, sy, sm, sd, ey, em, ed] = periodM.map(Number);
    const labelM = LABEL_RE.exec(card);
    const clientM = CLIENT_RE.exec(card);
    seen.add(seq);
    rows.push({
      seq,
      label: labelM ? clean(labelM[1]) : "",
      title,
      halls: clientM ? clean(clientM[1]).replace(/\s*,\s*/g, ", ") : "",
      startIso: kstIso(sy, sm, sd),
      endIso: kstIso(ey, em, ed),
    });
  }
  return rows;
}

export interface KintexDetail {
  organizer: string;
  admission: string; // 입장료 원문 (줄바꿈은 " / ")
  homepage?: string;
  items: string; // 행사품목
  purpose: string; // 행사목적
}

/** "주 최"처럼 글자 사이 공백이 들어간 라벨도 맞도록 정규식을 만든다. */
function labelPattern(label: string): string {
  return [...label].join("\\s*");
}

function infoField(html: string, label: string): string {
  const re = new RegExp(
    `<div class="title">\\s*${labelPattern(label)}\\s*</div>\\s*<div class="info">([\\s\\S]*?)</div>`,
  );
  const m = re.exec(html);
  return m ? m[1] : "";
}

function tableField(html: string, label: string): string {
  const re = new RegExp(
    `<th scope="row">\\s*${labelPattern(label)}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
  );
  const m = re.exec(html);
  return m ? m[1] : "";
}

/** <br>로 나뉜 줄을 " / "로 잇는다. 빈 줄·"."같은 자리표시는 버린다. */
function joinLines(html: string): string {
  return html
    .split(/<br\s*\/?>/i)
    .map(clean)
    .filter((line) => /[가-힣A-Za-z0-9]/.test(line))
    .join(" / ");
}

export function parseKintexDetail(rawHtml: string): KintexDetail {
  // 주석 처리된 블록("기 타" 관람시간 등)을 실제 값으로 읽지 않도록 먼저 제거.
  const html = rawHtml.replace(/<!--[\s\S]*?-->/g, "");
  const homepageM = /href="(https?:\/\/[^"]+)"/.exec(
    tableField(html, "홈페이지"),
  );
  return {
    organizer: clean(infoField(html, "주최")),
    admission: joinLines(infoField(html, "입장료")),
    homepage: homepageM?.[1],
    items: joinLines(tableField(html, "행사품목")),
    purpose: joinLines(tableField(html, "행사목적")),
  };
}

function eventType(row: KintexRow): EventType | null {
  if (/채용|취업|취창업|일자리|잡페어|job\s*fair/i.test(row.title)) {
    return "JOB_FAIR";
  }
  if (row.label === "전시회") return "EXHIBITION";
  if (row.label === "회의") return "CONFERENCE";
  return null; // 문화행사·기타 — 요청에서 빠지지만 마크업이 바뀌어도 섞이지 않게
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function buildKintexEvent(
  row: KintexRow,
  detail?: KintexDetail,
): CollectedEvent | null {
  const type = eventType(row);
  if (!type) return null;

  const summary = detail?.items
    ? `품목: ${detail.items}`
    : (detail?.purpose ?? "");
  const description = [
    truncate(summary, 200),
    detail?.admission ? `입장료: ${truncate(detail.admission, 120)}` : "",
    detail?.homepage ? `홈페이지: ${detail.homepage}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    source: "kintex",
    externalId: `kintex-${row.seq}`,
    title: row.title,
    // 품목 문장까지 넣으면 "펫보험"→금융, "인테리어"→디자인처럼 오분류가 많아
    // 행사명만 본다. 대부분의 산업 전시는 폴백(경영/기획)으로 간다.
    category: classifyByText(row.title, "BUSINESS"),
    type,
    startDate: row.startIso,
    endDate: row.endIso,
    allDay: true,
    organizer: detail?.organizer ?? "",
    location: row.halls ? `킨텍스 ${row.halls}` : "킨텍스",
    isOnline: false,
    // "사전등록 시 무료 / 현장 12,000원"처럼 조건부인 경우가 많아 단독 무료·0원만 0으로 본다.
    fee: detail && /^(무료|0\s*원?)$/.test(detail.admission) ? 0 : null,
    // 행사 홈페이지는 주최사 공용 주소인 경우가 있어(메가푸드쇼·메가쇼&트래블쇼 등)
    // 링크로 쓰면 URL 기준 중복 처리에서 서로 다른 행사가 합쳐진다.
    // 행사마다 고유한 킨텍스 상세로 링크하고 홈페이지는 설명에 둔다.
    link: kintexViewUrl(row.seq),
    description: description || `킨텍스 ${row.label} 일정`,
  };
}

export const kintexSource: EventSource = {
  id: "kintex",
  label: "킨텍스",
  homepage: BASE,
  method: "html",
  defaultCategory: "BUSINESS",
  async collect(ctx: CollectContext): Promise<CollectedEvent[]> {
    const deadline = Date.now() + DETAIL_PHASE_DEADLINE_MS;
    const rows: KintexRow[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_LIST_PAGES; page++) {
      const { body } = await ctx.fetchDoc(kintexListUrl(page, ctx.now), {
        timeoutMs: LIST_TIMEOUT_MS,
      });
      const pageRows = parseKintexList(body);
      if (page === 1 && pageRows.length === 0) {
        // 8개월 범위에 전시가 하나도 없을 수는 없다 — 마크업 변경으로 본다.
        throw new Error("kintex: list page parsed to 0 rows (markup changed?)");
      }
      for (const row of pageRows) {
        if (seen.has(row.seq)) continue;
        seen.add(row.seq);
        rows.push(row);
      }
      if (pageRows.length < PAGE_UNIT) break;
    }

    const details = await mapWithConcurrency(
      rows,
      DETAIL_CONCURRENCY,
      // 상세 원문(~60KB) 대신 읽어낸 필드만 캐시한다. 캐시 히트는 마감 뒤에도 쓰고,
      // 미스일 때만 마감을 보고 건너뛴다(throw라 캐시되지 않음).
      (row) =>
        ctx.cached(`detail:${row.seq}`, async () => {
          if (Date.now() > deadline) throw new DeadlineExceeded();
          const { body } = await ctx.fetchDoc(kintexViewUrl(row.seq), {
            timeoutMs: DETAIL_TIMEOUT_MS,
          });
          return parseKintexDetail(body);
        }),
    );
    const failed = details.filter(
      (d) => d.error && !(d.error instanceof DeadlineExceeded),
    );
    if (failed.length > 0) {
      const first = failed[0].error;
      console.warn(
        `[events] kintex: detail lookup failed ${failed.length}/${rows.length}:`,
        first instanceof Error ? first.message : String(first),
      );
    }

    const events: CollectedEvent[] = [];
    rows.forEach((row, i) => {
      const ev = buildKintexEvent(row, details[i].value);
      if (ev) events.push(ev);
    });
    return events;
  },
};
