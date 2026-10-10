# Filewell Feature Map (agent-facing)

What every surface is, how a user reaches it, how the UI drive reaches it, and which IPC
commands sit under it. Update this file in the same change as any interface change; when it
and the code disagree, the code wins and this file is fixed. `src/tests/featureMap.test.ts`
checks the Shortcuts table against `src/lib/appCommands.ts`.

## Surfaces

| Surface | Test id | Component | Reached by |
| --- | --- | --- | --- |
| Application shell | `app` | `src/App.tsx` | Always rendered |
| Title bar with tabs and window controls | `titlebar`, `tab`, `tab-new` | `src/components/shell/TitleBar.tsx` | Always; Ctrl+T adds a tab, Ctrl+W closes one; tabs keep at least 96 px and scroll sideways (wheel too) when they outnumber the strip, the active tab is kept in view, and New tab sits outside the scroller |
| Sidebar | `sidebar` | `src/components/shell/Sidebar.tsx` | Always; collapses to an icon rail below 900 px |
| Content area | `content` | `src/App.tsx` | Always; shows the active tab's view |
| Home view | `home-view` | `src/components/home/HomeView.tsx` | Default view of a new tab; sidebar Home |
| Settings view | `settings-view`, `setting-theme` | `src/components/settings/SettingsView.tsx` | Sidebar Settings, Ctrl+Comma, palette "Open settings" |
| Side panel (Preview, Notes, To-dos) | `side-panel` | `src/components/shell/SidePanel.tsx` | Docked open at 1100 px and wider; below that it starts closed, overlays the content when opened, and Escape dismisses it; crossing 1100 px closes or reopens it (`src/store/panel.ts`); Ctrl+Shift+E or the status bar button toggles it |
| Status bar | `statusbar`, `status-hidden` | `src/components/shell/StatusBar.tsx` | Always |
| Command palette | `command-palette` | `src/components/palette/CommandPalette.tsx` | Ctrl+K; Escape or the backdrop closes it wherever focus is; Tab stays on the input (a combobox with `aria-activedescendant`); the active command scrolls into view; focus returns to the opener |
| Toasts | `toasts` | `src/components/ui/Toasts.tsx` | Any store reporting an error |
| Confirm dialog | `confirm-dialog` | `src/components/ui/ConfirmDialog.tsx` | `useUi.getState().ask(...)`; no foundation flow asks yet; focus returns to the opener (`src/lib/useRestoreFocus.ts`) |
| Browser view (toolbar, breadcrumb, list or grid) | `browser-view`, `browser-toolbar`, `nav-back`, `nav-forward`, `nav-up`, `breadcrumb`, `path-input`, `file-list`, `file-row`, `file-grid`, `file-tile`, `listing-notice` | `src/components/browser/BrowserView.tsx` and siblings | A drive card, a sidebar place, a breadcrumb, double-click on a folder, Ctrl+L and a typed path |
| Context menu | `context-menu` | `src/components/browser/ContextMenu.tsx` | Right-click a row or tile; Escape or Tab closes it and focus returns to the view |
| Sidebar places | `place-drive`, `place-folder` | `src/components/shell/Sidebar.tsx` | Always; This PC and Folders sections, headings hidden in the icon rail |
| Home drive cards | `drive-card` | `src/components/home/HomeView.tsx` | Home |
| Status bar counts | `status-items`, `status-selection` | `src/components/shell/StatusBar.tsx` | Browser tabs show item and selection counts |

## Shortcuts

Fixed bindings (spec 7.3). Scope `global` fires even while a text field has focus.

