import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { describeError } from "../../lib/errors";
import { openEntry, reloadTab } from "../../lib/fileActions";
import { ipc } from "../../lib/ipc";
import { samePath } from "../../lib/paths";
import { EMPTY_SELECTION, pruneSelection } from "../../lib/selection";
import { useDelayed } from "../../lib/useDelayed";
import { queueWatch } from "../../lib/watchQueue";
import { useListings } from "../../store/listings";
import { useSelection } from "../../store/selection";
import { useSettings } from "../../store/settings";
import type { Tab } from "../../store/tabs";
import { useUi } from "../../store/ui";
import type { Entry } from "../../types";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ContextMenu, type EntryAction } from "./ContextMenu";
import { FileGrid } from "./FileGrid";
import { FileList } from "./FileList";
import { Toolbar } from "./Toolbar";

export function BrowserView({ tab }: { tab: Tab }) {
  const path = tab.path ?? "";
  const showHidden = useSettings((state) => state.settings.showHidden);
  const defaultView = useSettings((state) => state.settings.defaultView);
  const state = useListings((store) => store.byTab[tab.id]);
  const [menu, setMenu] = useState<{ entry: Entry; x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const viewMode = tab.viewMode ?? defaultView;

  useEffect(() => {
    if (path) void useListings.getState().load(tab.id, path, showHidden, tab.sort);
  }, [tab.id, path, showHidden, tab.sort]);

  // Live refresh (spec 5.8): Rust watches this folder while the tab shows it.
  useEffect(() => {
    if (!path) return;
    let active = true;
    let stop: (() => void) | undefined;
    void queueWatch(tab.id, () =>
      ipc.watchDir(tab.id, path).catch((error: unknown) => console.warn("Filewell could not watch this folder", error)),
    );
    ipc
      .onDirChanged((changed) => {
        if (samePath(changed, path)) void reloadTab(tab.id);
      })
      .then((unlisten) => {
        if (active) stop = unlisten;
        else unlisten();
      })
      .catch((error: unknown) => console.warn("Filewell could not listen for folder changes", error));
    return () => {
      active = false;
      stop?.();
      void queueWatch(tab.id, () =>
        ipc.unwatch(tab.id).catch((error: unknown) => console.warn("Filewell could not stop watching", error)),
      );
    };
  }, [tab.id, path]);

  const listing = state?.listing ?? null;
  const previousPaths = useRef<string[]>([]);
  const previousFolder = useRef<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listing) return;
    const store = useSelection.getState();
    const nextPaths = listing.entries.map((entry) => entry.path);
    if (previousFolder.current !== null && !samePath(previousFolder.current, listing.path)) {
      store.put(tab.id, EMPTY_SELECTION);
    } else {
      store.put(tab.id, pruneSelection(store.of(tab.id), previousPaths.current, nextPaths));
    }
    previousPaths.current = nextPaths;
    previousFolder.current = listing.path;
  }, [tab.id, listing]);

  // After a typed path, focus the new folder's file view once it has loaded.
  const status = state?.status;
  useEffect(() => {
    const wanted = useUi.getState().focusViewFor;
    if (wanted === null || !status) return;
    if (status === "error") {
      useUi.getState().requestViewFocus(null);
    } else if (status === "ready" && listing && samePath(listing.path, wanted)) {
      useUi.getState().requestViewFocus(null);
      if (listing.entries.length === 0) return;
      requestAnimationFrame(() => {
        bodyRef.current?.querySelector<HTMLElement>('[data-testid="file-list"], [data-testid="file-grid"]')?.focus();
      });
    }
  }, [status, listing]);

  const onAction = useCallback(
    (action: EntryAction) => {
      if (action.kind === "open") void openEntry(tab.id, action.entry);
      else setMenu({ entry: action.entry, x: action.x, y: action.y });
    },
    [tab.id],
  );

  const slow = useDelayed(state?.status === "loading" && !listing, 150);
  const entries = listing?.entries ?? [];

  let body: ReactNode;
  if (state?.status === "error" && state.error) {
    const { title, detail } = describeError(state.error);
    body = <EmptyState title={title} message={detail} action={<Button onClick={() => void reloadTab(tab.id)}>Try again</Button>} />;
  } else if (!listing) {
    body = slow ? (
      <div className="skeleton-list" aria-busy="true" aria-label="Loading the folder">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="skeleton-row" />
        ))}
      </div>
    ) : null;
  } else if (entries.length === 0) {
    body = <EmptyState message="This folder is empty." />;
  } else if (viewMode === "grid") {
    body = <FileGrid key={`${tab.id}:${listing.path}`} tab={tab} entries={entries} onAction={onAction} />;
  } else {
    body = <FileList key={`${tab.id}:${listing.path}`} tab={tab} entries={entries} onAction={onAction} />;
  }

  const notices: string[] = [];
  if (listing?.truncated) notices.push(`Showing the first ${listing.entries.length.toLocaleString()} of ${listing.total.toLocaleString()} items.`);
  if (listing && listing.skipped > 0) notices.push(listing.skipped === 1 ? "1 item could not be read." : `${listing.skipped} items could not be read.`);

  return (
    <section className="browser-view" data-testid="browser-view">
      <Toolbar tab={tab} viewMode={viewMode} />
      {notices.length > 0 && (
        <p className="listing-notice" role="status" data-testid="listing-notice">
          {notices.join(" ")}
        </p>
      )}
      <div ref={bodyRef} className="browser-body">{body}</div>
      {menu && <ContextMenu tab={tab} entry={menu.entry} x={menu.x} y={menu.y} onClose={closeMenu} />}
    </section>
  );
}
