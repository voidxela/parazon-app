import { create } from "zustand";
import type { VoidFissure } from "@parazon/types";

interface AppState {
  /** Whether the initial data hydration from the API has completed. */
  isHydrated: boolean;
  setHydrated: (value: boolean) => void;

  /** Active void fissures fetched from the API. */
  fissures: VoidFissure[];
  setFissures: (fissures: VoidFissure[]) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  isHydrated: false,
  setHydrated: (value) => set({ isHydrated: value }),

  fissures: [],
  setFissures: (fissures) => set({ fissures }),
}));
