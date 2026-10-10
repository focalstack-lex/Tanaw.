# Filewell v1: Design Specification

**Product**: Filewell (renamed from Tanaw on 2026-10-10, see the decision log)
**One line**: A calm, focused file manager for Windows, with notes and to-dos beside your files.
**Owner**: Lex Matondo, published free and open source under MIT at `github.com/focalstack-lex/Filewell`
**Platform**: Windows 10 and 11 (x64), Tauri 2, Rust core, React and TypeScript renderer.
**Status**: Design approved in brainstorming on 2026-10-02; implementation plans follow per piece.

This document is the binding design for the first release. It records every product decision
taken during brainstorming, the architecture, the contracts between layers, and the
verification that counts as done. Implementation plans live in `docs/superpowers/plans/` and
derive from this file; when the two disagree, this file is corrected first.

---

## 1. Positioning

Windows Explorer is noisy: ribbons, ads for cloud storage, mixed metaphors. Filewell is the quiet
alternative for students and creatives: one clear frame, fast listing, predictable file
operations that can always be undone, and a side panel where notes and to-dos live next to
the folder being worked in. It runs locally only, has no accounts, sends no telemetry, and
its only network call is a user-confirmed update check.

An LLM assistant is planned for the release after v1. Two decisions in this document exist
for it: the side panel reserves a fourth tab, and every file action is a checked Rust command,
so the assistant can later call the same commands as tools and inherit the same validation and
the same Recycle Bin safety. How the assistant runs (local model or cloud API) is a privacy
decision deferred to its own design phase.

## 2. Decisions taken in brainstorming

| Topic | Decision | Alternatives rejected |
| --- | --- | --- |
| Purpose | Own product, free, open source (MIT) | School project, portfolio, paid |
| Platform | Windows only for v1 | macOS, Linux |
| Core | File manager first; notes and to-dos are a side panel | Productivity first, equal linked workspace |
| Edge | Calm, focused UI | Instant whole-drive search, keyboard power tool, organization layer |
| Search | Current folder filter plus live subfolder walk, no index | Pinned-location index, whole-drive index |
| Notes storage | App database (SQLite), auto-save, version snapshots | Markdown files on disk, folder-attached notes |
| Note editor | Markdown, live-rendered inline | Plain text, rich text |
| To-dos | One list, due dates, overdue marking, reorder | Reminders, multiple lists and priorities |
| Preview | Images only | Text and code, PDF, audio and video |
| Landing | Home dashboard | Last folder, user choice |
| Multi-folder | Tabs | Single view, tabs plus split view |
| Undo | Session undo (Ctrl+Z) for every file operation | Persistent undo, Recycle Bin only |
| Conflicts | Ask with Replace, Keep both, Skip, and apply-to-all | Always keep both, side-by-side compare |
| Windows integration | Drag in from Explorer, open in default app, Open with | Native shell context menu, Explorer hooks, drag out |
| Recovery | Note version history | Session restore, interrupted operations, database backups |
| Export and import | Single `.filewell` backup file, merge or replace | Markdown export, plain JSON |
| Shortcuts | Explorer defaults plus Ctrl+K command palette, fixed bindings | Rebinding, no palette |
| Updates | Check GitHub Releases, user confirms install, signed | Silent auto-update, manual only |
| Name | Filewell, repository `focalstack-lex/Filewell`. Renamed from Tanaw on 2026-10-10: "Tanaw" is used by a tourism platform, and the repository name `Tanaw.` (trailing period) cannot be checked out on Windows runners. Web search found only a small unrelated business app and a for-sale domain using the name; the trademark check is still owed before release | Tanaw, Silip, Linaw, Banaag, Stillroom, Plainview, Lull, Kept, Shelfwise |
| Architecture | Approach A: Rust does the work, the renderer displays it | Tauri fs plugin from the renderer, hybrid |
| Reference | Dashboard frame from the Explo mockup, stripped of cloud, sharing and upsell parts | |
| Drive kind (piece 2a) | `Drive.kind` is narrowed to `"fixed" \| "removable"`: `list_drives` maps `sysinfo`'s `is_removable()` to removable and any disk it does not report as removable (a network drive, if listed) to fixed, until a later piece needs the distinction | `"network"` and `"other"` kinds |

Defaults set without a question, open to veto: theme follows Windows with a manual override;
hidden and system files hidden by default with a Ctrl+H toggle; no telemetry; long operations
show progress with Cancel and never block the window; window size and position are remembered.

## 3. Scope of v1

### In

