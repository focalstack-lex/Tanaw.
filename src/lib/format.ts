// Display formats for listings. naturalCompare mirrors src-tauri/src/fs/sort.rs
// (UTF-16 code units here, Unicode scalars there: they differ only for
// characters outside the Basic Multilingual Plane).
import type { Entry } from "../types";

const isDigit = (c: string) => c >= "0" && c <= "9";

export function naturalCompare(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (isDigit(a[i]) && isDigit(b[j])) {
      let endA = i;
      while (endA < a.length && isDigit(a[endA])) endA += 1;
      let endB = j;
      while (endB < b.length && isDigit(b[endB])) endB += 1;
      const digitsA = a.slice(i, endA);
      const digitsB = b.slice(j, endB);
      const valueA = digitsA.replace(/^0+/, "");
      const valueB = digitsB.replace(/^0+/, "");
      const order =
        valueA.length - valueB.length || (valueA < valueB ? -1 : valueA > valueB ? 1 : 0) || digitsA.length - digitsB.length;
      if (order !== 0) return Math.sign(order);
      i = endA;
      j = endB;
      continue;
    }
    const x = a[i].toLowerCase();
    const y = b[j].toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
    i += 1;
    j += 1;
  }
  if (i < a.length) return 1;
  if (j < b.length) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

const UNITS = ["KB", "MB", "GB", "TB"];

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes === 1 ? "1 byte" : `${bytes} bytes`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`;
}

/** Empty for an unknown (zero) timestamp. */
export function formatDate(ms: number, locale?: string): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(ms);
}

export function kindLabel(entry: Pick<Entry, "kind" | "ext">): string {
  if (entry.kind === "dir") return "Folder";
  return entry.ext ? `${entry.ext.toUpperCase()} file` : "File";
}
