// Drives and known folders for the sidebar and Home, loaded once at boot.
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

export const usePlaces = create<PlacesStore>((set) => ({
  drives: [],
  folders: [],
  loaded: false,
  load: async () => {
    const [drives, folders] = await Promise.allSettled([ipc.listDrives(), ipc.knownFolders()]);
    set({
      drives: drives.status === "fulfilled" ? drives.value : [],
      folders: folders.status === "fulfilled" ? folders.value : [],
      loaded: true,
    });
    for (const result of [drives, folders]) {
      if (result.status === "rejected") {
        const { title, detail } = describeError(toFilewellError(result.reason));
        useUi.getState().toast("error", title, detail);
      }
    }
  },
}));
