import type {
  CollectContext,
  CollectedEvent,
  EventSource,
} from "../types";
import { clean } from "../util/html";
import { classifyByText } from "../util/classify";
import { kstIso, kstParts } from "../util/date";
import type { Category } from "@/lib/types";

// contestkorea.com(씽굿 계열 아님, 콘테스트코리아) 공모전 리스트를 긁는다.
// robots.txt는 전체 허용(2026-09 확인), Cloudflare 없이 일반 호스팅이라
// Vercel(데이터센터 IP)에서도 접근된다 — 위비티가 Cloudflare 403으로
// 서버리스에서 차단되어 그 대체로 추가.
// 리스트 항목에 분야·주최·대상·접수기간(MM.DD~MM.DD)·D-day·상태가 모두
// 서버 렌더링되어 있어 상세 조회가 필요 없다.

const BASE = "https://www.contestkorea.com";
const MAX_LIST_PAGES = 3; // 페이지당 접수중 ~12건

function listUrl(page: number): string {
  return `${BASE}/sub/list.php?int_gbn=1&page=${page}`;
}

// 콘테스트코리아 분야 라벨("음악•콩쿠르•댄스" 등)의 토큰 → 우리 Category.
// 라벨 안 토큰 순서대로 첫 매칭을 쓴다.
const TOKEN_MAP: Array<{ pattern: RegExp; category: Category }> = [
  { pattern: /^(IT|게임|소프트웨어|코딩)/i, category: "IT" },
  { pattern: /^(학문|과학|논문)/, category: "RESEARCH" },
  { pattern: /^(광고|마케팅|네이밍|슬로건|브랜드)/, category: "MARKETING" },
  { pattern: /^(디자인|건축|공예)/, category: "DESIGN" },
  {
    pattern: /^(사진|영상|영화|UCC|음악|콩쿠르|댄스|문학|문예|만화|웹툰|캐릭터|방송|미술)/i,
    category: "MEDIA",
  },
  { pattern: /^(경제|금융|회계)/, category: "FINANCE" },
  { pattern: /^(아이디어|창업|기획|경영|취업)/, category: "BUSINESS" },
  { pattern: /^(환경|봉사|사회공헌|정책|행정|지역)/, category: "PUBLIC" },
];

export function mapContestKoreaCategory(
  label: string,
  title: string,
): Category {
  for (const token of label.split("•").map((t) => t.trim())) {
    for (const rule of TOKEN_MAP) {
      if (rule.pattern.test(token)) return rule.category;
    }
  }
  return classifyByText(`${title} ${label}`, "BUSINESS");
}

/** 접수 중인 행사의 MM.DD에 연도를 붙인다.
 *  접수 마감은 오늘(KST) 이후여야 하므로, 오늘로부터 가장 가까운 미래(당일 포함)
 *  연도를 고른다. */
export function inferEndYear(
  month: number,
  day: number,
  now: Date,
): number {
  const today = kstParts(now);
  for (const year of [today.year - 1, today.year, today.year + 1]) {
    const candidate = Date.UTC(year, month - 1, day);
    const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
    if (candidate >= todayUtc) return year;
  }
  return today.year + 1;
}

export interface ContestKoreaRow {
  externalId: string;
  link: string;
  title: string;
  categoryLabel: string;
  organizer: string;
  target: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

const HREF_RE = /<a href="(view\.php\?int_gbn=1[^"]+)"/;
const STR_NO_RE = /str_no=(\d+)/;
const CATEGORY_RE = /<span class="category">([^<]+)<\/span>/;
const TITLE_RE = /<span class="txt">([\s\S]*?)<\/span>/;
const HOST_RE = /<strong>주최<\/strong>\s*\.?\s*([^<]+)/;
const TARGET_RE = /<strong>대상<\/strong>\s*\.?\s*([^<]+)/;
const PERIOD_RE =
  /<em>접수<\/em>\s*(\d{1,2})\.(\d{1,2})\s*~\s*(\d{1,2})\.(\d{1,2})/;
const CONDITION_RE = /<span class="condition">([^<]+)<\/span>/;

/** 리스트 HTML에서 "접수중" 항목만 추출한다.
 *  항목 블록은 <div class="title"> 기준으로 나눈다 — 사이드바 최신등록 링크에는
 *  title/접수기간/상태 구조가 없어 자연히 걸러진다. */
