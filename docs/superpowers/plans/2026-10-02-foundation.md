# Tanaw Foundation (Piece 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Tauri 2 desktop app that opens on an empty Home with working tabs, a custom title bar, light and dark themes persisted in SQLite, a command palette, Explorer-style shortcuts, and the full verification gate (lint invariants, unit tests, driven UI verification, cargo test, clippy, code map, CI).

**Architecture:** Approach A from the spec: the Rust core owns the database and every side effect; the React renderer only displays and calls typed commands through one `lib/ipc.ts`. The renderer runs in a plain browser through a mocked-IPC harness so Playwright can drive it without Rust. Every directive that a linter can check is enforced by a linter.

**Tech Stack:** Tauri 2 (Rust stable), React 19, TypeScript, Vite, zustand, lucide-react, rusqlite (bundled), tauri-plugin-log, tauri-plugin-window-state, ESLint with custom invariant rules, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-filewell-v1-design.md`. Section numbers below refer to it.

## Global Constraints

- Platform: Windows 10 and 11 x64 only (spec header). The app lives at the repository root.
- No emoji anywhere; no em dash or en dash anywhere, in code, copy, comments, docs or commits.
- Copy rules (8.4): sentence case, no exclamation marks, verbs on buttons, errors are calm sentences naming the file and cause, never "Oops".
- Renderer never touches the filesystem or database (4.1). No `tauri-plugin-fs`, no `tauri-plugin-sql`, no asset protocol. Capabilities are exactly `core:default` plus the four window-control permissions (9).
- Every command returns `Result<T, TanawError>`; command code never panics: `clippy::unwrap_used`, `clippy::expect_used`, `clippy::panic` denied (4.2). Test modules may allow them locally.
- `lib/ipc.ts` is the only file that calls `invoke` (6). `lib/commands.ts` is the single source of truth for shortcuts (7.3). Bindings are fixed (7.3 table).
- Tokens live in `styles.css` under `:root[data-theme="dark"]` and `:root[data-theme="light"]` with the exact values of the 8.2 table. Chrome stays monochrome; `--accent` marks selection and focus only.
- Fonts: Geist Sans and JetBrains Mono vendored under `src/assets/fonts/` with their license files (8.3). Nothing loads from the network.
- Window: `decorations: false`, `shadow: true`, 1200 x 760 default, 720 x 480 minimum, label `main` (8.1).
- CSP (9): `default-src 'self'; img-src 'self' data: http://tanaw.localhost https://tanaw.localhost; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'`.
- Database at `%LOCALAPPDATA%/com.focalstack.tanaw/tanaw.db`, WAL, foreign keys on, busy timeout 5000, `user_version` migrations, integrity check with quarantine (5.9). Settings keys and bounds: `theme`, `showHidden`, `defaultView`, `checkUpdates`, `panelWidth`, `panelTab`, `sidebarWidth`.
- Verification (10): `npm run verify` = typecheck, lint, test, contrast, map check; `npm run verify:ui` = Playwright drive with evidence in `reports/ui-verification/<stamp>/`; `cargo test`; `cargo clippy --all-targets -- -D warnings`. CI is the authority; local runs are advisory.
- Every change is journaled in `journal/2026-10-02.md` (or the current date) with the real command output, and pushed.
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## How code blocks in this plan work

Every file this plan creates appears once, in full, as a fenced block whose info string carries `path=<repo-relative path>`. A later task that changes a file repeats the whole file with the same path. Tooling may extract these blocks mechanically; a human copies them verbatim. There are no partial snippets to merge by hand.

## File structure

| Path | Responsibility |
| --- | --- |
| `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html` | Renderer toolchain (Task 1) |
| `eslint.config.js`, `eslint-rules/tanaw-invariants.js` | Lint gate with the four directive invariants (Task 1) |
| `scripts/generate-code-map.mjs`, `docs/CODE_MAP.md` | Agent navigation map, generated (Task 1) |
| `.github/workflows/verify.yml` | CI gate: frontend (Task 1), ui (Task 4), native (Task 5) |
| `src-tauri/Cargo.toml`, `tauri.conf.json`, `capabilities/default.json`, `build.rs`, `icons/` | Native shell configuration (Task 2) |
| `src-tauri/src/{main,lib,error,state,app}.rs`, `db/mod.rs`, `db/migrations/0001_init.sql`, `data/{mod,settings}.rs` | Rust core: errors, state, database, settings, app info (Task 2) |
| `src/types.ts`, `src/lib/{ipc,errors,defaults,theme,shortcuts,commands,appCommands}.ts` | Contracts and pure logic (Task 3) |
| `src/store/{tabs,settings,panel,ui}.ts` | zustand stores (Task 3) |
| `src/components/ui/*`, `shell/*`, `home/HomeView.tsx`, `settings/SettingsView.tsx`, `palette/CommandPalette.tsx` | Interface (Task 3) |
| `src/styles.css`, `src/assets/fonts/` | Tokens, base and component styles, vendored fonts (Task 3) |
| `src/dev/mockBackend.ts`, `src/main.tsx`, `src/App.tsx` | Harness and composition (Task 3) |
| `src/tests/*.test.ts` | vitest: invariants (Task 1), shortcuts, commands, tabs, theme (Task 3), feature map (Task 4) |
| `scripts/verify-contrast.mjs`, `scripts/verify-ui.mjs`, `docs/FEATURE_MAP.md` | Contrast gate, UI drive, interface map (Task 4) |

---

### Task 1: Toolchain, invariant lint gate, code map, CI frontend job

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/vite-env.d.ts`
- Create: `.gitignore`, `LICENSE`, `README.md`, `.env.example`
- Create: `eslint.config.js`, `eslint-rules/tanaw-invariants.js`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css` (minimal; Task 3 replaces all three)
- Create: `scripts/generate-code-map.mjs` (copied from the project-scaffolding skill, then adapted), `docs/CODE_MAP.md` (generated)
- Create: `.github/workflows/verify.yml`
- Test: `src/tests/invariants.test.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `dev:ui`, `build`, `build:release`, `typecheck`, `lint`, `test`, `verify:contrast`, `verify:ui`, `map:code`, `map:code:check`, `verify`, `verify:all` (Tasks 3 to 5 rely on them; `verify:contrast` and `verify:ui` get their scripts in Task 4).
- Produces: the ESLint plugin `tanaw` with rules `no-emoji`, `no-dash-punctuation`, `no-silent-catch`, `no-hardcoded-secret`.

- [ ] **Step 1: Create package.json and install the declared dependencies**

```json path=package.json
{
  "name": "tanaw",
  "private": true,
  "version": "0.1.0",
  "description": "Tanaw: a calm, focused file manager for Windows, with notes and to-dos beside your files.",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "dev:ui": "vite",
    "build": "tsc && vite build",
    "build:release": "tauri build",
    "preview": "vite preview",
    "tauri": "tauri",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "verify:contrast": "node scripts/verify-contrast.mjs",
    "verify:ui": "node scripts/verify-ui.mjs",
    "map:code": "node scripts/generate-code-map.mjs",
    "map:code:check": "node scripts/generate-code-map.mjs --check",
    "verify": "npm run typecheck && npm run lint && npm test && npm run verify:contrast && npm run map:code:check",
    "verify:all": "npm run verify && npm run verify:ui"
  }
}
```

Run (versions come from the registry at install time, never from memory):

```bash
npm install react react-dom @tauri-apps/api zustand lucide-react
npm install --save-dev typescript vite @vitejs/plugin-react @types/react @types/react-dom @types/node @tauri-apps/cli eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals vitest playwright
```

Expected: `package.json` gains `dependencies` and `devDependencies`; `package-lock.json` is created. Record the resolved versions in the journal.

- [ ] **Step 2: Renderer toolchain files**

```ts path=vite.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vite options tailored for Tauri development: a fixed port (tauri.conf.json
// devUrl), no screen clearing so Rust errors stay visible, and src-tauri kept
// out of the watcher. The `test` block configures vitest.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    include: ["src/tests/**/*.test.ts"],
    environment: "node",
  },
});
```

```json path=tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```json path=tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

```html path=index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark light" />
    <title>Tanaw</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```ts path=src/vite-env.d.ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Repository hygiene files**

```gitignore path=.gitignore
# Dependencies and build output
node_modules/
dist/
src-tauri/target/
src-tauri/gen/schemas/

# Local configuration and secrets
.env
*.local
.scratch/

# Evidence and logs
reports/
*.log

# Editors and OS
.vscode/*
!.vscode/extensions.json
.idea/
.DS_Store
Thumbs.db
```

```text path=LICENSE
MIT License

Copyright (c) 2026 Lex Matondo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

````md path=README.md
# Tanaw

A calm, focused file manager for Windows, with notes and to-dos beside your files.
Free and open source under the MIT license.

Tanaw is being built in five pieces (see `docs/superpowers/specs/2026-10-02-filewell-v1-design.md`).
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
````

```text path=.env.example
# Release signing for the Tauri updater (piece 5 of the v1 plan). The public key
# lives in src-tauri/tauri.conf.json; these two values exist only in the release
# environment and in GitHub Actions secrets. Never commit the real values.
TAURI_SIGNING_PRIVATE_KEY=
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=
```

- [ ] **Step 4: Write the failing invariant test**

```ts path=src/tests/invariants.test.ts
import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import tanaw from "../../eslint-rules/tanaw-invariants.js";

// Each sample is assembled at runtime so this test file itself stays clean
// under the very rules it exercises.
const linter = new Linter();

function ruleIds(code: string, rule: string): string[] {
  return linter
    .verify(
      code,
      [{ files: ["**/*.js"], plugins: { tanaw }, rules: { [`tanaw/${rule}`]: "error" } }],
      { filename: "sample.js" },
    )
    .map((message) => message.ruleId ?? "");
}

