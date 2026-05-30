"use client";

import { useCallback, useMemo } from "react";
import type { CareerEvent } from "@/lib/types";
import { useFilterStore } from "@/lib/store";
import { useModalStore } from "@/lib/modalStore";
import { useUIStore } from "@/lib/uiStore";
import { CategoryFilter } from "@/components/sidebar/CategoryFilter";
import { TypeFilter } from "@/components/sidebar/TypeFilter";
import { UpcomingEvents } from "@/components/sidebar/UpcomingEvents";

interface Props {
  events: CareerEvent[];
}

export function Sidebar({ events }: Props) {
  const selectedCategories = useFilterStore((s) => s.selectedCategories);
  const selectedTypes = useFilterStore((s) => s.selectedTypes);
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const openModal = useModalStore((s) => s.open);
  const setMobileOpen = useUIStore((s) => s.setMobileMenuOpen);

  const handleSelectEvent = useCallback(
    (event: CareerEvent) => {
      setMobileOpen(false);
      openModal(event);
    },
    [openModal, setMobileOpen],
  );

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
    <div className="flex h-full flex-col overflow-y-auto p-4 sm:p-5">
      <div className="space-y-6">
        <CategoryFilter />
        <div className="h-px bg-slate-100" />
        <TypeFilter />
        <div className="h-px bg-slate-100" />
        <UpcomingEvents events={filtered} onSelectEvent={handleSelectEvent} />
      </div>
    </div>
  );
}
