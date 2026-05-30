"use client";

import { Compass, Menu, Search, User } from "lucide-react";
import { useFilterStore } from "@/lib/store";
import { useUIStore } from "@/lib/uiStore";

export function Header() {
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const toggleMobileMenu = useUIStore((s) => s.toggleMobileMenu);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6">
        <button
          type="button"
          onClick={toggleMobileMenu}
          aria-label="메뉴 열기"
          className="lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm shadow-blue-500/20">
            <Compass className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Career Compass
            </div>
            <div className="hidden sm:block text-[11px] text-slate-500">
              대학생 진로 캘린더
            </div>
          </div>
        </div>

        <div className="hidden lg:block lg:ml-4 lg:flex-1 lg:max-w-xl">
          <SearchInput value={searchQuery} onChange={setSearchQuery} />
        </div>

        <button
          type="button"
          className="ml-auto lg:ml-0 flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
          aria-label="사용자 메뉴"
        >
          <User className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      <div className="lg:hidden px-3 pb-3">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
      </div>
    </header>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="이벤트, 주최기관 검색…"
        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}
