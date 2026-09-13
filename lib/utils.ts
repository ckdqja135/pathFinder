import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import type { CareerEvent } from "./types";

export function classNames(
  ...classes: Array<string | undefined | false | null>
) {
  return classes.filter(Boolean).join(" ");
}

export function getDDay(targetISO: string, fromDate: Date = new Date()) {
  const date = parseISO(targetISO);
  if (!isValid(date)) return null;
  const diff = differenceInCalendarDays(date, fromDate);
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

export function formatRange(
  startISO: string,
  endISO: string,
  allDay = false,
) {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (!isValid(start) || !isValid(end)) return "";
  const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
  if (sameDay) {
    if (allDay) {
      // 원문에 시각 정보가 없는 행사 — 시각을 만들어 표시하지 않는다.
      return `${format(start, "yyyy.MM.dd (EEE)", { locale: ko })} · 시간 미정`;
    }
    return `${format(start, "yyyy.MM.dd (EEE)", { locale: ko })}  ${format(
      start,
      "HH:mm",
    )} – ${format(end, "HH:mm")}`;
  }
  return `${format(start, "yyyy.MM.dd", { locale: ko })} – ${format(
    end,
    "yyyy.MM.dd",
    { locale: ko },
  )}`;
}

export function formatCollectedTime(iso: string) {
  const d = parseISO(iso);
  if (!isValid(d)) return "";
  return format(d, "M월 d일 HH:mm", { locale: ko });
}

export function formatShortDate(iso: string) {
  const d = parseISO(iso);
  if (!isValid(d)) return "";
  return format(d, "M월 d일 (EEE)", { locale: ko });
}

export function getUpcoming(events: CareerEvent[], limit = 5): CareerEvent[] {
  const now = new Date();
  return [...events]
    .filter((e) => parseISO(e.startDate) >= startOfDay(now))
    .sort(
      (a, b) =>
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(),
    )
    .slice(0, limit);
}

function startOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function formatFee(fee: number | null) {
  if (fee === null) return "가격 정보 없음";
  if (fee === 0) return "무료";
  return `${fee.toLocaleString("ko-KR")}원`;
}
