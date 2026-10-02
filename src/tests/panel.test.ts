import { describe, expect, it } from "vitest";
import { OVERLAY_BREAKPOINT, initialPanelOpen } from "../store/panel";

describe("initialPanelOpen", () => {
  it("docks the panel open only where it does not cover the content", () => {
    expect(OVERLAY_BREAKPOINT).toBe(1100);
    expect(initialPanelOpen(1200)).toBe(true);
    expect(initialPanelOpen(1100)).toBe(true);
    expect(initialPanelOpen(1099)).toBe(false);
    expect(initialPanelOpen(960)).toBe(false);
    expect(initialPanelOpen(720)).toBe(false);
  });
});
