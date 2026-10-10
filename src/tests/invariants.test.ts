import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import filewell from "../../eslint-rules/filewell-invariants.js";

// Each sample is assembled at runtime so this test file itself stays clean
// under the very rules it exercises.
const linter = new Linter();

function ruleIds(code: string, rule: string): string[] {
  return linter
    .verify(
      code,
      [{ files: ["**/*.js"], plugins: { filewell }, rules: { [`filewell/${rule}`]: "error" } }],
      { filename: "sample.js" },
    )
    .map((message) => message.ruleId ?? "");
}

describe("filewell invariant rules", () => {
  it("flags an emoji character", () => {
    expect(ruleIds(`const s = "${String.fromCodePoint(0x1f600)}";`, "no-emoji")).toEqual(["filewell/no-emoji"]);
  });

  it("accepts the legal typographic symbols", () => {
    expect(ruleIds('const s = "\u00A9 2026";', "no-emoji")).toEqual([]);
  });

  it("flags em dashes and en dashes", () => {
    const code = `const s = "a ${String.fromCharCode(0x2014)} b ${String.fromCharCode(0x2013)} c";`;
    expect(ruleIds(code, "no-dash-punctuation")).toHaveLength(2);
  });

  it("flags an empty catch block and accepts a commented one", () => {
    expect(ruleIds("try { f(); } catch (e) {}", "no-silent-catch")).toHaveLength(1);
    expect(ruleIds("try { f(); } catch (e) { /* best effort: cache warmup */ }", "no-silent-catch")).toHaveLength(0);
  });

  it("flags a committed token pattern", () => {
    const token = "ghp_" + "a".repeat(30);
    expect(ruleIds(`const k = "${token}";`, "no-hardcoded-secret")).toEqual(["filewell/no-hardcoded-secret"]);
  });
});
