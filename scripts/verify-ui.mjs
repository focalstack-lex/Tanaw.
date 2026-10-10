#!/usr/bin/env node
/**
 * Filewell UI verification drive.
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
const MIN_WINDOW = { width: 720, height: 480 }; // tauri.conf.json minWidth and minHeight
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
  // A failed boot IPC call (settings, app info) surfaces only as an error toast.
  const toasts = await page.locator(".toast-error").allTextContents();
  if (toasts.length > 0) record("No error toast after the app loads", false, toasts.join(" | "));
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

  // 7. The palette keeps focus inside, Escape always closes it, and focus returns.
  await open(page);
  await page.focus('[data-testid="tab-new"]');
  await page.keyboard.press("Control+KeyK");
  await visible(page, '[data-testid="command-palette"]');
  await page.keyboard.press("Tab");
  const focusInside = await page.evaluate(() => Boolean(document.activeElement?.closest(".palette")));
  await page.keyboard.press("Escape");
  const closedAfterTab = await hidden(page, '[data-testid="command-palette"]');
  const focusReturned = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName);
  record("Palette traps Tab, Escape closes it after Tab, focus returns to the opener", focusInside && closedAfterTab && focusReturned === "tab-new",
    `focusInside=${focusInside} closed=${closedAfterTab} focusReturnedTo=${focusReturned}`);

  // 8. Arrow keys keep the active command in view and announce it.
  await open(page);
  await page.keyboard.press("Control+KeyK");
  await visible(page, '[data-testid="command-palette"]');
  for (let i = 0; i < 15; i += 1) await page.keyboard.press("ArrowDown");
  const active = await page.evaluate(() => {
    const list = document.querySelector(".palette-list")?.getBoundingClientRect();
    const option = document.querySelector('.palette-item[aria-selected="true"]');
    const rect = option?.getBoundingClientRect();
    const input = document.querySelector(".palette-input");
    return {
      inView: Boolean(list && rect && rect.top >= list.top - 1 && rect.bottom <= list.bottom + 1),
      announced: Boolean(option?.id) && input?.getAttribute("aria-activedescendant") === option?.id,
    };
  });
  await capture(page, "05-palette-scrolled");
  await page.keyboard.press("Escape");
  record("Palette scrolls the active command into view and sets aria-activedescendant", active.inView && active.announced, JSON.stringify(active));

  // 9. The app owns right-click and the browser's reload, print and find keys.
  await open(page);
  const chrome = await page.evaluate(() => {
    const fire = (target, event) => { target.dispatchEvent(event); return event.defaultPrevented; };
    const menu = () => new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    const key = (init) => new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    const field = document.createElement("input");
    document.body.appendChild(field);
    const result = {
      contentMenuBlocked: fire(document.querySelector('[data-testid="content"]'), menu()),
      fieldMenuKept: !fire(field, menu()),
      f5Blocked: fire(document.body, key({ key: "F5" })),
      ctrlRBlocked: fire(document.body, key({ key: "r", ctrlKey: true })),
      ctrlPBlocked: fire(document.body, key({ key: "p", ctrlKey: true })),
      ctrlFBlocked: fire(document.body, key({ key: "f", ctrlKey: true })),
    };
    field.remove();
    return result;
  });
  record("Right-click and browser reload, print and find keys are suppressed; fields keep their menu", Object.values(chrome).every(Boolean), JSON.stringify(chrome));

  // 10. Narrow windows: real per-region overflow at 800 px and at the 720 px minimum.
  for (const size of [{ width: 800, height: 600 }, MIN_WINDOW]) {
    await page.setViewportSize(size);
    await sleep(200);
    const layout = await layoutReport(page);
    await capture(page, `06-layout-${size.width}`);
    record(`${size.width} px: sidebar is a 40 to 48 px rail and no region overflows`, layout.ok, JSON.stringify(layout));
  }

  // 11. Many tabs at the minimum width: New tab stays reachable and controls keep their size.
  await open(page);
  for (let i = 0; i < 11; i += 1) await page.keyboard.press("Control+KeyT");
  await sleep(200);
  const strip = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="tab-new"]')?.getBoundingClientRect();
    const controls = document.querySelector(".window-controls")?.getBoundingClientRect();
    const activeTab = document.querySelector('.tab.is-active')?.getBoundingClientRect();
    const tabsBox = document.querySelector(".titlebar-tabs")?.getBoundingClientRect();
    const hit = button ? document.elementFromPoint(button.left + button.width / 2, button.top + button.height / 2) : null;
    const closeWidth = document.querySelector('.tab.is-active .tab-close')?.getBoundingClientRect().width ?? 0;
    return {
      tabs: document.querySelectorAll('[data-testid="tab"]').length,
      newTabWidth: Math.round(button?.width ?? 0),
      newTabReachable: Boolean(hit?.closest('[data-testid="tab-new"]')) && Boolean(button && controls && button.right <= controls.left),
      closeWidth: Math.round(closeWidth),
      activeTabVisible: Boolean(activeTab && tabsBox && activeTab.left >= tabsBox.left - 1 && activeTab.right <= tabsBox.right + 1),
    };
  });
  await capture(page, "07-many-tabs-720");
  record("12 tabs at 720 px: New tab reachable at full size, close buttons keep their size, active tab visible",
    strip.tabs === 12 && strip.newTabWidth >= 28 && strip.newTabReachable && strip.closeWidth >= 16 && strip.activeTabVisible, JSON.stringify(strip));
  record("No error toasts during the main drive", (await errorToasts(page)) === 0);

  await context.close();

  // 12. A 1024 px window opens with the panel closed, so Settings controls are reachable.
  const narrowContext = await browser.newContext({ viewport: { width: 1024, height: 700 }, colorScheme: "dark" });
  const narrowPage = await narrowContext.newPage();
  narrowPage.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  narrowPage.on("pageerror", (error) => pageErrors.push(error.message));
  await open(narrowPage);
  const panelClosedAtStart = !(await narrowPage.locator('[data-testid="side-panel"]').isVisible());
  await narrowPage.keyboard.press("Control+Comma");
  await visible(narrowPage, '[data-testid="settings-view"]');
  const selectReachable = await narrowPage.evaluate(() => {
    const select = document.querySelector('[data-testid="setting-theme"]');
    const rect = select?.getBoundingClientRect();
    return Boolean(rect) && document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === select;
  });
  await narrowPage.keyboard.press("Control+Shift+KeyE");
  const overlayOpened = await visible(narrowPage, '[data-testid="side-panel"]');
  await narrowPage.keyboard.press("Escape");
  const overlayDismissed = await hidden(narrowPage, '[data-testid="side-panel"]');
  await capture(narrowPage, "08-settings-1024");
  record("1024 px: panel starts closed, Settings controls are reachable, the overlay opens and Escape dismisses it",
    panelClosedAtStart && selectReachable && overlayOpened && overlayDismissed,
    `closedAtStart=${panelClosedAtStart} selectReachable=${selectReachable} overlayOpened=${overlayOpened} escapeDismissed=${overlayDismissed}`);
  record("No error toasts in the narrow window", (await errorToasts(narrowPage)) === 0);
  await narrowContext.close();
}

/** Every region must fit its own box and the window; the sidebar must be the rail. */
async function layoutReport(page) {
  return page.evaluate(() => {
    const regions = {};
    let ok = true;
    for (const selector of ['[data-testid="titlebar"]', ".titlebar-tabs", '[data-testid="sidebar"]', '[data-testid="content"]', '[data-testid="statusbar"]', '[data-testid="side-panel"]']) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const overflow = el.scrollWidth > el.clientWidth + 1 || rect.right > window.innerWidth + 0.5;
      if (overflow) ok = false;
      regions[selector] = { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, right: Math.round(rect.right), overflow };
    }
    const sidebar = document.querySelector('[data-testid="sidebar"]');
    const rail = sidebar ? sidebar.getBoundingClientRect().width : -1;
    if (rail < 40 || rail > 48) ok = false;
    return { ok, rail, width: window.innerWidth, regions };
  });
}

async function errorToasts(page) {
  return page.locator(".toast-error").count();
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
    // Console errors fail the run: a renderer that logs errors is not passing.
    if (consoleErrors.length > 0) process.stderr.write(`[FAIL] ${consoleErrors.length} console error(s):\n${consoleErrors.join("\n")}\n`);
    if (pageErrors.length > 0) process.stderr.write(`[FAIL] ${pageErrors.length} uncaught page error(s):\n${pageErrors.join("\n")}\n`);
    if (failed.length > 0) process.stderr.write(`[FAIL] ${failed.length} surface check(s) failed.\n`);
    if (failed.length > 0 || pageErrors.length > 0 || consoleErrors.length > 0) exitCode = 1;
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
