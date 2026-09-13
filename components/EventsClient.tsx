"use client";

import { useQuery } from "@tanstack/react-query";
import { SidebarShell } from "@/components/layout/SidebarShell";
import { CalendarPanel } from "@/components/calendar/CalendarPanel";
import { eventsQueryKey, fetchEventsPayload } from "@/lib/api";
import type { EventsPayload } from "@/lib/types";

interface Props {
  initialPayload: EventsPayload;
}

export function EventsClient({ initialPayload }: Props) {
  const { data: payload = initialPayload, isFetching } = useQuery({
    queryKey: eventsQueryKey,
    queryFn: fetchEventsPayload,
    initialData: initialPayload,
  });

  return (
    <div className="relative flex w-full h-full">
      <SidebarShell events={payload.events} />
      <section className="flex-1 min-w-0 h-full">
        <CalendarPanel
          events={payload.events}
          sources={payload.sources}
          isFetching={isFetching}
        />
      </section>
    </div>
  );
}
