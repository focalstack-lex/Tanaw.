import { create } from "zustand";

export type TabView = "home" | "browser" | "trash" | "settings";

export interface Tab {
  id: string;
  view: TabView;
  /** The folder a browser tab shows; null for every other view. */
  path: string | null;
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
}

function makeTab(view: TabView, path: string | null): Tab {
  return { id: crypto.randomUUID(), view, path };
}

/** Last path segment, for tab titles. Accepts both separators Windows users type. */
export function folderName(path: string): string {
  const segments = path.split(/[/\u005c]+/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : path;
}

export function tabTitle(tab: Tab): string {
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

  setView: (id, view, path = null) =>
    set((state) => ({ tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, view, path } : tab)) })),
}));
