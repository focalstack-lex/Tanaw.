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
      await driveBrowsing(browser);
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

/** Steps 13 to 22: browsing the fake disk of the dev harness (piece 2a). */
async function driveBrowsing(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: "dark" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await open(page);

  const rows = '[data-testid="file-row"]';
  const rowNames = () => page.locator(`${rows} .name-text`).allTextContents();
  const currentCrumb = () => page.locator('[data-testid="breadcrumb"] .crumb.is-current').textContent();
  const atCrumb = async (label) => {
    try {
      await page.waitForFunction((want) => document.querySelector('[data-testid="breadcrumb"] .crumb.is-current')?.textContent === want, label, { timeout: STEP_TIMEOUT_MS });
      return true;
    } catch {
      return false;
    }
  };
  const goTo = async (path) => {
    await page.keyboard.press("Control+KeyL");
    await page.locator('[data-testid="path-input"]').fill(path);
    await page.keyboard.press("Enter");
  };
  const lastShellCall = () => page.evaluate(() => window.__filewellMock.opened.at(-1));

  // 13. Places on Home and in the sidebar.
  const places = {
    cards: await page.locator('[data-testid="drive-card"]').count(),
    drives: await page.locator('[data-testid="place-drive"]').count(),
    folders: await page.locator('[data-testid="place-folder"]').count(),
  };
  await capture(page, "09-home-drives");
  record("Home shows drive cards; the sidebar lists drives and known folders", places.cards === 2 && places.drives === 2 && places.folders === 7, JSON.stringify(places));

  // 14. A drive card opens the drive; hidden system entries stay hidden.
  await page.locator('[data-testid="drive-card"]').first().click();
  await visible(page, '[data-testid="file-list"]');
  const driveRows = await rowNames();
  await capture(page, "10-drive-c");
  record("A drive card opens the drive with hidden entries filtered", driveRows.join(",") === "Program Files,Users,Windows" && (await currentCrumb()) === "C:", JSON.stringify(driveRows));

  // 15. Double-click into folders, jump by crumb, then Back, Back, Forward, Up.
  await page.locator(rows, { hasText: "Users" }).dblclick();
  const intoUsers = await atCrumb("Users");
  await page.locator(rows, { hasText: "dev" }).dblclick();
  const intoDev = await atCrumb("dev");
  await page.locator('[data-testid="breadcrumb"] .crumb', { hasText: "C:" }).click();
  const byCrumb = await atCrumb("C:");
  await page.keyboard.press("Alt+ArrowLeft");
  const back1 = await atCrumb("dev");
  await page.keyboard.press("Alt+ArrowLeft");
  const back2 = await atCrumb("Users");
  await page.keyboard.press("Alt+ArrowRight");
  const forward = await atCrumb("dev");
  await page.keyboard.press("Alt+ArrowUp");
  const up = await atCrumb("Users");
  record("Double-click, crumbs, Alt+Left, Alt+Right and Alt+Up move through folders and history",
    intoUsers && intoDev && byCrumb && back1 && back2 && forward && up,
    JSON.stringify({ intoUsers, intoDev, byCrumb, back1, back2, forward, up }));

  // 16. 10,000 entries: virtualized, quick, and End reaches the last one.
  const started = Date.now();
  await goTo("D:\\Big folder");
  await page.locator(rows, { hasText: "file-00001.txt" }).waitFor({ timeout: STEP_TIMEOUT_MS });
  const firstRowMs = Date.now() - started;
  const big = await page.evaluate(() => ({
    rowCount: Number(document.querySelector('[data-testid="file-list"]')?.getAttribute("aria-rowcount")),
    inDom: document.querySelectorAll('[data-testid="file-row"]').length,
  }));
  await page.locator(rows).first().click();
  await page.keyboard.press("End");
  const lastSelected = await page.locator(`${rows}[aria-selected="true"] .name-text`).allTextContents();
  await capture(page, "11-big-folder-end");
  record("10,000 entries list in under 2 s, under 100 rows in the DOM, End selects the last",
    big.rowCount === 10_001 && big.inDom < 100 && firstRowMs < 2_000 && lastSelected.join() === "file-10000.txt",
    JSON.stringify({ ...big, firstRowMs, lastSelected }));

  // 17. Selection: click, Shift+Down twice, then Ctrl+A; the status bar counts it.
  await goTo("C:\\Users\\dev\\Documents");
  await atCrumb("Documents");
  const docRows = await rowNames();
  await page.locator(rows).first().click();
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  const extended = await page.locator(`${rows}[aria-selected="true"]`).count();
  const status = (await page.locator('[data-testid="status-selection"]').textContent()) ?? "";
  await page.keyboard.press("Control+KeyA");
  const all = await page.locator(`${rows}[aria-selected="true"]`).count();
  record("Natural order, Shift+arrows extend, Ctrl+A selects all, the status bar counts",
    docRows.join(",") === "budget.xlsx,file2.txt,file10.txt,Report.docx" && extended === 3 && status.startsWith("3 selected") && all === 4,
    JSON.stringify({ docRows, extended, status, all }));

  // 18. Grid and back to list.
  await page.keyboard.press("Control+Shift+Digit2");
  const gridOk = await visible(page, '[data-testid="file-grid"]');
  const tiles = await page.locator('[data-testid="file-tile"]').count();
  await capture(page, "12-grid");
  await page.keyboard.press("Control+Shift+Digit1");
  const listBack = await visible(page, '[data-testid="file-list"]');
  record("Ctrl+Shift+2 shows the grid and Ctrl+Shift+1 the list", gridOk && tiles === 4 && listBack, JSON.stringify({ gridOk, tiles, listBack }));

  // 19. Context menu: opens on right-click with the actions, Escape returns focus.
  await page.locator(rows, { hasText: "Report.docx" }).click({ button: "right" });
  const menuOk = await visible(page, '[data-testid="context-menu"]');
  const menuItems = await page.locator('[data-testid="context-menu"] [role="menuitem"]').allTextContents();
  await capture(page, "13-context-menu");
  await page.keyboard.press("Escape");
  const menuClosed = await hidden(page, '[data-testid="context-menu"]');
  const focusBack = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  record("Right-click shows Open, Open with, Show in Explorer and Copy path; Escape closes it and returns focus",
    menuOk && ["Open", "Open with", "Show in Explorer"].every((item) => menuItems.includes(item)) && menuItems.some((item) => item.startsWith("Copy")) && menuClosed && focusBack === "file-list",
    JSON.stringify({ menuItems, menuClosed, focusBack }));

  // 20. Enter opens, Ctrl+Enter reveals, the menu's Open with asks Windows.
  await page.locator(rows, { hasText: "Report.docx" }).click();
  await page.keyboard.press("Enter");
  const openCall = await lastShellCall();
  await page.keyboard.press("Control+Enter");
  const revealCall = await lastShellCall();
  await page.locator(rows, { hasText: "Report.docx" }).click({ button: "right" });
  await page.locator('[data-testid="context-menu"] [role="menuitem"]', { hasText: "Open with" }).click();
  const openWithCall = await lastShellCall();
  const report = "C:\\Users\\dev\\Documents\\Report.docx";
  record("Enter opens, Ctrl+Enter shows in Explorer, Open with reaches the shell",
    openCall?.action === "open" && openCall.path === report && revealCall?.action === "reveal" && openWithCall?.action === "openWith",
    JSON.stringify({ openCall, revealCall, openWithCall }));

  // 21. A missing folder explains itself and offers to try again.
  await goTo("Q:\\nowhere");
  const missingOk = await visible(page, 'text="That item no longer exists."');
  const retry = await page.getByRole("button", { name: "Try again" }).count();
  await capture(page, "14-missing-folder");
  record("A missing folder shows a calm error with Try again", missingOk && retry === 1, `visible=${missingOk} retry=${retry}`);

  // 22. The browser view fits the 720 px minimum.
  await goTo("C:\\Users\\dev\\Documents");
  await atCrumb("Documents");
  await page.setViewportSize(MIN_WINDOW);
  await sleep(200);
  const layout = await layoutReport(page);
  await capture(page, "15-browser-720");
  record("720 px: the browser view fits without overflow", layout.ok, JSON.stringify(layout));
  record("No error toasts while browsing", (await errorToasts(page)) === 0);

  await context.close();
}

await main();
