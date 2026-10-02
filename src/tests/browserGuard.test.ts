import { describe, expect, it } from "vitest";
import { isReservedBrowserKey } from "../lib/browserGuard";

type Mods = Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }>;

function key(name: string, mods: Mods = {}) {
  return { key: name, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods };
}

describe("isReservedBrowserKey", () => {
  it("claims the WebView2 accelerators that would reload, print, find or navigate the app", () => {
    for (const event of [
      key("F5"),
      key("r", { ctrlKey: true }),
      key("R", { ctrlKey: true, shiftKey: true }),
      key("p", { ctrlKey: true }),
      key("f", { ctrlKey: true }),
      key("g", { ctrlKey: true }),
      key("u", { ctrlKey: true }),
      key("s", { ctrlKey: true }),
      key("j", { ctrlKey: true }),
      key("F3"),
      key("F7"),
      key("ArrowLeft", { altKey: true }),
      key("ArrowRight", { altKey: true }),
    ]) {
      expect(isReservedBrowserKey(event), JSON.stringify(event)).toBe(true);
    }
  });

  it("leaves typing, editing and the app's own shortcuts alone", () => {
    for (const event of [
      key("r"),
      key("F2"),
      key("c", { ctrlKey: true }),
      key("v", { ctrlKey: true }),
      key("z", { ctrlKey: true }),
      key("k", { ctrlKey: true }),
      key("ArrowLeft"),
      key("F12"),
    ]) {
      expect(isReservedBrowserKey(event), JSON.stringify(event)).toBe(false);
    }
  });
});
