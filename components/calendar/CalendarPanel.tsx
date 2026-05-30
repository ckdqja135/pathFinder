"use client";

import { useMemo } from "react";
import type { CareerEvent } from "@/lib/types";
import { useFilterStore } from "@/lib/store";
import { useModalStore } from "@/lib/modalStore";
import { CalendarView } from "./CalendarView";
import { EventModal } from "./EventModal";

interface Props {
  events: CareerEvent[];
}

export function CalendarPanel({ events }: Props) {
  const selectedCategories = useFilterStore((s) => s.selectedCategories);
  const selectedTypes = useFilterStore((s) => s.selectedTypes);
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const openModal = useModalStore((s) => s.open);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((e) => {
      if (!selectedCategories.includes(e.category)) return false;
      if (!selectedTypes.includes(e.type)) return false;
      if (q) {
        const haystack = `${e.title} ${e.organizer} ${e.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, selectedCategories, selectedTypes, searchQuery]);

  return (
    <div className="flex h-full flex-col p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            진로 캘린더
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500">
            현재 {filtered.length}개의 이벤트가 표시되고 있습니다.
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 sm:p-4 shadow-sm">
        <CalendarView events={filtered} onSelectEvent={openModal} />
      </div>
      <EventModal />
    </div>
  );
}
