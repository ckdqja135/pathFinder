"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
    </>
  );
}
