/*
 * Dev-only mock of the Tauri IPC backend so the renderer runs in a plain
 * browser (`npm run dev:ui`) and under the Playwright drive. Activated from
 * main.tsx only when `import.meta.env.DEV` is true AND no Tauri host is
 * present, so it is dead code in `npm run build` and never runs in the app.
 *
 * It mirrors the Rust commands of src-tauri/src with in-memory state. The
 * shapes here are the contract in src/types.ts; keep them in step.
 */
import { DEFAULT_SETTINGS } from "../lib/defaults";
import type { AppInfo, Settings } from "../types";

type Handler = (args: Record<string, unknown>) => unknown;

const state = { settings: { ...DEFAULT_SETTINGS } as Settings };
const SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

const HANDLERS: Record<string, Handler> = {
  get_settings: () => ({ ...state.settings }),
  set_setting: (args) => {
    const key = String(args.key);
    if (!SETTING_KEYS.has(key)) {
      throw { code: "validation", message: `${key} is not a setting` };
    }
    state.settings = { ...state.settings, [key]: args.value };
    return { ...state.settings };
  },
  get_app_info: (): AppInfo => ({
    version: "0.1.0-dev",
    dataDir: "C:/Users/dev/AppData/Local/com.focalstack.filewell",
    databaseRecovered: false,
  }),
  // Window plugin calls from the custom title bar: no window to move in a browser.
  "plugin:window|is_maximized": () => false,
  "plugin:window|minimize": () => null,
  "plugin:window|toggle_maximize": () => null,
  "plugin:window|close": () => null,
  "plugin:window|start_dragging": () => null,
};

export function installMockBackend(): void {
  if ("__TAURI_INTERNALS__" in window) return;
  console.info("[filewell] Running with the dev mock backend (no Tauri host detected).");

  let callbackId = 0;
  const internals = {
    // getCurrentWindow() reads these synchronously on mount.
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { label: "main" },
    },
    transformCallback(callback: (response: unknown) => void, once?: boolean): number {
      callbackId += 1;
      const id = callbackId;
      const key = `_${id}`;
      Object.defineProperty(window, key, {
        value: (response?: unknown) => {
          if (once) delete (window as unknown as Record<string, unknown>)[key];
          callback(response);
        },
        writable: false,
        configurable: true,
      });
      return id;
    },
    unregisterCallback(id: number): void {
      delete (window as unknown as Record<string, unknown>)[`_${id}`];
    },
    invoke(cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
      // Event listeners register cleanly and never fire in the harness.
      if (cmd.startsWith("plugin:event|")) return Promise.resolve(callbackId);
      const handler = HANDLERS[cmd];
      if (!handler) {
        return Promise.reject(new Error(`[filewell dev mock] Unhandled IPC command: ${cmd}`));
      }
      return Promise.resolve().then(() => handler(args));
    },
    isTauri: true,
  };
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: internals, writable: false, configurable: false });

  // The event API's unlisten path calls this before invoking plugin:event|unlisten.
  Object.defineProperty(window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
    value: {
      unregisterListener(_event: string, id: number): void {
        internals.unregisterCallback(id);
      },
    },
    writable: false,
    configurable: false,
  });
}
