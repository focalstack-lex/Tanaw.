// What happens when a person opens, reveals or copies an entry. Failures
// become calm toasts; nothing here throws to the caller.
import { describeError } from "./errors";
import { ipc, toFilewellError } from "./ipc";
import { useListings } from "../store/listings";
import { useSettings } from "../store/settings";
import { useTabs } from "../store/tabs";
import { useUi } from "../store/ui";
import type { Entry } from "../types";

async function report(work: Promise<unknown>): Promise<void> {
  try {
    await work;
  } catch (raw) {
    const { title, detail } = describeError(toFilewellError(raw));
    useUi.getState().toast("error", title, detail);
  }
}

export async function openEntry(tabId: string, entry: Entry): Promise<void> {
  if (entry.kind === "dir") {
    useTabs.getState().navigate(tabId, entry.path);
    return;
  }
  await report(ipc.openPath(entry.path));
}

export const openWithEntry = (entry: Entry) => report(ipc.openWith(entry.path));
export const revealEntry = (entry: Entry) => report(ipc.revealInExplorer(entry.path));

export async function copyPaths(paths: string[]): Promise<void> {
  try {
    await navigator.clipboard.writeText(paths.join("\r\n"));
    useUi.getState().toast("success", paths.length === 1 ? "Copied the path." : `Copied ${paths.length} paths.`);
  } catch (raw) {
    useUi.getState().toast("error", "Filewell could not copy to the clipboard.", raw instanceof Error ? raw.message : String(raw));
  }
}

/** Reloads a browser tab with its current settings and sort. */
export function reloadTab(tabId: string): Promise<void> {
  const tab = useTabs.getState().tabs.find((candidate) => candidate.id === tabId);
  if (!tab || tab.view !== "browser" || !tab.path) return Promise.resolve();
  return useListings.getState().load(tab.id, tab.path, useSettings.getState().settings.showHidden, tab.sort);
}