describe("tanaw invariant rules", () => {
  it("flags an emoji character", () => {
    expect(ruleIds(`const s = "${String.fromCodePoint(0x1f600)}";`, "no-emoji")).toEqual(["tanaw/no-emoji"]);
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
    expect(ruleIds(`const k = "${token}";`, "no-hardcoded-secret")).toEqual(["tanaw/no-hardcoded-secret"]);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run src/tests/invariants.test.ts`
Expected: FAIL, "Failed to resolve import ../../eslint-rules/tanaw-invariants.js".

- [ ] **Step 6: Write the invariant rules and the ESLint config**

```js path=eslint-rules/tanaw-invariants.js
/**
 * Tanaw invariant rules for ESLint.
 *
 * These rules turn prose directives (the Severus house style) into machine
 * enforced failures. Characters written as unicode escapes (for example
 * "\u2014") do not match the raw-text scans, so pattern definitions stay legal.
 *
 * Rules:
 *   tanaw/no-emoji              Zero emoji in source, copy and comments.
 *   tanaw/no-dash-punctuation   Zero em dash and en dash.
 *   tanaw/no-silent-catch       No empty catch block without a stated reason.
 *   tanaw/no-hardcoded-secret   No credentials committed to source.
 */

const DASH_PATTERN = /[\u2013\u2014]/g;

// Extended_Pictographic also covers a few typographic symbols that are legal in copy.
const ALLOWED_PICTOGRAPHS = new Set(["\u00A9", "\u00AE", "\u2122", "\u2139"]);
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

const SECRET_PATTERNS = [
  { label: "an OpenAI style sk- key", re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { label: "a GitHub personal access token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { label: "a GitHub fine grained token", re: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { label: "a Google API key", re: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { label: "a Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { label: "a JSON Web Token", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { label: "an AWS access key id", re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { label: "a private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

function locate(sourceCode, index) {
  const loc = sourceCode.getLocFromIndex(index);
  return { line: loc.line, column: loc.column };
}

function scanRawText(context, pattern, messageId, allow) {
  const sourceCode = context.sourceCode;
  const text = sourceCode.getText();
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (!allow || !allow.has(match[0])) {
      context.report({ loc: locate(sourceCode, match.index), messageId, data: { sample: match[0] } });
    }
    // Zero length matches would loop forever.
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
  }
}

const noEmoji = {
  meta: {
    type: "problem",
    docs: { description: "Disallow emoji characters in source, UI copy and comments" },
    schema: [],
    messages: {
      emoji: "Emoji are banned in this codebase (Strict Zero-Emoji Directive). Use a lucide-react icon or a text label instead. Found: {{sample}}",
    },
  },
  create(context) {
    return { Program() { scanRawText(context, EMOJI_PATTERN, "emoji", ALLOWED_PICTOGRAPHS); } };
  },
};

const noDashPunctuation = {
  meta: {
    type: "problem",
    docs: { description: "Disallow em dashes and en dashes in source, copy and comments" },
    schema: [],
    messages: {
      dash: "Em dashes and en dashes are banned (Strict Zero-Em-Dash Directive). Use a period, comma, colon, parentheses or a single hyphen. Found: {{sample}}",
    },
  },
  create(context) {
    return { Program() { scanRawText(context, DASH_PATTERN, "dash", null); } };
  },
};

const noSilentCatch = {
  meta: {
    type: "problem",
    docs: { description: "Disallow empty catch blocks that swallow an error silently" },
    schema: [],
    messages: {
      silent: "This catch block swallows the error silently. Log it, surface it, rethrow it, or state in a comment why the failure is safe to ignore (Defensive and Secure Programming Directive).",
    },
  },
  create(context) {
    return {
      CatchClause(node) {
        if (node.body.body.length > 0) return;
        // A documented best-effort catch is a decision, not a swallow.
        if (context.sourceCode.getCommentsInside(node.body).length > 0) return;
        context.report({ node, messageId: "silent" });
      },
    };
  },
};

const noHardcodedSecret = {
  meta: {
    type: "problem",
    docs: { description: "Disallow hardcoded credentials and API keys in source" },
    schema: [],
    messages: {
      secret: "This looks like {{label}} committed to source. Move it to .env (see .env.example) and keep it out of version control.",
    },
  },
  create(context) {
    function check(value, node) {
      if (typeof value !== "string") return;
      for (const { label, re } of SECRET_PATTERNS) {
        if (re.test(value)) {
          context.report({ node, messageId: "secret", data: { label } });
          return;
        }
      }
    }
    return {
      Literal(node) { check(node.value, node); },
      TemplateElement(node) { check(node.value.raw, node); },
    };
  },
};

export default {
  meta: { name: "tanaw-invariants", version: "1.0.0" },
  rules: {
    "no-emoji": noEmoji,
    "no-dash-punctuation": noDashPunctuation,
    "no-silent-catch": noSilentCatch,
    "no-hardcoded-secret": noHardcodedSecret,
  },
};
```

```js path=eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tanaw from "./eslint-rules/tanaw-invariants.js";

/**
 * Tanaw ESLint gate.
 *
 * Narrow on purpose: the four directive invariants (zero emoji, zero em or en
 * dash, no silent catch, no committed secret) plus TypeScript and hooks
 * correctness. No style preferences, so it never forces a structural rewrite.
 */
const INVARIANTS = {
  "tanaw/no-emoji": "error",
  "tanaw/no-dash-punctuation": "error",
  "tanaw/no-silent-catch": "error",
  "tanaw/no-hardcoded-secret": "error",
};

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "src-tauri/**", "reports/**", "docs/**", ".scratch/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    plugins: { tanaw },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    rules: {
      ...INVARIANTS,
      // TypeScript resolves identifiers; no-undef misfires on DOM and JSX types.
      "no-undef": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Conditional or looped hooks crash React at runtime, so this one is fatal.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/tests/invariants.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Minimal renderer so typecheck, lint and build have something to check**

Task 3 replaces these three files in full.

```tsx path=src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Tanaw: index.html has no #root element");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

```tsx path=src/App.tsx
export default function App() {
  return (
    <div className="app" data-testid="app">
      <p>Tanaw</p>
    </div>
  );
}
```

```css path=src/styles.css
:root {
  color-scheme: dark light;
}

body {
  margin: 0;
  font-family: "Segoe UI", system-ui, sans-serif;
}
```

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all three exit 0; `dist/index.html` exists.

- [ ] **Step 9: Agent navigation map**

Copy the generator from the project-scaffolding skill, then adapt it for a TypeScript and Rust tree with the script below (run once, not committed; `.scratch/` is gitignored).

```bash
mkdir -p scripts .scratch
cp "$HOME/.claude/skills/project-scaffolding/scripts/generate-code-map.mjs" scripts/generate-code-map.mjs
node .scratch/adapt-code-map.mjs
```

```js path=.scratch/adapt-code-map.mjs
// One-time adaptation of the skill's code map generator for Tanaw: TypeScript,
// TSX and Rust files are indexed, Rust and TS symbols become anchors, UI groups
// and Rust modules read as their own areas, and the entry points describe this
// repository. Fails loudly if any expected line is absent.
import { readFileSync, writeFileSync } from "node:fs";

const file = "scripts/generate-code-map.mjs";
let text = readFileSync(file, "utf8");
// The skill copy may carry CRLF line endings on Windows; match on LF.
text = text.replace(/\r\n/g, "\n");

function replaceOnce(from, to) {
  if (!text.includes(from)) throw new Error("adapt-code-map: expected text not found: " + from.slice(0, 60));
  text = text.replace(from, () => to);
}

replaceOnce(
  "const KEEP_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.sql']);",
  "const KEEP_EXT = new Set(['.ts', '.tsx', '.rs', '.js', '.mjs', '.cjs', '.css', '.html', '.sql', '.toml']);",
);

replaceOnce(
  String.raw`  'bg elements', 'presentation', 'electron-builder', 'node_modules2',
]);`,
  String.raw`  'bg elements', 'presentation', 'electron-builder', 'node_modules2',
  'target', 'gen', 'icons', 'fonts', 'public', 'journal', '.scratch',
]);`,
);

replaceOnce(
  String.raw`const HTML_ID = /<[a-zA-Z][^>]*\sid="([A-Za-z0-9_-]+)"/;`,
  String.raw`const HTML_ID = /<[a-zA-Z][^>]*\sid="([A-Za-z0-9_-]+)"/;
const TS_SYMBOL = /^[ \t]*export\s+(?:declare\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
const RS_SYMBOL = /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(fn|struct|enum|trait|impl|mod|const|static|type)\s+(?:<[^>]*>\s*)?([A-Za-z_][A-Za-z0-9_]*)/;`,
);

replaceOnce(
  String.raw`  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    lines.forEach((line, i) => {
      const m = line.match(JS_SYMBOL);
      if (m) {
        const name = m[1] || m[2] || m[3];
        if (name && !seen.has(name)) { seen.add(name); out.push({ line: i + 1, label: name + '()' }); }
      }
    });
  }`,
  String.raw`  if (ext === '.js' || ext === '.mjs' || ext === '.cjs' || ext === '.ts' || ext === '.tsx') {
    lines.forEach((line, i) => {
      const m = line.match(JS_SYMBOL);
      if (m) {
        const name = m[1] || m[2] || m[3];
        if (name && !seen.has(name)) { seen.add(name); out.push({ line: i + 1, label: name + '()' }); }
        return;
      }
      const t = line.match(TS_SYMBOL);
      if (t && !seen.has(t[1])) { seen.add(t[1]); out.push({ line: i + 1, label: t[1] }); }
    });
  } else if (ext === '.rs') {
    lines.forEach((line, i) => {
      const m = line.match(RS_SYMBOL);
      if (m) {
        const label = m[1] + ' ' + m[2];
        if (!seen.has(label)) { seen.add(label); out.push({ line: i + 1, label }); }
      }
    });
  }`,
);

replaceOnce(
  "  if (parts[0] === 'client' && parts[1] === 'js' && parts.length > 3) return ['client/js/' + parts[2], parts.slice(2).join('/')];",
  String.raw`  // UI groups and Rust modules read as their own areas.
  if (parts[0] === 'src' && parts[1] === 'components' && parts.length > 3) return [parts.slice(0, 3).join('/'), parts.slice(3).join('/')];
  if (parts[0] === 'src-tauri' && parts[1] === 'src' && parts.length > 3) return [parts.slice(0, 3).join('/'), parts.slice(3).join('/')];`,
);

replaceOnce(
  String.raw`  L.push('- Server: ` + "`server/index.js`" + String.raw` (Express app, middleware order, route mounting).');`,
  String.raw`  L.push('- Native entry: ` + "`src-tauri/src/lib.rs`" + String.raw` (plugins, managed state, command list).');
  L.push('- IPC boundary: ` + "`src/lib/ipc.ts`" + String.raw` (the only invoke site) mirrors the #[tauri::command] functions.');
  L.push('- Renderer composition: ` + "`src/App.tsx`" + String.raw`; design tokens: ` + "`src/styles.css`" + String.raw`.');
  L.push('- Shortcuts and palette: ` + "`src/lib/commands.ts`" + String.raw` and ` + "`src/lib/appCommands.ts`" + String.raw`.');`,
);

for (const stale of [
  "  L.push('- Client: `client/index.html` (portal shell and script load order).');\n",
  "  L.push('- Client router: `client/js/app.js`. API helper: `client/js/api.js`.');\n",
  "  L.push('- Desktop client: `electron/`.');\n",
]) {
  replaceOnce(stale, "");
}
replaceOnce(
  "  L.push('- Schema and migrations: `supabase/migrations/` (numbered, forward only).');",
  "  L.push('- Schema and migrations: `src-tauri/src/db/migrations/` (numbered, forward only).');\n  L.push('- Interface map: `docs/FEATURE_MAP.md`. Design: `docs/superpowers/specs/`.');",
);

writeFileSync(file, text);
console.log("adapted scripts/generate-code-map.mjs");
```

Run: `npm run map:code && npm run map:code:check`
Expected: `Wrote docs/CODE_MAP.md (...)` then `CODE MAP CURRENT: fingerprint ...`.

- [ ] **Step 10: CI gate, frontend job**

```yaml path=.github/workflows/verify.yml
name: Verify

# The authority for every gate. Local runs are advisory; this one blocks.
# Frontend feedback is fast on Linux. The native crate (Task 5) runs on
# Windows because the shell and the Recycle Bin are Windows-specific.

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: verify-${{ github.ref }}
  cancel-in-progress: true

jobs:
  frontend:
    name: Frontend (types, invariants, tests, contrast, code map)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint (Tanaw invariants and correctness)
        run: npm run lint

      - name: Unit tests
        run: npm test

      - name: Code map freshness
        run: npm run map:code:check
```

- [ ] **Step 11: Run the whole Task 1 gate**

Run: `npm run typecheck && npm run lint && npm test && npm run map:code:check && npm run build`
Expected: every command exits 0. (`verify:contrast` joins `npm run verify` in Task 4, when `styles.css` holds the tokens it checks.)

- [ ] **Step 12: Journal and commit**

Append one line to `journal/2026-10-02.md` with the resolved package versions and the gate output, then:

```bash
git add -A
git commit -m "chore: scaffold Tanaw toolchain, invariant lint gate, code map and CI" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Rust core: shell configuration, errors, state, database, settings, app info

**Files:**
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/.gitignore`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/icons/*` (from the Tauri template; the Tanaw icon is designed in piece 5)
- Create: `src-tauri/src/main.rs`, `lib.rs`, `error.rs`, `state.rs`, `app.rs`, `db/mod.rs`, `db/migrations/0001_init.sql`, `data/mod.rs`, `data/settings.rs`
- Test: `src-tauri/src/db/tests.rs`, `src-tauri/src/data/settings/tests.rs`, inline tests in `error.rs`

**Interfaces:**
- Produces IPC commands (Task 3 calls them through `lib/ipc.ts`): `get_settings() -> Settings`, `set_setting(key: string, value: json) -> Settings`, `get_app_info() -> { version, dataDir, databaseRecovered }`. Errors arrive as `{ code, message, path? }` with `code` in camelCase.
- Produces `Settings` JSON: `{ theme: "system"|"light"|"dark", showHidden: bool, defaultView: "list"|"grid", checkUpdates: bool, panelWidth: 200..800, panelTab: "preview"|"notes"|"todos", sidebarWidth: 160..480 }`.

- [ ] **Step 1: Shell configuration and icons**

Generate the official template once to harvest its icon set (the only part reused), then write the configuration files.

```bash
mkdir -p src-tauri/src src-tauri/capabilities .scratch
(cd .scratch && npx --yes create-tauri-app@latest tpl --template react-ts --manager npm --yes)
cp -r .scratch/tpl/src-tauri/icons src-tauri/icons
```

```toml path=src-tauri/Cargo.toml
[package]
name = "tanaw"
version = "0.1.0"
description = "Tanaw: a calm, focused file manager for Windows"
authors = ["Lex Matondo"]
license = "MIT"
edition = "2021"
rust-version = "1.85"

[lib]
# The `_lib` suffix keeps the library name distinct from the binary on Windows.
name = "tanaw_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
# Shell and plugins. Window state remembers geometry; log writes a rotating
# file under the app log directory. Both are Rust-side only: nothing is
# exposed to the renderer.
tauri = { version = "2", features = [] }
tauri-plugin-log = "2"
tauri-plugin-window-state = "2"
# IPC serialization.
serde = { version = "1", features = ["derive"] }
serde_json = "1"
# App data: SQLite compiled in, so no system library is required.
rusqlite = { version = "0.40", features = ["bundled"] }
# Error enum derivation and the logging facade.
thiserror = "2"
log = "0.4"

[dev-dependencies]
tempfile = "3"

[lints.rust]
unsafe_code = "deny"

[lints.clippy]
# Release builds abort on panic (below), so command code must never panic.
unwrap_used = "deny"
expect_used = "deny"
panic = "deny"

[profile.release]
codegen-units = 1
lto = true
opt-level = 3
panic = "abort"
strip = true
```

```rust path=src-tauri/build.rs
fn main() {
    tauri_build::build()
}
```

```gitignore path=src-tauri/.gitignore
# Generated by Cargo
/target/

# Generated by Tauri: schema files for capability autocompletion
/gen/schemas
```

```json path=src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Tanaw",
  "version": "0.1.0",
  "identifier": "com.focalstack.tanaw",
  "build": {
    "beforeDevCommand": "npm run dev:ui",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Tanaw",
        "width": 1200,
        "height": 760,
        "minWidth": 720,
        "minHeight": 480,
        "center": true,
        "decorations": false,
        "shadow": true,
        "dragDropEnabled": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: http://tanaw.localhost https://tanaw.localhost; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'",
      "devCsp": "default-src 'self' ws://localhost:1420; img-src 'self' data: http://tanaw.localhost https://tanaw.localhost; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "nsis": {
        "installMode": "currentUser"
      }
    }
  }
}
```

`devCsp` allows the Vite HMR socket and the React refresh preamble (an inline script) during development only; the release `csp` is the spec's.

```json path=src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "The main window: core defaults plus the four window controls the custom title bar needs.",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close"
  ]
}
```

If `npm run dev` later logs `window.is_maximized not allowed` in the webview console, add `core:window:allow-is-maximized` to this list; it is the one getter the title bar reads that may sit outside `core:window:default`.

- [ ] **Step 2: Entry points, error type and managed state**

```rust path=src-tauri/src/main.rs
// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tanaw_lib::run()
}
```

```rust path=src-tauri/src/error.rs
//! The one error type every command returns. Serialized for the renderer as
//! `{ code, message, path? }`; the renderer maps `code` to calm copy.

use serde::Serialize;

/// Stable error categories (spec 5.12).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    NotFound,
    PermissionDenied,
    AlreadyExists,
    InvalidPath,
    InvalidName,
    Protected,
    Cancelled,
    Io,
    Db,
    Validation,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, thiserror::Error)]
#[error("{message}")]
#[serde(rename_all = "camelCase")]
pub struct TanawError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl TanawError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), path: None }
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Validation, message)
    }

    pub fn db(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Db, message)
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }
}

impl From<std::io::Error> for TanawError {
    fn from(error: std::io::Error) -> Self {
        use std::io::ErrorKind;
        let code = match error.kind() {
            ErrorKind::NotFound => ErrorCode::NotFound,
            ErrorKind::PermissionDenied => ErrorCode::PermissionDenied,
            ErrorKind::AlreadyExists => ErrorCode::AlreadyExists,
            _ => ErrorCode::Io,
        };
        Self::new(code, error.to_string())
    }
}

impl From<rusqlite::Error> for TanawError {
    fn from(error: rusqlite::Error) -> Self {
        Self::db(error.to_string())
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;

    #[test]
    fn io_errors_map_to_their_category() {
        let error: TanawError = std::io::Error::new(std::io::ErrorKind::NotFound, "gone").into();
        assert_eq!(error.code, ErrorCode::NotFound);
        let error: TanawError = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "no").into();
        assert_eq!(error.code, ErrorCode::PermissionDenied);
        let error: TanawError = std::io::Error::other("other").into();
        assert_eq!(error.code, ErrorCode::Io);
    }

    #[test]
    fn serializes_in_camel_case_without_an_empty_path() {
        let json = serde_json::to_value(TanawError::validation("bad")).unwrap();
        assert_eq!(json, serde_json::json!({ "code": "validation", "message": "bad" }));
        let json = serde_json::to_value(TanawError::validation("bad").with_path("C:/x")).unwrap();
        assert_eq!(json["path"], "C:/x");
    }
}
```

```rust path=src-tauri/src/state.rs
//! Process-wide state managed by Tauri.

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::error::TanawError;

/// The database connection sits behind a mutex because commands run on a
/// thread pool; SQLite in WAL mode makes the critical sections short.
pub struct AppState {
    db: Mutex<Connection>,
    pub data_dir: PathBuf,
    pub database_recovered: bool,
}

impl AppState {
    pub fn new(connection: Connection, data_dir: PathBuf, database_recovered: bool) -> Self {
        Self { db: Mutex::new(connection), data_dir, database_recovered }
    }

    /// Locks the connection. A poisoned mutex means an earlier command panicked
    /// while holding it; that is reported as a database error, never unwrapped.
    pub fn db(&self) -> Result<MutexGuard<'_, Connection>, TanawError> {
        self.db
            .lock()
            .map_err(|_| TanawError::db("the database lock was poisoned by an earlier failure"))
    }
}
```

```rust path=src-tauri/src/app.rs
//! Application facts the renderer shows in Settings and on Home.

use serde::Serialize;
use tauri::State;

use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub data_dir: String,
    pub database_recovered: bool,
}

#[tauri::command]
pub fn get_app_info(state: State<'_, AppState>) -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        data_dir: state.data_dir.display().to_string(),
        database_recovered: state.database_recovered,
    }
}
```

```rust path=src-tauri/src/lib.rs
//! Tanaw native core. Every side effect (database, filesystem, shell) lives
//! here behind `#[tauri::command]` functions that validate their input; the
//! renderer only displays what these commands return.

mod app;
mod data;
mod db;
mod error;
mod state;

pub use error::{ErrorCode, TanawError};

use tauri::Manager;

/// Builds and runs the application. Exits with status 1 instead of panicking
/// when the shell cannot start, because release builds abort on panic.
pub fn run() {
    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    let builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir { file_name: Some("tanaw".into()) },
                )])
                .level(log_level)
                .max_file_size(5 * 1024 * 1024)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(3))
                .build(),
        )
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let data_dir = app.path().app_local_data_dir()?;
            let opened = db::open(&data_dir)?;
            if opened.recovered {
                log::warn!("the database was damaged; a fresh one was created in {}", data_dir.display());
            }
            app.manage(state::AppState::new(opened.connection, data_dir, opened.recovered));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app::get_app_info,
            data::settings::get_settings,
            data::settings::set_setting,
        ]);

    if let Err(error) = builder.run(tauri::generate_context!()) {
        log::error!("Tanaw could not start: {error}");
        std::process::exit(1);
    }
}
```

- [ ] **Step 3: Write the failing database and settings tests**

```sql path=src-tauri/src/db/migrations/0001_init.sql
-- Tanaw schema, version 1 (spec 5.9). Ids are UUID v4 strings so backups
-- merge across machines; timestamps are Unix milliseconds; due_date is an
-- ISO calendar date.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('file', 'dir')),
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL
);