| Shortcut | Command id | Scope |
| --- | --- | --- |
| `Ctrl+K` | `app.palette` | global |
| `Ctrl+T` | `tab.new` | global |
| `Ctrl+W` | `tab.close` | global |
| `Ctrl+Tab` | `tab.next` | global |
| `Ctrl+Shift+Tab` | `tab.previous` | global |
| `Ctrl+<n>` | `tab.select.<n>` | global, n = 1 to 9 |
| `Ctrl+Comma` | `app.settings` | global |
| `Alt+Left` | `nav.back` | outside text fields |
| `Alt+Right` | `nav.forward` | outside text fields |
| `Alt+Up` | `nav.up` | outside text fields |
| `Ctrl+L` | `nav.path` | outside text fields |
| `F5` | `view.refresh` | outside text fields |
| `Ctrl+A` | `edit.selectAll` | outside text fields |
| `Ctrl+Shift+E` | `panel.toggle` | outside text fields |
| `Ctrl+H` | `view.toggleHidden` | outside text fields |
| `Ctrl+Shift+1` | `view.list` | outside text fields |
| `Ctrl+Shift+2` | `view.grid` | outside text fields |

Palette-only commands: `nav.home`, `theme.system`, `theme.light`, `theme.dark`, `sort.name`, `sort.modified`, `sort.kind`, `sort.size`, `file.openWith`, `file.reveal`, `file.copyPath`.

In the file list and grid: arrows, Shift+arrows, Home, End, PageUp, PageDown, Ctrl+Space, Enter (open), Ctrl+Enter (Show in Explorer), Backspace (back), Escape (clear the selection) and type-ahead are handled by `src/components/browser/useFileKeys.ts`, not the command registry. `Ctrl+Shift+1` and `Ctrl+Shift+2` switch the current tab between list and grid.

## IPC

| Command | Rust | Renderer caller |
| --- | --- | --- |
| `get_settings` | `src-tauri/src/data/settings.rs` | `useSettings.load` |
| `set_setting(key, value)` | `src-tauri/src/data/settings.rs` | `useSettings.update` |
| `get_app_info` | `src-tauri/src/app.rs` | `App` boot effect |
| `plugin:window` minimize, toggle_maximize, close, is_maximized, start_dragging | Tauri core, capability `src-tauri/capabilities/default.json` | `TitleBar` |
| `list_dir(path, showHidden, sort)`, `stat(path)` | `src-tauri/src/fs/listing.rs` | `useListings.load`, mock fake disk |
| `watch_dir(tabId, path)`, `unwatch(tabId)`, event `dir-changed` | `src-tauri/src/fs/watch.rs` | `BrowserView` |
| `list_drives`, `known_folders` | `src-tauri/src/shell.rs` | `usePlaces.load` |
| `open_path`, `open_with`, `reveal_in_explorer` | `src-tauri/src/shell.rs` | `src/lib/fileActions.ts` |

Events: `dir-changed { path }` (debounced 300 ms). Piece 2b adds `op-progress` and `op-finished`.

## Drive recipes (`npm run verify:ui`)

