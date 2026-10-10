import { create } from "zustand";
import { EMPTY_SELECTION, type Selection } from "../lib/selection";

interface SelectionStore {
  byTab: Record<string, Selection>;
  of: (tabId: string) => Selection;
  put: (tabId: string, selection: Selection) => void;
}

export const useSelection = create<SelectionStore>((set, get) => ({
  byTab: {},
  of: (tabId) => get().byTab[tabId] ?? EMPTY_SELECTION,
  put: (tabId, selection) => set((state) => ({ byTab: { ...state.byTab, [tabId]: selection } })),
}));
