import { describe, expect, it } from "vitest";
import { breadcrumbs, normalizeInputPath, parentPath, samePath } from "../lib/paths";

describe("Windows paths", () => {
  it("finds the parent, stopping at the drive root", () => {
    expect(parentPath("C:\\Users\\dev\\Documents")).toBe("C:\\Users\\dev");
    expect(parentPath("C:\\Users")).toBe("C:\\");
    expect(parentPath("C:\\")).toBeNull();
    expect(parentPath("\\\\server\\share\\docs")).toBe("\\\\server\\share\\");
    expect(parentPath("\\\\server\\share\\")).toBeNull();
  });

  it("builds breadcrumbs with the drive as the first crumb", () => {
    expect(breadcrumbs("C:\\Users\\dev")).toEqual([
      { label: "C:", path: "C:\\" },
      { label: "Users", path: "C:\\Users" },
      { label: "dev", path: "C:\\Users\\dev" },
    ]);
    expect(breadcrumbs("D:\\")).toEqual([{ label: "D:", path: "D:\\" }]);
  });

  it("normalizes what people type or paste into the path field", () => {
    expect(normalizeInputPath("  c:/users//dev/  ")).toBe("C:\\users\\dev");
    expect(normalizeInputPath("\"D:\\Projects\"")).toBe("D:\\Projects");
    expect(normalizeInputPath("d:")).toBe("D:\\");
    expect(normalizeInputPath("Projects\\filewell")).toBeNull();
    expect(normalizeInputPath("")).toBeNull();
  });

  it("compares paths the way Windows does", () => {
    expect(samePath("C:\\Users\\Dev\\", "c:\\users\\dev")).toBe(true);
    expect(samePath("C:\\Users", "C:\\Users\\dev")).toBe(false);
  });
});
