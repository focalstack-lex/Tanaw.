// The only file that calls `invoke`. One typed function per Rust command;
// every rejection is normalized to a FilewellError before it reaches a store.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppInfo, DirListing, Drive, Entry, FilewellError, KnownFolder, SettingKey, Settings, Sort } from "../types";

export function isTauriHost(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function toFilewellError(raw: unknown): FilewellError {
  if (raw && typeof raw === "object" && "code" in raw && "message" in raw) {
    return raw as FilewellError;
  }
  return { code: "io", message: raw instanceof Error ? raw.message : String(raw) };
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (raw) {
    throw toFilewellError(raw);
  }
}

export const ipc = {
  getSettings: () => call<Settings>("get_settings"),
  setSetting: (key: SettingKey, value: Settings[SettingKey]) => call<Settings>("set_setting", { key, value }),
  getAppInfo: () => call<AppInfo>("get_app_info"),

  listDir: (path: string, showHidden: boolean, sort: Sort) => call<DirListing>("list_dir", { path, showHidden, sort }),
  stat: (path: string) => call<Entry>("stat", { path }),
  watchDir: (tabId: string, path: string) => call<void>("watch_dir", { tabId, path }),
  unwatch: (tabId: string) => call<void>("unwatch", { tabId }),
  listDrives: () => call<Drive[]>("list_drives"),
  knownFolders: () => call<KnownFolder[]>("known_folders"),
  openPath: (path: string) => call<void>("open_path", { path }),
  openWith: (path: string) => call<void>("open_with", { path }),
  revealInExplorer: (path: string) => call<void>("reveal_in_explorer", { path }),

  /** Live refresh: Rust emits the watched folder's path, debounced. */
  onDirChanged: (handler: (path: string) => void): Promise<UnlistenFn> =>
    listen<{ path: string }>("dir-changed", (event) => handler(event.payload.path)),
};
