"use client";

import { create } from "zustand";
import type { CareerEvent } from "./types";

interface ModalStore {
  selectedEvent: CareerEvent | null;
  open: (event: CareerEvent) => void;
  close: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  selectedEvent: null,
  open: (event) => set({ selectedEvent: event }),
  close: () => set({ selectedEvent: null }),
}));
