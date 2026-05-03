"use client";

import { ALL_TYPES, TYPE_META } from "@/lib/types";
import { useFilterStore } from "@/lib/store";

export function TypeFilter() {
  const selected = useFilterStore((s) => s.selectedTypes);
  const toggle = useFilterStore((s) => s.toggleType);
  const selectAll = useFilterStore((s) => s.selectAllTypes);
  const clear = useFilterStore((s) => s.clearTypes);

  const allOn = selected.length === ALL_TYPES.length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">이벤트 타입</h2>
        <button
          type="button"
          onClick={() => (allOn ? clear() : selectAll())}
          className="text-xs font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
        >
          {allOn ? "전체 해제" : "전체 선택"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ALL_TYPES.map((type) => {
          const meta = TYPE_META[type];
          const checked = selected.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              aria-pressed={checked}
              className={
                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-200 " +
                (checked
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")
              }
            >
              <span aria-hidden>{meta.emoji}</span>
              <span className="truncate">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
