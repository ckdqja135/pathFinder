import type { EventsPayload } from "./types";

export async function fetchEventsPayload(): Promise<EventsPayload> {
  const res = await fetch("/api/events", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  return (await res.json()) as EventsPayload;
}

export const eventsQueryKey = ["events"] as const;
