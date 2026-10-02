// WebView2 keeps the browser's page menu and accelerators unless the page claims
// them: right-click offers Back, Reload, Save as and Print, F5 or Ctrl+R reloads
// the renderer and drops every tab, Ctrl+P prints the UI. Tauri exposes no window
// option for this, so the renderer claims them here. Only the default action is
// prevented; the app's own key handler still sees the event, so later pieces can
// bind F5 (Refresh) and Ctrl+F (Search) as commands.
import type { KeyLike } from "./shortcuts";

type GuardKey = Pick<KeyLike, "key" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey">;

const PLAIN = new Set(["f3", "f5", "f7"]);
// Ctrl with or without Shift: reload, find, find next, print, save, view source, downloads, new window, open.
const WITH_CTRL = new Set(["r", "f", "g", "p", "s", "u", "j", "n", "o"]);
const WITH_ALT = new Set(["arrowleft", "arrowright"]);

export function isReservedBrowserKey(event: GuardKey): boolean {
  if (event.metaKey) return false;
  const key = event.key.toLowerCase();
  if (!event.ctrlKey && !event.altKey && PLAIN.has(key)) return true;
  if (event.ctrlKey && !event.altKey && WITH_CTRL.has(key)) return true;
  return event.altKey && !event.ctrlKey && !event.shiftKey && WITH_ALT.has(key);
}

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "url", "email", "password", "number", "tel"]);

/** Text fields keep the native menu for cut, copy and paste. */
export function wantsNativeContextMenu(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type);
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) return true;
  return target.closest(".cm-editor") !== null;
}

/** Installs the guard on the document for the life of the page. */
export function installBrowserGuard(): void {
  document.addEventListener(
    "keydown",
    (event) => {
      if (isReservedBrowserKey(event)) event.preventDefault();
    },
    { capture: true },
  );
  document.addEventListener("contextmenu", (event) => {
    if (!wantsNativeContextMenu(event.target)) event.preventDefault();
  });
}
