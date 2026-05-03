"use client";

import { useQuery } from "@tanstack/react-query";
import { SidebarShell } from "@/components/layout/SidebarShell";
import { CalendarPanel } from "@/components/calendar/CalendarPanel";
import { eventsQueryKey, fetchEvents } from "@/lib/api";
import type { CareerEvent } from "@/lib/types";

interface Props {
  initialEvents: CareerEvent[];
}

export function EventsClient({ initialEvents }: Props) {
  const { data: events = initialEvents } = useQuery({
    queryKey: eventsQueryKey,
    queryFn: fetchEvents,
    initialData: initialEvents,
  });

  return (
    <div className="relative flex w-full">
      <SidebarShell events={events} />
      <section className="flex-1 min-w-0">
        <CalendarPanel events={events} />
      </section>
    </div>
  );
}
