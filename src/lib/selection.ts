// The selection model of a file view, as pure functions over the ordered list
// of paths: click replaces, Ctrl toggles, Shift extends from the anchor.

export interface Selection {
  selected: ReadonlySet<string>;
  /** Where a Shift range starts. */
  anchor: number | null;
  /** The keyboard position (the row aria-activedescendant points at). */
  focus: number;
}

export const EMPTY_SELECTION: Selection = { selected: new Set<string>(), anchor: null, focus: 0 };

export type SelectMode = "replace" | "toggle" | "range";

function between(paths: string[], from: number, to: number): Set<string> {
  const [low, high] = from <= to ? [from, to] : [to, from];
  return new Set(paths.slice(low, high + 1));
}

export function selectAt(state: Selection, paths: string[], index: number, mode: SelectMode): Selection {
  const path = paths[index];
  if (path === undefined) return state;
  if (mode === "toggle") {
    const next = new Set(state.selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return { selected: next, anchor: index, focus: index };
  }
  if (mode === "range") {
    const anchor = state.anchor ?? index;
    return { selected: between(paths, anchor, index), anchor, focus: index };
  }
  return { selected: new Set([path]), anchor: index, focus: index };
}

/** Arrow keys: move to `index` (clamped), extending from the anchor with Shift. */
export function moveFocus(state: Selection, paths: string[], index: number, extend: boolean): Selection {
  if (paths.length === 0) return EMPTY_SELECTION;
  const clamped = Math.max(0, Math.min(index, paths.length - 1));
  return selectAt(state, paths, clamped, extend ? "range" : "replace");
}

export function selectAll(paths: string[]): Selection {
  return { selected: new Set(paths), anchor: 0, focus: 0 };
}

/**
 * After a reload: drop vanished paths and remap anchor and focus through their
 * paths, so a row inserted or removed above them does not move them to another file.
 */
export function pruneSelection(state: Selection, previous: string[], next: string[]): Selection {
  const present = new Set(next);
  const last = Math.max(next.length - 1, 0);
  const remap = (index: number | null): number | null => {
    const path = index === null ? undefined : previous[index];
    return path !== undefined && present.has(path) ? next.indexOf(path) : null;
  };
  return {
    selected: new Set([...state.selected].filter((path) => present.has(path))),
    anchor: remap(state.anchor),
    focus: remap(state.focus) ?? Math.min(state.focus, last),
  };
}
