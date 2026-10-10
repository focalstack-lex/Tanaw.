import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_SELECTION } from "../lib/selection";
import { useListings } from "../store/listings";
import { useSelection } from "../store/selection";
import { startTabSync } from "../store/tabSync";
import { useTabs } from "../store/tabs";

const picked = { selected: new Set(["C:\\A\\one.txt"]), anchor: 0, focus: 0 };

let stop: () => void;

function reset() {
  const first = useTabs.getState().tabs[0];
  useTabs.setState({ tabs: [first], activeId: first.id });
  useSelection.setState({ byTab: {} });
  useListings.setState({ byTab: {} });
}

describe("tab sync", () => {
  beforeEach(() => {
    reset();
    stop = startTabSync();
  });
  afterEach(() => stop());

  it("clears the selection when the tab navigates", () => {
    const id = useTabs.getState().newTab("browser", "C:\\A");
    useSelection.getState().put(id, picked);
    useTabs.getState().navigate(id, "C:\\B");
    expect(useSelection.getState().of(id)).toBe(EMPTY_SELECTION);
  });

  it("clears the selection on goBack and on setView to home", () => {
    const id = useTabs.getState().newTab("browser", "C:\\A");
    useTabs.getState().navigate(id, "C:\\B");
    useSelection.getState().put(id, picked);
    useTabs.getState().goBack(id);
    expect(useSelection.getState().of(id)).toBe(EMPTY_SELECTION);
    useSelection.getState().put(id, picked);
    useTabs.getState().setView(id, "home");
    expect(useSelection.getState().of(id)).toBe(EMPTY_SELECTION);
  });

  it("keeps the selection of a tab whose path and view did not change", () => {
    const id = useTabs.getState().newTab("browser", "C:\\A");
    useSelection.getState().put(id, picked);
    useTabs.getState().setSort(id, { key: "size", dir: "desc" });
    useTabs.getState().navigate(id, "c:\\a");
    expect(useSelection.getState().of(id)).toBe(picked);
  });

  it("drops the listing and selection of a closed tab", () => {
    const id = useTabs.getState().newTab("browser", "C:\\A");
    useSelection.getState().put(id, picked);
    useListings.setState({ byTab: { [id]: { path: "C:\\A", status: "loading", listing: null, error: null, request: 1 } } });
    useTabs.getState().closeTab(id);
    expect(useSelection.getState().byTab[id]).toBeUndefined();
    expect(useListings.getState().byTab[id]).toBeUndefined();
  });
});
