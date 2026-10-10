import { useMemo, useRef, type MouseEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDate, formatSize, kindLabel } from "../../lib/format";
import { EMPTY_SELECTION, selectAt, type SelectMode } from "../../lib/selection";
import { useSelection } from "../../store/selection";
import { useTabs, type Tab } from "../../store/tabs";
import type { Entry, SortKey } from "../../types";
import { FileIcon } from "./FileIcon";
import { useFileKeys } from "./useFileKeys";
import type { EntryAction } from "./ContextMenu";

export const ROW_HEIGHT = 28;

const COLUMNS: Array<{ key: SortKey; label: string; className: string }> = [
  { key: "name", label: "Name", className: "cell-name" },
  { key: "modified", label: "Date modified", className: "cell-date" },
  { key: "kind", label: "Type", className: "cell-kind" },
  { key: "size", label: "Size", className: "cell-size" },
];

export interface FileViewProps {
  tab: Tab;
  entries: Entry[];
  onAction: (request: EntryAction) => void;
}

export const rowId = (tabId: string, index: number) => `entry-${tabId}-${index}`;

/** Click replaces, Ctrl+click toggles, Shift+click extends from the anchor. */
export function clickMode(event: MouseEvent): SelectMode {
  return event.shiftKey ? "range" : event.ctrlKey ? "toggle" : "replace";
}

export function FileList({ tab, entries, onAction }: FileViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const selection = useSelection((state) => state.byTab[tab.id] ?? EMPTY_SELECTION);
  const paths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const virtual = useVirtualizer({ count: entries.length, getScrollElement: () => scroller.current, estimateSize: () => ROW_HEIGHT, overscan: 12 });
  const onKeyDown = useFileKeys(tab, entries, 1, (index) => virtual.scrollToIndex(index, { align: "auto" }));

  const select = (index: number, mode: SelectMode) =>
    useSelection.getState().put(tab.id, selectAt(useSelection.getState().of(tab.id), paths, index, mode));

  const sortBy = (key: SortKey) => {
    const dir = tab.sort.key === key && tab.sort.dir === "asc" ? "desc" : "asc";
    useTabs.getState().setSort(tab.id, { key, dir });
  };

  return (
    <div
      className="file-list"
      role="grid"
      aria-label="Folder contents"
      aria-rowcount={entries.length + 1}
      aria-multiselectable="true"
      aria-activedescendant={entries.length > 0 ? rowId(tab.id, selection.focus) : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="file-list"
    >
      <div className="file-row file-list-header" role="row" aria-rowindex={1}>
        {COLUMNS.map((column) => {
          const sorted = tab.sort.key === column.key;
          return (
            <div
              key={column.key}
              role="columnheader"
              className={column.className}
              aria-sort={sorted ? (tab.sort.dir === "asc" ? "ascending" : "descending") : "none"}
            >
              <button type="button" className="column-button" onClick={() => sortBy(column.key)}>
                {column.label}
              </button>
            </div>
          );
        })}
      </div>
      <div ref={scroller} className="file-list-body">
        <div className="virtual-space" style={{ height: virtual.getTotalSize() }}>
          {virtual.getVirtualItems().map((item) => {
            const entry = entries[item.index];
            const selected = selection.selected.has(entry.path);
            const focused = item.index === selection.focus;
            return (
              <div
                key={entry.path}
                id={rowId(tab.id, item.index)}
                role="row"
                aria-rowindex={item.index + 2}
                aria-selected={selected}
                className={`file-row${selected ? " is-selected" : ""}${focused ? " is-focused" : ""}${entry.hidden ? " is-hidden" : ""}`}
                style={{ transform: `translateY(${item.start}px)` }}
                onClick={(event) => select(item.index, clickMode(event))}
                onDoubleClick={() => onAction({ kind: "open", entry })}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (!useSelection.getState().of(tab.id).selected.has(entry.path)) select(item.index, "replace");
                  onAction({ kind: "menu", entry, x: event.clientX, y: event.clientY });
                }}
                data-testid="file-row"
              >
                <div role="gridcell" className="cell-name">
                  <FileIcon entry={entry} />
                  <span className="name-text">{entry.name}</span>
                </div>
                <div role="gridcell" className="cell-date">{formatDate(entry.modified)}</div>
                <div role="gridcell" className="cell-kind">{kindLabel(entry)}</div>
                <div role="gridcell" className="cell-size">{entry.kind === "dir" ? "" : formatSize(entry.size)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
