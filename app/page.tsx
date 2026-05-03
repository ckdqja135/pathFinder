import { getAllEvents } from "@/lib/events-data";
import { EventsClient } from "@/components/EventsClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await getAllEvents();
  return <EventsClient initialEvents={events} />;
}
