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
