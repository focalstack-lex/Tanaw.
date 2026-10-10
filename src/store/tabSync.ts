// Keeps per-tab state honest as tabs change. Done as a subscription so the tabs
// store stays free of the selection and listing stores.
import { samePath } from "../lib/paths";
import { useListings } from "./listings";
import { useSelection } from "./selection";
import { useTabs, type Tab } from "./tabs";

function moved(before: Tab, after: Tab): boolean {
  if (before.view !== after.view) return true;
  if (before.path === after.path) return false;
  return before.path === null || after.path === null || !samePath(before.path, after.path);
}

/** Starts the sync once; the returned function stops it. */
export function startTabSync(): () => void {
  return useTabs.subscribe((state, previous) => {
    if (state.tabs === previous.tabs) return;
    const before = new Map(previous.tabs.map((tab) => [tab.id, tab]));
    const after = new Set(state.tabs.map((tab) => tab.id));
    for (const tab of state.tabs) {
      const old = before.get(tab.id);
      if (old && moved(old, tab)) useSelection.getState().clear(tab.id);
    }
    for (const id of before.keys()) {
      if (!after.has(id)) {
        useListings.getState().forget(id);
        useSelection.getState().forget(id);
      }
    }
  });
}
