// Types that cross the IPC boundary. They mirror the Rust structs in
// src-tauri/src (serde renames every field to camelCase).

export type Theme = "system" | "light" | "dark";
export type ViewMode = "list" | "grid";
export type PanelTab = "preview" | "notes" | "todos";

export interface Settings {
  theme: Theme;
  showHidden: boolean;
  defaultView: ViewMode;
  checkUpdates: boolean;
  panelWidth: number;
  panelTab: PanelTab;
  sidebarWidth: number;
}

export type SettingKey = keyof Settings;

export interface AppInfo {
  version: string;
  dataDir: string;
  databaseRecovered: boolean;
}

export type ErrorCode =
  | "notFound"
  | "permissionDenied"
  | "alreadyExists"
  | "invalidPath"
  | "invalidName"
  | "protected"
  | "cancelled"
  | "io"
  | "db"
  | "validation"
  | "unsupported";

export interface TanawError {
  code: ErrorCode;
  message: string;
  path?: string;
}