CREATE TABLE recent_files (
  path TEXT PRIMARY KEY,
  opened_at INTEGER NOT NULL,
  open_count INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE note_versions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX note_versions_note ON note_versions(note_id, created_at);

CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
```

```rust path=src-tauri/src/db/tests.rs
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;

fn table_count(connection: &Connection) -> i64 {
    connection
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN \
             ('settings', 'favorites', 'recent_files', 'notes', 'note_versions', 'todos')",
            [],
            |row| row.get(0),
        )
        .unwrap()
}

#[test]
fn open_creates_the_schema_at_the_latest_version() {
    let dir = tempfile::tempdir().unwrap();
    let opened = open(dir.path()).unwrap();
    assert!(!opened.recovered);
    assert_eq!(schema_version(&opened.connection).unwrap(), MIGRATIONS.len() as u32);
    assert_eq!(table_count(&opened.connection), 6);
}

#[test]
fn reopening_applies_no_further_migrations() {
    let dir = tempfile::tempdir().unwrap();
    drop(open(dir.path()).unwrap());
    let opened = open(dir.path()).unwrap();
    assert_eq!(migrate(&opened.connection).unwrap(), 0);
}

#[test]
fn pragmas_are_applied() {
    let dir = tempfile::tempdir().unwrap();
    let opened = open(dir.path()).unwrap();
    let mode: String = opened.connection.query_row("PRAGMA journal_mode", [], |row| row.get(0)).unwrap();
    assert_eq!(mode, "wal");
    let foreign_keys: i64 = opened.connection.query_row("PRAGMA foreign_keys", [], |row| row.get(0)).unwrap();
    assert_eq!(foreign_keys, 1);
}

#[test]
fn a_damaged_file_is_quarantined_and_replaced() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join(DB_FILE), b"this is not a database").unwrap();
    let opened = open(dir.path()).unwrap();
    assert!(opened.recovered);
    assert_eq!(schema_version(&opened.connection).unwrap(), MIGRATIONS.len() as u32);
    let quarantined = std::fs::read_dir(dir.path())
        .unwrap()
        .filter_map(Result::ok)
        .any(|entry| entry.file_name().to_string_lossy().starts_with("tanaw.db.corrupt-"));
    assert!(quarantined);
}
```

```rust path=src-tauri/src/data/settings/tests.rs
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use super::*;
use crate::error::ErrorCode;
use serde_json::json;

fn connection() -> Connection {
    let connection = Connection::open_in_memory().unwrap();
    crate::db::migrate(&connection).unwrap();
    connection
}

#[test]
fn defaults_when_the_table_is_empty() {
    assert_eq!(load(&connection()).unwrap(), Settings::default());
}

#[test]
fn stores_and_reloads_each_key() {
    let connection = connection();
    store(&connection, "theme", &json!("dark")).unwrap();
    store(&connection, "showHidden", &json!(true)).unwrap();
    store(&connection, "defaultView", &json!("grid")).unwrap();
    store(&connection, "checkUpdates", &json!(false)).unwrap();
    store(&connection, "panelWidth", &json!(400)).unwrap();
    store(&connection, "panelTab", &json!("notes")).unwrap();
    let settings = store(&connection, "sidebarWidth", &json!(260)).unwrap();
    let expected = Settings {
        theme: Theme::Dark,
        show_hidden: true,
        default_view: ViewMode::Grid,
        check_updates: false,
        panel_width: 400,
        panel_tab: PanelTab::Notes,
        sidebar_width: 260,
    };
    assert_eq!(settings, expected);
    assert_eq!(load(&connection).unwrap(), expected);
}

#[test]
fn overwriting_a_key_keeps_one_row() {
    let connection = connection();
    store(&connection, "theme", &json!("dark")).unwrap();
    store(&connection, "theme", &json!("light")).unwrap();
    let rows: i64 = connection.query_row("SELECT count(*) FROM settings", [], |row| row.get(0)).unwrap();
    assert_eq!(rows, 1);
    assert_eq!(load(&connection).unwrap().theme, Theme::Light);
}

#[test]
fn rejects_unknown_keys_and_bad_values_without_writing() {
    let connection = connection();
    assert_eq!(store(&connection, "colour", &json!("red")).unwrap_err().code, ErrorCode::Validation);
    assert_eq!(store(&connection, "theme", &json!("sepia")).unwrap_err().code, ErrorCode::Validation);
    assert_eq!(store(&connection, "showHidden", &json!("yes")).unwrap_err().code, ErrorCode::Validation);
    assert_eq!(store(&connection, "panelWidth", &json!(5000)).unwrap_err().code, ErrorCode::Validation);
    assert_eq!(store(&connection, "sidebarWidth", &json!(10)).unwrap_err().code, ErrorCode::Validation);
    let rows: i64 = connection.query_row("SELECT count(*) FROM settings", [], |row| row.get(0)).unwrap();
    assert_eq!(rows, 0);
}

#[test]
fn rows_from_a_newer_build_or_damaged_rows_are_skipped() {
    let connection = connection();
    connection.execute("INSERT INTO settings (key, value) VALUES ('futureKey', '1')", []).unwrap();
    connection.execute("INSERT INTO settings (key, value) VALUES ('theme', 'not json')", []).unwrap();
    assert_eq!(load(&connection).unwrap(), Settings::default());
}
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd src-tauri && cargo test`
Expected: compile error, `unresolved import` or `file not found for module db` (the modules do not exist yet).

- [ ] **Step 5: Implement the database module and the settings module**

```rust path=src-tauri/src/db/mod.rs
//! Database lifecycle: open with the pragmas from the spec (5.9), quarantine a
//! damaged file, and apply numbered migrations tracked by `user_version`.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;

use crate::error::TanawError;

#[cfg(test)]
mod tests;

pub const DB_FILE: &str = "tanaw.db";

/// Forward-only migrations. Index 0 brings `user_version` to 1, and so on.
const MIGRATIONS: &[&str] = &[include_str!("migrations/0001_init.sql")];

pub struct Opened {
    pub connection: Connection,
    /// True when an existing file failed its integrity check and was moved aside.
    pub recovered: bool,
}

pub fn open(data_dir: &Path) -> Result<Opened, TanawError> {
    std::fs::create_dir_all(data_dir)?;
    let path = data_dir.join(DB_FILE);
    let recovered = quarantine_if_damaged(&path)?;
    let connection = Connection::open(&path)?;
    configure(&connection)?;
    migrate(&connection)?;
    Ok(Opened { connection, recovered })
}

pub fn schema_version(connection: &Connection) -> Result<u32, TanawError> {
    Ok(connection.query_row("PRAGMA user_version", [], |row| row.get::<_, u32>(0))?)
}

/// Applies every migration above the current `user_version`, each in its own
/// transaction, and returns how many ran.
pub fn migrate(connection: &Connection) -> Result<usize, TanawError> {
    let current = schema_version(connection)? as usize;
    let mut applied = 0;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current) {
        let next = u32::try_from(index + 1)
            .map_err(|_| TanawError::db("too many migrations for a 32-bit user_version"))?;
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(sql)?;
        transaction.pragma_update(None, "user_version", next)?;
        transaction.commit()?;
        applied += 1;
    }
    Ok(applied)
}

fn configure(connection: &Connection) -> Result<(), TanawError> {
    // journal_mode answers with the resulting mode as a row, so it is queried.
    connection.query_row("PRAGMA journal_mode = WAL", [], |_| Ok(()))?;
    connection.execute_batch(
        "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;",
    )?;
    Ok(())
}

/// Returns true when an existing file failed `integrity_check` and was moved
/// aside, with its WAL and SHM siblings, so a fresh database can be created.
fn quarantine_if_damaged(path: &Path) -> Result<bool, TanawError> {
    if !path.exists() || is_healthy(path) {
        return Ok(false);
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or(0);
    for suffix in ["", "-wal", "-shm"] {
        let source = with_suffix(path, suffix);
        if source.exists() {
            let target = with_suffix(path, &format!(".corrupt-{stamp}{suffix}"));
            std::fs::rename(&source, &target)?;
            log::warn!("quarantined damaged database file {}", target.display());
        }
    }
    Ok(true)
}

fn is_healthy(path: &Path) -> bool {
    let Ok(connection) = Connection::open(path) else {
        return false;
    };
    let verdict: Result<String, rusqlite::Error> =
        connection.query_row("PRAGMA integrity_check", [], |row| row.get(0));
    matches!(verdict.as_deref(), Ok("ok"))
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{suffix}", path.display()))
}
```

```rust path=src-tauri/src/data/mod.rs
//! Thin command modules over the database.

pub mod settings;
```

```rust path=src-tauri/src/data/settings.rs
//! Settings: a key/value table behind a typed struct. Keys and bounds are the
//! spec's (5.9). Unknown keys are refused on write and skipped with a warning
//! on read, so a newer backup never breaks an older build.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::error::TanawError;
use crate::state::AppState;

#[cfg(test)]
mod tests;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViewMode {
    List,
    Grid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PanelTab {
    Preview,
    Notes,
    Todos,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: Theme,
    pub show_hidden: bool,
    pub default_view: ViewMode,
    pub check_updates: bool,
    pub panel_width: u32,
    pub panel_tab: PanelTab,
    pub sidebar_width: u32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            show_hidden: false,
            default_view: ViewMode::List,
            check_updates: true,
            panel_width: 320,
            panel_tab: PanelTab::Preview,
            sidebar_width: 220,
        }
    }
}

/// Inclusive pixel bounds for the two persisted widths.
pub const PANEL_WIDTH: (u32, u32) = (200, 800);
pub const SIDEBAR_WIDTH: (u32, u32) = (160, 480);

pub fn load(connection: &Connection) -> Result<Settings, TanawError> {
    let mut settings = Settings::default();
    let mut statement = connection.prepare("SELECT key, value FROM settings")?;
    let rows = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))?;
    for row in rows {
        let (key, raw) = row?;
        let value: Value = match serde_json::from_str(&raw) {
            Ok(value) => value,
            Err(error) => {
                log::warn!("setting {key} holds unreadable JSON ({error}); using the default");
                continue;
            }
        };
        if let Err(error) = apply(&mut settings, &key, &value) {
            log::warn!("setting {key} ignored: {}", error.message);
        }
    }
    Ok(settings)
}

/// Validates one key against the current settings, then persists it as JSON.
pub fn store(connection: &Connection, key: &str, value: &Value) -> Result<Settings, TanawError> {
    let mut settings = load(connection)?;
    apply(&mut settings, key, value)?;
    connection.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value.to_string()],
    )?;
    Ok(settings)
}

fn apply(settings: &mut Settings, key: &str, value: &Value) -> Result<(), TanawError> {
    match key {
        "theme" => settings.theme = parse(key, value)?,
        "showHidden" => settings.show_hidden = parse(key, value)?,
        "defaultView" => settings.default_view = parse(key, value)?,
        "checkUpdates" => settings.check_updates = parse(key, value)?,
        "panelWidth" => settings.panel_width = bounded(key, value, PANEL_WIDTH)?,
        "panelTab" => settings.panel_tab = parse(key, value)?,
        "sidebarWidth" => settings.sidebar_width = bounded(key, value, SIDEBAR_WIDTH)?,
        _ => return Err(TanawError::validation(format!("{key} is not a setting"))),
    }
    Ok(())
}

fn parse<T: serde::de::DeserializeOwned>(key: &str, value: &Value) -> Result<T, TanawError> {
    serde_json::from_value(value.clone())
        .map_err(|error| TanawError::validation(format!("{key} does not accept {value}: {error}")))
}

