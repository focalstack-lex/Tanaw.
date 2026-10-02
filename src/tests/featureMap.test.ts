import { describe, expect, it } from "vitest";
import { buildAppCommands } from "../lib/appCommands";
// Vite's raw import keeps Node types out of the renderer project.
import map from "../../docs/FEATURE_MAP.md?raw";

/** Rows of the Shortcuts table as shortcut -> command id; a `<n>` row expands to 1 to 9. */
function mappedShortcuts(): Map<string, string> {
  const section = map.split("## Shortcuts")[1]?.split("\n## ")[0] ?? "";
  const rows = new Map<string, string>();
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 4 || cells[1] === "Shortcut" || cells[1].startsWith("---")) continue;
    const shortcut = cells[1].replace(/`/g, "");
    const id = cells[2].replace(/`/g, "");
    if (shortcut.includes("<n>")) {
      for (let n = 1; n <= 9; n += 1) rows.set(shortcut.replace("<n>", String(n)), id.replace("<n>", String(n)));
    } else {
      rows.set(shortcut, id);
    }
  }
  return rows;
}

describe("docs/FEATURE_MAP.md", () => {
  it("lists every bound shortcut with its command id, and nothing stale", () => {
    const mapped = mappedShortcuts();
    const bound = new Map(buildAppCommands().filter((c) => c.shortcut).map((c) => [c.shortcut as string, c.id]));
    expect(Object.fromEntries(mapped)).toEqual(Object.fromEntries(bound));
  });
});