| Area | Ships |
| --- | --- |
| Home | Drive cards with used space, Favorites tiles, Recent files table |
| Browsing | Tabs, back and forward history, breadcrumb, sidebar (drives, known folders, Favorites, Recycle Bin), list and grid views, sorting, type-ahead selection, virtualized lists for 10,000+ entries, live refresh when the folder changes on disk |
| File operations | New folder, new file, rename, copy, move, delete to Recycle Bin, permanent delete behind a confirmation, Replace moves the old file to the Recycle Bin, session undo, conflict dialog with apply-to-all, progress panel with cancel |
| Recycle Bin view | List items, restore selected, open the Recycle Bin in Explorer |
| Windows integration | Drop files from Explorer onto a folder or the list (copy, or move with Shift), open in default app on Enter or double-click, Open with, Show in Explorer |
| Search | Filter as you type in the open folder (instant, in memory); Enter walks subfolders live, streamed, cancellable |
| Side panel | Tabs: Preview (images), Notes, To-dos; a reserved slot for Assistant |
| Notes | Live-rendered Markdown editor, auto-save, version history with restore, soft delete with a Deleted list and restore |
| To-dos | Title, done, optional due date, overdue marking, drag to reorder |
| App | Settings, light, dark or system theme, Explorer shortcuts, Ctrl+K palette, `.filewell` export and import (merge or replace), update check with confirm |
| Distribution | NSIS installer (per user, no admin prompt), signed updater manifest on GitHub Releases, Windows code signing through SignPath's open-source program |

### Out of v1, on purpose

LLM assistant (next release), whole-drive index, split view, native Windows shell context
menu, Explorer "Open in Filewell" hook, dragging files out to other apps, previews for PDF, text,
audio and video, reminders, multiple to-do lists, shortcut rebinding, session restore,
interrupted-operation resume, database backups, Markdown export of notes, a deep folder tree
in the sidebar, emptying the Recycle Bin from inside Filewell, redo, macOS and Linux.

### Done criteria

1. Every operation on real files is undoable in the session, or goes through the Recycle Bin.
   Permanent delete is the only exception and sits behind a confirmation.
2. No user action can lose note text: auto-save, version snapshots, soft delete.
3. A folder with 10,000 entries lists in under 150 ms of IPC time and scrolls without drops.
4. A clean Windows install shows no SmartScreen "unknown publisher" warning. This depends on
   SignPath approval, which is external; until it lands, the release notes state the warning.
5. The full gate passes in CI: typecheck, lint invariants, unit tests, driven UI verification,
   `cargo test`, `cargo clippy` with warnings denied, and `map:code:check`.

---

## 4. Architecture

### 4.1 Layers

```
+---------------------------------------------------------------+
| Renderer (WebView2): React 19 + TypeScript + Vite              |
|   stores (zustand) -> components -> lib/ipc.ts (typed invoke)  |
+------------------------------+--------------------------------+
                               | Tauri IPC (JSON, camelCase)
+------------------------------v--------------------------------+
| Rust core (src-tauri): every command validates, then acts      |
|   paths.rs  fs/  shell.rs  db/  data/  backup.rs  updater.rs   |
|   custom protocol filewell:// serves files and thumbnails         |
+------------------------------+--------------------------------+
                               | std::fs, trash, notify, rusqlite
+------------------------------v--------------------------------+
| Windows: NTFS, Recycle Bin, shell associations, %LOCALAPPDATA% |
+---------------------------------------------------------------+
```

Rules that follow from approach A:

- The renderer never touches the filesystem or the database. `tauri-plugin-fs`,
  `tauri-plugin-sql` and the asset protocol are not installed. The renderer's capability file
  grants `core:default` plus the four window-control permissions the custom title bar needs
  (start dragging, minimize, toggle maximize, close) and nothing else.
- Native dialogs (file and folder pickers) are opened from Rust inside the command that needs
  them, so the dialog plugin is not exposed to the renderer either.
- One input validator (`paths.rs`) runs on every path that enters a command. Client-side
  checks exist only for responsiveness and are never sufficient.
- Long operations return an id immediately and report through events. The window never
  blocks on IO.

### 4.2 Known Tauri constraints that shape the design

- With native drag-and-drop enabled (`dragDropEnabled: true`, required for drops from
  Explorer), HTML5 drag-and-drop inside the webview does not work on Windows. Internal drags
  (file onto a sidebar folder, to-do reorder, favorites reorder) therefore use pointer events
  through one `useDrag` hook, not the HTML5 API.
- Custom URI schemes are served on Windows as `http://filewell.localhost/...`. The CSP image
  source list includes that origin.
- Release builds run with `panic = "abort"`. Command code must not panic: `clippy::unwrap_used`,
  `clippy::expect_used` and `clippy::panic` are denied in `Cargo.toml` lints.
- The updater needs a signing key pair. The public key is committed in `tauri.conf.json`; the
  private key and its password exist only as GitHub Actions secrets and in the local
  environment of the release machine (`.env.example` names them, `.env` is ignored).

### 4.3 Repository layout

The app lives at the repository root (single application, no `desktop/` subfolder).

```
Filewell/
  .github/workflows/verify.yml       gate: frontend, ui drive, native (Windows), code map
  .github/workflows/release.yml      tag v* -> NSIS installer + latest.json (added in piece 5)
  docs/CODE_MAP.md                   generated agent navigation map (never hand-edited)
  docs/FEATURE_MAP.md                surfaces, shortcuts, IPC table, drive recipes
  docs/superpowers/specs/            this file
  docs/superpowers/plans/            one implementation plan per piece
  journal/YYYY-MM-DD.md              append-only development journal
  reports/ui-verification/           drive evidence (gitignored)
  scripts/generate-code-map.mjs      dependency-free, extended for .ts .tsx .rs
  scripts/verify-ui.mjs              Playwright drive of the mocked renderer
  eslint-rules/filewell-invariants.js   no-emoji, no-dash-punctuation, no-silent-catch, no-hardcoded-secret
  src/                               renderer (section 7)
  src-tauri/                         Rust core (section 5)
  index.html  vite.config.ts  tsconfig.json  eslint.config.js  package.json
  README.md  LICENSE (MIT)  .gitignore  .env.example
```

