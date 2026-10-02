import { describe, expect, it } from "vitest";
import { matchesShortcut, parseShortcut, shortcutKeys } from "../lib/shortcuts";

type Overrides = Partial<{ key: string; code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }>;

function keyEvent(overrides: Overrides) {
  return { key: "", code: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...overrides };
}

describe("parseShortcut", () => {
  it("reads modifiers and normalizes the key", () => {
    expect(parseShortcut("Ctrl+Shift+N")).toEqual({ ctrl: true, shift: true, alt: false, key: "n" });
    expect(parseShortcut("Alt+Left")).toEqual({ ctrl: false, shift: false, alt: true, key: "arrowleft" });
    expect(parseShortcut("Ctrl+Comma")).toEqual({ ctrl: true, shift: false, alt: false, key: "," });
    expect(parseShortcut("F5")).toEqual({ ctrl: false, shift: false, alt: false, key: "f5" });
  });

  it("refuses a shortcut that names no key", () => {
    expect(() => parseShortcut("Ctrl+Shift")).toThrow(/names no key/);
  });
});

describe("matchesShortcut", () => {
  it("matches letters regardless of case and requires the exact modifiers", () => {
    const shortcut = parseShortcut("Ctrl+K");
    expect(matchesShortcut(keyEvent({ key: "k", ctrlKey: true }), shortcut)).toBe(true);
    expect(matchesShortcut(keyEvent({ key: "K", ctrlKey: true, shiftKey: true }), shortcut)).toBe(false);
    expect(matchesShortcut(keyEvent({ key: "k" }), shortcut)).toBe(false);
    expect(matchesShortcut(keyEvent({ key: "k", ctrlKey: true, metaKey: true }), shortcut)).toBe(false);
  });

  it("matches shifted digits through the physical key code", () => {
    const shortcut = parseShortcut("Ctrl+Shift+1");
    expect(matchesShortcut(keyEvent({ key: "!", code: "Digit1", ctrlKey: true, shiftKey: true }), shortcut)).toBe(true);
    expect(matchesShortcut(keyEvent({ key: "@", code: "Digit2", ctrlKey: true, shiftKey: true }), shortcut)).toBe(false);
  });

  it("matches named keys", () => {
    expect(matchesShortcut(keyEvent({ key: "ArrowLeft", altKey: true }), parseShortcut("Alt+Left"))).toBe(true);
    expect(matchesShortcut(keyEvent({ key: "Tab", ctrlKey: true }), parseShortcut("Ctrl+Tab"))).toBe(true);
    expect(matchesShortcut(keyEvent({ key: ",", ctrlKey: true }), parseShortcut("Ctrl+Comma"))).toBe(true);
  });
});

describe("shortcutKeys", () => {
  it("splits a written shortcut for display", () => {
    expect(shortcutKeys("Ctrl+Shift+E")).toEqual(["Ctrl", "Shift", "E"]);
  });
});
