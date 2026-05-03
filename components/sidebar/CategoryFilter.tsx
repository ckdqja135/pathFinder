"use client";

import { ALL_CATEGORIES, CATEGORY_META } from "@/lib/types";
import { useFilterStore } from "@/lib/store";

export function CategoryFilter() {
  const selected = useFilterStore((s) => s.selectedCategories);
  const toggle = useFilterStore((s) => s.toggleCategory);
  const selectAll = useFilterStore((s) => s.selectAllCategories);
  const clear = useFilterStore((s) => s.clearCategories);

  const allOn = selected.length === ALL_CATEGORIES.length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">분야</h2>
        <button
          type="button"
          onClick={() => (allOn ? clear() : selectAll())}
          className="text-xs font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
        >
          {allOn ? "전체 해제" : "전체 선택"}
        </button>
      </div>
      <ul className="space-y-1">
        {ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const checked = selected.includes(cat);
          return (
            <li key={cat}>
              <label className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-200 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(cat)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="text-sm text-slate-700 group-hover:text-slate-900">
                  {meta.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
