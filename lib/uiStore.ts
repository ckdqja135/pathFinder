"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  mobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      mobileMenuOpen: false,
      toggleMobileMenu: () =>
        set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
    }),
    {
      name: "career-compass-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    },
  ),
);
