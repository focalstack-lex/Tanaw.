/*
 * Dev-only mock of the Tauri IPC backend so the renderer runs in a plain
 * browser (`npm run dev:ui`) and under the Playwright drive. Activated from
 * main.tsx only when `import.meta.env.DEV` is true AND no Tauri host is
 * present, so it is dead code in `npm run build` and never runs in the app.
 *
 * It mirrors the Rust commands of src-tauri/src with in-memory state,
 * including a fake disk (C: and D:, with a 10,000-entry folder) whose order
 * comes from lib/sortEntries.ts, the mirror of fs/listing.rs.
 */
import { DEFAULT_SETTINGS } from "../lib/defaults";
import { normalizeInputPath } from "../lib/paths";
import { sortEntries } from "../lib/sortEntries";
import type { AppInfo, Drive, Entry, KnownFolder, Settings, Sort } from "../types";

type Handler = (args: Record<string, unknown>) => unknown;

interface FakeNode {
  name: string;
  kind: "file" | "dir";
  size: number;
  modified: number;
  hidden?: boolean;
  children?: FakeNode[];
}

const BASE = Date.UTC(2026, 8, 20, 9, 30);
const DAY = 86_400_000;
const file = (name: string, size: number, daysAgo = 0, hidden = false): FakeNode => ({ name, kind: "file", size, modified: BASE - daysAgo * DAY, hidden });
const folder = (name: string, children: FakeNode[] = [], hidden = false): FakeNode => ({ name, kind: "dir", size: 0, modified: BASE, children, hidden });

const DRIVES: Record<string, FakeNode> = {
  "C:\\": folder("C:", [
    folder("$Recycle.Bin", [], true),
    folder("Program Files", [folder("Filewell")]),
    folder("Users", [
      folder("dev", [
        folder("Desktop", [file("notes.txt", 420, 1)]),
        folder("Documents", [file("Report.docx", 48_213, 3), file("budget.xlsx", 18_442, 5), file("file2.txt", 2, 6), file("file10.txt", 10, 7)]),
        folder("Downloads", [file("setup.exe", 84_533_000, 2), file("archive.zip", 1_240_000, 9)]),
        folder("Pictures", Array.from({ length: 12 }, (_, i) => file(`photo-${String(i + 1).padStart(2, "0")}.jpg`, 2_400_000 + i * 1_000, i))),
        folder("Music"),
        folder("Videos"),
      ]),
    ]),
    folder("Windows"),
    file("pagefile.sys", 4_294_967_296, 30, true),
  ]),
  "D:\\": folder("D:", [
    folder("Big folder"),
    folder("Projects", [folder("filewell", [file("README.md", 1_800, 1), file("package.json", 1_200, 1)])]),
  ]),
};

let bigFolder: FakeNode[] | null = null;

function childrenOf(node: FakeNode): FakeNode[] {
  if (node.name === "Big folder") {
    bigFolder ??= Array.from({ length: 10_000 }, (_, i) => file(`file-${String(i + 1).padStart(5, "0")}.txt`, 1_024 + i, i % 400));
    return bigFolder;
  }
  return node.children ?? [];
}

function findNode(path: string): FakeNode | null {
  const match = /^([A-Za-z]):[\\/]*(.*)$/.exec(path);
  if (!match) return null;
  let node: FakeNode | undefined = DRIVES[`${match[1].toUpperCase()}:\\`];
  for (const part of match[2].split(/[\\/]+/).filter(Boolean)) {
    node = node ? childrenOf(node).find((child) => child.name.toLowerCase() === part.toLowerCase()) : undefined;
  }
  return node ?? null;
}

function toEntry(parent: string, node: FakeNode): Entry {
  const path = parent.endsWith("\\") ? parent + node.name : `${parent}\\${node.name}`;
  const dot = node.name.lastIndexOf(".");
  const ext = node.kind === "file" && dot > 0 ? node.name.slice(dot + 1).toLowerCase() : "";
  return { name: node.name, path, kind: node.kind, size: node.size, modified: node.modified, created: node.modified, hidden: Boolean(node.hidden), readonly: false, isLink: false, ext };
}

function existing(raw: unknown): string {
  const path = normalizeInputPath(String(raw));
  if (!path) throw { code: "invalidPath", message: "The path is not absolute.", path: String(raw) };
  if (!findNode(path)) throw { code: "notFound", message: "The system cannot find the path specified.", path };
  return path;
}

/** What the drive can assert about shell calls the app made. */
const opened: Array<{ action: "open" | "openWith" | "reveal"; path: string }> = [];
(window as unknown as { __filewellMock: { opened: typeof opened } }).__filewellMock = { opened };

const state = { settings: { ...DEFAULT_SETTINGS } as Settings };
const SETTING_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

