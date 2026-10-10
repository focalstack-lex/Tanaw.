// Native browsing check: real disk, real watcher, real 10,000-entry folder.
// Drives the WebView2 over CDP through the DOM only; never moves the mouse.
//
// How to run (two terminals, from the repository root):
//   1. npm run tauri -- dev --config scripts/tauri.debug.conf.json
//      (the override opens the WebView2 debugging port 9333)
//   2. npm run verify:native
// Exits 0 when every step passes. Not part of `npm run verify`: it needs the
// real app running.
import { chromium } from "playwright";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const results = [];
const record = (step, ok, detail) => { results.push(ok); console.log(`[${ok ? "PASS" : "FAIL"}] ${step}${detail ? " :: " + detail : ""}`); };
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const live = mkdtempSync(join(tmpdir(), "filewell-live-"));
const big = mkdtempSync(join(tmpdir(), "filewell-big-"));
for (let i = 0; i < 10_000; i += 1) writeFileSync(join(big, `file-${String(i).padStart(5, "0")}.txt`), "");

const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith("http://localhost:1420"));
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="app"]');
await sleep(800);

const goTo = async (path) => {
  await page.keyboard.press("Control+KeyL");
  await page.locator('[data-testid="path-input"]').fill(path);
  await page.keyboard.press("Enter");
};

const cards = await page.locator('[data-testid="drive-card"]').count();
await page.locator('[data-testid="drive-card"]').first().click();
await page.waitForSelector('[data-testid="file-row"]', { timeout: 8000 });
record("Real drives on Home; the first drive lists", cards > 0, `cards=${cards}`);

await goTo(live);
const empty = await page.locator('text="This folder is empty."').waitFor({ timeout: 8000 }).then(() => true, () => false);
writeFileSync(join(live, "appeared.txt"), "hello");
const appeared = await page.locator('[data-testid="file-row"]', { hasText: "appeared.txt" }).waitFor({ timeout: 5000 }).then(() => true, () => false);
rmSync(join(live, "appeared.txt"));
const gone = await page.locator('text="This folder is empty."').waitFor({ timeout: 5000 }).then(() => true, () => false);
record("Live refresh: a file created outside Filewell appears, and disappears when deleted", empty && appeared && gone, JSON.stringify({ empty, appeared, gone }));

const started = Date.now();
await goTo(big);
await page.locator('[data-testid="file-row"]', { hasText: "file-00000.txt" }).waitFor({ timeout: 8000 });
const ms = Date.now() - started;
const inDom = await page.locator('[data-testid="file-row"]').count();
record("A real 10,000-file folder shows its first rows quickly and stays virtualized", ms < 1500 && inDom < 100, `ms=${ms} inDom=${inDom}`);

record("No console errors in the real webview", errors.length === 0, errors.join(" | ").slice(0, 300));
await browser.close();
rmSync(live, { recursive: true, force: true });
rmSync(big, { recursive: true, force: true });
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} native browsing checks passed`);
process.exit(failed === 0 ? 0 : 1);
