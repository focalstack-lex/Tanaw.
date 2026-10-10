import { describe, expect, it } from "vitest";
import { formatDate, formatSize, kindLabel, naturalCompare } from "../lib/format";
import { sortEntries } from "../lib/sortEntries";
import type { Entry } from "../types";

function entry(name: string, kind: Entry["kind"], size = 0, modified = 0): Entry {
  const ext = kind === "file" && name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return { name, path: `C:\\x\\${name}`, kind, size, modified, created: 0, hidden: false, readonly: false, isLink: false, ext };
}

describe("naturalCompare mirrors the Rust order", () => {
  it("compares numbers by value, ignores case, and breaks ties exactly", () => {
    const sorted = ["file10", "file2", "File1", "img007", "img7"].sort(naturalCompare);
    expect(sorted).toEqual(["File1", "file2", "file10", "img7", "img007"]);
    expect(naturalCompare("A", "a")).toBeLessThan(0);
    expect(naturalCompare("a", "a")).toBe(0);
  });
});

describe("sortEntries mirrors fs/listing.rs", () => {
  const entries = [entry("file10.txt", "file", 10), entry("b-folder", "dir"), entry("Photo.JPG", "file", 3), entry("A-folder", "dir"), entry("file2.txt", "file", 2)];

  it("puts folders first in natural name order", () => {
    expect(sortEntries(entries, { key: "name", dir: "asc" }).map((e) => e.name)).toEqual(["A-folder", "b-folder", "file2.txt", "file10.txt", "Photo.JPG"]);
  });

  it("keeps folders first when sorting by size descending", () => {
    expect(sortEntries(entries, { key: "size", dir: "desc" }).map((e) => e.name)).toEqual(["b-folder", "A-folder", "file10.txt", "Photo.JPG", "file2.txt"]);
  });
});

describe("display formats", () => {
  it("formats sizes like Explorer", () => {
    expect(formatSize(0)).toBe("0 bytes");
    expect(formatSize(1)).toBe("1 byte");
    expect(formatSize(1023)).toBe("1023 bytes");
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(1536 * 1024)).toBe("1.5 MB");
    expect(formatSize(250 * 1024 ** 3)).toBe("250 GB");
  });

  it("labels kinds and leaves unknown dates blank", () => {
    expect(kindLabel(entry("Docs", "dir"))).toBe("Folder");
    expect(kindLabel(entry("Report.pdf", "file"))).toBe("PDF file");
    expect(kindLabel(entry("Makefile", "file"))).toBe("File");
    expect(formatDate(0)).toBe("");
    expect(formatDate(Date.UTC(2026, 9, 2, 12, 0), "en-US")).toContain("2026");
  });
});
