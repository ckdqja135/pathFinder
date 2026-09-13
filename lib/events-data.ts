import { collectFromAllSources } from "@/lib/sources";
import { getSourceById } from "@/lib/sources/registry";
import type { CollectedEvent } from "@/lib/sources/types";
import type {
  CareerEvent,
  Category as CategoryEnum,
  EventsPayload,
  EventType as EventTypeEnum,
} from "@/lib/types";

// DB 없는 조회 경로: 페이지와 /api/events가 공유하는 데이터 계층.
// 수집·캐시는 lib/sources(fetch Data Cache, 출처별 1시간)에서 처리하고,
// 여기서는 도메인 모델 변환과 필터만 담당한다.

interface QueryOptions {
  categories?: CategoryEnum[];
  types?: EventTypeEnum[];
  query?: string;
}

function toCareerEvent(item: CollectedEvent): CareerEvent {
  return {
    id: `${item.source}:${item.externalId}`,
    title: item.title,
    category: item.category,
    type: item.type,
    startDate: item.startDate,
    endDate: item.endDate,
    allDay: item.allDay,
    registrationStart: item.registrationStart,
    registrationEnd: item.registrationEnd,
    organizer: item.organizer,
    location: item.location,
    isOnline: item.isOnline,
    fee: item.fee,
    link: item.link,
    description: item.description,
    sourceLabel: getSourceById(item.source)?.label,
  };
}

function applyFilters(
  events: CareerEvent[],
  { categories, types, query }: QueryOptions,
): CareerEvent[] {
  const q = query?.trim().toLowerCase();
  return events.filter((e) => {
    if (categories?.length && !categories.includes(e.category)) return false;
    if (types?.length && !types.includes(e.type)) return false;
    if (q) {
      const haystack =
        `${e.title} ${e.organizer} ${e.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function getEventsPayload(
  opts: QueryOptions = {},
): Promise<EventsPayload> {
  const { events, sources } = await collectFromAllSources();
  const filtered = applyFilters(events.map(toCareerEvent), opts);

  return {
    events: filtered,
    total: filtered.length,
    // 오류 상세는 서버 로그에만 남기고 클라이언트에는 상태만 내려보낸다.
    sources: sources.map(({ id, label, ok, count, fetchedAt }) => ({
      id,
      label,
      ok,
      count,
      fetchedAt,
    })),
    generatedAt: new Date().toISOString(),
  };
}
