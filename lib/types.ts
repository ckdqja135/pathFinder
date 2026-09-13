export type Category =
  | "IT"
  | "DESIGN"
  | "MARKETING"
  | "FINANCE"
  | "BUSINESS"
  | "MEDIA"
  | "PUBLIC"
  | "RESEARCH";

export type EventType =
  | "CONFERENCE"
  | "CERTIFICATION"
  | "JOB_FAIR"
  | "CONTEST";

export interface CareerEvent {
  id: string;
  title: string;
  category: Category;
  type: EventType;
  /** ISO 8601, 항상 +09:00(KST) 오프셋 포함 */
  startDate: string;
  endDate: string;
  /** true면 원문에 시각이 없어 종일(시간 미정)로 취급 */
  allDay?: boolean;
  registrationStart?: string;
  registrationEnd?: string;
  organizer: string;
  /** 빈 문자열이면 장소 미정 */
  location: string;
  isOnline: boolean;
  /** null = 가격 정보 없음(무료와 구분), 0 = 무료 */
  fee: number | null;
  link: string;
  description: string;
  /** 수집 출처 라벨(예: "위비티") — 사용자에게 출처 표기용 */
  sourceLabel?: string;
}

/** 출처별 수집 상태 — API 응답에 포함되어 부분 실패 표시에 쓰인다. */
export interface SourceStatus {
  id: string;
  label: string;
  ok: boolean;
  count: number;
  /** 마지막 수집 성공 시각(ISO). 캐시에서 온 경우 캐시 생성 시각. */
  fetchedAt?: string;
}

export interface EventsPayload {
  events: CareerEvent[];
  total: number;
  sources: SourceStatus[];
  /** 이 스냅샷을 조립한 시각(ISO) */
  generatedAt: string;
}

export const CATEGORY_META: Record<
  Category,
  { label: string; color: string; bg: string; text: string; ring: string; soft: string }
> = {
  IT: {
    label: "IT/개발",
    color: "#3B82F6",
    bg: "bg-blue-500",
    text: "text-blue-700",
    ring: "ring-blue-500",
    soft: "bg-blue-50",
  },
  DESIGN: {
    label: "디자인",
    color: "#A855F7",
    bg: "bg-purple-500",
    text: "text-purple-700",
    ring: "ring-purple-500",
    soft: "bg-purple-50",
  },
  MARKETING: {
    label: "마케팅/광고",
    color: "#EC4899",
    bg: "bg-pink-500",
    text: "text-pink-700",
    ring: "ring-pink-500",
    soft: "bg-pink-50",
  },
  FINANCE: {
    label: "금융/회계",
    color: "#22C55E",
    bg: "bg-green-500",
    text: "text-green-700",
    ring: "ring-green-500",
    soft: "bg-green-50",
  },
  BUSINESS: {
    label: "경영/기획",
    color: "#F97316",
    bg: "bg-orange-500",
    text: "text-orange-700",
    ring: "ring-orange-500",
    soft: "bg-orange-50",
  },
  MEDIA: {
    label: "미디어/콘텐츠",
    color: "#EF4444",
    bg: "bg-red-500",
    text: "text-red-700",
    ring: "ring-red-500",
    soft: "bg-red-50",
  },
  PUBLIC: {
    label: "공공/행정",
    color: "#6B7280",
    bg: "bg-gray-500",
    text: "text-gray-700",
    ring: "ring-gray-500",
    soft: "bg-gray-50",
  },
  RESEARCH: {
    label: "연구/학술",
    color: "#14B8A6",
    bg: "bg-teal-500",
    text: "text-teal-700",
    ring: "ring-teal-500",
    soft: "bg-teal-50",
  },
};

export const TYPE_META: Record<EventType, { label: string; emoji: string }> = {
  CONFERENCE: { label: "컨퍼런스/세미나", emoji: "🎤" },
  CERTIFICATION: { label: "자격증 시험", emoji: "📝" },
  JOB_FAIR: { label: "채용박람회", emoji: "💼" },
  CONTEST: { label: "공모전", emoji: "🏆" },
};

export const ALL_CATEGORIES: Category[] = [
  "IT",
  "DESIGN",
  "MARKETING",
  "FINANCE",
  "BUSINESS",
  "MEDIA",
  "PUBLIC",
  "RESEARCH",
];

export const ALL_TYPES: EventType[] = [
  "CONFERENCE",
  "CERTIFICATION",
  "JOB_FAIR",
  "CONTEST",
];
