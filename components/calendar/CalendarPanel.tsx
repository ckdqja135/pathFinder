"use client";

import { useMemo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { CareerEvent, SourceStatus } from "@/lib/types";
import { useFilterStore } from "@/lib/store";
import { useModalStore } from "@/lib/modalStore";
import { formatCollectedTime } from "@/lib/utils";
import { CalendarView } from "./CalendarView";
import { EventModal } from "./EventModal";

interface Props {
  events: CareerEvent[];
  sources: SourceStatus[];
  isFetching?: boolean;
}

export function CalendarPanel({ events, sources, isFetching }: Props) {
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

  const failedSources = sources.filter((s) => !s.ok);
  const allFailed = sources.length > 0 && failedSources.length === sources.length;
  const lastFetchedAt = sources
    .filter((s) => s.ok && s.fetchedAt)
    .map((s) => s.fetchedAt as string)
    .sort()
    .pop();

  const statusText = (() => {
    if (allFailed) return null; // 아래 배너에서 안내
    if (events.length === 0) {
      return "현재 수집된 행사가 없습니다.";
    }
    return `현재 ${filtered.length}개의 이벤트가 표시되고 있습니다.`;
  })();

  return (
    <div className="flex h-full flex-col p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            진로 캘린더
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] sm:text-xs text-slate-500">
            {statusText && <span>{statusText}</span>}
            {lastFetchedAt && (
              <span className="text-slate-400">
                {formatCollectedTime(lastFetchedAt)} 수집
              </span>
            )}
            {isFetching && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                갱신 중
              </span>
            )}
          </p>
        </div>
      </div>

      {allFailed && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs sm:text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            행사 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
          </span>
        </div>
      )}
      {!allFailed && failedSources.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs sm:text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            일부 출처({failedSources.map((s) => s.label).join(", ")})를 불러오지
            못해 해당 행사가 빠져 있을 수 있습니다.
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 sm:p-4 shadow-sm">
        <CalendarView events={filtered} onSelectEvent={openModal} />
      </div>
      <EventModal />
    </div>
  );
}
