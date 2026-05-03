"use client";

import { Compass, Search, User } from "lucide-react";
import { useFilterStore } from "@/lib/store";

export function Header() {
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="flex h-16 items-center gap-4 px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 text-white">
            <Compass className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold text-slate-900">
              Career Compass
            </div>
            <div className="text-[11px] text-slate-500">
              대학생 진로 캘린더
            </div>
          </div>
        </div>

        <div className="ml-6 flex-1 max-w-xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이벤트, 주최기관 검색…"
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900"
          aria-label="사용자 메뉴"
        >
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
