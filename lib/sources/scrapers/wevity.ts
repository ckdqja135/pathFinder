import type {
  CollectContext,
  CollectedEvent,
  EventSource,
} from "../types";
import { clean } from "../util/html";
import { classifyByText } from "../util/classify";
import { addDaysKst, kstIso, kstParts } from "../util/date";
import { mapWithConcurrency } from "../util/fetch";
import type { Category } from "@/lib/types";

// wevity.com 공모전 리스트(+상세 일부)를 긁는다. robots.txt는 전체 허용(2026-09 확인).
// - 리스트 행: 제목/분야/주최/D-N(접수중)만 있고 접수 시작일은 없다.
// - 상세 페이지엔 "접수기간 YYYY-MM-DD ~ YYYY-MM-DD"와 주최/주관이 구조화돼 있어
//   상위 MAX_DETAIL_FETCHES건만 상세로 보강한다(상세 조회 상한).
// - 공모전의 "개최일"은 원문에 없으므로 만들어 넣지 않는다. 캘린더 표시 기준일은
//   접수 마감일(allDay)이고, registrationEnd에 동일 값을 넣어 마감일임을 구분한다.

const BASE = "https://www.wevity.com";
const MAX_LIST_PAGES = 2; // 페이지당 ~16건
const MAX_DETAIL_FETCHES = 10;
const DETAIL_CONCURRENCY = 3;

function listUrl(page: number): string {
  return `${BASE}/?c=find&s=1&gp=${page}&gbn=list`;
}

function detailUrl(ix: string): string {
  return `${BASE}/?c=find&s=1&gbn=view&gp=1&ix=${ix}`;
}

// 위비티 자체 분야 태그 → 우리 Category. 행사 원문의 첫 분야 태그를 우선한다.
const FIELD_MAP: Array<{ pattern: RegExp; category: Category }> = [
  { pattern: /웹\/모바일\/IT|게임\/소프트웨어/, category: "IT" },
  { pattern: /과학\/공학|논문\/리포트/, category: "RESEARCH" },
  { pattern: /광고\/마케팅|네이밍\/슬로건/, category: "MARKETING" },
  { pattern: /디자인|건축\/건설\/인테리어/, category: "DESIGN" },
  {
    pattern: /영상\/UCC\/사진|캐릭터\/만화\/게임|예체능\/미술\/음악|문학\/글\/시나리오/,
    category: "MEDIA",
  },
  { pattern: /기획\/아이디어|창업\/사업계획서|대외활동\/서포터즈/, category: "BUSINESS" },
];

export function mapWevityFields(fieldsText: string, title: string): Category {
  const tokens = fieldsText.split(",").map((t) => t.trim());
  for (const token of tokens) {
    for (const rule of FIELD_MAP) {
      if (rule.pattern.test(token)) return rule.category;
    }
  }
  return classifyByText(`${title} ${fieldsText}`, "BUSINESS");
}

export interface WevityListRow {
  ix: string;
  title: string;
  fields: string;
  organizer: string;
  daysLeft: number;
}

const LI_RE = /<li[^>]*>([\s\S]*?)<\/li>/g;
const TIT_RE =
  /<div class="tit">\s*<a href="\?c=find&s=1&gbn=view&gp=\d+&ix=(\d+)">([\s\S]*?)<\/a>\s*<div class="sub-tit">([\s\S]*?)<\/div>/;
const ORGAN_RE = /<div class="organ">([\s\S]*?)<\/div>/;
const DAY_RE = /<div class="day">\s*D-(\d+)[\s\S]*?접수중/;