fn bounded(key: &str, value: &Value, (min, max): (u32, u32)) -> Result<u32, TanawError> {
    let number: u32 = parse(key, value)?;
    if number < min || number > max {
        return Err(TanawError::validation(format!(
            "{key} must be between {min} and {max}, not {number}"
        )));
    }
    Ok(number)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, TanawError> {
    let db = state.db()?;
    load(&db)
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: Value) -> Result<Settings, TanawError> {
    let db = state.db()?;
    store(&db, &key, &value)
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd src-tauri && cargo test`
Expected: `test result: ok.` with 11 tests passed (2 error, 4 db, 5 settings).

- [ ] **Step 7: Clippy with the denied lints, then a debug build of the shell**

Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo build`
Expected: no warnings; `target/debug/tanaw.exe` exists. `cargo build` also generates `gen/schemas/desktop-schema.json`, which is gitignored.

- [ ] **Step 8: Journal and commit**

Append the real `cargo test` summary line and the clippy result to `journal/2026-10-02.md`, then:

```bash
git add -A
git commit -m "feat(core): Tauri shell configuration, error type, database with migrations, settings and app info commands" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Renderer foundation: contracts, stores, shell, settings, palette, harness, tokens

**Files:**
- Create: `src/types.ts`, `src/lib/defaults.ts`, `src/lib/ipc.ts`, `src/lib/errors.ts`, `src/lib/theme.ts`, `src/lib/shortcuts.ts`, `src/lib/commands.ts`, `src/lib/appCommands.ts`
- Create: `src/store/tabs.ts`, `src/store/ui.ts`, `src/store/settings.ts`, `src/store/panel.ts`
- Create: `src/components/ui/{Button,IconButton,Kbd,EmptyState,Field,Toasts,ConfirmDialog}.tsx`
- Create: `src/components/shell/{TitleBar,Sidebar,SidePanel,StatusBar}.tsx`, `src/components/home/HomeView.tsx`, `src/components/settings/SettingsView.tsx`, `src/components/palette/CommandPalette.tsx`
- Create: `src/dev/mockBackend.ts`, `src/assets/fonts/*` (vendored)
- Replace: `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- Test: `src/tests/shortcuts.test.ts`, `src/tests/commands.test.ts`, `src/tests/tabs.test.ts`, `src/tests/theme.test.ts`

**Interfaces:**
- Consumes: IPC commands from Task 2 (`get_settings`, `set_setting`, `get_app_info`).
- Produces: `data-testid` hooks for Task 4: `app`, `titlebar`, `tab`, `tab-new`, `sidebar`, `content`, `home-view`, `settings-view`, `setting-theme`, `side-panel`, `statusbar`, `command-palette`, `toasts`, `confirm-dialog`.
- Produces: `buildAppCommands()` returning the fixed bindings, which Task 4's feature map test compares against `docs/FEATURE_MAP.md`.

- [ ] **Step 1: Write the failing logic tests**

```ts path=src/tests/shortcuts.test.ts
import { describe, expect, it } from "vitest";
import { matchesShortcut, parseShortcut, shortcutKeys } from "../lib/shortcuts";

type Overrides = Partial<{ key: string; code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }>;

function keyEvent(overrides: Overrides) {
  return { key: "", code: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...overrides };
}

describe("parseShortcut", () => {
  it("reads modifiers and normalizes the key", () => {
    expect(parseShortcut("Ctrl+Shift+N")).toEqual({ ctrl: true, shift: true, alt: false, key: "n" });
    expect(parseShortcut("Alt+Left")).toEqual({ ctrl: false, shift: false, alt: true, key: "arrowleft" });
    expect(parseShortcut("Ctrl+Comma")).toEqual({ ctrl: true, shift: false, alt: false, key: "," });
    expect(parseShortcut("F5")).toEqual({ ctrl: false, shift: false, alt: false, key: "f5" });
  });

  it("refuses a shortcut that names no key", () => {
    expect(() => parseShortcut("Ctrl+Shift")).toThrow(/names no key/);
  });
});

describe("matchesShortcut", () => {
  it("matches letters regardless of case and requires the exact modifiers", () => {
    const shortcut = parseShortcut("Ctrl+K");
    expect(matchesShortcut(keyEvent({ key: "k", ctrlKey: true }), shortcut)).toBe(true);
    expect(matchesShortcut(keyEvent({ key: "K", ctrlKey: true, shiftKey: true }), shortcut)).toBe(false);
    expect(matchesShortcut(keyEvent({ key: "k" }), shortcut)).toBe(false);
    expect(matchesShortcut(keyEvent({ key: "k", ctrlKey: true, metaKey: true }), shortcut)).toBe(false);
  });

  it("matches shifted digits through the physical key code", () => {
    const shortcut = parseShortcut("Ctrl+Shift+1");
    expect(matchesShortcut(keyEvent({ key: "!", code: "Digit1", ctrlKey: true, shiftKey: true }), shortcut)).toBe(true);
    expect(matchesShortcut(keyEvent({ key: "@", code: "Digit2", ctrlKey: true, shiftKey: true }), shortcut)).toBe(false);
  });

  it("matches named keys", () => {
    expect(matchesShortcut(keyEvent({ key: "ArrowLeft", altKey: true }), parseShortcut("Alt+Left"))).toBe(true);
    expect(matchesShortcut(keyEvent({ key: "Tab", ctrlKey: true }), parseShortcut("Ctrl+Tab"))).toBe(true);
    expect(matchesShortcut(keyEvent({ key: ",", ctrlKey: true }), parseShortcut("Ctrl+Comma"))).toBe(true);
  });
});

describe("shortcutKeys", () => {
  it("splits a written shortcut for display", () => {
    expect(shortcutKeys("Ctrl+Shift+E")).toEqual(["Ctrl", "Shift", "E"]);
  });
});
```

```ts path=src/tests/commands.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { commandForKey, listCommands, registerCommands, resetCommands, runCommand } from "../lib/commands";
import { buildAppCommands } from "../lib/appCommands";

type Mods = Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean }>;

function keyEvent(key: string, mods: Mods = {}) {
  return { key, code: "", ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, target: null, ...mods };
}

describe("command registry", () => {
  beforeEach(resetCommands);

  it("refuses duplicate ids and duplicate shortcuts", () => {
    registerCommands([{ id: "a", title: "A", group: "app", shortcut: "Ctrl+K", run: () => {} }]);
    expect(() => registerCommands([{ id: "a", title: "A2", group: "app", run: () => {} }])).toThrow(/Duplicate command id/);
    expect(() => registerCommands([{ id: "b", title: "B", group: "app", shortcut: "Ctrl+K", run: () => {} }])).toThrow(/already bound/);
  });

  it("resolves a key event to its command and honours when()", () => {
    let hidden = false;
    registerCommands([{ id: "a", title: "A", group: "app", shortcut: "Ctrl+K", when: () => !hidden, run: () => {} }]);
    expect(commandForKey(keyEvent("k", { ctrlKey: true }))?.id).toBe("a");
    hidden = true;
    expect(commandForKey(keyEvent("k", { ctrlKey: true }))).toBeNull();
  });

  it("runCommand reports whether it ran", async () => {
    let runs = 0;
    registerCommands([{ id: "a", title: "A", group: "app", run: () => { runs += 1; } }]);
    expect(await runCommand("a")).toBe(true);
    expect(await runCommand("missing")).toBe(false);
    expect(runs).toBe(1);
  });
});

describe("app commands", () => {
  beforeEach(resetCommands);

  it("register without conflicts and carry the fixed bindings", () => {
    registerCommands(buildAppCommands());
    const bound = new Map(listCommands().filter((c) => c.shortcut).map((c) => [c.shortcut as string, c.id]));
    expect(bound.get("Ctrl+K")).toBe("app.palette");
    expect(bound.get("Ctrl+T")).toBe("tab.new");
    expect(bound.get("Ctrl+W")).toBe("tab.close");
    expect(bound.get("Ctrl+Comma")).toBe("app.settings");
    expect(bound.get("Ctrl+Shift+E")).toBe("panel.toggle");
    expect(bound.get("Ctrl+H")).toBe("view.toggleHidden");
    expect(bound.get("Ctrl+9")).toBe("tab.select.9");
    const globals = listCommands().filter((c) => c.global).map((c) => c.id);
    expect(globals).toEqual(expect.arrayContaining(["app.palette", "tab.new", "tab.close", "app.settings"]));
  });
});
```

```ts path=src/tests/tabs.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { activeTab, folderName, tabTitle, useTabs } from "../store/tabs";

function reset() {
  const first = useTabs.getState().tabs[0];
  useTabs.setState({ tabs: [first], activeId: first.id });
}

describe("tabs store", () => {
  beforeEach(reset);

  it("starts with one Home tab", () => {
    const state = useTabs.getState();
    expect(state.tabs).toHaveLength(1);
    expect(activeTab(state).view).toBe("home");
  });

  it("newTab appends and activates", () => {
    const id = useTabs.getState().newTab("settings");
    const state = useTabs.getState();
    expect(state.tabs).toHaveLength(2);
    expect(state.activeId).toBe(id);
    expect(activeTab(state).view).toBe("settings");
  });

  it("closing the active tab activates the right neighbour, else the left", () => {
    const first = useTabs.getState().tabs[0].id;
    const second = useTabs.getState().newTab();
    const third = useTabs.getState().newTab();
    useTabs.getState().activate(second);
    useTabs.getState().closeTab(second);
    expect(useTabs.getState().activeId).toBe(third);
    useTabs.getState().closeTab(third);
    expect(useTabs.getState().activeId).toBe(first);
  });

  it("closing an inactive tab keeps the active one", () => {
    const first = useTabs.getState().tabs[0].id;
    const second = useTabs.getState().newTab();
    useTabs.getState().closeTab(first);
    expect(useTabs.getState().activeId).toBe(second);
    expect(useTabs.getState().tabs).toHaveLength(1);
  });

  it("closing the last tab leaves a fresh Home tab", () => {
    const only = useTabs.getState().tabs[0].id;
    useTabs.getState().setView(only, "settings");
    useTabs.getState().closeTab(only);
    const state = useTabs.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].id).not.toBe(only);
    expect(activeTab(state).view).toBe("home");
  });

  it("next and previous wrap around, activateIndex ignores out of range", () => {
    const first = useTabs.getState().tabs[0].id;
    const second = useTabs.getState().newTab();
    useTabs.getState().next();
    expect(useTabs.getState().activeId).toBe(first);
    useTabs.getState().previous();
    expect(useTabs.getState().activeId).toBe(second);
    useTabs.getState().activateIndex(7);
    expect(useTabs.getState().activeId).toBe(second);
    useTabs.getState().activateIndex(0);
    expect(useTabs.getState().activeId).toBe(first);
  });

  it("titles follow the view", () => {
    expect(tabTitle({ id: "x", view: "home", path: null })).toBe("Home");
    expect(tabTitle({ id: "x", view: "settings", path: null })).toBe("Settings");
    expect(tabTitle({ id: "x", view: "browser", path: "C:/Users/lex/Pictures" })).toBe("Pictures");
    expect(folderName("C:/")).toBe("C:");
  });
});
```

```ts path=src/tests/theme.test.ts
import { describe, expect, it } from "vitest";
import { resolveTheme } from "../lib/theme";

describe("resolveTheme", () => {
  it("follows the system only when asked", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run`
Expected: the four new files FAIL with "Failed to resolve import" (the invariants test still passes).

- [ ] **Step 3: Contracts and pure logic**

```ts path=src/types.ts
// Types that cross the IPC boundary. They mirror the Rust structs in
// src-tauri/src (serde renames every field to camelCase).

export type Theme = "system" | "light" | "dark";
export type ViewMode = "list" | "grid";
export type PanelTab = "preview" | "notes" | "todos";

export interface Settings {
  theme: Theme;
  showHidden: boolean;
  defaultView: ViewMode;
  checkUpdates: boolean;
  panelWidth: number;
  panelTab: PanelTab;
  sidebarWidth: number;
}

export type SettingKey = keyof Settings;

export interface AppInfo {
  version: string;
  dataDir: string;
  databaseRecovered: boolean;
}

export type ErrorCode =
  | "notFound"
  | "permissionDenied"
  | "alreadyExists"
  | "invalidPath"
  | "invalidName"
  | "protected"
  | "cancelled"
  | "io"
  | "db"
  | "validation"
  | "unsupported";

export interface TanawError {
  code: ErrorCode;
  message: string;
  path?: string;
}
```

```ts path=src/lib/defaults.ts
import type { Settings } from "../types";

// Mirrors `Settings::default()` in src-tauri/src/data/settings.rs. Used before
// the database answers and by the dev harness.
export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  showHidden: false,
  defaultView: "list",
  checkUpdates: true,
  panelWidth: 320,
  panelTab: "preview",
  sidebarWidth: 220,
};
```

```ts path=src/lib/ipc.ts
// The only file that calls `invoke`. One typed function per Rust command;
// every rejection is normalized to a TanawError before it reaches a store.
import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, SettingKey, Settings, TanawError } from "../types";

export function isTauriHost(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function toTanawError(raw: unknown): TanawError {
  if (raw && typeof raw === "object" && "code" in raw && "message" in raw) {
    return raw as TanawError;
  }
  return { code: "io", message: raw instanceof Error ? raw.message : String(raw) };
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (raw) {
    throw toTanawError(raw);
  }
}

export const ipc = {
  getSettings: () => call<Settings>("get_settings"),
  setSetting: (key: SettingKey, value: Settings[SettingKey]) => call<Settings>("set_setting", { key, value }),
  getAppInfo: () => call<AppInfo>("get_app_info"),
};
```

```ts path=src/lib/errors.ts
import type { ErrorCode, TanawError } from "../types";

// Calm headlines per error code (spec 8.4). The raw message stays in `detail`.
const HEADLINES: Record<ErrorCode, string> = {
  notFound: "That item no longer exists.",
  permissionDenied: "Windows refused access.",
  alreadyExists: "Something with that name is already there.",
  invalidPath: "That location is not a valid path.",
  invalidName: "That name cannot be used.",
  protected: "Tanaw does not change that location.",
  cancelled: "The operation was cancelled.",
  io: "The file system reported a problem.",
  db: "Tanaw could not read or write its own data.",
  validation: "That value was not accepted.",
  unsupported: "That action is not available here.",
};

export function describeError(error: TanawError): { title: string; detail: string } {
  const where = error.path ? ` (${error.path})` : "";
  return { title: HEADLINES[error.code] ?? HEADLINES.io, detail: `${error.message}${where}` };
}
```

```ts path=src/lib/theme.ts
import type { Theme } from "../types";

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

const QUERY = "(prefers-color-scheme: dark)";
let stopFollowing: (() => void) | null = null;

/** Sets `data-theme` on the html element and keeps following the system when asked. */
export function applyTheme(theme: Theme): void {
  stopFollowing?.();
  stopFollowing = null;
  const media = window.matchMedia(QUERY);
  const paint = () => {
    document.documentElement.dataset.theme = resolveTheme(theme, media.matches);
  };
  paint();
  if (theme === "system") {
    media.addEventListener("change", paint);
    stopFollowing = () => media.removeEventListener("change", paint);
  }
}
```

```ts path=src/lib/shortcuts.ts
// Shortcut parsing and matching. Written forms come from lib/appCommands.ts
// and docs/FEATURE_MAP.md, for example "Ctrl+Shift+N", "Alt+Left", "Ctrl+Comma".

export interface Shortcut {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  /** Lower-case KeyboardEvent.key, for example "k", "tab", "arrowleft", ",". */
  key: string;
}

const KEY_ALIASES: Record<string, string> = {
  left: "arrowleft",
  right: "arrowright",
  up: "arrowup",
  down: "arrowdown",
  comma: ",",
  period: ".",
  space: " ",
  esc: "escape",
};

export function parseShortcut(text: string): Shortcut {
  const shortcut: Shortcut = { ctrl: false, shift: false, alt: false, key: "" };
  for (const part of text.split("+").map((p) => p.trim()).filter(Boolean)) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") shortcut.ctrl = true;
    else if (lower === "shift") shortcut.shift = true;
    else if (lower === "alt") shortcut.alt = true;
    else shortcut.key = KEY_ALIASES[lower] ?? lower;
  }
  if (!shortcut.key) throw new Error(`Shortcut "${text}" names no key`);
  return shortcut;
}

export type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey"> & { code?: string };

export function matchesShortcut(event: KeyLike, shortcut: Shortcut): boolean {
  if (event.metaKey) return false;
  if (event.ctrlKey !== shortcut.ctrl || event.shiftKey !== shortcut.shift || event.altKey !== shortcut.alt) return false;
  // Shift turns a digit's key value into punctuation on most layouts, so digits
  // match on the physical key instead.
  if (/^[0-9]$/.test(shortcut.key) && event.code) return event.code === `Digit${shortcut.key}`;
  return event.key.toLowerCase() === shortcut.key;
}

/** "Ctrl+Shift+N" to ["Ctrl", "Shift", "N"], for rendering on a Kbd. */
export function shortcutKeys(text: string): string[] {
  return text.split("+").map((p) => p.trim()).filter(Boolean);
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True when the event target takes typed text, so plain shortcuts must stay out of its way. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable) return true;
  return target.closest(".cm-editor") !== null;
}
```

```ts path=src/lib/commands.ts
// The command registry: the single source of truth for titles and shortcuts.
// The palette lists it, the key handler executes it, docs/FEATURE_MAP.md is
// checked against it by a test.
import { isEditableTarget, matchesShortcut, parseShortcut, type KeyLike, type Shortcut } from "./shortcuts";

export type CommandGroup = "tabs" | "navigate" | "view" | "app";

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  /** Written form, for example "Ctrl+Shift+N". Palette-only commands have none. */
  shortcut?: string;
  /** Global shortcuts fire even while a text field has focus. */
  global?: boolean;
  /** Returning false hides the command from the palette and ignores its shortcut. */
  when?: () => boolean;
  run: () => void | Promise<void>;
}

interface Registered {
  command: Command;
  parsed: Shortcut | null;
}

let registry: Registered[] = [];

function sameShortcut(a: Shortcut, b: Shortcut): boolean {
  return a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.key === b.key;
}

export function registerCommands(commands: Command[]): void {
  for (const command of commands) {
    if (registry.some((entry) => entry.command.id === command.id)) {
      throw new Error(`Duplicate command id: ${command.id}`);
    }
    const parsed = command.shortcut ? parseShortcut(command.shortcut) : null;
    if (parsed && registry.some((entry) => entry.parsed && sameShortcut(entry.parsed, parsed))) {
      throw new Error(`Shortcut ${command.shortcut} is already bound (${command.id})`);
    }
    registry.push({ command, parsed });
  }
}

