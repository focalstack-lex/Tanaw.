// Per-tab folder listings. A newer load for the same tab wins over an older
// one that answers late, and a reload of the same folder keeps its rows on
// screen until the new answer arrives.
import { create } from "zustand";
import { ipc, toFilewellError } from "../lib/ipc";
import type { DirListing, FilewellError, Sort } from "../types";

export interface ListingState {
  path: string;
  status: "loading" | "ready" | "error";
  listing: DirListing | null;
  error: FilewellError | null;
  request: number;
}

interface ListingsStore {
  byTab: Record<string, ListingState>;
  load: (tabId: string, path: string, showHidden: boolean, sort: Sort) => Promise<void>;
  forget: (tabId: string) => void;
}

let nextRequest = 0;

export const useListings = create<ListingsStore>((set, get) => ({
  byTab: {},

  load: async (tabId, path, showHidden, sort) => {
    nextRequest += 1;
    const request = nextRequest;
    const previous = get().byTab[tabId];
    const kept = previous && previous.path === path ? previous.listing : null;
    set((state) => ({ byTab: { ...state.byTab, [tabId]: { path, status: "loading", listing: kept, error: null, request } } }));
    try {
      const listing = await ipc.listDir(path, showHidden, sort);
      if (get().byTab[tabId]?.request !== request) return;
      set((state) => ({ byTab: { ...state.byTab, [tabId]: { path, status: "ready", listing, error: null, request } } }));
    } catch (raw) {
      if (get().byTab[tabId]?.request !== request) return;
      const error = toFilewellError(raw);
      set((state) => ({ byTab: { ...state.byTab, [tabId]: { path, status: "error", listing: null, error, request } } }));
    }
  },

  forget: (tabId) =>
    set((state) => {
      const byTab = { ...state.byTab };
      delete byTab[tabId];
      return { byTab };
    }),
}));
