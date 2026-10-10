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
| `Ctrl+Shift+E` | `panel.toggle` | outside text fields |
| `Ctrl+H` | `view.toggleHidden` | outside text fields |
| `Ctrl+Shift+1` | `view.list` | outside text fields |
| `Ctrl+Shift+2` | `view.grid` | outside text fields |

Palette-only commands: `nav.home`, `theme.system`, `theme.light`, `theme.dark`.

## IPC

| Command | Rust | Renderer caller |
| --- | --- | --- |
| `get_settings` | `src-tauri/src/data/settings.rs` | `useSettings.load` |
| `set_setting(key, value)` | `src-tauri/src/data/settings.rs` | `useSettings.update` |
| `get_app_info` | `src-tauri/src/app.rs` | `App` boot effect |
| `plugin:window` minimize, toggle_maximize, close, is_maximized, start_dragging | Tauri core, capability `src-tauri/capabilities/default.json` | `TitleBar` |

Events: none yet (piece 2 adds `op-progress`, `op-finished`, `dir-changed`).

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

Every page load, and the end of each browser context, fails the run if a `.toast-error` is visible; any console error or uncaught page error fails the run.

## Known traps

- The dev harness (`src/dev/mockBackend.ts`) runs only when `import.meta.env.DEV` is true and no Tauri host is present. Never mask a feature to make a drive pass.
- `dragDropEnabled: true` (needed for drops from Explorer) disables HTML5 drag and drop inside the webview on Windows; internal drags use pointer events.
- Custom URI schemes are served as `http://filewell.localhost` on Windows; the CSP lists that origin.
- Vite dev needs the inline React refresh preamble, so `devCsp` allows inline scripts; the release `csp` does not.
- WebView2 keeps the browser's page menu and accelerators (reload, print, find, view source, back and forward) unless the page claims them, and Tauri has no window option for it. `src/lib/browserGuard.ts`, installed in `src/main.tsx`, prevents their default action; it never stops propagation, so the app can still bind F5 and Ctrl+F as commands. Text fields keep the native cut, copy and paste menu.
- WebView2 ignores `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` when the app passes its own browser arguments. To drive the real native webview, add `--remote-debugging-port` through a `tauri dev --config` override with `additionalBrowserArgs`, then use Playwright `connectOverCDP`.
- Closing the app with `taskkill` without `/F` sends WM_CLOSE to the hidden event-loop window as well and can leave a windowless process. Test closing with WM_CLOSE to the main window (Alt+F4 semantics).
