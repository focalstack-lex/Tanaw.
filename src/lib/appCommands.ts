// The fixed bindings of spec 7.3 that exist in the foundation. Later pieces
// append their own commands through registerCommands.
import { registerCommands, listCommands, type Command } from "./commands";
import { usePanel } from "../store/panel";
import { useSettings } from "../store/settings";
import { useTabs } from "../store/tabs";
import { useUi } from "../store/ui";

export function buildAppCommands(): Command[] {
  const tabs = () => useTabs.getState();
  const settings = () => useSettings.getState();

  const commands: Command[] = [
    { id: "tab.new", title: "New tab", group: "tabs", shortcut: "Ctrl+T", global: true, run: () => { tabs().newTab("home"); } },
    { id: "tab.close", title: "Close tab", group: "tabs", shortcut: "Ctrl+W", global: true, run: () => tabs().closeTab(tabs().activeId) },
    { id: "tab.next", title: "Next tab", group: "tabs", shortcut: "Ctrl+Tab", global: true, run: () => tabs().next() },
    { id: "tab.previous", title: "Previous tab", group: "tabs", shortcut: "Ctrl+Shift+Tab", global: true, run: () => tabs().previous() },
    { id: "nav.home", title: "Go to Home", group: "navigate", run: () => tabs().setView(tabs().activeId, "home") },
    { id: "app.palette", title: "Command palette", group: "app", shortcut: "Ctrl+K", global: true, run: () => useUi.getState().openPalette() },
    { id: "app.settings", title: "Open settings", group: "app", shortcut: "Ctrl+Comma", global: true, run: () => tabs().setView(tabs().activeId, "settings") },
    { id: "panel.toggle", title: "Show or hide the side panel", group: "view", shortcut: "Ctrl+Shift+E", run: () => usePanel.getState().toggle() },
    { id: "view.toggleHidden", title: "Show or hide hidden files", group: "view", shortcut: "Ctrl+H", run: () => settings().update("showHidden", !settings().settings.showHidden) },
    { id: "view.list", title: "Use list view by default", group: "view", shortcut: "Ctrl+Shift+1", run: () => settings().update("defaultView", "list") },
    { id: "view.grid", title: "Use grid view by default", group: "view", shortcut: "Ctrl+Shift+2", run: () => settings().update("defaultView", "grid") },
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
