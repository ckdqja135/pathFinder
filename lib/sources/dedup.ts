import type { CollectedEvent } from "./types";

// 서로 다른 출처의 동일 행사 중복 처리 — 보수적으로:
// 1) 원문 URL이 같으면 확실한 중복.
// 2) 정규화한 제목 + 시작 날짜(달력일)가 같으면 중복으로 본다.
// 중복이면 정보가 더 풍부한 쪽(시각 있음 > 종일, 접수기간/주최/장소 보유)을 남긴다.

function normalizeLink(link: string): string {
  try {
    const u = new URL(link);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${path}${u.search}`;
  } catch {
    return link.trim().toLowerCase();
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s ]+/g, "")
    .replace(/[[\]()【】〈〉<>「」'"“”‘’·•\-–—_:;,.!?~]/g, "");
}

function startDay(event: CollectedEvent): string {
  // ISO 문자열은 항상 +09:00이므로 앞 10자가 KST 달력일이다.
  return event.startDate.slice(0, 10);
}

function infoScore(event: CollectedEvent): number {
  let score = 0;
  if (!event.allDay) score += 4; // 시각 정보 보유
  if (event.registrationStart || event.registrationEnd) score += 2;
  if (event.organizer) score += 1;
  if (event.location) score += 1;
  if (event.fee !== null) score += 1;
  return score;
}

export function dedupEvents(events: CollectedEvent[]): CollectedEvent[] {
  const byKey = new Map<string, CollectedEvent>();
  const keysOf = (ev: CollectedEvent): string[] => [
    `link:${normalizeLink(ev.link)}`,
    `title:${normalizeTitle(ev.title)}@${startDay(ev)}`,
  ];

  const kept: CollectedEvent[] = [];
  for (const ev of events) {
    const keys = keysOf(ev);
    const existing = keys
      .map((k) => byKey.get(k))
      .find((e): e is CollectedEvent => e !== undefined);

    if (!existing) {
      kept.push(ev);
      for (const k of keys) byKey.set(k, ev);
      continue;
    }
    if (infoScore(ev) > infoScore(existing)) {
      // 더 풍부한 레코드로 교체 (배열 위치 유지)
      const idx = kept.indexOf(existing);
      if (idx !== -1) kept[idx] = ev;
      for (const k of [...keysOf(existing), ...keys]) byKey.set(k, ev);
    } else {
      for (const k of keys) if (!byKey.has(k)) byKey.set(k, existing);
    }
  }
  return kept;
}
