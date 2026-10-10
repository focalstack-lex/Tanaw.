// The fixed bindings of spec 7.3. Later pieces append their own commands
// through registerCommands.
import { registerCommands, listCommands, type Command } from "./commands";
import { copyPaths, openWithEntry, reloadTab, revealEntry } from "./fileActions";
import { parentPath } from "./paths";
import { selectAll } from "./selection";
import { useListings } from "../store/listings";
import { usePanel } from "../store/panel";
import { useSelection } from "../store/selection";
import { useSettings } from "../store/settings";
import { activeTab, useTabs } from "../store/tabs";
import { useUi } from "../store/ui";
import type { Entry, SortKey } from "../types";

export function buildAppCommands(): Command[] {
  const tabs = () => useTabs.getState();
  const settings = () => useSettings.getState();
  const current = () => activeTab(tabs());
  const browsing = () => current().view === "browser" && Boolean(current().path);
  const listing = () => useListings.getState().byTab[current().id]?.listing ?? null;
  const focused = (): Entry | null => {
    const selection = useSelection.getState().of(current().id);
    return browsing() && selection.selected.size > 0 ? (listing()?.entries[selection.focus] ?? null) : null;
  };
  const selectedPaths = () => [...useSelection.getState().of(current().id).selected];
  const sortBy = (key: SortKey, title: string): Command => ({
    id: `sort.${key}`,
    title,
    group: "view",
    when: browsing,
    run: () => tabs().setSort(current().id, { key, dir: "asc" }),
  });

  const commands: Command[] = [
    { id: "tab.new", title: "New tab", group: "tabs", shortcut: "Ctrl+T", global: true, run: () => { tabs().newTab("home"); } },
    { id: "tab.close", title: "Close tab", group: "tabs", shortcut: "Ctrl+W", global: true, run: () => tabs().closeTab(tabs().activeId) },
    { id: "tab.next", title: "Next tab", group: "tabs", shortcut: "Ctrl+Tab", global: true, run: () => tabs().next() },
    { id: "tab.previous", title: "Previous tab", group: "tabs", shortcut: "Ctrl+Shift+Tab", global: true, run: () => tabs().previous() },
    { id: "nav.home", title: "Go to Home", group: "navigate", run: () => tabs().setView(tabs().activeId, "home") },
    { id: "nav.back", title: "Go back", group: "navigate", shortcut: "Alt+Left", when: () => browsing() && current().history.back.length > 0, run: () => tabs().goBack(current().id) },
    { id: "nav.forward", title: "Go forward", group: "navigate", shortcut: "Alt+Right", when: () => browsing() && current().history.forward.length > 0, run: () => tabs().goForward(current().id) },
    { id: "nav.up", title: "Go to the parent folder", group: "navigate", shortcut: "Alt+Up", when: () => browsing() && parentPath(current().path ?? "") !== null, run: () => tabs().goUp(current().id) },
    { id: "nav.path", title: "Edit the folder path", group: "navigate", shortcut: "Ctrl+L", when: browsing, run: () => useUi.getState().requestPathEdit() },
    { id: "app.palette", title: "Command palette", group: "app", shortcut: "Ctrl+K", global: true, run: () => useUi.getState().openPalette() },
    { id: "app.settings", title: "Open settings", group: "app", shortcut: "Ctrl+Comma", global: true, run: () => tabs().setView(tabs().activeId, "settings") },
    { id: "panel.toggle", title: "Show or hide the side panel", group: "view", shortcut: "Ctrl+Shift+E", run: () => usePanel.getState().toggle() },
    { id: "view.toggleHidden", title: "Show or hide hidden files", group: "view", shortcut: "Ctrl+H", run: () => settings().update("showHidden", !settings().settings.showHidden) },
    { id: "view.list", title: "Show as a list", group: "view", shortcut: "Ctrl+Shift+1", when: browsing, run: () => tabs().setViewMode(current().id, "list") },
    { id: "view.grid", title: "Show as a grid", group: "view", shortcut: "Ctrl+Shift+2", when: browsing, run: () => tabs().setViewMode(current().id, "grid") },
    { id: "view.refresh", title: "Refresh", group: "view", shortcut: "F5", when: browsing, run: () => reloadTab(current().id) },
    sortBy("name", "Sort by name"),
    sortBy("modified", "Sort by date modified"),
    sortBy("kind", "Sort by type"),
    sortBy("size", "Sort by size"),
    {
      id: "edit.selectAll",
      title: "Select all",
      group: "edit",
      shortcut: "Ctrl+A",
      when: () => browsing() && listing() !== null,
      run: () => {
        const entries = listing()?.entries ?? [];
        useSelection.getState().put(current().id, selectAll(entries.map((entry) => entry.path)));
      },
    },
    { id: "file.openWith", title: "Open with", group: "files", when: () => focused()?.kind === "file", run: async () => { const entry = focused(); if (entry) await openWithEntry(entry); } },
    { id: "file.reveal", title: "Show in Explorer", group: "files", when: () => focused() !== null, run: async () => { const entry = focused(); if (entry) await revealEntry(entry); } },
    { id: "file.copyPath", title: "Copy path", group: "files", when: () => browsing() && selectedPaths().length > 0, run: () => copyPaths(selectedPaths()) },
    { id: "theme.system", title: "Follow the Windows theme", group: "app", run: () => settings().update("theme", "system") },
    { id: "theme.light", title: "Use the light theme", group: "app", run: () => settings().update("theme", "light") },
    { id: "theme.dark", title: "Use the dark theme", group: "app", run: () => settings().update("theme", "dark") },
  ];

  for (let n = 1; n <= 9; n += 1) {
    commands.push({
      id: `tab.select.${n}`,
      title: `Switch to tab ${n}`,
      group: "tabs",
      shortcut: `Ctrl+${n}`,
      global: true,
      run: () => tabs().activateIndex(n - 1),
    });
  }

  return commands;
}

/** Registers once; React StrictMode mounts twice in development. */
export function ensureAppCommands(): void {
  if (listCommands().length === 0) registerCommands(buildAppCommands());
}
