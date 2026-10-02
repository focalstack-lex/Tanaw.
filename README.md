# Tanaw

A calm, focused file manager for Windows, with notes and to-dos beside your files.
Free and open source under the MIT license.

Tanaw is being built in five pieces (see `docs/superpowers/specs/2026-10-02-tanaw-v1-design.md`).
Piece 1, the foundation, is what this repository holds today: the native shell, tabs, themes,
settings, the command palette and the verification gate.

## Run

Requirements: Node 24, a stable Rust toolchain (1.80 or newer), and WebView2 (part of Windows 11,
installed with the app on Windows 10).

```
npm install
npm run dev        # the native app (tauri dev)
npm run dev:ui     # the renderer alone, in a browser, with mocked IPC
```

## Verify

```
npm run verify     # typecheck, lint invariants, unit tests, contrast, code map freshness
npm run verify:ui  # drives the mocked renderer with Playwright; evidence in reports/ui-verification
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
```

CI (`.github/workflows/verify.yml`) runs the same gates and is the authority.

## Build

```
npm run build:release   # NSIS installer under src-tauri/target/release/bundle/nsis
```

## Find your way

- `docs/CODE_MAP.md`: generated file inventory with purposes and anchors (`npm run map:code`).
- `docs/FEATURE_MAP.md`: every surface, shortcut, IPC command and how the UI drive reaches it.
- `journal/`: one file per day of development, newest entry last.
