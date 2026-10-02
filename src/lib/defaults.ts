import type { Settings } from "../types";

// Mirrors `Settings::default()` in src-tauri/src/data/settings.rs. Used before
// the database answers and by the dev harness.
export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  showHidden: false,
  defaultView: "list",
  checkUpdates: true,
  panelWidth: 320,
  panelTab: "preview",
  sidebarWidth: 220,
};
