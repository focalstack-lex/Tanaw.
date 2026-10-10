import { beforeEach, describe, expect, it } from "vitest";
import { activeTab, useTabs } from "../store/tabs";

function reset() {
  const first = useTabs.getState().tabs[0];
  useTabs.setState({ tabs: [{ ...first, view: "home", path: null, history: { back: [], forward: [] } }], activeId: first.id });
  return first.id;
}

describe("per-tab navigation", () => {
  let id = "";
  beforeEach(() => { id = reset(); });

  it("navigate opens the browser and records history", () => {
    useTabs.getState().navigate(id, "C:\\");
    useTabs.getState().navigate(id, "C:\\Users");
    const tab = activeTab(useTabs.getState());
    expect(tab.view).toBe("browser");
    expect(tab.path).toBe("C:\\Users");
    expect(tab.history.back).toEqual(["C:\\"]);
  });

  it("back and forward move through history; a new navigation clears forward", () => {
    const tabs = () => useTabs.getState();
    tabs().navigate(id, "C:\\");
    tabs().navigate(id, "C:\\Users");
    tabs().navigate(id, "C:\\Users\\dev");
    tabs().goBack(id);
    expect(activeTab(tabs()).path).toBe("C:\\Users");
    tabs().goBack(id);
    expect(activeTab(tabs()).path).toBe("C:\\");
    tabs().goForward(id);
    expect(activeTab(tabs()).path).toBe("C:\\Users");
    tabs().navigate(id, "D:\\");
    expect(activeTab(tabs()).history.forward).toEqual([]);
  });

  it("up goes to the parent and stops at the root; same-path navigation adds nothing", () => {
    const tabs = () => useTabs.getState();
    tabs().navigate(id, "C:\\Users\\dev");
    tabs().goUp(id);
    expect(activeTab(tabs()).path).toBe("C:\\Users");
    tabs().goUp(id);
    tabs().goUp(id);
    expect(activeTab(tabs()).path).toBe("C:\\");
    const backBefore = activeTab(tabs()).history.back.length;
    tabs().navigate(id, "c:\\");
    expect(activeTab(tabs()).history.back.length).toBe(backBefore);
  });

  it("sort and view mode belong to the tab", () => {
    useTabs.getState().setSort(id, { key: "size", dir: "desc" });
    useTabs.getState().setViewMode(id, "grid");
    const tab = activeTab(useTabs.getState());
    expect(tab.sort).toEqual({ key: "size", dir: "desc" });
    expect(tab.viewMode).toBe("grid");
  });
});
