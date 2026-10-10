import { create } from "zustand";
import type { SettingKey, Settings } from "../types";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import { describeError } from "../lib/errors";
import { ipc, toFilewellError } from "../lib/ipc";
import { applyTheme } from "../lib/theme";
import { useUi } from "./ui";

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  /** Optimistic: the change shows at once and rolls back if Rust refuses it. */
  update: <K extends SettingKey>(key: K, value: Settings[K]) => Promise<void>;
}

function report(raw: unknown): void {
  const { title, detail } = describeError(toFilewellError(raw));
  useUi.getState().toast("error", title, detail);
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const settings = await ipc.getSettings();
      applyTheme(settings.theme);
      set({ settings, loaded: true });
    } catch (raw) {
      report(raw);
      set({ loaded: true });
    }
  },

  update: async (key, value) => {
    const previous = get().settings;
    const optimistic = { ...previous, [key]: value };
    set({ settings: optimistic });
    if (key === "theme") applyTheme(optimistic.theme);
    try {
      const settings = await ipc.setSetting(key, value);
      set({ settings });
    } catch (raw) {
      set({ settings: previous });
      if (key === "theme") applyTheme(previous.theme);
      report(raw);
    }
  },
}));
