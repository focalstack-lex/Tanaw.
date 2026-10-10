import { create } from "zustand";
import { parentPath, samePath } from "../lib/paths";
import type { Sort, ViewMode } from "../types";

export type TabView = "home" | "browser" | "trash" | "settings";

export interface TabHistory {
  back: string[];
  forward: string[];
}

export interface Tab {
  id: string;
  view: TabView;
  /** The folder a browser tab shows; null for every other view. */
  path: string | null;
  history: TabHistory;
  sort: Sort;
  /** null follows the defaultView setting. */
  viewMode: ViewMode | null;
}

interface TabsState {
  tabs: Tab[];
  activeId: string;
  newTab: (view?: TabView, path?: string | null) => string;
  closeTab: (id: string) => void;
  activate: (id: string) => void;
  activateIndex: (index: number) => void;
  next: () => void;
  previous: () => void;
  setView: (id: string, view: TabView, path?: string | null) => void;
  navigate: (id: string, path: string) => void;
  goBack: (id: string) => void;
  goForward: (id: string) => void;
  goUp: (id: string) => void;
  setSort: (id: string, sort: Sort) => void;
  setViewMode: (id: string, mode: ViewMode) => void;
}

export const DEFAULT_SORT: Sort = { key: "name", dir: "asc" };

function makeTab(view: TabView, path: string | null): Tab {
  return { id: crypto.randomUUID(), view, path, history: { back: [], forward: [] }, sort: DEFAULT_SORT, viewMode: null };
}

/** Last path segment, for tab titles. Accepts both separators Windows users type. */
export function folderName(path: string): string {
  const segments = path.split(/[\\/]+/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : path;
}

export function tabTitle(tab: Pick<Tab, "view" | "path"> & { id?: string }): string {
  switch (tab.view) {
    case "home":
      return "Home";
    case "settings":
      return "Settings";
    case "trash":
      return "Recycle Bin";
    case "browser":
      return tab.path ? folderName(tab.path) : "Browse";
  }
}

export function activeTab(state: Pick<TabsState, "tabs" | "activeId">): Tab {
  return state.tabs.find((tab) => tab.id === state.activeId) ?? state.tabs[0];
}

function update(tabs: Tab[], id: string, change: (tab: Tab) => Tab): Tab[] {
  return tabs.map((tab) => (tab.id === id ? change(tab) : tab));
}

/** Moves a tab to a folder, recording where it was so Back can return. */
function goTo(tab: Tab, path: string): Tab {
  if (tab.view === "browser" && tab.path && samePath(tab.path, path)) return tab;
  const back = tab.view === "browser" && tab.path ? [...tab.history.back, tab.path] : tab.history.back;
  return { ...tab, view: "browser", path, history: { back, forward: [] } };
}

const first = makeTab("home", null);

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [first],
  activeId: first.id,

  newTab: (view = "home", path = null) => {
    const tab = makeTab(view, path);
    set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
    return tab.id;
  },

  closeTab: (id) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index === -1) return state;
      const remaining = state.tabs.filter((tab) => tab.id !== id);
      // Never zero tabs: the last close leaves a fresh Home.
      if (remaining.length === 0) {
        const fresh = makeTab("home", null);
        return { tabs: [fresh], activeId: fresh.id };
      }
      if (state.activeId !== id) return { tabs: remaining };
      // The right neighbour slid into this index; at the end, the left one.
      const neighbour = remaining[Math.min(index, remaining.length - 1)];
      return { tabs: remaining, activeId: neighbour.id };
    }),

  activate: (id) => set((state) => (state.tabs.some((tab) => tab.id === id) ? { activeId: id } : state)),

  activateIndex: (index) => {
    const tab = get().tabs[index];
    if (tab) set({ activeId: tab.id });
  },

  next: () => {
    const { tabs, activeId } = get();
    const index = tabs.findIndex((tab) => tab.id === activeId);
    set({ activeId: tabs[(index + 1) % tabs.length].id });
  },

  previous: () => {
    const { tabs, activeId } = get();
    const index = tabs.findIndex((tab) => tab.id === activeId);
    set({ activeId: tabs[(index - 1 + tabs.length) % tabs.length].id });
  },

  setView: (id, view, path = null) => set((state) => ({ tabs: update(state.tabs, id, (tab) => ({ ...tab, view, path })) })),

  navigate: (id, path) => set((state) => ({ tabs: update(state.tabs, id, (tab) => goTo(tab, path)) })),

  goBack: (id) =>
    set((state) => ({
      tabs: update(state.tabs, id, (tab) => {
        const target = tab.history.back[tab.history.back.length - 1];
        if (tab.view !== "browser" || !tab.path || target === undefined) return tab;
        return { ...tab, path: target, history: { back: tab.history.back.slice(0, -1), forward: [tab.path, ...tab.history.forward] } };
      }),
    })),

  goForward: (id) =>
    set((state) => ({
      tabs: update(state.tabs, id, (tab) => {
        const [target, ...remaining] = tab.history.forward;
        if (tab.view !== "browser" || !tab.path || target === undefined) return tab;
        return { ...tab, path: target, history: { back: [...tab.history.back, tab.path], forward: remaining } };
      }),
    })),

  goUp: (id) =>
    set((state) => ({
      tabs: update(state.tabs, id, (tab) => {
        const parent = tab.view === "browser" && tab.path ? parentPath(tab.path) : null;
        return parent ? goTo(tab, parent) : tab;
      }),
    })),

  setSort: (id, sort) => set((state) => ({ tabs: update(state.tabs, id, (tab) => ({ ...tab, sort })) })),

  setViewMode: (id, mode) => set((state) => ({ tabs: update(state.tabs, id, (tab) => ({ ...tab, viewMode: mode })) })),
}));
