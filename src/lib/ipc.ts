// The only file that calls `invoke`. One typed function per Rust command;
// every rejection is normalized to a TanawError before it reaches a store.
import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, SettingKey, Settings, TanawError } from "../types";

export function isTauriHost(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function toTanawError(raw: unknown): TanawError {
  if (raw && typeof raw === "object" && "code" in raw && "message" in raw) {
    return raw as TanawError;
  }
  return { code: "io", message: raw instanceof Error ? raw.message : String(raw) };
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (raw) {
    throw toTanawError(raw);
  }
}

export const ipc = {
  getSettings: () => call<Settings>("get_settings"),
  setSetting: (key: SettingKey, value: Settings[SettingKey]) => call<Settings>("set_setting", { key, value }),
  getAppInfo: () => call<AppInfo>("get_app_info"),
};