export function listCommands(): Command[] {
  return registry.map((entry) => entry.command);
}

export function findCommand(id: string): Command | undefined {
  return registry.find((entry) => entry.command.id === id)?.command;
}

export function isAvailable(command: Command): boolean {
  return command.when ? command.when() : true;
}

/** Runs a command by id; false when it is unknown or unavailable. */
export async function runCommand(id: string): Promise<boolean> {
  const command = findCommand(id);
  if (!command || !isAvailable(command)) return false;
  await command.run();
  return true;
}

/** Resolves a key event to the command it should run, honouring focus context. */
export function commandForKey(event: KeyLike & { target?: EventTarget | null }): Command | null {
  const editable = isEditableTarget(event.target ?? null);
  for (const { command, parsed } of registry) {
    if (!parsed || !matchesShortcut(event, parsed)) continue;
    if (editable && !command.global) continue;
    if (!isAvailable(command)) continue;
    return command;
  }
  return null;
}

/** Test helper. */
export function resetCommands(): void {
  registry = [];
}
```

- [ ] **Step 4: Stores**

```ts path=src/store/tabs.ts
import { create } from "zustand";

export type TabView = "home" | "browser" | "trash" | "settings";

export interface Tab {
  id: string;
  view: TabView;
  /** The folder a browser tab shows; null for every other view. */
  path: string | null;
}

interface TabsState {
  tabs: Tab[];
  activeId: string;
  newTab: (view?: TabView, path?: string | null) => string;
  closeTab: (id: string) => void;
  activate: (id: string) => void;
  activateIndex: (index: number) => void;
  next: () => void;
  previous: () => void;
  setView: (id: string, view: TabView, path?: string | null) => void;
}

function makeTab(view: TabView, path: string | null): Tab {
  return { id: crypto.randomUUID(), view, path };
}

/** Last path segment, for tab titles. Accepts both separators Windows users type. */
export function folderName(path: string): string {
  const segments = path.split(/[/\u005c]+/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : path;
}

export function tabTitle(tab: Tab): string {
  switch (tab.view) {
    case "home":
      return "Home";
    case "settings":
      return "Settings";
    case "trash":
      return "Recycle Bin";
    case "browser":
      return tab.path ? folderName(tab.path) : "Browse";
  }
}

export function activeTab(state: Pick<TabsState, "tabs" | "activeId">): Tab {
  return state.tabs.find((tab) => tab.id === state.activeId) ?? state.tabs[0];
}

const first = makeTab("home", null);

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [first],
  activeId: first.id,

  newTab: (view = "home", path = null) => {
    const tab = makeTab(view, path);
    set((state) => ({ tabs: [...state.tabs, tab], activeId: tab.id }));
    return tab.id;
  },

  closeTab: (id) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index === -1) return state;
      const remaining = state.tabs.filter((tab) => tab.id !== id);
      // Never zero tabs: the last close leaves a fresh Home.
      if (remaining.length === 0) {
        const fresh = makeTab("home", null);
        return { tabs: [fresh], activeId: fresh.id };
      }
      if (state.activeId !== id) return { tabs: remaining };
      // The right neighbour slid into this index; at the end, the left one.
      const neighbour = remaining[Math.min(index, remaining.length - 1)];
      return { tabs: remaining, activeId: neighbour.id };
    }),

  activate: (id) => set((state) => (state.tabs.some((tab) => tab.id === id) ? { activeId: id } : state)),

  activateIndex: (index) => {
    const tab = get().tabs[index];
    if (tab) set({ activeId: tab.id });
  },

  next: () => {
    const { tabs, activeId } = get();
    const index = tabs.findIndex((tab) => tab.id === activeId);
    set({ activeId: tabs[(index + 1) % tabs.length].id });
  },

  previous: () => {
    const { tabs, activeId } = get();
    const index = tabs.findIndex((tab) => tab.id === activeId);
    set({ activeId: tabs[(index - 1 + tabs.length) % tabs.length].id });
  },

  setView: (id, view, path = null) =>
    set((state) => ({ tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, view, path } : tab)) })),
}));
```

```ts path=src/store/ui.ts
import { create } from "zustand";
import type { AppInfo } from "../types";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

interface UiState {
  toasts: Toast[];
  toast: (kind: ToastKind, title: string, detail?: string) => void;
  dismiss: (id: number) => void;
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  confirm: PendingConfirm | null;
  /** Shows the confirm dialog and resolves with the user's answer. */
  ask: (request: ConfirmRequest) => Promise<boolean>;
  answer: (ok: boolean) => void;
  appInfo: AppInfo | null;
  setAppInfo: (info: AppInfo) => void;
}

const TOAST_MS: Record<ToastKind, number> = { info: 6000, success: 6000, error: 10000 };
let nextToastId = 0;

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  toast: (kind, title, detail) => {
    nextToastId += 1;
    const id = nextToastId;
    set((state) => ({ toasts: [...state.toasts, { id, kind, title, detail }] }));
    setTimeout(() => get().dismiss(id), TOAST_MS[kind]);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  paletteOpen: false,
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),

  confirm: null,
  ask: (request) =>
    new Promise<boolean>((resolve) => {
      // A second question replaces the first; the first is answered "no".
      get().confirm?.resolve(false);
      set({ confirm: { ...request, resolve } });
    }),
  answer: (ok) => {
    const pending = get().confirm;
    set({ confirm: null });
    pending?.resolve(ok);
  },

  appInfo: null,
  setAppInfo: (appInfo) => set({ appInfo }),
}));
```

```ts path=src/store/panel.ts
import { create } from "zustand";

// Whether the side panel is shown is session state; its width and active tab
// persist through settings.
interface PanelState {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const usePanel = create<PanelState>((set) => ({
  open: true,
  toggle: () => set((state) => ({ open: !state.open })),
  setOpen: (open) => set({ open }),
}));
```

```ts path=src/store/settings.ts
import { create } from "zustand";
import type { SettingKey, Settings } from "../types";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import { describeError } from "../lib/errors";
import { ipc, toTanawError } from "../lib/ipc";
import { applyTheme } from "../lib/theme";
import { useUi } from "./ui";

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  /** Optimistic: the change shows at once and rolls back if Rust refuses it. */
  update: <K extends SettingKey>(key: K, value: Settings[K]) => Promise<void>;
}

function report(raw: unknown): void {
  const { title, detail } = describeError(toTanawError(raw));
  useUi.getState().toast("error", title, detail);
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const settings = await ipc.getSettings();
      applyTheme(settings.theme);
      set({ settings, loaded: true });
    } catch (raw) {
      report(raw);
      set({ loaded: true });
    }
  },

  update: async (key, value) => {
    const previous = get().settings;
    const optimistic = { ...previous, [key]: value };
    set({ settings: optimistic });
    if (key === "theme") applyTheme(optimistic.theme);
    try {
      const settings = await ipc.setSetting(key, value);
      set({ settings });
    } catch (raw) {
      set({ settings: previous });
      if (key === "theme") applyTheme(previous.theme);
      report(raw);
    }
  },
}));
```

- [ ] **Step 5: App commands and interface primitives**

```ts path=src/lib/appCommands.ts
// The fixed bindings of spec 7.3 that exist in the foundation. Later pieces
// append their own commands through registerCommands.
import { registerCommands, listCommands, type Command } from "./commands";
import { usePanel } from "../store/panel";
import { useSettings } from "../store/settings";
import { useTabs } from "../store/tabs";
import { useUi } from "../store/ui";

export function buildAppCommands(): Command[] {
  const tabs = () => useTabs.getState();
  const settings = () => useSettings.getState();

  const commands: Command[] = [
    { id: "tab.new", title: "New tab", group: "tabs", shortcut: "Ctrl+T", global: true, run: () => { tabs().newTab("home"); } },
    { id: "tab.close", title: "Close tab", group: "tabs", shortcut: "Ctrl+W", global: true, run: () => tabs().closeTab(tabs().activeId) },
    { id: "tab.next", title: "Next tab", group: "tabs", shortcut: "Ctrl+Tab", global: true, run: () => tabs().next() },
    { id: "tab.previous", title: "Previous tab", group: "tabs", shortcut: "Ctrl+Shift+Tab", global: true, run: () => tabs().previous() },
    { id: "nav.home", title: "Go to Home", group: "navigate", run: () => tabs().setView(tabs().activeId, "home") },
    { id: "app.palette", title: "Command palette", group: "app", shortcut: "Ctrl+K", global: true, run: () => useUi.getState().openPalette() },
    { id: "app.settings", title: "Open settings", group: "app", shortcut: "Ctrl+Comma", global: true, run: () => tabs().setView(tabs().activeId, "settings") },
    { id: "panel.toggle", title: "Show or hide the side panel", group: "view", shortcut: "Ctrl+Shift+E", run: () => usePanel.getState().toggle() },
    { id: "view.toggleHidden", title: "Show or hide hidden files", group: "view", shortcut: "Ctrl+H", run: () => settings().update("showHidden", !settings().settings.showHidden) },
    { id: "view.list", title: "Use list view by default", group: "view", shortcut: "Ctrl+Shift+1", run: () => settings().update("defaultView", "list") },
    { id: "view.grid", title: "Use grid view by default", group: "view", shortcut: "Ctrl+Shift+2", run: () => settings().update("defaultView", "grid") },
    { id: "theme.system", title: "Follow the Windows theme", group: "app", run: () => settings().update("theme", "system") },
    { id: "theme.light", title: "Use the light theme", group: "app", run: () => settings().update("theme", "light") },
    { id: "theme.dark", title: "Use the dark theme", group: "app", run: () => settings().update("theme", "dark") },
  ];

  for (let n = 1; n <= 9; n += 1) {
    commands.push({
      id: `tab.select.${n}`,
      title: `Switch to tab ${n}`,
      group: "tabs",
      shortcut: `Ctrl+${n}`,
      global: true,
      run: () => tabs().activateIndex(n - 1),
    });
  }

  return commands;
}

/** Registers once; React StrictMode mounts twice in development. */
export function ensureAppCommands(): void {
  if (listCommands().length === 0) registerCommands(buildAppCommands());
}
```

```tsx path=src/components/ui/Button.tsx
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
}

export function Button({ variant = "secondary", className, type = "button", ...rest }: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");
  return <button type={type} className={classes} {...rest} />;
}
```

```tsx path=src/components/ui/IconButton.tsx
import type { ComponentProps } from "react";

interface IconButtonProps extends ComponentProps<"button"> {
  /** Accessible name; also the tooltip. */
  label: string;
  active?: boolean;
}

export function IconButton({ label, active, className, type = "button", children, ...rest }: IconButtonProps) {
  const classes = ["icon-btn", active ? "is-active" : "", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} aria-label={label} title={label} aria-pressed={active} {...rest}>
      {children}
    </button>
  );
}
```

```tsx path=src/components/ui/Kbd.tsx
import { shortcutKeys } from "../../lib/shortcuts";

export function Kbd({ shortcut }: { shortcut: string }) {
  return (
    <span className="kbd" aria-label={shortcut}>
      {shortcutKeys(shortcut).map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}
```

```tsx path=src/components/ui/EmptyState.tsx
import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  /** One sentence (spec 8.4). */
  message: string;
  action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      {title && <p className="empty-title">{title}</p>}
      <p className="empty-message">{message}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
```

```tsx path=src/components/ui/Field.tsx
import { cloneElement, useId, type ReactElement } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  /** A single form control; it receives the generated id for the label. */
  children: ReactElement<{ id?: string }>;
}

export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <div className="field-text">
        <label htmlFor={id} className="field-label">{label}</label>
        {hint && <p className="field-hint">{hint}</p>}
      </div>
      <div className="field-control">{cloneElement(children, { id })}</div>
    </div>
  );
}
```

```tsx path=src/components/ui/Toasts.tsx
import { X } from "lucide-react";
import { useUi } from "../../store/ui";

