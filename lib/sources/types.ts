import type { Category, EventType } from "@/lib/types";

export interface CollectedEvent {
  source: string;
  externalId: string;
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

export interface EventSource {
  name: string;
  collect: () => Promise<CollectedEvent[]>;
}