/** 리스트 HTML에서 "접수중" 행만 추출한다. 마감/예정 행은 제외. */
export function parseWevityList(html: string): WevityListRow[] {
  const rows: WevityListRow[] = [];
  const seen = new Set<string>();
  let li: RegExpExecArray | null;
  while ((li = LI_RE.exec(html)) !== null) {
    const inner = li[1];
    const titM = TIT_RE.exec(inner);
    if (!titM) continue;
    const ix = titM[1];
    if (seen.has(ix)) continue; // 배너/본문 중복 노출 방지
    const dayM = DAY_RE.exec(inner);
    if (!dayM) continue;
    const organM = ORGAN_RE.exec(inner);

    // 제목 뒤에 붙는 배지(<span class='stat ...'>SPECIAL</span> 등)는 여러 개일 수
    // 있으므로 태그 제거 전에 span 블록째로 걷어낸다.
    const title = clean(
      titM[2].replace(/<span class=['"]stat[^>]*>[\s\S]*?<\/span>/g, ""),
    )
      .replace(/\s+/g, " ")
      .trim();
    const fields = clean(titM[3]).replace(/^분야\s*:\s*/, "");
    const daysLeft = Number(dayM[1]);
    if (!title || !Number.isFinite(daysLeft)) continue;

    seen.add(ix);
    rows.push({
      ix,
      title,
      fields,
      organizer: organM ? clean(organM[1]) : "",
      daysLeft,
    });
  }
  return rows;
}

export interface WevityDetail {
  registrationStart?: string; // YYYY-MM-DD
  registrationEnd?: string; // YYYY-MM-DD
  organizer?: string;
}

const DETAIL_PERIOD_RE =
  /접수기간<\/span>\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/;
const DETAIL_ORGANIZER_RE = /주최\/주관<\/span>\s*([^<]+)/;

/** 상세 HTML에서 접수기간과 주최/주관을 추출한다. 없으면 필드 생략. */
export function parseWevityDetail(html: string): WevityDetail {
  const detail: WevityDetail = {};
  const periodM = DETAIL_PERIOD_RE.exec(html);
  if (periodM) {
    detail.registrationStart = periodM[1];
    detail.registrationEnd = periodM[2];
  }
  const organizerM = DETAIL_ORGANIZER_RE.exec(html);
  if (organizerM) {
    const organizer = clean(organizerM[1]);
    if (organizer) detail.organizer = organizer;
  }
  return detail;
}

function dateOnlyToKstIso(dateOnly: string, endOfDay: boolean): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return endOfDay ? kstIso(y, m, d, 23, 59) : kstIso(y, m, d, 0, 0);
}

export function buildWevityEvent(
  row: WevityListRow,
  detail: WevityDetail | undefined,
  now: Date,
): CollectedEvent {
  // 마감일: 상세의 접수기간이 있으면 그 종료일, 없으면 리스트의 D-N으로 계산
  // (D-N도 원문 데이터다 — 수집 시점 기준 KST 달력으로 환산).
  const deadlineIso = detail?.registrationEnd
    ? dateOnlyToKstIso(detail.registrationEnd, true)
    : (() => {
        const deadline = addDaysKst(kstParts(now), row.daysLeft);
        return kstIso(deadline.year, deadline.month, deadline.day, 23, 59);
      })();

  return {
    source: "wevity",
    externalId: `wevity-${row.ix}`,
    title: row.title,
    category: mapWevityFields(row.fields, row.title),
    type: "CONTEST",
    // 개최(발표)일은 원문 리스트에 없으므로 접수 마감일을 캘린더 기준일로 쓴다.
    startDate: deadlineIso,
    endDate: deadlineIso,
    allDay: true,
    registrationStart: detail?.registrationStart
      ? dateOnlyToKstIso(detail.registrationStart, false)
      : undefined,
    registrationEnd: deadlineIso,
    organizer: detail?.organizer || row.organizer || "위비티 등록 공모전",
    location: "", // 원문 리스트에 장소/접수 방식 정보 없음
    isOnline: false,
    fee: null, // 참가비 정보 없음 (무료 단정 금지)
    link: detailUrl(row.ix),
    description: row.fields ? `공모 분야: ${row.fields}` : row.title,
  };
}

export const wevitySource: EventSource = {
  id: "wevity",
  label: "위비티 공모전",
  homepage: BASE,
  method: "html",
  defaultCategory: "BUSINESS",
  async collect(ctx: CollectContext): Promise<CollectedEvent[]> {
    const rows: WevityListRow[] = [];
    const seen = new Set<string>();

    // 리스트 페이지 순회 (상한 MAX_LIST_PAGES). 첫 페이지 실패는 출처 실패로 던지고,
    // 이후 페이지 실패는 이미 모은 행으로 계속한다.
    for (let page = 1; page <= MAX_LIST_PAGES; page++) {
      let html: string;
      try {
        ({ body: html } = await ctx.fetchDoc(listUrl(page), {
          timeoutMs: 10_000,
        }));
      } catch (err) {
        if (page === 1) throw err;
        break;
      }
      const pageRows = parseWevityList(html);
      if (page === 1 && pageRows.length === 0) {
        // 마크업 개편 등 파싱 실패를 "공모전 없음"으로 캐시/보고하지 않는다.
        throw new Error("wevity: list page parsed to 0 rows (markup changed?)");
      }
      for (const row of pageRows) {
        if (!seen.has(row.ix)) {
          seen.add(row.ix);
          rows.push(row);
        }
      }
      if (pageRows.length === 0) break;
    }

    // 상위 N건만 상세 보강 (상세 조회 상한). 상세 실패는 리스트 데이터로 대체.
    const detailTargets = rows.slice(0, MAX_DETAIL_FETCHES);
    const details = await mapWithConcurrency(
      detailTargets,
      DETAIL_CONCURRENCY,
      async (row) => {
        const { body } = await ctx.fetchDoc(detailUrl(row.ix), {
          timeoutMs: 8_000,
        });
        return parseWevityDetail(body);
      },
    );
    const detailByIx = new Map<string, WevityDetail>();
    detailTargets.forEach((row, i) => {
      const r = details[i];
      if (r?.value) detailByIx.set(row.ix, r.value);
    });

    return rows.map((row) => buildWevityEvent(row, detailByIx.get(row.ix), ctx.now));
  },
};