---

## 5. Rust core (`src-tauri/src/`)

### 5.1 Modules

| File | Responsibility |
| --- | --- |
| `main.rs` | Entry point, calls `filewell_lib::run()` |
| `lib.rs` | Builder: plugins, managed state, command list, `filewell` protocol registration, startup checks |
| `error.rs` | `FilewellError { code, message, path }` and `ErrorCode`; `From` impls for io, rusqlite, trash, zip |
| `paths.rs` | Path and name validation (5.2) |
| `state.rs` | `AppState`: database connection behind a mutex, operation registry, undo stack, search registry, watcher registry |
| `fs/mod.rs` | `list_dir`, `stat`, natural sort |
| `fs/ops.rs` | create, rename, copy, move, delete to trash, permanent delete; progress and cancellation |
| `fs/conflicts.rs` | Conflict scan, resolution policy, `name (2)` generator |
| `fs/undo.rs` | Session undo stack and inverse operations |
| `fs/search.rs` | Subfolder walk, batching, cancellation |
| `fs/watch.rs` | Per-tab folder watcher with debounce |
| `fs/thumbs.rs` | Thumbnail cache and the protocol handler |
| `shell.rs` | Open in default app, Open with, show in Explorer, drives, known folders, Recycle Bin listing and restore |
| `db/mod.rs` | Open, pragmas, integrity check, migration runner |
| `db/migrations/0001_init.sql` | Schema (5.9) |
| `data/settings.rs` `favorites.rs` `recent.rs` `notes.rs` `todos.rs` | Thin command modules over the database |
| `backup.rs` | Export, inspect and import of `.filewell` files |
| `updater.rs` | Check and install wrappers around the updater plugin |

### 5.2 Path and name validation (`paths.rs`)

Every command that receives a path calls `validate_path` and every command that receives a
new name calls `validate_name`. Both return `ErrorCode::InvalidPath` or `InvalidName` with a
message that names the rule broken.

Path rules: must be absolute; no NUL byte; no `..` component after normalization; must
canonicalize when it is expected to exist; length under 32,000 characters (long-path aware:
the core adds the Windows extended-length prefix where needed). Protected targets refuse
rename, move, copy-over and delete: any drive root, `%WINDIR%`, and the Filewell data directory.
Everything else is governed by Windows ACLs; a refusal from Windows is surfaced, never retried
with elevation.

Name rules: not empty, not only whitespace or dots; none of the characters Windows forbids in
file names (less-than, greater-than, colon, double quote, slash, backslash, pipe, question mark,
asterisk); no control characters; no trailing space or period; not a reserved device name
(`CON`, `PRN`, `AUX`, `NUL`, `COM1` to `COM9`, `LPT1` to `LPT9`, with or without an extension);
at most 255 UTF-16 units.

### 5.3 Listing (`fs/mod.rs`)

`list_dir(path, showHidden, sort)` reads the directory once, applies the hidden filter
(FILE_ATTRIBUTE_HIDDEN or SYSTEM, plus names starting with `$` at a drive root), sorts in Rust,
and returns the full listing in one IPC call, capped at 50,000 entries with `truncated: true`
beyond that. Folders sort before files in every order. Name order is natural (numeric-aware,
case-insensitive, implemented in-house with tests, no crate). Filter-as-you-type runs in the
renderer on the loaded listing, so typing never crosses IPC.

### 5.4 Operations, progress, cancellation (`fs/ops.rs`)

`start_operation` validates, pre-scans conflicts if the caller has not already resolved them,
registers an `OperationId`, spawns the work on a blocking thread, and returns the id. The thread
emits `op-progress { opId, done, total, bytesDone, bytesTotal, currentPath }` at most every
100 ms and `op-finished { opId, outcome }` once, where `outcome` is `completed`, `cancelled`,
or `failed { error, completedItems }`. `cancel_operation(opId)` sets an atomic flag checked
between items and between 1 MiB copy chunks; a cancelled copy removes the partially written
target file, never the source.

Copy and move walk the source tree first (counting items and bytes) so progress is a real
fraction. Move on the same volume is a rename; across volumes it is copy then delete per item,
so a failure midway leaves every item either fully moved or fully untouched. Items that
completed before a failure stay completed and are reported.

### 5.5 Conflicts (`fs/conflicts.rs`)

`scan_conflicts(sources, dest)` returns the top-level collisions. The renderer shows the dialog
with Replace, Keep both, Skip, and "Apply to all remaining". The choice travels into
`start_operation` as `{ default, perItem }`. Replace never overwrites in place: the existing
target is moved to the Recycle Bin first, then the source is written, so Replace is both
undoable and recoverable. Keep both generates `name (2)`, `name (3)`, up to the first free
number, keeping the extension. Folder-on-folder conflicts: Replace merges and applies the same
choice to nested collisions, Keep both copies as `Folder (2)`, Skip skips the folder.

### 5.6 Session undo (`fs/undo.rs`)