export function Toasts() {
  const toasts = useUi((state) => state.toasts);
  const dismiss = useUi((state) => state.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host" aria-live="polite" data-testid="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
          <div className="toast-body">
            <p className="toast-title">{toast.title}</p>
            {toast.detail && <p className="toast-detail">{toast.detail}</p>}
          </div>
          <button type="button" className="toast-dismiss" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

```tsx path=src/components/ui/ConfirmDialog.tsx
import { useEffect, useRef, type KeyboardEvent } from "react";
import { useUi } from "../../store/ui";
import { Button } from "./Button";

/** Renders the pending question from the ui store; Escape and the backdrop answer no. */
export function ConfirmDialog() {
  const confirm = useUi((state) => state.confirm);
  const answer = useUi((state) => state.answer);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirm) primary.current?.focus();
  }, [confirm]);

  if (!confirm) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      answer(false);
      return;
    }
    if (event.key === "Tab") {
      // Keep focus inside the dialog.
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex = event.shiftKey ? (index - 1 + buttons.length) % buttons.length : (index + 1) % buttons.length;
      event.preventDefault();
      buttons[nextIndex]?.focus();
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={() => answer(false)} data-testid="confirm-dialog">
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id="dialog-title" className="dialog-title">{confirm.title}</h2>
        <p className="dialog-body">{confirm.body}</p>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={() => answer(false)}>Cancel</Button>
          <Button ref={primary} variant={confirm.destructive ? "danger" : "primary"} onClick={() => answer(true)}>
            {confirm.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Shell components**

```tsx path=src/components/shell/TitleBar.tsx
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Plus, Square, X } from "lucide-react";
import { isTauriHost } from "../../lib/ipc";
import { tabTitle, useTabs } from "../../store/tabs";
import { IconButton } from "../ui/IconButton";

type WindowAction = "minimize" | "toggleMaximize" | "close";

function windowControl(action: WindowAction): void {
  if (!isTauriHost()) return;
  getCurrentWindow()[action]().catch((error: unknown) => {
    console.error(`window ${action} failed`, error);
  });
}

/** Tabs on the left, window controls on the right, a drag region between (spec 8.1). */
export function TitleBar() {
  const tabs = useTabs((state) => state.tabs);
  const activeId = useTabs((state) => state.activeId);
  const activate = useTabs((state) => state.activate);
  const closeTab = useTabs((state) => state.closeTab);
  const newTab = useTabs((state) => state.newTab);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriHost()) return;
    const win = getCurrentWindow();
    let stop: (() => void) | undefined;
    const refresh = () => {
      win.isMaximized().then(setMaximized).catch((error: unknown) => console.warn("isMaximized failed", error));
    };
    refresh();
    win.onResized(refresh).then((unlisten) => { stop = unlisten; }).catch((error: unknown) => console.warn("onResized failed", error));
    return () => stop?.();
  }, []);

  return (
    <header className="titlebar" data-tauri-drag-region data-testid="titlebar">
      <div className="titlebar-tabs" role="tablist" aria-label="Tabs">
        {tabs.map((tab) => {
          const title = tabTitle(tab);
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              className={active ? "tab is-active" : "tab"}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              onClick={() => activate(tab.id)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") activate(tab.id); }}
              onAuxClick={(event) => { if (event.button === 1) closeTab(tab.id); }}
              data-testid="tab"
            >
              <span className="tab-title">{title}</span>
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${title}`}
                onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        <IconButton label="New tab" onClick={() => newTab("home")} data-testid="tab-new">
          <Plus size={14} />
        </IconButton>
      </div>
      <div className="titlebar-drag" data-tauri-drag-region />
      <div className="window-controls">
        <button type="button" className="window-control" aria-label="Minimize" onClick={() => windowControl("minimize")}>
          <Minus size={14} />
        </button>
        <button type="button" className="window-control" aria-label={maximized ? "Restore" : "Maximize"} onClick={() => windowControl("toggleMaximize")}>
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button type="button" className="window-control window-control-close" aria-label="Close" onClick={() => windowControl("close")}>
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
```

```tsx path=src/components/shell/Sidebar.tsx
import type { ReactNode } from "react";
import { House, Settings } from "lucide-react";
import { activeTab, useTabs, type TabView } from "../../store/tabs";

interface NavItem {
  view: TabView;
  label: string;
  icon: ReactNode;
}

const TOP: NavItem[] = [{ view: "home", label: "Home", icon: <House size={16} /> }];
const BOTTOM: NavItem[] = [{ view: "settings", label: "Settings", icon: <Settings size={16} /> }];

function NavButton({ item, current, onSelect }: { item: NavItem; current: boolean; onSelect: (view: TabView) => void }) {
  return (
    <button
      type="button"
      className={current ? "nav-item is-active" : "nav-item"}
      aria-current={current ? "page" : undefined}
      title={item.label}
      onClick={() => onSelect(item.view)}
    >
      {item.icon}
      <span className="nav-label">{item.label}</span>
    </button>
  );
}

/** Collapses to an icon rail below 900 px (styles.css); drives and favorites join in piece 2. */
export function Sidebar() {
  const current = useTabs(activeTab);
  const activeId = useTabs((state) => state.activeId);
  const setView = useTabs((state) => state.setView);
  const select = (view: TabView) => setView(activeId, view);

  return (
    <nav className="sidebar" aria-label="Navigation" data-testid="sidebar">
      <div className="sidebar-section">
        {TOP.map((item) => <NavButton key={item.view} item={item} current={current.view === item.view} onSelect={select} />)}
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-section">
        {BOTTOM.map((item) => <NavButton key={item.view} item={item} current={current.view === item.view} onSelect={select} />)}
      </div>
    </nav>
  );
}
```

```tsx path=src/components/shell/SidePanel.tsx
import type { ReactNode } from "react";
import { Image, ListChecks, NotebookPen } from "lucide-react";
import type { PanelTab } from "../../types";
import { useSettings } from "../../store/settings";
import { EmptyState } from "../ui/EmptyState";

interface PanelTabSpec {
  id: PanelTab;
  label: string;
  icon: ReactNode;
  empty: string;
}

const TABS: PanelTabSpec[] = [
  { id: "preview", label: "Preview", icon: <Image size={14} />, empty: "Select a file to preview it." },
  { id: "notes", label: "Notes", icon: <NotebookPen size={14} />, empty: "No notes yet." },
  { id: "todos", label: "To-dos", icon: <ListChecks size={14} />, empty: "No to-dos yet." },
];

/** Preview, Notes and To-dos tabs; a fourth slot stays reserved for the assistant (spec 8.1). */
export function SidePanel() {
  const active = useSettings((state) => state.settings.panelTab);
  const update = useSettings((state) => state.update);
  const current = TABS.find((tab) => tab.id === active) ?? TABS[0];

  return (
    <aside className="panel" data-testid="side-panel" aria-label="Side panel">
      <div className="panel-tabs" role="tablist" aria-label="Side panel sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`panel-tab-${tab.id}`}
            aria-selected={tab.id === current.id}
            aria-controls="panel-content"
            className={tab.id === current.id ? "panel-tab is-active" : "panel-tab"}
            onClick={() => update("panelTab", tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div id="panel-content" className="panel-content" role="tabpanel" aria-labelledby={`panel-tab-${current.id}`}>
        <EmptyState message={current.empty} />
      </div>
    </aside>
  );
}
```

```tsx path=src/components/shell/StatusBar.tsx
import { PanelRight } from "lucide-react";
import { usePanel } from "../../store/panel";
import { useSettings } from "../../store/settings";
import { activeTab, tabTitle, useTabs } from "../../store/tabs";
import { IconButton } from "../ui/IconButton";

export function StatusBar() {
  const tab = useTabs(activeTab);
  const showHidden = useSettings((state) => state.settings.showHidden);
  const panelOpen = usePanel((state) => state.open);
  const togglePanel = usePanel((state) => state.toggle);

  return (
    <footer className="statusbar" data-testid="statusbar">
      <span className="status-text">{tabTitle(tab)}</span>
      <span className="status-text status-muted" data-testid="status-hidden">
        {showHidden ? "Hidden files shown" : ""}
      </span>
      <span className="status-spacer" />
      <IconButton label="Show or hide the side panel" active={panelOpen} onClick={togglePanel}>
        <PanelRight size={14} />
      </IconButton>
    </footer>
  );
}
```

- [ ] **Step 7: Views and the palette**

```tsx path=src/components/home/HomeView.tsx
import { useUi } from "../../store/ui";

/** Drive cards, favorites and recent files arrive in piece 2; today Home is honest about being empty. */
export function HomeView() {
  const info = useUi((state) => state.appInfo);
  return (
    <section className="view" data-testid="home-view">
      {info?.databaseRecovered && (
        <div className="notice" role="status">
          The Tanaw database was damaged and has been reset. The damaged file was kept beside it.
        </div>
      )}
      <h1 className="view-title">Home</h1>
      <p className="view-lead">Nothing to show yet.</p>
    </section>
  );
}
```

```tsx path=src/components/settings/SettingsView.tsx
import type { Theme, ViewMode } from "../../types";
import { useSettings } from "../../store/settings";
import { useUi } from "../../store/ui";
import { Field } from "../ui/Field";

export function SettingsView() {
  const settings = useSettings((state) => state.settings);
  const update = useSettings((state) => state.update);
  const info = useUi((state) => state.appInfo);

  return (
    <section className="view" data-testid="settings-view">
      <h1 className="view-title">Settings</h1>

      <div className="settings-group">
        <h2 className="settings-heading">Appearance</h2>
        <Field label="Theme" hint="System follows the Windows setting.">
          <select
            className="input"
            value={settings.theme}
            onChange={(event) => update("theme", event.target.value as Theme)}
            data-testid="setting-theme"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
        <Field label="Default view" hint="How a folder opens the first time.">
          <select
            className="input"
            value={settings.defaultView}
            onChange={(event) => update("defaultView", event.target.value as ViewMode)}
          >
            <option value="list">List</option>
            <option value="grid">Grid</option>
          </select>
        </Field>
      </div>

      <div className="settings-group">
        <h2 className="settings-heading">Files</h2>
        <Field label="Show hidden and system files" hint="Ctrl+H toggles this while browsing.">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.showHidden}
            onChange={(event) => update("showHidden", event.target.checked)}
          />
        </Field>
      </div>

      <div className="settings-group">
        <h2 className="settings-heading">Updates</h2>
        <Field label="Check for updates when Tanaw starts" hint="The only network request Tanaw makes. Installing always asks first.">
          <input
            type="checkbox"
            className="checkbox"
            checked={settings.checkUpdates}
            onChange={(event) => update("checkUpdates", event.target.checked)}
          />
        </Field>
      </div>

      <div className="settings-group">
        <h2 className="settings-heading">About</h2>
        <dl className="about">
          <dt>Version</dt>
          <dd className="mono">{info?.version ?? ""}</dd>
          <dt>Data folder</dt>
          <dd className="mono">{info?.dataDir ?? ""}</dd>
        </dl>
      </div>
    </section>
  );
}
```

```tsx path=src/components/palette/CommandPalette.tsx
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { isAvailable, listCommands, type Command, type CommandGroup } from "../../lib/commands";
import { useUi } from "../../store/ui";
import { Kbd } from "../ui/Kbd";

const GROUP_LABEL: Record<CommandGroup, string> = {
  tabs: "Tabs",
  navigate: "Navigate",
  view: "View",
  app: "App",
};

/** Ctrl+K: every available command, filtered by title, run with Enter or a click. */
export function CommandPalette() {
  const open = useUi((state) => state.paletteOpen);
  const close = useUi((state) => state.closePalette);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return listCommands().filter((command) => isAvailable(command) && (needle === "" || command.title.toLowerCase().includes(needle)));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  const run = (command: Command) => {
    close();
    void command.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((current) => Math.min(current + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = items[index];
      if (command) run(command);
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={close} data-testid="command-palette">
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(event) => event.stopPropagation()}>
        <input
          ref={input}
          className="palette-input"
          placeholder="Type a command"
          aria-label="Search commands"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setIndex(0); }}
          onKeyDown={onKeyDown}
        />
        <ul className="palette-list" role="listbox" aria-label="Commands">
          {items.map((command, position) => (
            <li
              key={command.id}
              role="option"
              aria-selected={position === index}
              className={position === index ? "palette-item is-active" : "palette-item"}
              onMouseEnter={() => setIndex(position)}
              onClick={() => run(command)}
            >
              <span className="palette-group micro">{GROUP_LABEL[command.group]}</span>
              <span className="palette-title">{command.title}</span>
              {command.shortcut && <Kbd shortcut={command.shortcut} />}
            </li>
          ))}
          {items.length === 0 && <li className="palette-empty">Nothing matches {query}.</li>}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Harness, composition and entry**

```ts path=src/dev/mockBackend.ts
/*
 * Dev-only mock of the Tauri IPC backend so the renderer runs in a plain
 * browser (`npm run dev:ui`) and under the Playwright drive. Activated from
 * main.tsx only when `import.meta.env.DEV` is true AND no Tauri host is
 * present, so it is dead code in `npm run build` and never runs in the app.
 *
 * It mirrors the Rust commands of src-tauri/src with in-memory state. The
 * shapes here are the contract in src/types.ts; keep them in step.
 */
import { DEFAULT_SETTINGS } from "../lib/defaults";
import type { AppInfo, Settings } from "../types";

type Handler = (args: Record<string, unknown>) => unknown;

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
    dataDir: "C:/Users/dev/AppData/Local/com.focalstack.tanaw",
    databaseRecovered: false,
  }),
  // Window plugin calls from the custom title bar: no window to move in a browser.
  "plugin:window|is_maximized": () => false,
  "plugin:window|minimize": () => null,
  "plugin:window|toggle_maximize": () => null,
  "plugin:window|close": () => null,
  "plugin:window|start_dragging": () => null,
};

export function installMockBackend(): void {
  if ("__TAURI_INTERNALS__" in window) return;
  console.info("[tanaw] Running with the dev mock backend (no Tauri host detected).");

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
        return Promise.reject(new Error(`[tanaw dev mock] Unhandled IPC command: ${cmd}`));
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
```

```tsx path=src/App.tsx
import { useEffect, type CSSProperties } from "react";
import { ensureAppCommands } from "./lib/appCommands";
import { commandForKey } from "./lib/commands";
import { describeError } from "./lib/errors";
import { ipc, toTanawError } from "./lib/ipc";
import { usePanel } from "./store/panel";
import { useSettings } from "./store/settings";
import { activeTab, useTabs } from "./store/tabs";
import { useUi } from "./store/ui";
import { HomeView } from "./components/home/HomeView";
import { CommandPalette } from "./components/palette/CommandPalette";
import { SettingsView } from "./components/settings/SettingsView";
import { Sidebar } from "./components/shell/Sidebar";
import { SidePanel } from "./components/shell/SidePanel";
import { StatusBar } from "./components/shell/StatusBar";
import { TitleBar } from "./components/shell/TitleBar";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";
import { Toasts } from "./components/ui/Toasts";

export default function App() {
  const load = useSettings((state) => state.load);
  const settings = useSettings((state) => state.settings);
  const setAppInfo = useUi((state) => state.setAppInfo);
  const tab = useTabs(activeTab);
  const panelOpen = usePanel((state) => state.open);

  // Boot: commands, persisted settings (which paint the theme), app facts.
  useEffect(() => {
    ensureAppCommands();
    void load();
    ipc.getAppInfo().then(setAppInfo).catch((raw: unknown) => {
      const { title, detail } = describeError(toTanawError(raw));
      useUi.getState().toast("error", title, detail);
    });
  }, [load, setAppInfo]);

  // One key handler for every shortcut; overlays own their keys while open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUi.getState();
      if (ui.paletteOpen || ui.confirm) return;
      const command = commandForKey(event);
      if (!command) return;
      event.preventDefault();
      void command.run();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const style = {
    "--sidebar-width": `${settings.sidebarWidth}px`,
    "--panel-width": `${settings.panelWidth}px`,
  } as CSSProperties;

  return (
    <div className={panelOpen ? "app has-panel" : "app"} style={style} data-testid="app">
      <TitleBar />
      <Sidebar />
      <main className="content" data-testid="content">
        {tab.view === "settings" ? <SettingsView /> : <HomeView />}
      </main>
      {panelOpen && <SidePanel />}
      <StatusBar />
      <CommandPalette />
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}
```

```tsx path=src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme } from "./lib/theme";
import "./styles.css";

// Dev harness: run the renderer in a plain browser with mocked IPC.
// Never active in production builds or inside the Tauri shell.
if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
  const { installMockBackend } = await import("./dev/mockBackend");
  installMockBackend();
}

// Paint the system theme before the first frame; settings may switch it after loading.
applyTheme("system");

const root = document.getElementById("root");
if (!root) throw new Error("Tanaw: index.html has no #root element");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 9: Vendor the fonts**

Both families are SIL Open Font License 1.1. Pack the fontsource variable packages once, copy the latin variable files under neutral names, and keep the license texts beside them. Nothing from these packages stays a dependency.

```bash
mkdir -p src/assets/fonts .scratch/fonts
(cd .scratch/fonts && npm pack @fontsource-variable/geist @fontsource-variable/jetbrains-mono && for t in *.tgz; do mkdir -p "${t%.tgz}" && tar -xzf "$t" -C "${t%.tgz}"; done && ls */package/files)
cp .scratch/fonts/fontsource-variable-geist-*/package/files/geist-latin-wght-normal.woff2 src/assets/fonts/GeistVariable.woff2
cp .scratch/fonts/fontsource-variable-geist-*/package/LICENSE src/assets/fonts/LICENSE-Geist.txt
cp .scratch/fonts/fontsource-variable-jetbrains-mono-*/package/files/jetbrains-mono-latin-wght-normal.woff2 src/assets/fonts/JetBrainsMonoVariable.woff2
cp .scratch/fonts/fontsource-variable-jetbrains-mono-*/package/LICENSE src/assets/fonts/LICENSE-JetBrainsMono.txt
ls -l src/assets/fonts
```

The `ls */package/files` line prints the real file names; if a package names its latin variable file differently, copy that file instead and record the name in the journal.

- [ ] **Step 10: Tokens, base and component styles**

```css path=src/styles.css
/* ---------------------------------------------------------------------------
   Tanaw design system. The chrome is monochrome; color carries information
   only (selection, focus, status, file types). Token values are the table in
   docs/superpowers/specs/2026-10-02-filewell-v1-design.md, section 8.2.
--------------------------------------------------------------------------- */

@font-face {
  font-family: "Geist";
  src: url("./assets/fonts/GeistVariable.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "JetBrains Mono";
  src: url("./assets/fonts/JetBrainsMonoVariable.woff2") format("woff2");
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}

/* ---------------------------------------------------------------------------
   Tokens shared by both themes
--------------------------------------------------------------------------- */
:root {
  --font-main: "Geist", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Mono", ui-monospace, monospace;

  --text-11: 11px;
  --text-13: 13px;
  --text-16: 16px;
  --text-20: 20px;
  --text-26: 26px;

  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 24px;
  --s-6: 32px;

  --r-sm: 4px;
  --r-md: 6px;
  --r-lg: 10px;
  --r-xl: 14px;

  --z-nav: 20;
  --z-drawer: 30;
  --z-popover: 40;
  --z-modal: 50;
  --z-toast: 60;

  --duration: 120ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);

  --titlebar-height: 38px;
  --statusbar-height: 26px;
  --rail-width: 48px;
  --sidebar-width: 220px;
  --panel-width: 320px;
}

/* Dark is also the fallback before the theme attribute is set. */
:root,
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg-canvas: #0b0b0c;
  --bg-surface: #111113;
  --bg-raised: #18181b;
  --bg-overlay: #1f1f23;
  --bg-hover: rgba(255, 255, 255, 0.05);
  --bg-active: rgba(255, 255, 255, 0.09);
  --border-faint: rgba(255, 255, 255, 0.06);
  --border: rgba(255, 255, 255, 0.14);
  --border-strong: rgba(255, 255, 255, 0.26);
  --text-primary: #f2f2f0;
  --text-muted: #a3a3a0;
  --text-faint: #78787a;
  --accent: #7aa2f7;
  --accent-faint: rgba(122, 162, 247, 0.14);
  --success: #46b37e;
  --warning: #d9a13f;
  --error: #e05d55;
  --shadow-rest: 0 1px 2px rgba(0, 0, 0, 0.6), 0 6px 16px rgba(0, 0, 0, 0.35);
  --shadow-raised: 0 2px 4px rgba(0, 0, 0, 0.55), 0 14px 36px rgba(0, 0, 0, 0.5);
  --shadow-overlay: 0 24px 64px rgba(0, 0, 0, 0.72);
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg-canvas: #f4f4f2;
  --bg-surface: #ffffff;
  --bg-raised: #ffffff;
  --bg-overlay: #ffffff;
  --bg-hover: rgba(0, 0, 0, 0.04);
  --bg-active: rgba(0, 0, 0, 0.08);
  --border-faint: rgba(0, 0, 0, 0.06);
  --border: rgba(0, 0, 0, 0.14);
  --border-strong: rgba(0, 0, 0, 0.24);
  --text-primary: #1a1a1a;
  --text-muted: #5c5c5a;
  --text-faint: #8a8a88;
  --accent: #2f62c7;
  --accent-faint: rgba(47, 98, 199, 0.12);
  --success: #2f8a5e;
  --warning: #a8771f;
  --error: #c4463e;
  --shadow-rest: 0 1px 2px rgba(0, 0, 0, 0.08), 0 6px 16px rgba(0, 0, 0, 0.08);
  --shadow-raised: 0 2px 4px rgba(0, 0, 0, 0.1), 0 14px 36px rgba(0, 0, 0, 0.14);
  --shadow-overlay: 0 24px 64px rgba(0, 0, 0, 0.22);
}

/* ---------------------------------------------------------------------------
   Base
--------------------------------------------------------------------------- */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body,
#root {
  height: 100%;
  overflow: hidden;
}

body {
  background: var(--bg-canvas);
  color: var(--text-primary);
  font-family: var(--font-main);
  font-size: var(--text-13);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  cursor: default;
}

button,
input,
select {
  font: inherit;
  color: inherit;
}

button {
  background: none;
  border: 0;
  cursor: default;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.mono {
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  user-select: text;
}

.micro {
  font-size: var(--text-11);
  line-height: 1.4;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border: 3px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}

::-webkit-scrollbar-thumb:hover {
  background-color: var(--border-strong);
}

::-webkit-scrollbar-button {
  display: none;
}

/* ---------------------------------------------------------------------------
   Layout: title bar / sidebar + content + panel / status bar
--------------------------------------------------------------------------- */
.app {
  position: relative;
  display: grid;
  grid-template-rows: var(--titlebar-height) 1fr var(--statusbar-height);
  grid-template-columns: auto 1fr;
  height: 100vh;
  background: var(--bg-canvas);
}

.app.has-panel {
  grid-template-columns: auto 1fr auto;
}

.titlebar,
.statusbar {
  grid-column: 1 / -1;
}

/* ---------------------------------------------------------------------------
   Title bar
--------------------------------------------------------------------------- */
.titlebar {
  display: flex;
  align-items: stretch;
  height: var(--titlebar-height);
  background: var(--bg-canvas);
  border-bottom: 1px solid var(--border-faint);
}

.titlebar-tabs {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;
  padding: var(--s-1) 0 0 var(--s-2);
  overflow: hidden;
}

.tab {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  height: 30px;
  min-width: 0;
  max-width: 200px;
  padding: 0 var(--s-2) 0 var(--s-3);
  border-radius: var(--r-md) var(--r-md) 0 0;
  color: var(--text-muted);
}

.tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab.is-active {
  background: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: inset 0 1px 0 var(--border-faint), inset 1px 0 0 var(--border-faint), inset -1px 0 0 var(--border-faint);
}

.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: var(--r-sm);
  color: var(--text-faint);
  opacity: 0;
}

.tab:hover .tab-close,
.tab.is-active .tab-close,
.tab-close:focus-visible {
  opacity: 1;
}

.tab-close:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

.titlebar-tabs .icon-btn {
  align-self: center;
  margin-left: var(--s-1);
}

.titlebar-drag {
  flex: 1;
  min-width: 80px;
}

.window-controls {
  display: flex;
}

.window-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: var(--titlebar-height);
  color: var(--text-muted);
}

.window-control:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.window-control-close:hover {
  background: var(--error);
  color: #ffffff;
}

/* ---------------------------------------------------------------------------
   Sidebar
--------------------------------------------------------------------------- */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
  width: var(--sidebar-width);
  padding: var(--s-2);
  background: var(--bg-canvas);
  overflow: hidden auto;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-spacer {
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  height: 32px;
  padding: 0 var(--s-3);
  border-radius: var(--r-md);
  color: var(--text-muted);
  text-align: left;
  white-space: nowrap;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.is-active {
  background: var(--bg-active);
  color: var(--text-primary);
  font-weight: 500;
}

.nav-item svg {
  flex: 0 0 auto;
}

/* ---------------------------------------------------------------------------
   Content and views
--------------------------------------------------------------------------- */
.content {
  min-width: 0;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-faint);
  border-right: 1px solid var(--border-faint);
  overflow: auto;
}

.view {
  max-width: 960px;
  padding: var(--s-6);
}

.view-title {
  font-size: var(--text-26);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.view-lead {
  margin-top: var(--s-2);
  color: var(--text-muted);
}

.notice {
  margin-bottom: var(--s-4);
  padding: var(--s-3) var(--s-4);
  border: 1px solid var(--border);
  border-left: 3px solid var(--warning);
  border-radius: var(--r-md);
  background: var(--bg-raised);
}

/* ---------------------------------------------------------------------------
   Side panel
--------------------------------------------------------------------------- */
.panel {
  display: flex;
  flex-direction: column;
  width: var(--panel-width);
  min-width: 0;
  background: var(--bg-canvas);
}

.panel-tabs {
  display: flex;
  gap: 2px;
  padding: var(--s-2) var(--s-2) 0;
  border-bottom: 1px solid var(--border-faint);
}

.panel-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  height: 32px;
  padding: 0 var(--s-3);
  border-radius: var(--r-md) var(--r-md) 0 0;
  color: var(--text-muted);
}

.panel-tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.panel-tab.is-active {
  color: var(--text-primary);
  font-weight: 500;
  box-shadow: inset 0 -2px 0 var(--accent);
}

.panel-content {
  display: flex;
  flex: 1;
  overflow: auto;
}

/* ---------------------------------------------------------------------------
   Status bar
--------------------------------------------------------------------------- */
.statusbar {
  display: flex;
  align-items: center;
  gap: var(--s-4);
  height: var(--statusbar-height);
  padding: 0 var(--s-2) 0 var(--s-3);
  border-top: 1px solid var(--border-faint);
  background: var(--bg-canvas);
  font-size: var(--text-11);
  line-height: 1.4;
}

.status-text {
  color: var(--text-primary);
  white-space: nowrap;
}

.status-muted {
  color: var(--text-muted);
}

.status-spacer {
  flex: 1;
}

.statusbar .icon-btn {
  width: 24px;
  height: 22px;
}

/* ---------------------------------------------------------------------------
   Buttons, keys, forms
--------------------------------------------------------------------------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  min-height: 32px;
  padding: 0 var(--s-4);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-raised);
  color: var(--text-primary);
  font-weight: 500;
  transition: background var(--duration) var(--ease-out);
}

.btn:hover {
  background: var(--bg-hover);
}

.btn-primary {
  background: var(--text-primary);
  color: var(--bg-canvas);
  border-color: transparent;
}

.btn-primary:hover {
  background: var(--text-primary);
  opacity: 0.9;
}

.btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-muted);
}

.btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-danger {
  background: var(--error);
  color: #ffffff;
  border-color: transparent;
}

.btn:disabled {
  opacity: 0.5;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-md);
  color: var(--text-muted);
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn.is-active {
  background: var(--bg-active);
  color: var(--text-primary);
}

.kbd {
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
}

.kbd kbd {
  padding: 3px 5px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: var(--r-sm);
  background: var(--bg-raised);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-11);
  line-height: 1;
}

.input {
  min-width: 160px;
  min-height: 32px;
  padding: 0 var(--s-3);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-raised);
  color: var(--text-primary);
}

.input:focus-visible {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-faint);
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-5);
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--border-faint);
}

.field:last-child {
  border-bottom: 0;
}

.field-label {
  font-weight: 500;
}

.field-hint {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 12px;
}

.field-control {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 32px;
}

.settings-group {
  margin-top: var(--s-5);
  padding: 0 var(--s-4);
  border: 1px solid var(--border-faint);
  border-radius: var(--r-lg);
  background: var(--bg-raised);
}

.settings-heading {
  padding: var(--s-3) 0 var(--s-1);
  font-size: var(--text-11);
  line-height: 1.4;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.about {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--s-2) var(--s-4);
  padding: var(--s-3) 0;
}

.about dt {
  color: var(--text-muted);
}

/* ---------------------------------------------------------------------------
   Empty states, dialog, toasts, palette
--------------------------------------------------------------------------- */
.empty-state {
  max-width: 280px;
  margin: auto;
  padding: var(--s-6);
  text-align: center;
}

.empty-title {
  font-size: var(--text-16);
  font-weight: 600;
}

.empty-message {
  color: var(--text-muted);
}

.empty-action {
  margin-top: var(--s-4);
}

.dialog-backdrop,
.palette-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.dialog-backdrop {
  z-index: var(--z-modal);
  align-items: center;
}

.palette-backdrop {
  z-index: var(--z-popover);
  align-items: flex-start;
  padding-top: 12vh;
}

.dialog {
  width: min(440px, calc(100vw - var(--s-6)));
  padding: var(--s-5);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-overlay);
}

.dialog-title {
  font-size: var(--text-16);
  font-weight: 600;
}

.dialog-body {
  margin-top: var(--s-2);
  color: var(--text-muted);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--s-2);
  margin-top: var(--s-5);
}

.toast-host {
  position: fixed;
  right: var(--s-4);
  bottom: calc(var(--statusbar-height) + var(--s-4));
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  width: min(360px, calc(100vw - var(--s-6)));
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
  border-radius: var(--r-lg);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-raised);
}

.toast-error {
  border-left-color: var(--error);
}

.toast-success {
  border-left-color: var(--success);
}

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 500;
}

.toast-detail {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
  user-select: text;
}

.toast-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--r-sm);
  color: var(--text-faint);
}

.toast-dismiss:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.palette {
  width: min(560px, calc(100vw - var(--s-6)));
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-overlay);
  overflow: hidden;
}

.palette-input {
  width: 100%;
  height: 44px;
  padding: 0 var(--s-4);
  border: 0;
  border-bottom: 1px solid var(--border-faint);
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-16);
  outline: none;
}

.palette-input::placeholder {
  color: var(--text-faint);
}

.palette-list {
  max-height: 50vh;
  padding: var(--s-1);
  list-style: none;
  overflow: auto;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  height: 34px;
  padding: 0 var(--s-3);
  border-radius: var(--r-md);
}

.palette-item.is-active {
  background: var(--accent-faint);
}

.palette-group {
  flex: 0 0 auto;
  width: 64px;
}

.palette-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-empty {
  padding: var(--s-4);
  color: var(--text-muted);
  text-align: center;
}

/* ---------------------------------------------------------------------------
   Responsiveness (spec 8.1) and motion
--------------------------------------------------------------------------- */
@media (max-width: 1099px) {
  .app.has-panel {
    grid-template-columns: auto 1fr;
  }

  .panel {
    position: absolute;
    top: var(--titlebar-height);
    right: 0;
    bottom: var(--statusbar-height);
    z-index: var(--z-drawer);
    border-left: 1px solid var(--border);
    box-shadow: var(--shadow-raised);
  }
}

@media (max-width: 899px) {
  .sidebar {
    width: var(--rail-width);
    padding: var(--s-2) var(--s-1);
  }

  .nav-item {
    justify-content: center;
    padding: 0;
  }

  .nav-label {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0ms !important;
    animation: none !important;
  }
}
```

- [ ] **Step 11: Run the tests to verify they pass, then the Task 3 gate**

Run: `npx vitest run`
Expected: PASS, 5 files (invariants, shortcuts, commands, tabs, theme).

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all exit 0.

Run: `npm run dev:ui` and open `http://localhost:1420` in a browser.
Expected: the shell renders in the dark theme with one Home tab, the console shows `[tanaw] Running with the dev mock backend`, Ctrl+K opens the palette, and the Settings theme select switches `html[data-theme]`. Stop the server afterwards.

- [ ] **Step 12: Journal and commit**

```bash
git add -A
git commit -m "feat(renderer): shell, tabs, themes, settings, command palette, shortcuts, mocked-IPC harness" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Contrast gate, driven UI verification, interface map, CI ui job

**Files:**
- Create: `scripts/verify-contrast.mjs`, `scripts/verify-ui.mjs`, `docs/FEATURE_MAP.md`
- Modify (whole file repeated): `.github/workflows/verify.yml`
- Test: `src/tests/featureMap.test.ts`

**Interfaces:**
- Consumes: the `data-testid` hooks and `buildAppCommands()` from Task 3; the `verify:contrast` and `verify:ui` npm scripts from Task 1.
- Produces: `reports/ui-verification/<stamp>/{summary.json,console.log,*.png}` on every drive; `docs/FEATURE_MAP.md`, which every later interface change updates in the same commit.

- [ ] **Step 1: Write the failing feature map test**

```ts path=src/tests/featureMap.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAppCommands } from "../lib/appCommands";

const map = readFileSync(new URL("../../docs/FEATURE_MAP.md", import.meta.url), "utf8");

/** Rows of the Shortcuts table as shortcut -> command id; a `<n>` row expands to 1 to 9. */
function mappedShortcuts(): Map<string, string> {
  const section = map.split("## Shortcuts")[1]?.split("\n## ")[0] ?? "";
  const rows = new Map<string, string>();
  for (const line of section.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 4 || cells[1] === "Shortcut" || cells[1].startsWith("---")) continue;
    const shortcut = cells[1].replace(/`/g, "");
    const id = cells[2].replace(/`/g, "");
    if (shortcut.includes("<n>")) {
      for (let n = 1; n <= 9; n += 1) rows.set(shortcut.replace("<n>", String(n)), id.replace("<n>", String(n)));
    } else {
      rows.set(shortcut, id);
    }
  }
  return rows;
}

