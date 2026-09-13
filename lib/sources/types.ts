import type { Category, EventType } from "@/lib/types";

export interface CollectedEvent {
  source: string;
  externalId: string;
  title: string;
  category: Category;
  type: EventType;
  /** ISO 8601, 항상 +09:00(KST) 오프셋 포함 */
  startDate: string;
  endDate: string;
  /** 원문에 시각 정보가 없으면 true (종일/시간 미정으로 표시) */
  allDay?: boolean;
  registrationStart?: string;
  registrationEnd?: string;
  organizer: string;
  /** 빈 문자열 = 장소 미정. 원문에 없는 장소를 만들어 넣지 않는다. */
  location: string;
  isOnline: boolean;
  /** null = 가격 정보 없음(무료와 구분), 0 = 무료 */
  fee: number | null;
  link: string;
  description: string;
}

/** fetch 결과 — 본문과 함께 원 서버 응답 시각(Date 헤더)을 돌려준다.
 *  Next Data Cache에서 재사용될 때 Date 헤더는 캐시 생성 시각으로 남으므로
 *  "마지막 수집 성공 시각"으로 쓸 수 있다. */
export interface FetchedDoc {
  body: string;
  fetchedAt?: string;
}

/** collect()에 주입되는 실행 컨텍스트.
 *  fetchDoc을 주입식으로 두어 테스트에서 고정 샘플로 대체할 수 있게 한다. */
export interface CollectContext {
  fetchDoc: (
    url: string,
    init?: { timeoutMs?: number; headers?: Record<string, string> },
  ) => Promise<FetchedDoc>;
  now: Date;
}

export interface EventSource {
  /** 캐시 태그·event.source에 쓰이는 안정적인 식별자 */
  id: string;
  /** UI 노출용 라벨 */
  label: string;
  /** 출처 대표 URL (관리·문서용) */
  homepage: string;
  /** 수집 방식 (관리·문서용) */
  method: "html" | "markdown";
  /** 기본 분야 — 분류 실패 시 폴백 */
  defaultCategory: Category;
  collect: (ctx: CollectContext) => Promise<CollectedEvent[]>;
}

export interface SourceRunResult {
  id: string;
  label: string;
  ok: boolean;
  count: number;
  fetchedAt?: string;
  /** 서버 로그 전용 — 클라이언트 응답에는 내려보내지 않는다 */
  error?: string;
}