The stack lives in memory for the app's lifetime, holds at most 100 entries, and records the
inverse of each completed operation:

| Operation | Inverse | Precondition checked at undo time |
| --- | --- | --- |
| Rename a to b | Rename b to a | b exists, a does not |
| Move items to dest | Move each back | Each moved item still at dest, original path free |
| Copy items to dest | Move the copies to the Recycle Bin | Each copy still exists |
| New folder or file | Move it to the Recycle Bin | It still exists |
| Delete to Recycle Bin | Restore from the Recycle Bin (`trash::os_limited::restore_all`) | Items still in the bin |
| Replace during copy or move | Restore the replaced file from the bin, then trash the new one | Both conditions above |

Permanent delete is never recorded. A failed precondition drops the entry and reports "Cannot
undo: <name> has changed since". There is no redo in v1. `undo_peek` returns the description
the status bar shows ("Undo rename of report.docx").

### 5.7 Search (`fs/search.rs`)

`start_search(root, query, includeHidden)` returns a `SearchId` and walks `root` with
`walkdir` (symlinks and junctions not followed, so no loops; permission errors on a subfolder
are counted and skipped, not fatal). Matching is case-insensitive substring on the file name.
Results stream as `search-results { searchId, entries }` every 50 hits or 100 ms, then
`search-done { searchId, scanned, skipped, cancelled }`. Starting a new search on a tab cancels
the previous one. Results are capped at 5,000 with a notice.

### 5.8 Watching, thumbnails, shell

- `watch_dir(tabId, path)` installs a `notify` watcher (non-recursive) and emits
  `dir-changed { path }` debounced at 300 ms; the tab refetches its listing. `unwatch(tabId)`
  on tab close or navigation.
- Thumbnails: `filewell://localhost/thumb/<percent-encoded path>` decodes PNG, JPEG, GIF, WebP
  through the `image` crate, resizes to 160 px on the long side, encodes JPEG quality 80 into
  `%LOCALAPPDATA%/com.focalstack.filewell/thumbs/<hash>.jpg` keyed by path, size and mtime, and
  serves it. Generation runs on a bounded blocking pool (4 workers); misses return 404 and the
  tile keeps its icon. Files older than 30 days are pruned at startup. SVG is served as-is.
  `filewell://localhost/file/<path>` serves the full image for the preview pane. Both handlers
  validate the path and refuse anything that is not a regular file.
- `open_path` and `reveal_in_explorer` call the opener plugin from Rust. `open_with` calls
  `SHOpenWithDialog` through the `windows` crate. `list_drives` uses `sysinfo` (mount point,
  label, total and available bytes, kind). `known_folders` uses `dirs` (Desktop, Documents,
  Downloads, Pictures, Music, Videos, home). `list_trash` and `restore_trash` wrap
  `trash::os_limited`.

### 5.9 Database (`db/`)

One SQLite file at `%LOCALAPPDATA%/com.focalstack.filewell/filewell.db`, opened with WAL journal,
`foreign_keys = ON`, `busy_timeout = 5000`. `PRAGMA user_version` carries the schema version;
migrations are numbered SQL files embedded with `include_str!` and applied in one transaction
each. On open, `PRAGMA integrity_check`; a failure renames the file to
`filewell.db.corrupt-<unix ms>` and starts a fresh database with a visible notice on Home.
Every query is parameterized.

```sql
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE favorites (
  id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK (kind IN ('file','dir')),
  position INTEGER NOT NULL, added_at INTEGER NOT NULL);
CREATE TABLE recent_files (
  path TEXT PRIMARY KEY, opened_at INTEGER NOT NULL, open_count INTEGER NOT NULL DEFAULT 1);
CREATE TABLE notes (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER);
CREATE TABLE note_versions (
  id TEXT PRIMARY KEY, note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX note_versions_note ON note_versions(note_id, created_at);
CREATE TABLE todos (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0,
  due_date TEXT, position INTEGER NOT NULL, created_at INTEGER NOT NULL, completed_at INTEGER);
```

Ids are UUID v4 strings so an imported backup from another machine merges without collisions.
Timestamps are Unix milliseconds; `due_date` is an ISO calendar date (`YYYY-MM-DD`).
Recent files keep the newest 200 rows. Settings keys in v1: `theme` (`system|light|dark`),
`showHidden`, `defaultView` (`list|grid`), `checkUpdates`, `panelWidth`, `panelTab`,
`sidebarWidth`.

### 5.10 Notes and versions (`data/notes.rs`)

`save_note(id, title, body)` updates the row and inserts a version snapshot when the previous
snapshot is older than 5 minutes or when the caller passes `reason: "blur" | "close"`. The
same transaction prunes to the newest 50 versions. `delete_note` sets `deleted_at`;
`restore_note` clears it; rows deleted more than 30 days ago are purged at startup. Title is
derived by the renderer from the first line and stored for listing. Body size is capped at
2 MiB per note with a clear error.

### 5.11 Backup format (`backup.rs`)