describe("docs/FEATURE_MAP.md", () => {
  it("lists every bound shortcut with its command id, and nothing stale", () => {
    const mapped = mappedShortcuts();
    const bound = new Map(buildAppCommands().filter((c) => c.shortcut).map((c) => [c.shortcut as string, c.id]));
    expect(Object.fromEntries(mapped)).toEqual(Object.fromEntries(bound));
  });
});
```

Run: `npx vitest run src/tests/featureMap.test.ts`
Expected: FAIL, `ENOENT ... docs/FEATURE_MAP.md`.

- [ ] **Step 2: The interface map**

```md path=docs/FEATURE_MAP.md
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
```

Run: `npx vitest run src/tests/featureMap.test.ts`
Expected: PASS.

- [ ] **Step 3: Contrast gate**

```js path=scripts/verify-contrast.mjs
#!/usr/bin/env node
// Contrast gate over the design tokens in src/styles.css (spec 8.5): every
// text token on every surface token, in both themes. Body text tokens need
// 4.5:1. --text-faint is reserved for 13 px and larger text and needs 3:1.
// --accent is a focus and selection mark and needs 3:1 on every surface.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function tokensFor(theme) {
  const marker = `[data-theme="${theme}"]`;
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`verify-contrast: no ${marker} block in src/styles.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const tokens = {};
  for (const match of css.slice(open, close).matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

function luminance(hex) {
  const channel = (offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function ratio(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const SURFACES = ["bg-canvas", "bg-surface", "bg-raised", "bg-overlay"];
const RULES = [
  { token: "text-primary", min: 4.5 },
  { token: "text-muted", min: 4.5 },
  { token: "text-faint", min: 3 },
  { token: "accent", min: 3 },
];

let checks = 0;
let failures = 0;
for (const theme of ["dark", "light"]) {
  const tokens = tokensFor(theme);
  for (const { token, min } of RULES) {
    for (const surface of SURFACES) {
      const foreground = tokens[token];
      const background = tokens[surface];
      if (!foreground || !background) {
        failures += 1;
        console.error(`[FAIL] ${theme}: missing token --${foreground ? surface : token}`);
        continue;
      }
      checks += 1;
      const value = ratio(foreground, background);
      const ok = value >= min;
      if (!ok) failures += 1;
      console.log(`[${ok ? "PASS" : "FAIL"}] ${theme} --${token} on --${surface}: ${value.toFixed(2)}:1 (min ${min})`);
    }
  }
}

console.log(`\n${checks} pairs checked, ${failures} below threshold.`);
process.exit(failures === 0 ? 0 : 1);
```

