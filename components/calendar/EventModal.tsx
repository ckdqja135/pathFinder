"use client";

import { useEffect } from "react";
import {
  Building2,
  Calendar,
  ExternalLink,
  MapPin,
  Star,
  Ticket,
  X,
} from "lucide-react";
import { useModalStore } from "@/lib/modalStore";
import { useFilterStore } from "@/lib/store";
import { CATEGORY_META, TYPE_META } from "@/lib/types";
import {
  classNames,
  formatFee,
  formatRange,
  getDDay,
} from "@/lib/utils";

export function EventModal() {
  const event = useModalStore((s) => s.selectedEvent);
  const close = useModalStore((s) => s.close);
  const favorites = useFilterStore((s) => s.favorites);
  const toggleFavorite = useFilterStore((s) => s.toggleFavorite);

  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, close]);

  if (!event) return null;

  const meta = CATEGORY_META[event.category];
  const typeMeta = TYPE_META[event.type];
  const isFav = favorites.includes(event.id);
  const dday = getDDay(event.startDate);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: meta.color }}
          aria-hidden
        />
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute right-4 top-4 rounded-md p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{
                backgroundColor: `${meta.color}1a`,
                color: meta.color,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: meta.color }}
                aria-hidden
              />
              {meta.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {typeMeta.emoji} {typeMeta.label}
            </span>
            {dday && (
              <span
                className={classNames(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold",
                  dday === "D-Day"
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-50 text-blue-700",
                )}
              >
                {dday}
              </span>
            )}
          </div>

          <h2 className="mt-3 text-xl font-bold text-slate-900">
            {event.title}
          </h2>

          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <Row icon={<Calendar className="h-4 w-4 text-slate-400" />}>
              {formatRange(event.startDate, event.endDate)}
            </Row>
            {event.registrationStart && event.registrationEnd && (
              <Row icon={<Calendar className="h-4 w-4 text-slate-400" />}>
                <span className="text-slate-500">접수기간 · </span>
                {formatRange(event.registrationStart, event.registrationEnd)}
              </Row>
            )}
            <Row icon={<Building2 className="h-4 w-4 text-slate-400" />}>
              {event.organizer}
            </Row>
            <Row icon={<MapPin className="h-4 w-4 text-slate-400" />}>
              {event.location}
              <span
                className={classNames(
                  "ml-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold",
                  event.isOnline
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {event.isOnline ? "온라인" : "오프라인"}
              </span>
            </Row>
            <Row icon={<Ticket className="h-4 w-4 text-slate-400" />}>
              {formatFee(event.fee)}
            </Row>
          </div>

          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
            {event.description}
          </p>

          <div className="mt-5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => toggleFavorite(event.id)}
              className={classNames(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200",
                isFav
                  ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              <Star
                className={classNames(
                  "h-4 w-4",
                  isFav && "fill-yellow-400 text-yellow-400",
                )}
              />
              {isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
            </button>
            <a
              href={event.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-600"
            >
              신청 페이지로 <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
