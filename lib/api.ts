import type { CareerEvent } from "./types";

export async function fetchEvents(): Promise<CareerEvent[]> {
  const res = await fetch("/api/events", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  const json = (await res.json()) as { events: CareerEvent[] };
  return json.events;
}

export const eventsQueryKey = ["events"] as const;