A `.filewell` file is a zip with two fixed entries: `manifest.json`
`{ "format": "filewell-backup", "version": 1, "createdAt": <ms>, "appVersion": "0.1.0" }` and
`data.json` holding `settings`, `favorites`, `recent`, `notes` (with their versions) and
`todos`. Export opens a native save dialog from Rust. `inspect_backup` returns counts and the
creation date for the confirmation dialog without importing. `import_backup(mode)` rejects
files over 200 MiB, a manifest with an unknown format or a version above the supported one,
and any record that fails field validation (string lengths, enum values, date parsing, UUID
shape); on rejection nothing changes. `replace` deletes all app data and inserts in one
transaction; `merge` upserts notes and todos by id and favorites and recent files by path.

### 5.12 Errors and logging

All commands return `Result<T, FilewellError>`. `ErrorCode` is `NotFound`, `PermissionDenied`,
`AlreadyExists`, `InvalidPath`, `InvalidName`, `Protected`, `Cancelled`, `Io`, `Db`,
`Validation`, `Unsupported`. The renderer maps each code to a calm sentence and never shows a
raw error string as the headline; the detail is available under "Details".
`tauri-plugin-log` writes `%LOCALAPPDATA%/com.focalstack.filewell/logs/filewell.log`, rotating at
5 MiB and keeping 3 files, level `info` in release and `debug` in dev. Failures log the path at
`warn`; successes log counts only. Nothing is logged to the network.

### 5.13 Crate list with reasons

tauri 2 (shell), tauri-plugin-dialog (native pickers, called from Rust), tauri-plugin-opener
(default app and reveal, called from Rust), tauri-plugin-updater and tauri-plugin-process
(signed update check and relaunch), tauri-plugin-log (rotating file log),
tauri-plugin-window-state (remember window geometry), serde and serde_json (IPC), rusqlite
with the `bundled` feature (no system SQLite), trash (Recycle Bin, listing and restore),
notify (folder change events), walkdir (search walk), image with png, jpeg, gif and webp
features (thumbnails), sysinfo with the disk feature (drive cards), dirs (known folders),
windows with Shell features (Open with dialog), zip with deflate (backup container), uuid v4
(stable ids), thiserror (error enum), tempfile as a dev dependency (tests). Versions are
resolved with `cargo add` at implementation time and locked in `Cargo.lock`.

---

## 6. IPC contract

Types cross the boundary as JSON in camelCase (`#[serde(rename_all = "camelCase")]`). The
renderer calls commands only through `src/lib/ipc.ts`, one typed function per command.

### 6.1 Shared types

```ts
type EntryKind = "file" | "dir"; // the link target's kind; links carry isLink
interface Entry { name: string; path: string; kind: EntryKind; size: number; modified: number;
  created: number; hidden: boolean; readonly: boolean; isLink: boolean; ext: string }
interface DirListing { path: string; entries: Entry[]; total: number; truncated: boolean; skipped: number }
interface Sort { key: "name" | "size" | "modified" | "kind"; dir: "asc" | "desc" }
interface Conflict { source: string; target: string; kind: "file" | "dir" }
type Resolution = "replace" | "keepBoth" | "skip";
interface ResolutionPlan { default: Resolution; perItem: Record<string, Resolution> }
interface Drive { mountPoint: string; label: string; totalBytes: number; availableBytes: number;
  kind: "fixed" | "removable" }
interface TrashItem { id: string; name: string; originalPath: string; deletedAt: number }
interface FilewellError { code: ErrorCode; message: string; path?: string }
```

### 6.2 Commands

| Command | Signature | Notes |
| --- | --- | --- |
| `list_dir` | `(path, showHidden, sort) -> DirListing` | 5.3 |
| `stat` | `(path) -> Entry` | |
| `create_folder` / `create_file` | `(parent, name) -> Entry` | Records undo |
| `rename` | `(path, newName) -> Entry` | Records undo |
| `scan_conflicts` | `(sources[], dest) -> Conflict[]` | |
| `start_operation` | `(kind: "copy" or "move", sources[], dest, plan: ResolutionPlan) -> opId` | Events 6.3 |
| `delete_to_trash` | `(paths[]) -> opId` | Records undo |
| `delete_permanent` | `(paths[]) -> opId` | Not undoable; renderer confirms first |
| `cancel_operation` | `(opId)` | |
| `undo` | `() -> { description } or error` | |
| `undo_peek` | `() -> { description } or null` | |
| `start_search` / `cancel_search` | `(root, query, includeHidden) -> searchId` / `(searchId)` | |
| `watch_dir` / `unwatch` | `(tabId, path)` / `(tabId)` | |
| `open_path` / `open_with` / `reveal_in_explorer` | `(path)` | `open_path` also records recent |
| `list_drives` / `known_folders` | `() -> Drive[]` / `() -> Record<string, string>` | |
| `list_trash` / `restore_trash` | `() -> TrashItem[]` / `(ids[])` | |
| `get_settings` / `set_setting` | `() -> Settings` / `(key, value)` | |
| `list_favorites` / `add_favorite` / `remove_favorite` / `reorder_favorites` | | `add_favorite()` without a path opens a folder picker |
| `list_recent` / `clear_recent` | | |
| `list_notes` / `get_note` / `create_note` / `save_note` / `delete_note` / `restore_note` | | 5.10 |
| `list_note_versions` / `restore_note_version` | `(noteId)` / `(versionId)` | Restore saves a snapshot of the current body first |
| `list_todos` / `create_todo` / `update_todo` / `delete_todo` / `reorder_todos` | | |
| `export_backup` / `inspect_backup` / `import_backup` | `() -> path or null` / `() -> summary or null` / `(path, mode)` | Pickers from Rust |
| `get_app_info` | `() -> { version, dataDir }` | |
| `check_for_update` / `install_update` | | Emits `update-available` |

