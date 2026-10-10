import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check } from "lucide-react";
import { EMPTY_SELECTION, selectAt, type SelectMode } from "../../lib/selection";
import { useSelection } from "../../store/selection";
import { FileIcon } from "./FileIcon";
import { clickMode, rowId, type FileViewProps } from "./FileList";
import { useFileKeys } from "./useFileKeys";

const TILE_WIDTH = 112;
const TILE_HEIGHT = 104;
const GAP = 8;
const PADDING = 16;

export function FileGrid({ tab, entries, onAction }: FileViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const selection = useSelection((state) => state.byTab[tab.id] ?? EMPTY_SELECTION);
  const paths = useMemo(() => entries.map((entry) => entry.path), [entries]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(([measured]) => setWidth(measured.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const columns = Math.max(1, Math.floor((width - PADDING * 2 + GAP) / (TILE_WIDTH + GAP)));
  const rows = Math.ceil(entries.length / columns);
  const virtual = useVirtualizer({ count: rows, getScrollElement: () => scroller.current, estimateSize: () => TILE_HEIGHT + GAP, overscan: 4 });
  const onKeyDown = useFileKeys(tab, entries, columns, (index) => virtual.scrollToIndex(Math.floor(index / columns), { align: "auto" }));

  const select = (index: number, mode: SelectMode) =>
    useSelection.getState().put(tab.id, selectAt(useSelection.getState().of(tab.id), paths, index, mode));

  return (
    <div
      ref={scroller}
      className="file-grid"
      role="grid"
      aria-label="Folder contents"
      aria-rowcount={rows}
      aria-colcount={columns}
      aria-multiselectable="true"
      aria-activedescendant={entries.length > 0 ? rowId(tab.id, selection.focus) : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="file-grid"
    >
      <div className="virtual-space" style={{ height: virtual.getTotalSize() }}>
        {virtual.getVirtualItems().map((row) => (
          <div key={row.index} role="row" aria-rowindex={row.index + 1} className="tile-row" style={{ transform: `translateY(${row.start}px)` }}>
            {entries.slice(row.index * columns, row.index * columns + columns).map((entry, offset) => {
              const index = row.index * columns + offset;
              const selected = selection.selected.has(entry.path);
              return (
                <div
                  key={entry.path}
                  id={rowId(tab.id, index)}
                  role="gridcell"
                  aria-selected={selected}
                  title={entry.name}
                  className={`file-tile${selected ? " is-selected" : ""}${index === selection.focus ? " is-focused" : ""}${entry.hidden ? " is-hidden" : ""}`}
                  onClick={(event) => select(index, clickMode(event))}
                  onDoubleClick={() => onAction({ kind: "open", entry })}
                  onContextMenu={(event) => {
                    event.currentTarget.closest<HTMLElement>('[role="grid"]')?.focus();
                    event.preventDefault();
                    if (!useSelection.getState().of(tab.id).selected.has(entry.path)) select(index, "replace");
                    onAction({ kind: "menu", entry, x: event.clientX, y: event.clientY });
                  }}
                  data-testid="file-tile"
                >
                  {selected && <Check className="tile-check" size={14} aria-hidden="true" />}
                  <FileIcon entry={entry} size={40} />
                  <span className="tile-name">{entry.name}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
