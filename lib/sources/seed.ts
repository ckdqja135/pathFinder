import { mockEvents } from "@/data/mockEvents";
import type { EventSource } from "./types";

// Bootstrap source so the DB has demo data on first sync.
// Replace/extend with real scrapers (q-net, feconf, ssafy, ...) over time.
export const seedSource: EventSource = {
  name: "seed",
  async collect() {
    return mockEvents.map((e) => ({
      source: "seed",
      externalId: e.id,
      title: e.title,
      category: e.category,
      type: e.type,
      startDate: e.startDate,
      endDate: e.endDate,
      registrationStart: e.registrationStart,
      registrationEnd: e.registrationEnd,
      organizer: e.organizer,
      location: e.location,
      isOnline: e.isOnline,
      fee: e.fee,
      link: e.link,
      description: e.description,
    }));
  },
};