const HANDLERS: Record<string, Handler> = {
  get_settings: () => ({ ...state.settings }),
  set_setting: (args) => {
    const key = String(args.key);
    if (!SETTING_KEYS.has(key)) {
      throw { code: "validation", message: `${key} is not a setting` };
    }
    state.settings = { ...state.settings, [key]: args.value };
    return { ...state.settings };
  },
  get_app_info: (): AppInfo => ({
    version: "0.1.0-dev",
    dataDir: "C:/Users/dev/AppData/Local/com.focalstack.filewell",
    databaseRecovered: false,
  }),
  list_dir: (args) => {
    const path = existing(args.path);
    const node = findNode(path) as FakeNode;
    if (node.kind !== "dir") throw { code: "validation", message: "That is a file, not a folder.", path };
    const visible = childrenOf(node)
      .map((child) => toEntry(path, child))
      .filter((entry) => Boolean(args.showHidden) || !entry.hidden);
    const entries = sortEntries(visible, (args.sort as Sort | undefined) ?? { key: "name", dir: "asc" });
    return { path, entries, total: entries.length, truncated: false, skipped: 0 };
  },
  stat: (args) => {
    const path = existing(args.path);
    const parent = path.slice(0, Math.max(path.lastIndexOf("\\"), 3));
    return toEntry(parent, findNode(path) as FakeNode);
  },
  watch_dir: () => null,
  unwatch: () => null,
  list_drives: (): Drive[] => [
    { mountPoint: "C:\\", label: "Local Disk", totalBytes: 512 * 1024 ** 3, availableBytes: 201 * 1024 ** 3, kind: "fixed" },
    { mountPoint: "D:\\", label: "Data", totalBytes: 1024 ** 4, availableBytes: 74 * 1024 ** 3, kind: "fixed" },
  ],
  known_folders: (): KnownFolder[] =>
    [
      ["desktop", "Desktop", "C:\\Users\\dev\\Desktop"],
      ["documents", "Documents", "C:\\Users\\dev\\Documents"],
      ["downloads", "Downloads", "C:\\Users\\dev\\Downloads"],
      ["pictures", "Pictures", "C:\\Users\\dev\\Pictures"],
      ["music", "Music", "C:\\Users\\dev\\Music"],
      ["videos", "Videos", "C:\\Users\\dev\\Videos"],
      ["home", "Home folder", "C:\\Users\\dev"],
    ].map(([id, label, path]) => ({ id, label, path })),
  open_path: (args) => {
    opened.push({ action: "open", path: existing(args.path) });
    return null;
  },
  open_with: (args) => {
    opened.push({ action: "openWith", path: existing(args.path) });
    return null;
  },
  reveal_in_explorer: (args) => {
    opened.push({ action: "reveal", path: existing(args.path) });
    return null;
  },
  // Window plugin calls from the custom title bar: no window to move in a browser.
  "plugin:window|is_maximized": () => false,
  "plugin:window|minimize": () => null,
  "plugin:window|toggle_maximize": () => null,
  "plugin:window|close": () => null,
  "plugin:window|start_dragging": () => null,
};

export function installMockBackend(): void {
  if ("__TAURI_INTERNALS__" in window) return;
  console.info("[filewell] Running with the dev mock backend (no Tauri host detected).");

  let callbackId = 0;
  const internals = {
    // getCurrentWindow() reads these synchronously on mount.
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { label: "main" },
    },
    transformCallback(callback: (response: unknown) => void, once?: boolean): number {
      callbackId += 1;
      const id = callbackId;
      const key = `_${id}`;
      Object.defineProperty(window, key, {
        value: (response?: unknown) => {
          if (once) delete (window as unknown as Record<string, unknown>)[key];
          callback(response);
        },
        writable: false,
        configurable: true,
      });
      return id;
    },
    unregisterCallback(id: number): void {
      delete (window as unknown as Record<string, unknown>)[`_${id}`];
    },
    invoke(cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
      // Event listeners register cleanly and never fire in the harness.
      if (cmd.startsWith("plugin:event|")) return Promise.resolve(callbackId);
      const handler = HANDLERS[cmd];
      if (!handler) {
        return Promise.reject(new Error(`[filewell dev mock] Unhandled IPC command: ${cmd}`));
      }
      return Promise.resolve().then(() => handler(args));
    },
    isTauri: true,
  };
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: internals, writable: false, configurable: false });

  // The event API's unlisten path calls this before invoking plugin:event|unlisten.
  Object.defineProperty(window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
    value: {
      unregisterListener(_event: string, id: number): void {
        internals.unregisterCallback(id);
      },
    },
    writable: false,
    configurable: false,
  });
}
