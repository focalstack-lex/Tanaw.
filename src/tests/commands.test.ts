import { beforeEach, describe, expect, it } from "vitest";
import { commandForKey, listCommands, registerCommands, resetCommands, runCommand } from "../lib/commands";
import { buildAppCommands } from "../lib/appCommands";

type Mods = Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean }>;

function keyEvent(key: string, mods: Mods = {}) {
  return { key, code: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, target: null, ...mods };
}

describe("command registry", () => {
  beforeEach(resetCommands);

  it("refuses duplicate ids and duplicate shortcuts", () => {
    registerCommands([{ id: "a", title: "A", group: "app", shortcut: "Ctrl+K", run: () => {} }]);
    expect(() => registerCommands([{ id: "a", title: "A2", group: "app", run: () => {} }])).toThrow(/Duplicate command id/);
    expect(() => registerCommands([{ id: "b", title: "B", group: "app", shortcut: "Ctrl+K", run: () => {} }])).toThrow(/already bound/);
  });

  it("resolves a key event to its command and honours when()", () => {
    let hidden = false;
    registerCommands([{ id: "a", title: "A", group: "app", shortcut: "Ctrl+K", when: () => !hidden, run: () => {} }]);
    expect(commandForKey(keyEvent("k", { ctrlKey: true }))?.id).toBe("a");
    hidden = true;
    expect(commandForKey(keyEvent("k", { ctrlKey: true }))).toBeNull();
  });

  it("runCommand reports whether it ran", async () => {
    let runs = 0;
    registerCommands([{ id: "a", title: "A", group: "app", run: () => { runs += 1; } }]);
    expect(await runCommand("a")).toBe(true);
    expect(await runCommand("missing")).toBe(false);
    expect(runs).toBe(1);
  });
});

describe("app commands", () => {
  beforeEach(resetCommands);

  it("register without conflicts and carry the fixed bindings", () => {
    registerCommands(buildAppCommands());
    const bound = new Map(listCommands().filter((c) => c.shortcut).map((c) => [c.shortcut as string, c.id]));
    expect(bound.get("Ctrl+K")).toBe("app.palette");
    expect(bound.get("Ctrl+T")).toBe("tab.new");
    expect(bound.get("Ctrl+W")).toBe("tab.close");
    expect(bound.get("Ctrl+Comma")).toBe("app.settings");
    expect(bound.get("Ctrl+Shift+E")).toBe("panel.toggle");
    expect(bound.get("Ctrl+H")).toBe("view.toggleHidden");
    expect(bound.get("Ctrl+9")).toBe("tab.select.9");
    const globals = listCommands().filter((c) => c.global).map((c) => c.id);
    expect(globals).toEqual(expect.arrayContaining(["app.palette", "tab.new", "tab.close", "app.settings"]));
  });
});
