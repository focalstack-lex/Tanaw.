import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import filewell from "./eslint-rules/filewell-invariants.js";

/**
 * Filewell ESLint gate.
 *
 * Narrow on purpose: the four directive invariants (zero emoji, zero em or en
 * dash, no silent catch, no committed secret) plus TypeScript and hooks
 * correctness. No style preferences, so it never forces a structural rewrite.
 */
const INVARIANTS = {
  "filewell/no-emoji": "error",
  "filewell/no-dash-punctuation": "error",
  "filewell/no-silent-catch": "error",
  "filewell/no-hardcoded-secret": "error",
};

export default tseslint.config(
  {
    ignores: [
      "dist/**", "node_modules/**", "src-tauri/**", "reports/**", "docs/**", ".scratch/**",
      // Working copies and state of other agent tools (for example a Kilo Code
      // git worktree under .kilo/worktrees) are separate checkouts, not this project.
      ".kilo/**", ".claude/**", ".superpowers/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    plugins: { filewell },
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