### 6.3 Events (Rust to renderer)

`op-progress`, `op-finished`, `search-results`, `search-done`, `dir-changed`,
`update-available { version, notes }`, and the built-in `tauri://drag-drop` with
`{ paths, position }` for drops from Explorer.

---

## 7. Renderer (`src/`)

### 7.1 Layout

```
src/
  main.tsx              mounts App; in dev without a Tauri host, installs dev/mockBackend
  App.tsx               Shell composition and global key handling
  styles.css            tokens (light and dark), base, component styles
  types.ts              IPC types (section 6)
  lib/ipc.ts            typed invoke wrappers and event subscriptions (the only invoke site)
  lib/commands.ts       command registry: id, title, shortcut, when(), run()
  lib/shortcuts.ts      keymap to command id, focus-aware dispatch
  lib/theme.ts          system, light, dark; sets data-theme on the html element
  lib/format.ts         sizes, dates, natural compare (mirrors Rust for client-side filtering)
  lib/fileTypes.ts      extension to category, color token and icon
  lib/useDrag.ts        pointer-event drag for internal reorders and drops
  store/                zustand stores: tabs, selection, clipboard, operations, settings, panel, undo
  components/ui/        Button, IconButton, Dialog, Menu, Toast, Kbd, Tooltip, Input, Checkbox
  components/shell/     TitleBar (tabs and window controls), Sidebar, SidePanel, StatusBar
  components/home/      HomeView, DriveCard, FavoriteTile, RecentTable
  components/browser/   BrowserView, Toolbar, Breadcrumb, FileList, FileGrid, FileRow, FileTile,
                        ContextMenu, InlineRename, ConflictDialog, ProgressPanel, EmptyState
  components/search/    SearchBar, SearchResults
  components/trash/     TrashView
  components/panel/     PreviewPane, NotesPane, NoteList, NoteEditor, NoteHistory, TodosPane, TodoItem
  components/palette/   CommandPalette
  components/settings/  SettingsView
  dev/mockBackend.ts    installs window.__TAURI_INTERNALS__ with a fake invoke and events over an
                        in-memory filesystem and database, so the renderer runs in a plain browser
  tests/*.test.ts       vitest logic tests
```

### 7.2 State

Stores are small and single-purpose: `tabs` (a list of `{ id, view, path, history, sort,
viewMode, filter }` where `view` is `home`, `browser`, `trash` or `settings`, plus the active
id), `selection` (per tab, ordered paths and the anchor for Shift ranges), `clipboard` (paths
and cut or copy), `operations` (live operations from `op-progress`), `settings` (mirrors the
database, writes through `set_setting`), `panel` (open, width, active tab), `undo` (the
`undo_peek` description). Components read stores; only store actions call `lib/ipc.ts`.

### 7.3 Commands and shortcuts

`lib/commands.ts` is the single source of truth. The palette lists it, the keyboard
dispatcher executes it, menus render from it, and `docs/FEATURE_MAP.md` is checked against
it by a test. Bindings are fixed in v1:

| Shortcut | Command |
| --- | --- |
| Ctrl+K | Command palette |
| Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1 to Ctrl+9 | Tabs |
| Alt+Left, Alt+Right, Alt+Up, Backspace | Back, forward, parent, back |
| Ctrl+L | Focus the breadcrumb path field |
| Ctrl+F | Focus search (filter); Enter in the field starts the subfolder search |
| Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+A | Copy, cut, paste, select all |
| F2, Delete, Shift+Delete | Rename, delete to Recycle Bin, permanent delete (confirm) |
| Enter, Ctrl+Enter | Open, Show in Explorer |
| Ctrl+Shift+N | New folder |
| Ctrl+Z | Undo |
| Ctrl+H | Toggle hidden files |
| Ctrl+Shift+1, Ctrl+Shift+2 | List view, grid view |
| F5 | Refresh |
| Ctrl+Shift+E | Toggle side panel |
| Ctrl+Comma | Settings |
| Arrows, Home, End, PageUp, PageDown, Shift and Ctrl modifiers, type-ahead | List navigation |

Bindings in the note editor follow CodeMirror defaults; the global bindings above apply only
when focus is outside a text field, except Ctrl+K, Ctrl+T, Ctrl+W and Ctrl+Comma, which are
global.

### 7.4 Note editor

CodeMirror 6 (`@codemirror/state`, `view`, `language`, `commands`, `lang-markdown`) with a
Filewell extension `liveMarkdown` that styles headings, emphasis, inline and fenced code, lists,
task checkboxes and links, and hides the syntax marks on every line except the one holding the
cursor. Checkboxes toggle on click; links open on Ctrl+click through `open_path` for local
paths and the opener for `https` URLs. The document stays plain Markdown. Auto-save debounces
500 ms and flushes on blur, tab switch and window close.

