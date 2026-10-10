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

export interface FilewellError {
  code: ErrorCode;
  message: string;
  path?: string;
}

// Browsing (piece 2a). Mirrors src-tauri/src/fs/listing.rs and shell.rs.

export type EntryKind = "file" | "dir";

export interface Entry {
  name: string;
  path: string;
  /** The link target's kind: a link to a folder opens like a folder. */
  kind: EntryKind;
  size: number;
  modified: number;
  created: number;
  hidden: boolean;
  readonly: boolean;
  isLink: boolean;
  /** Lowercase extension without the dot; empty for folders. */
  ext: string;
}

export interface DirListing {
  path: string;
  entries: Entry[];
  total: number;
  truncated: boolean;
  skipped: number;
}

export type SortKey = "name" | "size" | "modified" | "kind";
export type SortDir = "asc" | "desc";

export interface Sort {
  key: SortKey;
  dir: SortDir;
}

export interface Drive {
  mountPoint: string;
  label: string;
  totalBytes: number;
  availableBytes: number;
  kind: "fixed" | "removable";
}

export interface KnownFolder {
  id: string;
  label: string;
  path: string;
}