export function parseContestKoreaList(html: string): ContestKoreaRow[] {
  const rows: ContestKoreaRow[] = [];
  const seen = new Set<string>();
  const chunks = html.split('<div class="title">').slice(1);

  for (const chunk of chunks) {
    const condM = CONDITION_RE.exec(chunk);
    if (!condM || clean(condM[1]) !== "접수중") continue;

    const hrefM = HREF_RE.exec(chunk);
    if (!hrefM) continue;
    const strNoM = STR_NO_RE.exec(hrefM[1]);
    if (!strNoM) continue;
    const externalId = strNoM[1];
    if (seen.has(externalId)) continue;

    const titleM = TITLE_RE.exec(chunk);
    const periodM = PERIOD_RE.exec(chunk);
    if (!titleM || !periodM) continue;
    const title = clean(titleM[1]);
    if (!title) continue;

    const categoryM = CATEGORY_RE.exec(chunk);
    const hostM = HOST_RE.exec(chunk);
    const targetM = TARGET_RE.exec(chunk);

    seen.add(externalId);
    rows.push({
      externalId,
      link: `${BASE}/sub/${hrefM[1].replace(/&amp;/g, "&")}`,
      title,
      categoryLabel: categoryM ? clean(categoryM[1]) : "",
      organizer: hostM ? clean(hostM[1]) : "",
      target: targetM ? clean(targetM[1]) : "",
      startMonth: Number(periodM[1]),
      startDay: Number(periodM[2]),
      endMonth: Number(periodM[3]),
      endDay: Number(periodM[4]),
    });
  }
  return rows;
}

export function buildContestKoreaEvent(
  row: ContestKoreaRow,
  now: Date,
): CollectedEvent {
  const endYear = inferEndYear(row.endMonth, row.endDay, now);
  // 접수 시작이 마감보다 뒤의 월이면 해를 넘긴 것 (12.20~01.10)
  const startYear = row.startMonth > row.endMonth ? endYear - 1 : endYear;

  const registrationStart = kstIso(startYear, row.startMonth, row.startDay);
  const registrationEnd = kstIso(endYear, row.endMonth, row.endDay, 23, 59);

  const descriptionParts = [
    row.categoryLabel ? `공모 분야: ${row.categoryLabel}` : "",
    row.target ? `대상: ${row.target}` : "",
  ].filter(Boolean);

  return {
    source: "contestkorea",
    externalId: `ck-${row.externalId}`,
    title: row.title,
    category: mapContestKoreaCategory(row.categoryLabel, row.title),
    type: "CONTEST",
    // 개최(발표)일은 리스트에 없으므로 접수 마감일을 캘린더 기준일로 쓴다.
    startDate: registrationEnd,
    endDate: registrationEnd,
    allDay: true,
    registrationStart,
    registrationEnd,
    organizer: row.organizer || "콘테스트코리아 등록 공모전",
    location: "", // 리스트에 장소/접수 방식 정보 없음
    isOnline: false,
    fee: null, // 참가비 정보 없음 (무료 단정 금지)
    link: row.link,
    description: descriptionParts.join(" · ") || row.title,
  };
}

export const contestKoreaSource: EventSource = {
  id: "contestkorea",
  label: "콘테스트코리아",
  homepage: BASE,
  method: "html",
  defaultCategory: "BUSINESS",
  async collect(ctx: CollectContext): Promise<CollectedEvent[]> {
    const rows: ContestKoreaRow[] = [];
    const seen = new Set<string>();

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
      const pageRows = parseContestKoreaList(html);
      if (page === 1 && pageRows.length === 0) {
        // 마크업 개편 등 파싱 실패를 "공모전 없음"으로 보고하지 않는다.
        throw new Error(
          "contestkorea: list page parsed to 0 rows (markup changed?)",
        );
      }
      let added = 0;
      for (const row of pageRows) {
        if (!seen.has(row.externalId)) {
          seen.add(row.externalId);
          rows.push(row);
          added++;
        }
      }
      if (added === 0) break; // 마지막 페이지 넘어가면 같은 내용 반복
    }

    return rows.map((row) => buildContestKoreaEvent(row, ctx.now));
  },
};