### 7.5 Dev harness and verification hooks

`dev/mockBackend.ts` is active only when `import.meta.env.DEV` is true and
`__TAURI_INTERNALS__` is absent, so it is dead code in production. It seeds a fake tree
(drives, known folders, a 10,000-entry folder for the performance surface, images with inline
data URLs, a conflict pair) and a fake database (three notes with versions, five to-dos, two
favorites). Every surface named in `docs/FEATURE_MAP.md` carries a `data-testid` and is driven
by `scripts/verify-ui.mjs`.

---

## 8. Interface design

### 8.1 Frame and regions

Frameless window with a custom title bar (`decorations: false`, `shadow: true`, opaque).
Default 1200 x 760, minimum 720 x 480. Regions, in reading order:

1. **Title bar**: tab strip on the left (folder name, close on hover), window controls on the
   right, drag region between. Height 38 px.
2. **Sidebar** (left, 220 px, collapsible to a 48 px icon rail): Home, Recent, Favorites,
   Recycle Bin; then This PC (drives); then Quick access (known folders); then Favorites
   (pinned folders and files). No deep tree in v1; the breadcrumb handles depth.
3. **Content** (center): Home, Browser, Trash or Settings, per tab.
4. **Side panel** (right, 320 px default, resizable, collapsible): Preview, Notes, To-dos tabs,
   and a reserved fourth slot that renders nothing in v1.
5. **Status bar** (bottom, 26 px): item count, selection count and size, hidden-files state,
   undo hint, operation summary when one runs.

**Home** reading order: drive cards (what is where and how full), Favorites tiles (where I go),
Recent table (what I touched). One primary action, "New", in the toolbar.

**Browser** reading order: breadcrumb and toolbar (where am I, what can I do), the list (the
work), the status bar (how much). Toolbar: Back, Forward, Up, breadcrumb (click a segment to
jump, Ctrl+L to edit as text), filter field, view toggle, New, sort menu, side panel toggle.

**Responsiveness** (window width): below 1100 px the side panel overlays the content instead
of docking; below 900 px the sidebar collapses to the icon rail; Home tiles use
`grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))`; the Recent table drops the
Location column below 800 px. No horizontal scroll at any supported size. Every clickable
control is at least 32 x 32 px; list rows are 28 px, grid tiles have a 32 px hit area.

### 8.2 Tokens

Tokens live in `styles.css` on `:root`, redefined under `[data-theme="dark"]` and
`[data-theme="light"]`; `lib/theme.ts` sets the attribute from the setting or from
`prefers-color-scheme`. The chrome is monochrome; color carries information only.

| Token | Dark | Light |
| --- | --- | --- |
| `--bg-canvas` | `#0b0b0c` | `#f4f4f2` |
| `--bg-surface` | `#111113` | `#ffffff` |
| `--bg-raised` | `#18181b` | `#ffffff` |
| `--bg-overlay` | `#1f1f23` | `#ffffff` |
| `--bg-hover` / `--bg-active` | white at 5% / 9% | black at 4% / 8% |
| `--border-faint` / `--border` / `--border-strong` | white at 6% / 14% / 26% | black at 6% / 14% / 24% |
| `--text-primary` / `--text-muted` / `--text-faint` | `#f2f2f0` / `#a3a3a0` / `#78787a` | `#1a1a1a` / `#5c5c5a` / `#8a8a88` |
| `--accent` / `--accent-faint` | `#7aa2f7` / 14% | `#2f62c7` / 12% |
| `--success` / `--warning` / `--error` | `#46b37e` / `#d9a13f` / `#e05d55` | `#2f8a5e` / `#a8771f` / `#c4463e` |

`--accent` marks selection and focus only. `--text-faint` is never used for text under 13 px
in light mode (3.3:1); metadata uses `--text-muted` (5.6:1 on white, 8:1 on dark surface).
File-type tones (six, muted, information only, dark and light variants as tokens): document
blue, image rose, code green, archive gold, media violet, data amber. Spacing scale
`--s-1` 4 px to `--s-6` 32 px; radii 4, 6, 10, 14; z ladder nav 20, drawer 30, popover 40,
modal 50, toast 60; shadows are offset only, no colored halos.

### 8.3 Type

Geist Sans (variable, OFL) for the interface voice and JetBrains Mono (OFL) for machine data
(sizes, dates, paths, shortcut keys), both vendored under `src/assets/fonts/` with their
license files; no font loads from the network. Scale: 11 (metadata, 1.4), 13 (body, 1.5),
16, 20, 26 (Home headline, 600 weight). Tabular figures (`font-variant-numeric: tabular-nums`)
on every size and date column. Uppercase micro-labels tracked +0.04 em. Flush left
everywhere; no justified text; no widows in dialog copy.

### 8.4 States and copy

