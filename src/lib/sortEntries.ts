// The listing order of src-tauri/src/fs/listing.rs (sort_entries), for the dev
// harness and for tests that pin the two implementations together.
import { naturalCompare } from "./format";
import type { Entry, Sort } from "../types";

export function sortEntries(entries: Entry[], sort: Sort): Entry[] {
  const factor = sort.dir === "desc" ? -1 : 1;
  return [...entries].sort((a, b) => {
    const foldersFirst = Number(b.kind === "dir") - Number(a.kind === "dir");
    if (foldersFirst !== 0) return foldersFirst;
    const byName = naturalCompare(a.name, b.name);
    let order: number;
    switch (sort.key) {
      case "name":
        order = byName;
        break;
      case "size":
        order = a.size - b.size || byName;
        break;
      case "modified":
        order = a.modified - b.modified || byName;
        break;
      default:
        // "kind": by extension, then by name.
        order = (a.ext < b.ext ? -1 : a.ext > b.ext ? 1 : 0) || byName;
        break;
    }
    return Math.sign(order) * factor;
  });
}
