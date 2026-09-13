import type {
  CollectContext,
  CollectedEvent,
  EventSource,
} from "../types";
import { classifyByText } from "../util/classify";
import { kstIso } from "../util/date";
import { mapWithConcurrency } from "../util/fetch";

// GDG(Google Developer Groups) 챕터 페이지에서 이벤트 카드를 긁는다.
// robots.txt는 챕터 페이지를 허용한다(2026-09 확인, /api·/gql 등만 차단).
// 페이지 HTML에 카드별 상세 링크와 "YYYY년 M월 D일" 텍스트가 서버 렌더링돼 있다.
// 카드에는 날짜만 있고 시각·장소·참가비는 없으므로 만들어 넣지 않는다:
// allDay(시간 미정) + 장소 미정 + fee null로 수집한다.

const BASE = "https://gdg.community.dev";

// 수집 대상 챕터 (전체 작업량 제한을 위해 지역 챕터 중심으로 상한 유지).
// 슬러그가 사라지면 해당 챕터 fetch만 실패하고 다른 챕터에는 영향 없다.
const KOREAN_CHAPTERS = [
  "gdg-seoul",
  "gdg-busan",
  "gdg-daegu",
  "gdg-daejeon",
  "gdg-gwangju",
  "gdg-incheon",
  "gdg-jeju",
  "gdg-campus-korea",
];

const CHAPTER_CONCURRENCY = 4;
const CHAPTER_TIMEOUT_MS = 10_000;

/** 슬러그 → 사람이 읽기 좋은 챕터명 */
export function chapterName(slug: string): string {
  const cleaned = slug
    .replace(/^gdg-on-campus-/, "")
    .replace(/^gdg-/, "")
    .replace(/-south-korea$/, "")
    .replace(/-/g, " ")
    .trim();
  return cleaned
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** 이벤트 상세 슬러그 → 제목 (presents-/cohost- 등 부속 제거) */
export function slugToTitle(slug: string): string {
  const idx = slug.indexOf("-presents-");
  const tail = idx >= 0 ? slug.slice(idx + "-presents-".length) : slug;
  const cleaned = tail
    .replace(/^google-/, "")
    .replace(/\/cohost-.*$/, "")
    .replace(/\/$/, "")
    .replace(/-/g, " ")
    .trim();
  return cleaned
    .split(" ")
    .map((w) => {
      if (/^(ai|io|gdg|wtm|ml|ux|ui|api|aws|gcp)$/i.test(w)) {
        return w.toUpperCase();
      }
      return w.length ? w[0].toUpperCase() + w.slice(1) : w;
    })
    .join(" ");
}

// 카드는 `<a data-testid="container-block-XX" href=".../events/details/...">`로 시작.
const CARD_RE =
  /<a data-testid="container-block-[^"]+" href="(https:\/\/gdg\.community\.dev\/events\/details\/[^"]+)"[\s\S]*?(?=<a data-testid="container-block-|<\/body>)/g;

export function splitGdgCards(html: string): string[] {
  const cards: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = CARD_RE.exec(html)) !== null) {
    cards.push(m[0]);
  }
  return cards;
}

const DATE_RE = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;

export function parseGdgCard(
  card: string,
  chapterSlug: string,
  now: Date,
): CollectedEvent | null {
  const hrefMatch =
    /href="(https:\/\/gdg\.community\.dev\/events\/details\/[^"]+)"/.exec(card);
  if (!hrefMatch) return null;
  const link = hrefMatch[1];

  const slugMatch = /\/events\/details\/([^"/]+)/.exec(link);
  if (!slugMatch) return null;
  const eventSlug = slugMatch[1];

  const dateMatch = DATE_RE.exec(card);
  if (!dateMatch) return null;
  const y = Number(dateMatch[1]);
  const mo = Number(dateMatch[2]);
  const d = Number(dateMatch[3]);

  // 챕터 페이지엔 수년치 지난 행사가 함께 노출됨 — 지난 60일 + 미래만 통과.
  const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
  const eventMs = Date.parse(kstIso(y, mo, d));
  if (!Number.isFinite(eventMs) || eventMs < now.getTime() - SIXTY_DAYS) {
    return null;
  }

  const title = slugToTitle(eventSlug);
  if (!title) return null;

  const chapter = chapterName(chapterSlug);
  const dayIso = kstIso(y, mo, d);

  return {
    source: "gdg",
    externalId: eventSlug,
    title,
    category: classifyByText(`${title} GDG 개발자`, "IT"),
    type: "CONFERENCE",
    // 카드에 시각 정보가 없으므로 종일(시간 미정)로 표시한다.
    startDate: dayIso,
    endDate: dayIso,
    allDay: true,
    organizer: `GDG ${chapter}`,
    location: "", // 카드에 장소 정보 없음
    isOnline: false,
    fee: null, // 참가비 정보 없음
    link,
    description: `${chapter} 챕터 주최 GDG 이벤트. 시간·장소는 원문 링크에서 확인하세요.`,
  };
}

export function parseGdgChapterPage(
  html: string,
  chapterSlug: string,
  now: Date,
): CollectedEvent[] {
  const seen = new Set<string>();
  const out: CollectedEvent[] = [];
  for (const card of splitGdgCards(html)) {
    const ev = parseGdgCard(card, chapterSlug, now);
    if (!ev || seen.has(ev.externalId)) continue;
    seen.add(ev.externalId);
    out.push(ev);
  }
  return out;
}

export const gdgSource: EventSource = {
  id: "gdg",
  label: "GDG 커뮤니티",
  homepage: BASE,
  method: "html",
  defaultCategory: "IT",
  async collect(ctx: CollectContext): Promise<CollectedEvent[]> {
    const results = await mapWithConcurrency(
      KOREAN_CHAPTERS,
      CHAPTER_CONCURRENCY,
      async (slug) => {
        const { body } = await ctx.fetchDoc(`${BASE}/${slug}/`, {
          timeoutMs: CHAPTER_TIMEOUT_MS,
        });
        return parseGdgChapterPage(body, slug, ctx.now);
      },
    );

    const fulfilled = results.filter((r) => r.value !== undefined);
    if (fulfilled.length === 0) {
      // 모든 챕터 fetch 실패 — 빈 결과로 위장하지 않고 출처 실패로 보고한다.
      const firstError = results.find((r) => r.error)?.error;
      throw firstError instanceof Error
        ? firstError
        : new Error("gdg: all chapter fetches failed");
    }

    // cohost 행사는 여러 챕터 페이지에 중복 노출 → externalId로 걸러낸다.
    const seen = new Set<string>();
    const events: CollectedEvent[] = [];
    for (const r of fulfilled) {
      for (const ev of r.value ?? []) {
        if (seen.has(ev.externalId)) continue;
        seen.add(ev.externalId);
        events.push(ev);
      }
    }
    return events;
  },
};
