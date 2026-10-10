// Keyboard model shared by the list and the grid (spec 7.3): arrows move
// (Shift extends), Home and End, PageUp and PageDown, Ctrl+Space toggles,
// Enter opens, Ctrl+Enter shows in Explorer, Backspace goes back, Escape
// clears the selection, and typing a name jumps to it.
import { useRef, type KeyboardEvent } from "react";
import { openEntry, revealEntry } from "../../lib/fileActions";
import { EMPTY_SELECTION, moveFocus, selectAt, type Selection } from "../../lib/selection";
import { useSelection } from "../../store/selection";
import { useTabs, type Tab } from "../../store/tabs";
import type { Entry } from "../../types";

const TYPE_AHEAD_MS = 800;

export function useFileKeys(tab: Tab, entries: Entry[], columns: number, scrollTo: (index: number) => void) {
  const typed = useRef({ text: "", at: 0 });

  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.altKey || event.metaKey) return;
    const paths = entries.map((entry) => entry.path);
    const selection = useSelection.getState().of(tab.id);
    const put = (next: Selection) => {
      useSelection.getState().put(tab.id, next);
      scrollTo(next.focus);
    };
    const page = Math.max(1, columns * 10);
    const steps: Record<string, number> = { ArrowDown: columns, ArrowUp: -columns, PageDown: page, PageUp: -page };
    if (columns > 1) {
      steps.ArrowRight = 1;
      steps.ArrowLeft = -1;
    }
    const nothingYet = selection.selected.size === 0 && selection.anchor === null;

    if (event.key in steps && !event.ctrlKey) {
      event.preventDefault();
      const delta = steps[event.key];
      const target = nothingYet ? (delta > 0 ? 0 : paths.length - 1) : selection.focus + delta;
      put(moveFocus(selection, paths, target, event.shiftKey));
      return;
    }
    if ((event.key === "Home" || event.key === "End") && !event.ctrlKey) {
      event.preventDefault();
      put(moveFocus(selection, paths, event.key === "Home" ? 0 : paths.length - 1, event.shiftKey));
      return;
    }
    if (event.key === " " && event.ctrlKey) {
      event.preventDefault();
      put(selectAt(selection, paths, selection.focus, "toggle"));
      return;
    }
    const focused = entries[selection.focus];
    if (event.key === "Enter" && focused) {
      event.preventDefault();
      if (event.ctrlKey) void revealEntry(focused);
      else void openEntry(tab.id, focused);
      return;
    }
    if (event.key === "Backspace" && !event.ctrlKey) {
      event.preventDefault();
      useTabs.getState().goBack(tab.id);
      return;
    }
    if (event.key === "Escape" && selection.selected.size > 0) {
      event.preventDefault();
      event.stopPropagation();
      useSelection.getState().put(tab.id, { ...EMPTY_SELECTION, focus: selection.focus });
      return;
    }
    if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && entries.length > 0) {
      event.preventDefault();
      const now = Date.now();
      const state = typed.current;
      state.text = now - state.at < TYPE_AHEAD_MS ? state.text + event.key.toLowerCase() : event.key.toLowerCase();
      state.at = now;
      const start = state.text.length === 1 ? selection.focus + 1 : selection.focus;
      for (let offset = 0; offset < entries.length; offset += 1) {
        const index = (start + offset) % entries.length;
        if (entries[index].name.toLowerCase().startsWith(state.text)) {
          put(moveFocus(selection, paths, index, false));
          break;
        }
      }
    }
  };
}
