// Drives and known folders for the sidebar and Home, loaded at boot and refreshed when Home opens and the window regains focus.
import { create } from "zustand";
import { describeError } from "../lib/errors";
import { ipc, toFilewellError } from "../lib/ipc";
import type { Drive, KnownFolder } from "../types";
import { useUi } from "./ui";

interface PlacesStore {
  drives: Drive[];
  folders: KnownFolder[];
  loaded: boolean;
  load: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const usePlaces = create<PlacesStore>((set, get) => ({
  drives: [],
  folders: [],
  loaded: false,
  load: () => {
    if (inFlight) return inFlight;
    const run = async () => {
      const [drives, folders] = await Promise.allSettled([ipc.listDrives(), ipc.knownFolders()]);
      const first = !get().loaded;
      // A failed refresh keeps what the last good load showed.
      set((state) => ({
        drives: drives.status === "fulfilled" ? drives.value : state.drives,
        folders: folders.status === "fulfilled" ? folders.value : state.folders,
        loaded: true,
      }));
      if (!first) return;
      for (const result of [drives, folders]) {
        if (result.status === "rejected") {
          const { title, detail } = describeError(toFilewellError(result.reason));
          useUi.getState().toast("error", title, detail);
        }
      }
    };
    inFlight = run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  },
}));
