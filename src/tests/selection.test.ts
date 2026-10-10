import { describe, expect, it } from "vitest";
import { EMPTY_SELECTION, moveFocus, pruneSelection, selectAll, selectAt } from "../lib/selection";

const paths = ["a", "b", "c", "d", "e"];
const set = (s: { selected: ReadonlySet<string> }) => [...s.selected].sort();

describe("selection model", () => {
  it("click replaces, Ctrl+click toggles, Shift+click selects from the anchor", () => {
    let s = selectAt(EMPTY_SELECTION, paths, 1, "replace");
    expect(set(s)).toEqual(["b"]);
    s = selectAt(s, paths, 3, "toggle");
    expect(set(s)).toEqual(["b", "d"]);
    s = selectAt(s, paths, 3, "toggle");
    expect(set(s)).toEqual(["b"]);
    s = selectAt(selectAt(EMPTY_SELECTION, paths, 1, "replace"), paths, 3, "range");
    expect(set(s)).toEqual(["b", "c", "d"]);
    expect(s.anchor).toBe(1);
    expect(s.focus).toBe(3);
  });

  it("arrow moves replace or extend, and clamp at the ends", () => {
    let s = moveFocus(EMPTY_SELECTION, paths, 2, false);
    expect(set(s)).toEqual(["c"]);
    s = moveFocus(s, paths, 4, true);
    expect(set(s)).toEqual(["c", "d", "e"]);
    s = moveFocus(s, paths, 99, false);
    expect(s.focus).toBe(4);
    expect(set(s)).toEqual(["e"]);
    expect(moveFocus(EMPTY_SELECTION, [], 0, false)).toEqual(EMPTY_SELECTION);
  });

  it("select all and prune after the folder changes", () => {
    expect(set(selectAll(paths))).toEqual(paths);
    const s = selectAt(selectAt(EMPTY_SELECTION, paths, 4, "replace"), paths, 1, "toggle");
    const pruned = pruneSelection(s, paths, ["a", "b", "c"]);
    expect(set(pruned)).toEqual(["b"]);
    expect(pruned.focus).toBe(1);
  });

  it("keeps focus and anchor on the same paths when rows shift", () => {
    let s = selectAt(EMPTY_SELECTION, paths, 1, "replace");
    s = selectAt(s, paths, 3, "range");
    const next = ["new", ...paths];
    const pruned = pruneSelection(s, paths, next);
    expect(pruned.anchor).toBe(2);
    expect(pruned.focus).toBe(4);
    expect(set(pruned)).toEqual(["b", "c", "d"]);
  });

  it("falls back to the clamped index with no anchor when the focused path is gone", () => {
    let s = selectAt(EMPTY_SELECTION, paths, 1, "replace");
    s = selectAt(s, paths, 4, "range");
    const pruned = pruneSelection(s, paths, ["a", "b", "c"]);
    expect(pruned.focus).toBe(2);
    expect(pruned.anchor).toBe(1);
    const gone = pruneSelection(selectAt(EMPTY_SELECTION, paths, 1, "replace"), paths, ["a", "c"]);
    expect(gone.anchor).toBeNull();
    expect(gone.focus).toBe(1);
  });
});
