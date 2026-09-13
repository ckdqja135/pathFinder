"use client";

import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput } from "@fullcalendar/core";
import koLocale from "@fullcalendar/core/locales/ko";
import { CATEGORY_META, TYPE_META, type CareerEvent } from "@/lib/types";
import { ViewToggle, type CalendarViewName } from "./ViewToggle";

interface Props {
  events: CareerEvent[];
  onSelectEvent: (event: CareerEvent) => void;
}

const VIEW_MAP: Record<CalendarViewName, string> = {
  month: "dayGridMonth",
  week: "timeGridWeek",
  day: "timeGridDay",
  list: "listMonth",
};

function hexWithAlpha(hex: string, alpha: number) {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

export function CalendarView({ events, onSelectEvent }: Props) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [view, setView] = useState<CalendarViewName>("month");

  const fcEvents = useMemo<EventInput[]>(() => {
    const items: EventInput[] = [];

    // 시간 미정(allDay) 행사는 날짜 문자열만 넘겨 타임존 변환으로 날짜가
    // 밀리는 일을 막는다. FullCalendar의 allDay end는 exclusive라 +1일.
    const allDayRange = (event: CareerEvent) => {
      const startDay = event.startDate.slice(0, 10);
      const endDay = event.endDate.slice(0, 10);
      if (startDay === endDay) {
        return { start: startDay, end: undefined, allDay: true as const };
      }
      const exclusiveEnd = new Date(`${endDay}T00:00:00Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      return {
        start: startDay,
        end: exclusiveEnd.toISOString().slice(0, 10),
        allDay: true as const,
      };
    };

    for (const event of events) {
      const meta = CATEGORY_META[event.category];
      const timing = event.allDay
        ? allDayRange(event)
        : { start: event.startDate, end: event.endDate, allDay: false as const };

      if (event.type === "CERTIFICATION") {
        // Show registration window in a soft tone, exam day in a strong tone.
        if (event.registrationStart && event.registrationEnd) {
          items.push({
            id: `${event.id}-reg`,
            title: `[접수] ${event.title}`,
            start: event.registrationStart,
            end: event.registrationEnd,
            allDay: false,
            backgroundColor: hexWithAlpha(meta.color, 0.18),
            borderColor: hexWithAlpha(meta.color, 0.18),
            textColor: meta.color,
            extendedProps: { event, kind: "registration" },
          });
        }
        items.push({
          id: `${event.id}-exam`,
          title: `${TYPE_META[event.type].emoji} ${event.title}`,
          start: timing.start,
          end: timing.end,
          allDay: timing.allDay,
          backgroundColor: meta.color,
          borderColor: meta.color,
          textColor: "#ffffff",
          extendedProps: { event, kind: "exam" },
        });
      } else {
        items.push({
          id: event.id,
          title: `${TYPE_META[event.type].emoji} ${event.title}`,
          start: timing.start,
          end: timing.end,
          allDay: timing.allDay,
          backgroundColor: meta.color,
          borderColor: meta.color,
          textColor: "#ffffff",
          extendedProps: { event, kind: "default" },
        });
      }
    }
    return items;
  }, [events]);

  const handleViewChange = (next: CalendarViewName) => {
    setView(next);
    calendarRef.current?.getApi().changeView(VIEW_MAP[next]);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-end">
        <ViewToggle value={view} onChange={handleViewChange} />
      </div>
      <div className="flex-1 min-h-0">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={VIEW_MAP[view]}
          locale={koLocale}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          buttonText={{ today: "오늘" }}
          events={fcEvents}
          height="100%"
          dayMaxEvents={3}
          eventClick={(info) => {
            const ev = info.event.extendedProps.event as CareerEvent | undefined;
            if (ev) onSelectEvent(ev);
          }}
          eventDisplay="block"
          displayEventTime={false}
          firstDay={0}
        />
      </div>
    </div>
  );
}
