# Tanaw Feature Map (agent-facing)

What every surface is, how a user reaches it, how the UI drive reaches it, and which IPC
commands sit under it. Update this file in the same change as any interface change; when it
and the code disagree, the code wins and this file is fixed. `src/tests/featureMap.test.ts`
checks the Shortcuts table against `src/lib/appCommands.ts`.

## Surfaces

| Surface | Test id | Component | Reached by |
| --- | --- | --- | --- |
| Application shell | `app` | `src/App.tsx` | Always rendered |
| Title bar with tabs and window controls | `titlebar`, `tab`, `tab-new` | `src/components/shell/TitleBar.tsx` | Always; Ctrl+T adds a tab, Ctrl+W closes one |
| Sidebar | `sidebar` | `src/components/shell/Sidebar.tsx` | Always; collapses to an icon rail below 900 px |
| Content area | `content` | `src/App.tsx` | Always; shows the active tab's view |
| Home view | `home-view` | `src/components/home/HomeView.tsx` | Default view of a new tab; sidebar Home |
| Settings view | `settings-view`, `setting-theme` | `src/components/settings/SettingsView.tsx` | Sidebar Settings, Ctrl+Comma, palette "Open settings" |
| Side panel (Preview, Notes, To-dos) | `side-panel` | `src/components/shell/SidePanel.tsx` | Open by default; Ctrl+Shift+E or the status bar button toggles it; overlays the content below 1100 px |
| Status bar | `statusbar`, `status-hidden` | `src/components/shell/StatusBar.tsx` | Always |
| Command palette | `command-palette` | `src/components/palette/CommandPalette.tsx` | Ctrl+K; Escape or the backdrop closes it |
| Toasts | `toasts` | `src/components/ui/Toasts.tsx` | Any store reporting an error |
| Confirm dialog | `confirm-dialog` | `src/components/ui/ConfirmDialog.tsx` | `useUi.getState().ask(...)`; no foundation flow asks yet |

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
7. Narrow window: at 800 x 600 the sidebar is at most 48 px wide and `document.documentElement.scrollWidth` equals `window.innerWidth`.

## Known traps

- The dev harness (`src/dev/mockBackend.ts`) runs only when `import.meta.env.DEV` is true and no Tauri host is present. Never mask a feature to make a drive pass.
- `dragDropEnabled: true` (needed for drops from Explorer) disables HTML5 drag and drop inside the webview on Windows; internal drags use pointer events.
- Custom URI schemes are served as `http://tanaw.localhost` on Windows; the CSP lists that origin.
- Vite dev needs the inline React refresh preamble, so `devCsp` allows inline scripts; the release `csp` does not.