1. Shell: wait for `[data-testid="app"]`, assert titlebar, sidebar, content, statusbar visible.
2. Tabs: `Control+KeyT` makes two `[data-testid="tab"]`; `Control+KeyW` returns to one.
3. Palette: `Control+KeyK` shows `[data-testid="command-palette"]`; typing `settings` and `Enter` shows `[data-testid="settings-view"]`.
4. Theme: selecting `light` in `[data-testid="setting-theme"]` sets `html[data-theme="light"]`; selecting `dark` restores it.
5. Side panel: `Control+Shift+KeyE` hides `[data-testid="side-panel"]`; again shows it.
6. Hidden files: `Control+KeyH` makes `[data-testid="status-hidden"]` read "Hidden files shown".
7. Palette focus: with `tab-new` focused, `Control+KeyK`, `Tab` keeps focus inside `.palette`, `Escape` closes it, and focus is back on `tab-new`.
8. Palette scrolling: 15 x `ArrowDown` leaves the `aria-selected` option inside the list's visible box and named by the input's `aria-activedescendant`.
9. Browser chrome: a `contextmenu` on `content` and `keydown` F5, Ctrl+R, Ctrl+P, Ctrl+F are `defaultPrevented`; a text input keeps its menu.
10. Layout: at 800 x 600 and at the 720 x 480 minimum, the sidebar is a 40 to 48 px rail and no region (`titlebar`, `.titlebar-tabs`, `sidebar`, `content`, `statusbar`, `side-panel`) has `scrollWidth` over `clientWidth` or extends past the window.
11. Many tabs: 12 tabs at 720 px keep `tab-new` at full width and reachable by `elementFromPoint`, close buttons at least 16 px, and the active tab inside the strip.
12. Narrow window: a 1024 x 700 window starts with the panel closed, the theme select is the `elementFromPoint` at its center, `Control+Shift+KeyE` opens the overlay and `Escape` dismisses it.
13. Places: Home shows 2 `drive-card`s; the sidebar lists 2 `place-drive` and 7 `place-folder` entries.
14. Drive: clicking the first `drive-card` shows `file-list` with rows Program Files, Users, Windows (hidden entries filtered) and crumb `C:`.
15. History: double-click Users then dev, click the `C:` crumb, then `Alt+ArrowLeft` twice, `Alt+ArrowRight` and `Alt+ArrowUp` land on dev, Users, dev, Users.
16. Big folder: `Control+KeyL`, type `D:\Big folder`, Enter; `file-00001.txt` shows in under 2 s, `aria-rowcount` is 10,001, fewer than 100 rows are in the DOM, and `End` selects `file-10000.txt`.
17. Selection: in `C:\Users\dev\Documents` rows are in natural order; click, `Shift+ArrowDown` twice selects 3 and `status-selection` starts with "3 selected"; `Control+KeyA` selects all 4.
18. Grid: `Control+Shift+Digit2` shows `file-grid` with 4 `file-tile`s; `Control+Shift+Digit1` returns to `file-list`.
19. Context menu: right-click `Report.docx` shows `context-menu` with Open, Open with, Show in Explorer and a Copy item; `Escape` closes it and focus returns to `file-list`.
20. Shell calls: `Enter` records `open`, `Control+Enter` records `reveal`, the menu's Open with records `openWith` in `window.__filewellMock.opened`.
21. Missing folder: typing `Q:\nowhere` shows "That item no longer exists." with one Try again button.
22. Browser at 720: the browser view in `C:\Users\dev\Documents` passes the layout report at 720 x 480 and no error toast is visible.

Every page load, and the end of each browser context, fails the run if a `.toast-error` is visible; any console error or uncaught page error fails the run.

## Known traps

- The dev harness (`src/dev/mockBackend.ts`) runs only when `import.meta.env.DEV` is true and no Tauri host is present. Never mask a feature to make a drive pass.
- `dragDropEnabled: true` (needed for drops from Explorer) disables HTML5 drag and drop inside the webview on Windows; internal drags use pointer events.
- Custom URI schemes are served as `http://filewell.localhost` on Windows; the CSP lists that origin.
- Vite dev needs the inline React refresh preamble, so `devCsp` allows inline scripts; the release `csp` does not.
- WebView2 keeps the browser's page menu and accelerators (reload, print, find, view source, back and forward) unless the page claims them, and Tauri has no window option for it. `src/lib/browserGuard.ts`, installed in `src/main.tsx`, prevents their default action; it never stops propagation, so the app can still bind F5 and Ctrl+F as commands. Text fields keep the native cut, copy and paste menu.
- WebView2 ignores `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` when the app passes its own browser arguments. To drive the real native webview, add `--remote-debugging-port` through a `tauri dev --config` override with `additionalBrowserArgs`, then use Playwright `connectOverCDP`.
- Closing the app with `taskkill` without `/F` sends WM_CLOSE to the hidden event-loop window as well and can leave a windowless process. Test closing with WM_CLOSE to the main window (Alt+F4 semantics).
- Each tab watches only while it is shown (the view unwatches on unmount); a background tab reloads when it is shown again.
