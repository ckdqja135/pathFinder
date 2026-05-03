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
  startDate: string;
  endDate: string;
  registrationStart?: string;
  registrationEnd?: string;
  organizer: string;
  location: string;
  isOnline: boolean;
  fee: number;
  link: string;
  description: string;
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
