"use client";

import { CalendarDays, Star } from "lucide-react";
import { useFilterStore } from "@/lib/store";
import { CATEGORY_META, type CareerEvent } from "@/lib/types";
import {
  classNames,
  formatShortDate,
  getDDay,
  getUpcoming,
} from "@/lib/utils";

interface Props {
  events: CareerEvent[];
  onSelectEvent: (event: CareerEvent) => void;
}

export function UpcomingEvents({ events, onSelectEvent }: Props) {
  const upcoming = getUpcoming(events, 5);
  const favorites = useFilterStore((s) => s.favorites);
  const toggleFavorite = useFilterStore((s) => s.toggleFavorite);

  if (upcoming.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          다가오는 일정
        </h2>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <CalendarDays className="mx-auto mb-2 h-6 w-6 text-slate-400" />
          <p className="text-xs text-slate-500">
            현재 필터 조건에 맞는 임박한 일정이 없습니다.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        다가오는 일정
      </h2>
      <ul className="space-y-2">
        {upcoming.map((event) => {
          const meta = CATEGORY_META[event.category];
          const dday = getDDay(event.startDate);
          const isFav = favorites.includes(event.id);
          return (
            <li key={event.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectEvent(event)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectEvent(event);
                  }
                }}
                className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={classNames(
                      "inline-flex h-6 items-center rounded-md px-2 text-[11px] font-bold tracking-tight",
                      dday === "D-Day"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-50 text-blue-700",
                    )}
                  >
                    {dday}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(event.id);
                    }}
                    aria-label={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    className="rounded p-0.5 text-slate-300 transition-colors duration-200 hover:text-yellow-500"
                  >
                    <Star
                      className={classNames(
                        "h-4 w-4",
                        isFav && "fill-yellow-400 text-yellow-400",
                      )}
                    />
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                  {event.title}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatShortDate(event.startDate)}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.color }}
                    aria-hidden
                  />
                  <span className="text-[11px] font-medium text-slate-500">
                    {meta.label}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
