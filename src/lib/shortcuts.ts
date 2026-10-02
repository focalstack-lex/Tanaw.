// Shortcut parsing and matching. Written forms come from lib/appCommands.ts
// and docs/FEATURE_MAP.md, for example "Ctrl+Shift+N", "Alt+Left", "Ctrl+Comma".

export interface Shortcut {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  /** Lower-case KeyboardEvent.key, for example "k", "tab", "arrowleft", ",". */
  key: string;
}

const KEY_ALIASES: Record<string, string> = {
  left: "arrowleft",
  right: "arrowright",
  up: "arrowup",
  down: "arrowdown",
  comma: ",",
  period: ".",
  space: " ",
  esc: "escape",
};

export function parseShortcut(text: string): Shortcut {
  const shortcut: Shortcut = { ctrl: false, shift: false, alt: false, key: "" };
  for (const part of text.split("+").map((p) => p.trim()).filter(Boolean)) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") shortcut.ctrl = true;
    else if (lower === "shift") shortcut.shift = true;
    else if (lower === "alt") shortcut.alt = true;
    else shortcut.key = KEY_ALIASES[lower] ?? lower;
  }
  if (!shortcut.key) throw new Error(`Shortcut "${text}" names no key`);
  return shortcut;
}

export type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey"> & { code?: string };

export function matchesShortcut(event: KeyLike, shortcut: Shortcut): boolean {
  if (event.metaKey) return false;
  if (event.ctrlKey !== shortcut.ctrl || event.shiftKey !== shortcut.shift || event.altKey !== shortcut.alt) return false;
  // Shift turns a digit's key value into punctuation on most layouts, so digits
  // match on the physical key instead.
  if (/^[0-9]$/.test(shortcut.key) && event.code) return event.code === `Digit${shortcut.key}`;
  return event.key.toLowerCase() === shortcut.key;
}

/** "Ctrl+Shift+N" to ["Ctrl", "Shift", "N"], for rendering on a Kbd. */
export function shortcutKeys(text: string): string[] {
  return text.split("+").map((p) => p.trim()).filter(Boolean);
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True when the event target takes typed text, so plain shortcuts must stay out of its way. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable) return true;
  return target.closest(".cm-editor") !== null;
}
