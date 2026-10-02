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
  // Regression guard: the list must be populated before any typing (the first
  // build memoized it on the query and opened empty).
  const listed = paletteOk ? await page.locator(".palette-item").count() : 0;
  if (paletteOk) await capture(page, "03-palette");
  await page.keyboard.type("settings");
  await page.keyboard.press("Enter");
  const settingsOk = await visible(page, '[data-testid="settings-view"]');
  record("Ctrl+K opens the palette with commands listed and runs Open settings", paletteOk && listed > 0 && settingsOk, `palette=${paletteOk} listed=${listed} settings=${settingsOk}`);

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
