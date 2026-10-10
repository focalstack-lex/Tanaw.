import { describe, expect, it } from "vitest";
import { isScannable, scanText } from "../../scripts/verify-text.mjs";

// Samples are assembled at runtime so this file stays clean under the scan itself.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const GRIN = String.fromCodePoint(0x1f600);

describe("scanText", () => {
  it("reports em and en dashes with their line and column", () => {
    const violations = scanText(`fn main() {}\nlet a = "x ${EM} y";\n// range 1${EN}2\n`);
    expect(violations).toEqual([
      { line: 2, column: 12, kind: "dash", sample: EM },
      { line: 3, column: 11, kind: "dash", sample: EN },
    ]);
  });

  it("reports emoji and accepts the legal typographic symbols", () => {
    expect(scanText(`label = "${GRIN}"`)).toEqual([{ line: 1, column: 10, kind: "emoji", sample: GRIN }]);
    expect(scanText("Copyright © 2026 Filewell™")).toEqual([]);
  });

  it("passes clean text, including escaped code points written as text", () => {
    expect(scanText("const DASH = /[\\u2013\\u2014]/;\n- a hyphen - is fine\n")).toEqual([]);
  });
});

describe("isScannable", () => {
  it("scans every text file the repository tracks, in any language", () => {
    for (const path of ["src-tauri/src/lib.rs", "src/styles.css", "index.html", "docs/FEATURE_MAP.md", "src-tauri/src/db/migrations/0001_init.sql", "src-tauri/Cargo.toml", ".github/workflows/verify.yml", "package.json"]) {
      expect(isScannable(path), path).toBe(true);
    }
  });

  it("skips binaries, lockfiles and vendored third-party license texts", () => {
    for (const path of ["src/assets/fonts/GeistVariable.woff2", "src-tauri/icons/icon.ico", "src-tauri/icons/32x32.png", "package-lock.json", "src-tauri/Cargo.lock", "src/assets/fonts/LICENSE-Geist.txt"]) {
      expect(isScannable(path), path).toBe(false);
    }
  });
});
