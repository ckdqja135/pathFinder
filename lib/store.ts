"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  ALL_CATEGORIES,
  ALL_TYPES,
  type Category,
  type EventType,
} from "./types";

interface FilterStore {
  selectedCategories: Category[];
  selectedTypes: EventType[];
  favorites: string[];
  searchQuery: string;
  toggleCategory: (category: Category) => void;
  toggleType: (type: EventType) => void;
  toggleFavorite: (eventId: string) => void;
  setSearchQuery: (query: string) => void;
  selectAllCategories: () => void;
  clearCategories: () => void;
  selectAllTypes: () => void;
  clearTypes: () => void;
}

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      selectedCategories: [...ALL_CATEGORIES],
      selectedTypes: [...ALL_TYPES],
      favorites: [],
      searchQuery: "",
      toggleCategory: (category) =>
        set((state) => ({
          selectedCategories: state.selectedCategories.includes(category)
            ? state.selectedCategories.filter((c) => c !== category)
            : [...state.selectedCategories, category],
        })),
      toggleType: (type) =>
        set((state) => ({
          selectedTypes: state.selectedTypes.includes(type)
            ? state.selectedTypes.filter((t) => t !== type)
            : [...state.selectedTypes, type],
        })),
      toggleFavorite: (eventId) =>
        set((state) => ({
          favorites: state.favorites.includes(eventId)
            ? state.favorites.filter((id) => id !== eventId)
            : [...state.favorites, eventId],
        })),
      setSearchQuery: (query) => set({ searchQuery: query }),
      selectAllCategories: () =>
        set({ selectedCategories: [...ALL_CATEGORIES] }),
      clearCategories: () => set({ selectedCategories: [] }),
      selectAllTypes: () => set({ selectedTypes: [...ALL_TYPES] }),
      clearTypes: () => set({ selectedTypes: [] }),
    }),
    {
      name: "career-compass-filters",
      storage: createJSONStorage(() => localStorage),
      // v1: EXHIBITION 유형 추가. 이전에 저장된 선택에는 새 유형이 없어 기존
      // 방문자에게 전시/박람회가 꺼진 채로 보이므로, 선택 목록에 켜서 넣는다.
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Partial<FilterStore>;
        if (version < 1 && state.selectedTypes && !state.selectedTypes.includes("EXHIBITION")) {
          state.selectedTypes = [...state.selectedTypes, "EXHIBITION"];
        }
        return state as FilterStore;
      },
      partialize: (state) => ({
        favorites: state.favorites,
        selectedCategories: state.selectedCategories,
        selectedTypes: state.selectedTypes,
      }),
    },
  ),
);