Every list surface has an empty state with one sentence and, where it applies, one action
(empty folder: "This folder is empty." with New folder; no results: "Nothing matches
<query>." with Clear; no notes: "No notes yet." with New note). Loading shows a skeleton row
set after 150 ms, never a spinner for short waits. Errors are sentences naming the file and the
cause, with Details collapsed. Copy rules: no emoji, no em or en dashes, no exclamation marks,
sentence case, verbs on buttons (Replace, Keep both, Skip, Restore), never "Oops" or "Uh oh".
Destructive confirmations state the count and the irreversibility in one line each.

### 8.5 Accessibility

The file list is `role="grid"` with `aria-rowcount`, `aria-selected` and a roving tab index;
all shortcuts above work without a mouse; visible focus rings use `--accent`; selection and
state survive in more than one channel (background plus a check icon in grid tiles, weight in
list rows); dialogs trap focus and return it; `prefers-reduced-motion` disables the 120 ms
transitions. Contrast is checked by a script over every text token on every surface token in
both themes and fails the gate on any pair under 4.5:1 for body text.

---

## 9. Security and privacy

- No `tauri-plugin-fs`, no `tauri-plugin-shell`, no asset protocol. Capabilities:
  `core:default` plus `core:window:allow-start-dragging`, `allow-minimize`,
  `allow-toggle-maximize`, `allow-close`.
- CSP in `tauri.conf.json`: `default-src 'self'; img-src 'self' data: http://filewell.localhost
  https://filewell.localhost; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'`.
  No `connect-src` is needed: the updater runs in Rust.
- Network policy: the only outbound call is the updater's fetch of `latest.json` from
  `https://github.com/focalstack-lex/Filewell/releases/latest/download/latest.json`, gated by
  the `checkUpdates` setting, and the download of the installer the user confirmed. Update
  artifacts must verify against the committed public key or they are refused.
- Secrets: the updater private key and password are environment variables
  (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`), named in `.env.example`,
  stored as GitHub Actions secrets. `.env` is ignored. The invariant lint fails on committed
  key patterns.
- All SQL is parameterized; the database is per user under `%LOCALAPPDATA%`.
- Zip import reads only the two fixed entry names and never extracts to disk.
- Dependencies are audited (`npm audit`, `cargo audit`) in the release gate; findings are
  triaged in the journal before any tag.
- Release artifacts carry no dev harness (`import.meta.env.DEV` guard), no debug logging at
  `info`, and the window has no devtools in release.

---

## 10. Testing and verification

| Gate | Tool | Covers |
| --- | --- | --- |
| `npm run typecheck` | tsc | Renderer types |
| `npm run lint` | ESLint with `filewell-invariants` | Zero emoji, zero em or en dash, no silent catch, no committed secret, hooks rules |
| `npm test` | vitest | Natural sort, `name (2)` generator mirror, filter, shortcuts dispatch, command registry vs FEATURE_MAP, format helpers, store reducers |
| `npm run verify:ui` | Playwright over the mocked renderer | Every FEATURE_MAP surface: Home, Browser list and grid, 10,000-entry scroll, search, conflict dialog, progress panel, context menu, rename, palette, notes editor and history, to-dos, trash, settings, both themes, 800 px and 1200 px widths; evidence in `reports/ui-verification/<ts>/`; a page error or a crashed renderer fails the run |
| `cargo test` | Rust unit tests with `tempfile` | `paths.rs` rules, natural sort, listing and hidden filter, create, rename, copy, move, conflicts and keep-both naming, undo inverses and dropped preconditions, cancellation, search batching and cancel, migrations from empty and from each prior version, notes versioning and pruning, backup round trip and every rejection rule. Recycle Bin tests run only with `FILEWELL_TRASH_TESTS=1` because they touch the real bin |
| `cargo clippy -- -D warnings` | clippy | Including denied unwrap, expect, panic |
| `npm run map:code:check` | generator | `docs/CODE_MAP.md` matches the source |
| `npm run verify:contrast` | script | Token pairs in both themes |

`npm run verify` runs typecheck, lint, test, contrast and map check; `npm run verify:all`
adds the UI drive. CI (`verify.yml`) is the authority: `frontend` and `ui` on Ubuntu,
`native` on Windows (cargo test and clippy). Local runs are advisory. Every gate run that
changes state is journaled with its real output.

---

## 11. Delivery: five implementation plans

Each piece ends with software that runs, passes the gate, and is journaled and pushed.

1. **Foundation**: scaffold (project-scaffolding playbook, MIT license, README, gitignore,
   `.env.example`, code map, feature map, journal), Tauri shell with custom title bar and
   window controls, tokens and theme switch, database with migrations and settings, command
   registry, shortcuts, palette, toast and dialog primitives, dev harness, lint invariants,
   vitest, verify scripts, CI. Deliverable: the app opens on an empty Home with working tabs,
   theme and palette.
2. **File manager**: listing, sidebar, breadcrumb, list and grid views, selection, context
   menu, all file operations with progress, conflicts, undo, Recycle Bin view, drag in from
   Explorer, open and Open with, thumbnails, preview pane, Home with drives, favorites and
   recent. Deliverable: Filewell replaces Explorer for daily browsing.
3. **Search**: filter field, subfolder search with streaming and cancel, results view.
4. **Productivity**: notes list and editor, versions, soft delete, to-dos.
5. **Portability and release**: export and import, updater, release workflow, installer,
   signing request, deploy-checklist gate, first tagged release.

The LLM assistant is a separate spec after v1 ships.

---

## 12. Open external dependencies

- SignPath open-source code signing approval (apply when the first release candidate exists).
- Nothing else is pending; every product and technical choice above is decided.
