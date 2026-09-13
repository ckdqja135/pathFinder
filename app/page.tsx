import { getEventsPayload } from "@/lib/events-data";
import { EventsClient } from "@/components/EventsClient";

// 페이지도 /api/events와 동일한 공통 수집·캐시 계층을 사용한다.
// 렌더링은 요청 시점이지만, 외부 수집은 출처별 1시간 fetch 캐시를 공유하므로
// 캐시가 채워진 뒤에는 SSR이 캐시 응답으로 즉시 완료된다.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const payload = await getEventsPayload();
  return <EventsClient initialPayload={payload} />;
}
