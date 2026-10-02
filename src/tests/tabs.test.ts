import { beforeEach, describe, expect, it } from "vitest";
import { activeTab, folderName, tabTitle, useTabs } from "../store/tabs";

function reset() {
  const first = useTabs.getState().tabs[0];
  useTabs.setState({ tabs: [first], activeId: first.id });
}

describe("tabs store", () => {
  beforeEach(reset);

  it("starts with one Home tab", () => {
    const state = useTabs.getState();
    expect(state.tabs).toHaveLength(1);
    expect(activeTab(state).view).toBe("home");
  });

  it("newTab appends and activates", () => {
    const id = useTabs.getState().newTab("settings");
    const state = useTabs.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeId).toBe(id);
    expect(activeTab(state).view).toBe("settings");
  });

  it("closing the active tab activates the right neighbour, else the left", () => {
    const first = useTabs.getState().tabs[0].id;
    const second = useTabs.getState().newTab();
    const third = useTabs.getState().newTab();
    useTabs.getState().activate(second);
    useTabs.getState().closeTab(second);
    expect(useTabs.getState().activeId).toBe(third);
    useTabs.getState().closeTab(third);
    expect(useTabs.getState().activeId).toBe(first);
  });

  it("closing an inactive tab keeps the active one", () => {
    const first = useTabs.getState().tabs[0].id;
    const second = useTabs.getState().newTab();
    useTabs.getState().closeTab(first);
    expect(useTabs.getState().activeId).toBe(second);
    expect(useTabs.getState().tabs).toHaveLength(1);
  });

  it("closing the last tab leaves a fresh Home tab", () => {
    const only = useTabs.getState().tabs[0].id;
    useTabs.getState().setView(only, "settings");
    useTabs.getState().closeTab(only);
    const state = useTabs.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].id).not.toBe(only);
    expect(activeTab(state).view).toBe("home");
  });

  it("next and previous wrap around, activateIndex ignores out of range", () => {
    const first = useTabs.getState().tabs[0].id;
    const second = useTabs.getState().newTab();
    useTabs.getState().next();
    expect(useTabs.getState().activeId).toBe(first);
    useTabs.getState().previous();
    expect(useTabs.getState().activeId).toBe(second);
    useTabs.getState().activateIndex(7);
    expect(useTabs.getState().activeId).toBe(second);
    useTabs.getState().activateIndex(0);
    expect(useTabs.getState().activeId).toBe(first);
  });

  it("titles follow the view", () => {
    expect(tabTitle({ id: "x", view: "home", path: null })).toBe("Home");
    expect(tabTitle({ id: "x", view: "settings", path: null })).toBe("Settings");
    expect(tabTitle({ id: "x", view: "browser", path: "C:/Users/lex/Pictures" })).toBe("Pictures");
    expect(folderName("C:/")).toBe("C:");
  });
});
