"use client";

import { classNames } from "@/lib/utils";

export type CalendarViewName = "month" | "week" | "day" | "list";

interface Props {
  value: CalendarViewName;
  onChange: (next: CalendarViewName) => void;
}

const OPTIONS: Array<{ value: CalendarViewName; label: string }> = [
  { value: "month", label: "월간" },
  { value: "week", label: "주간" },
  { value: "day", label: "일간" },
  { value: "list", label: "리스트" },
];

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:p-1">
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={classNames(
              "rounded-md px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-all duration-200",
              active
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