Run: `npm run verify:contrast`
Expected: 32 pairs checked, 0 below threshold, exit 0.

- [ ] **Step 4: The UI drive**

```js path=scripts/verify-ui.mjs
#!/usr/bin/env node
/**
 * Tanaw UI verification drive.
 *
 * Starts the Vite dev server, which activates the mocked-IPC harness in a plain
 * browser (src/main.tsx), then drives the renderer with Playwright the way a
 * user does: real keys and clicks, screenshots and console output as evidence.
 *
 * Exits non-zero when the shell fails to render, a mapped surface does not
 * open, or the page raises an uncaught error. Evidence lands in
 * reports/ui-verification/<stamp>/. Native behaviour (window controls, the
 * real database) stays with cargo test.
 *
 * Usage: npm run verify:ui        (add --headed to watch it run)
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VITE_BIN = join(ROOT, "node_modules", "vite", "bin", "vite.js");
const HOST = "127.0.0.1";
const PORT = 1420;
const BASE_URL = `http://${HOST}:${PORT}`;
const READY_TIMEOUT_MS = 60_000;
const STEP_TIMEOUT_MS = 8_000;
const VIEWPORT = { width: 1280, height: 820 };
const NARROW = { width: 800, height: 600 };
const HEADED = process.argv.includes("--headed");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const EVIDENCE_DIR = join(ROOT, "reports", "ui-verification", stamp);

const results = [];
const consoleErrors = [];
const pageErrors = [];

function record(step, passed, detail) {
  results.push({ step, passed, detail });
  process.stdout.write(`[${passed ? "PASS" : "FAIL"}] ${step}${detail ? ` :: ${detail}` : ""}\n`);
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return (await response.text()).includes('id="root"');
    } catch {
      // Not listening yet; the dev server is still starting.
    }
    await sleep(500);
  }
  return false;
}

function startDevServer() {
  const child = spawn(process.execPath, [VITE_BIN, "--host", HOST, "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    env: { ...process.env, BROWSER: "none", CI: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk.toString(); });
  child.stderr.on("data", (chunk) => { log += chunk.toString(); });
  return { child, readLog: () => log };
}

function stopDevServer(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    // Kill the exact process tree we started, never by image name.
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

async function open(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="app"]', { timeout: READY_TIMEOUT_MS });
  await sleep(300);
}

async function visible(page, selector) {
  try {
    await page.waitForSelector(selector, { state: "visible", timeout: STEP_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

async function hidden(page, selector) {
  try {
    await page.waitForSelector(selector, { state: "hidden", timeout: STEP_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

const capture = (page, name) => page.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`) });

async function drive(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: "dark" });
  const page = await context.newPage();
  page.on("crash", () => pageErrors.push("renderer crashed"));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // 1. The shell renders with all four regions.
  await open(page);
  const regions = await Promise.all(["titlebar", "sidebar", "content", "statusbar"].map((id) => visible(page, `[data-testid="${id}"]`)));
  await capture(page, "01-shell-dark");
  record("Shell renders (titlebar, sidebar, content, statusbar)", regions.every(Boolean), regions.join(","));

  // 2. Tabs open and close from the keyboard.
  await page.keyboard.press("Control+KeyT");
  await sleep(100);
  const afterNew = await page.locator('[data-testid="tab"]').count();
  await page.keyboard.press("Control+KeyW");
  await sleep(100);
  const afterClose = await page.locator('[data-testid="tab"]').count();
  await capture(page, "02-tabs");
  record("Ctrl+T adds a tab and Ctrl+W closes it", afterNew === 2 && afterClose === 1, `after new=${afterNew} after close=${afterClose}`);

  // 3. The palette opens, filters and runs a command.
  await page.keyboard.press("Control+KeyK");
  const paletteOk = await visible(page, '[data-testid="command-palette"]');
  if (paletteOk) await capture(page, "03-palette");
  await page.keyboard.type("settings");
  await page.keyboard.press("Enter");
  const settingsOk = await visible(page, '[data-testid="settings-view"]');
  record("Ctrl+K opens the palette and runs Open settings", paletteOk && settingsOk, `palette=${paletteOk} settings=${settingsOk}`);

  // 4. The theme select switches the document theme both ways.
  await page.selectOption('[data-testid="setting-theme"]', "light");
  const light = await page.evaluate(() => document.documentElement.dataset.theme);
  await capture(page, "04-settings-light");
  await page.selectOption('[data-testid="setting-theme"]', "dark");
  const dark = await page.evaluate(() => document.documentElement.dataset.theme);
  record("Theme select switches html[data-theme]", light === "light" && dark === "dark", `light=${light} dark=${dark}`);

  // 5. The side panel toggles from the keyboard.
  await page.keyboard.press("Control+Shift+KeyE");
  const panelHidden = await hidden(page, '[data-testid="side-panel"]');
  await page.keyboard.press("Control+Shift+KeyE");
  const panelShown = await visible(page, '[data-testid="side-panel"]');
  record("Ctrl+Shift+E hides and shows the side panel", panelHidden && panelShown, `hidden=${panelHidden} shown=${panelShown}`);

  // 6. Hidden-files toggle reports in the status bar.
  await page.keyboard.press("Control+KeyH");
  await sleep(100);
  const status = (await page.locator('[data-testid="status-hidden"]').textContent()) ?? "";
  record("Ctrl+H reports hidden files in the status bar", status.includes("Hidden files shown"), JSON.stringify(status));
  await page.keyboard.press("Control+KeyH");

  // 7. Narrow window: sidebar rail, no horizontal overflow.
  await page.setViewportSize(NARROW);
  await sleep(200);
  const narrow = await page.evaluate(() => ({
    sidebar: document.querySelector('[data-testid="sidebar"]')?.getBoundingClientRect().width ?? 0,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  await capture(page, "05-narrow");
  record("800 px: sidebar collapses to a rail and nothing overflows", narrow.sidebar <= 48 && !narrow.overflow, JSON.stringify(narrow));

  await context.close();
}

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  let dev = null;
  let browser = null;
  let exitCode = 0;
  try {
    dev = startDevServer();
    const ready = await waitForServer();
    record("Doctor: dev server serves the app shell", ready, ready ? BASE_URL : `nothing serving #root on ${BASE_URL} after ${READY_TIMEOUT_MS} ms`);
    if (!ready) {
      process.stderr.write(dev.readLog());
      exitCode = 1;
    } else {
      browser = await chromium.launch({ headless: !HEADED });
      await drive(browser);
    }

    const failed = results.filter((entry) => !entry.passed);
    const summary = { stamp, baseUrl: BASE_URL, viewport: VIEWPORT, headless: !HEADED, steps: results, failedSteps: failed.length, consoleErrors, pageErrors };
    writeFileSync(join(EVIDENCE_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    writeFileSync(
      join(EVIDENCE_DIR, "console.log"),
      [...consoleErrors.map((line) => `[console.error] ${line}`), ...pageErrors.map((line) => `[pageerror] ${line}`)].join("\n") || "no console errors and no uncaught page errors\n",
    );
    process.stdout.write(`\nEvidence written to ${EVIDENCE_DIR}\n`);
    if (consoleErrors.length > 0) process.stdout.write(`[WARN] ${consoleErrors.length} console error(s) recorded; see console.log\n`);
    if (pageErrors.length > 0) process.stderr.write(`[FAIL] ${pageErrors.length} uncaught page error(s):\n${pageErrors.join("\n")}\n`);
    if (failed.length > 0) process.stderr.write(`[FAIL] ${failed.length} surface check(s) failed.\n`);
    if (failed.length > 0 || pageErrors.length > 0) exitCode = 1;
    process.stdout.write(exitCode === 0 ? "\n[UI VERIFY PASS] The interface renders and every mapped surface works.\n" : "\n[UI VERIFY FAIL] See the failures above.\n");
  } catch (error) {
    process.stderr.write(`[UI VERIFY ERROR] ${error.stack || error.message}\n`);
    exitCode = 1;
  } finally {
    if (browser) await browser.close().catch((error) => process.stderr.write(`browser close failed: ${error.message}\n`));
    if (dev) stopDevServer(dev.child);
    await sleep(500);
  }
  process.exit(exitCode);
}

await main();
```

Run: `npx playwright install chromium` (once per machine), then `npm run verify:ui`
Expected: 8 PASS lines, `[UI VERIFY PASS]`, five screenshots plus `summary.json` and `console.log` under `reports/ui-verification/<stamp>/`. Open the screenshots and check them against spec 8.1 (regions, reading order) before moving on.

- [ ] **Step 5: CI gains the contrast step and the ui job**

```yaml path=.github/workflows/verify.yml
name: Verify

# The authority for every gate. Local runs are advisory; this one blocks.
# Frontend feedback is fast on Linux. The native crate (Task 5) runs on
# Windows because the shell and the Recycle Bin are Windows-specific.

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: verify-${{ github.ref }}
  cancel-in-progress: true

jobs:
  frontend:
    name: Frontend (types, invariants, tests, contrast, code map)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint (Tanaw invariants and correctness)
        run: npm run lint

      - name: Unit tests
        run: npm test

      - name: Token contrast
        run: npm run verify:contrast

      - name: Code map freshness
        run: npm run map:code:check

  ui:
    name: UI drive (Playwright)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Chromium for the drive
        run: npx playwright install --with-deps chromium

      - name: Drive the interface and capture evidence
        run: npm run verify:ui

      - name: Upload drive evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ui-verification-evidence
          path: reports/ui-verification/**
          if-no-files-found: ignore
          retention-days: 14
```

- [ ] **Step 6: Full gate, journal, commit**

Run: `npm run map:code && npm run verify:all`
Expected: every step exits 0 (`map:code` first regenerates the map for the new files; the check inside `verify` then reports CURRENT). Record the evidence folder name and the eight drive results in the journal.

```bash
git add -A
git commit -m "test: contrast gate, Playwright UI drive, interface map and CI ui job" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Native run, release build, CI native job, registration, push

**Files:**
- Modify (whole file repeated): `.github/workflows/verify.yml`
- Regenerate: `docs/CODE_MAP.md`
- Append: `journal/2026-10-02.md`; Severus `journal/2026-10-02.md`; Severus `second-brain/notes/Tanaw.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `src-tauri/target/release/bundle/nsis/Tanaw_0.1.0_x64-setup.exe` and a pushed `main` whose CI is green.

- [ ] **Step 1: Run the native app and prove it stays up**

Run from the repository root, in the background: `npm run dev`
Expected within a few minutes: the first Rust compile finishes, a frameless Tanaw window opens centered at 1200 x 760 on the dark theme (or light, following Windows), the title bar shows one Home tab, and the webview console (F12 in a debug build) shows no `not allowed` permission errors. Prove it from a second shell: `tasklist /FI "IMAGENAME eq tanaw.exe"` lists the process; wait ten seconds and list again. Take a screenshot of the window for the journal, then stop the dev process.

If the console reports `window.is_maximized not allowed`, add `core:window:allow-is-maximized` to `src-tauri/capabilities/default.json` and run again.

- [ ] **Step 2: Release build and installer**

Run: `npm run build:release`
Expected: `src-tauri/target/release/Tanaw.exe` and `src-tauri/target/release/bundle/nsis/Tanaw_0.1.0_x64-setup.exe` exist. Launch the release executable once; the window opens the same way and `%LOCALAPPDATA%/com.focalstack.tanaw/tanaw.db` plus `logs/tanaw.log` appear. Record both artifact sizes in the journal. The updater is not configured yet; that is piece 5 of the spec.

- [ ] **Step 3: CI gains the native job**

Append this job to `.github/workflows/verify.yml` after the `ui` job (same indentation as `frontend:` and `ui:`), and change the header comment's "(Task 5)" to read "The native crate runs on Windows".

```yaml path=.github/workflows/native-job.partial.yml
  native:
    name: Native crate (cargo test, clippy)
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm

      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy

      - name: Cache Rust build
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install dependencies
        run: npm ci

      - name: Build the renderer (generate_context reads frontendDist)
        run: npm run build

      - name: Native tests
        working-directory: src-tauri
        run: cargo test --locked

      - name: Clippy with warnings denied
        working-directory: src-tauri
        run: cargo clippy --all-targets --locked -- -D warnings
```

The `.partial.yml` file is a fragment to splice, not a workflow; delete it after appending its body to `verify.yml`.

- [ ] **Step 4: Register the project in Severus and journal everything**

1. Regenerate the map: `npm run map:code`, then `npm run map:code:check` reports CURRENT.
2. Append the Task 5 entry to `journal/2026-10-02.md`: the native run proof (process listing, screenshot path), the release artifact names and sizes, the final gate output.
3. In `C:/Users/User/Documents/Severus`: append one line to `journal/2026-10-02.md` (Tanaw scaffolded, repository, spec and plan paths, gate result); write `second-brain/notes/Tanaw.md` (name, purpose, stack, repository; tags `#project #tauri #rust #react #typescript #file-manager`; links toward `[[Lex Matondo]]`, `[[The Glorious Evolution]]`, `[[Agentic Verification and Guardrails]]`); run `python second-brain/build_graph.py`; commit both files there.

- [ ] **Step 5: Commit and push, then watch CI**

```bash
git add -A
git commit -m "ci: native job; docs: code map and journal for the verified foundation build" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin main
```

Expected: the Verify workflow runs three jobs on the pushed commit and all pass. CI is the authority; the foundation is done only when it is green.
