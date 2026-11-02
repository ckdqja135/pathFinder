import { kstIso, kstIsoFromMs } from "./date";

// 행사 상세 페이지의 schema.org Event JSON-LD(<script type="application/ld+json">)에서
// 개최 일시를 읽는다. 이벤터스·티켓타코처럼 목록은 JS 렌더링이어도 상세 페이지에는
// 검색엔진용 구조화 데이터가 서버 렌더링돼 있는 경우가 많다(2026-10 확인).
// @type은 Event와 그 하위 타입(BusinessEvent, SaleEvent, SocialEvent …)을 모두 받는다.

export interface JsonLdSchedule {
  startIso: string;
  endIso: string;
  /** 원문 startDate에 시각이 없으면 true */
  allDay: boolean;
}

const LD_SCRIPT_RE =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HAS_OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

function isEventType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && /Event$/.test(t));
}

function findEventNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findEventNode(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  if (isEventType(obj["@type"]) && typeof obj.startDate === "string") {
    return obj;
  }
  return obj["@graph"] ? findEventNode(obj["@graph"]) : null;
}

/** JSON-LD 날짜 → KST ISO. 오프셋이 없으면 KST로 본다(국내 출처 전용). */
function parseLdDate(raw: string): { iso: string; dateOnly: boolean } | null {
  const s = raw.trim();
  const d = DATE_ONLY_RE.exec(s);
  if (d) {
    return { iso: kstIso(Number(d[1]), Number(d[2]), Number(d[3])), dateOnly: true };
  }
  const ms = Date.parse(HAS_OFFSET_RE.test(s) ? s : `${s}+09:00`);
  if (!Number.isFinite(ms)) return null;
  return { iso: kstIsoFromMs(ms), dateOnly: false };
}

/** 페이지의 첫 Event JSON-LD에서 개최 일시를 꺼낸다. 없거나 깨져 있으면 null.
 *  endDate가 없거나 시작보다 앞서면 시작 시각으로 둔다(종료 시각을 만들지 않음). */
export function extractJsonLdSchedule(html: string): JsonLdSchedule | null {
  for (const m of html.matchAll(LD_SCRIPT_RE)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const event = findEventNode(data);
    if (!event) continue;
    const start = parseLdDate(event.startDate as string);
    if (!start) continue;
    const end =
      typeof event.endDate === "string" ? parseLdDate(event.endDate) : null;
    const endIso =
      end && Date.parse(end.iso) >= Date.parse(start.iso) ? end.iso : start.iso;
    return { startIso: start.iso, endIso, allDay: start.dateOnly };
  }
  return null;
}
