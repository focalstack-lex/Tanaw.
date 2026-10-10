import { describe, expect, it, vi } from "vitest";
import { queueWatch } from "../lib/watchQueue";

describe("queueWatch", () => {
  it("runs a tab's calls in issue order even when the first resolves later", async () => {
    const order: string[] = [];
    const first = queueWatch("t1", () => new Promise((resolve) => setTimeout(() => { order.push("unwatch"); resolve(null); }, 20)));
    const second = queueWatch("t1", async () => { order.push("watch"); });
    await Promise.all([first, second]);
    expect(order).toEqual(["unwatch", "watch"]);
  });

  it("logs a failure and never rejects, and later work still runs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let ran = false;
    await queueWatch("t2", () => Promise.reject(new Error("boom")));
    await queueWatch("t2", async () => { ran = true; });
    expect(ran).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
