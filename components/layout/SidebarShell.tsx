"use client";

import { useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import type { CareerEvent } from "@/lib/types";
import { useUIStore } from "@/lib/uiStore";
import { classNames } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

interface Props {
  events: CareerEvent[];
}

export function SidebarShell({ events }: Props) {
  const open = useUIStore((s) => s.sidebarOpen);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const mobileOpen = useUIStore((s) => s.mobileMenuOpen);
  const setMobileOpen = useUIStore((s) => s.setMobileMenuOpen);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen]);

  return (
    <>
      <aside
        className={classNames(
          "relative hidden shrink-0 border-r border-slate-200 bg-white transition-[width] duration-300 ease-in-out lg:block",
          open ? "w-[30%] min-w-[320px] max-w-[420px]" : "w-0 min-w-0",
        )}
        aria-hidden={!open}
      >
        <div
          className={classNames(
            "h-full overflow-hidden transition-opacity duration-200",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <Sidebar events={events} />
        </div>
      </aside>

      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "사이드바 접기" : "사이드바 펼치기"}
        aria-expanded={open}
        className={classNames(
          "hidden lg:flex absolute top-20 z-30 h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:border-blue-300 hover:text-blue-600",
          open ? "left-[calc(min(30%,420px)-16px)]" : "left-2",
        )}
      >
        {open ? (
          <PanelLeftClose className="h-4 w-4" />
        ) : (
          <PanelLeftOpen className="h-4 w-4" />
        )}
      </button>

      <div
        className={classNames(
          "lg:hidden fixed inset-0 z-50 transition-opacity duration-200",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={classNames(
            "absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label="필터 메뉴"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <span className="text-sm font-semibold text-slate-900">메뉴</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="메뉴 닫기"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <Sidebar events={events} />
          </div>
        </aside>
      </div>
    </>
  );
}
