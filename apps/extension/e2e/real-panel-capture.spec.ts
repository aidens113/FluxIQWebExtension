// Real-browser pictures of the panel for a brand review: Chrome's real side panel and Firefox's real toolbar popup,
// each beside the company-website scenario, photographed from the screen (the Lab's Windows window-capture helper) so
// the frame, the fonts, the scrollbars and the toolbar icon are the browser's own. The panel's background is scripted
// (`screens/all-screens-entry.ts`) in a COPY of the built extension in a temp folder, so no Core, key or provider is
// involved and the product's build is untouched. The extension is pinned to the toolbar through the temp profile's
// Preferences. Everything lives in temp folders. Raw window photographs (JPEG) go to FLUXIQ_CAPTURE_RAW; a separate step
// crops them. Set FLUXIQ_REAL_BROWSER to "chrome" or "firefox".
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, test, type BrowserContext, type Page } from "@playwright/test";
import { startScenarioLab } from "../../scenario-lab/src/server.js";
import { installRealisticScenarioGuard } from "../../scenario-lab/e2e/realistic-scenario-guard/index.js";
import { ensureWindowCaptureHelper, parseProcessList, runWindowCaptureHelper } from "../../../packages/test-runner/src/run-scenario/window-capture/index.js";
import { installTemporaryAddon } from "../../../packages/test-runner/src/extension-chat-check/firefox/index.js";
import { allScreensEntry } from "./content/tests/screens/all-screens-entry.js";
import { bundlePanel } from "./content/tests/screens/panel-frame.js";

let rawFolder: string | undefined;

/** Where raw window photographs go: FLUXIQ_CAPTURE_RAW, else one fresh temp folder for this run. */
async function rawDir(): Promise<string> {
  rawFolder ??= process.env.FLUXIQ_CAPTURE_RAW ?? await mkdtemp(path.join(tmpdir(), "fluxiq-real-capture-"));
  return rawFolder;
}
const PIN = process.env.FLUXIQ_FIREFOX_PIN === "1";
const WHICH = process.env.FLUXIQ_REAL_BROWSER ?? "chrome";
const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Runs inside the panel's own window; reached from the control page through the extension's getViews().
const DRIVER = `
window.__do = (op, a, b) => {
  const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  const q = (sel) => document.querySelector(sel);
  const byName = (re) => [...document.querySelectorAll('button,[role=tab],summary,a')].filter(vis).find((e) => new RegExp(re, 'i').test((e.getAttribute('aria-label') || e.textContent || '').trim()));
  switch (op) {
    case 'click': { const e = byName(a); if (!e) return 'missing:' + a; e.click(); return 'ok'; }
    case 'clickSel': { const e = q(a); if (!e) return 'missing:' + a; e.click(); return 'ok'; }
    case 'fill': { const e = q(a); if (!e) return 'missing:' + a; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, b); e.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; }
    case 'theme': if (a === 'light') document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme; return 'ok';
    case 'scroll': { const e = q(a); if (!e) return 'missing:' + a; e.scrollTo(0, b); return [e.scrollHeight, e.clientHeight].join(','); }
    case 'show': window.__show(a); return 'ok';
    case 'reload': location.hash = a; location.reload(); return 'ok';
    case 'size': return [innerWidth, innerHeight, devicePixelRatio, outerWidth, outerHeight].join(',');
  }
  return 'unknown op';
};
`;

/** A copy of the built extension whose panel page is the scripted panel. */
async function scriptedCopy(source: string, panelPage: string, surface: "sidepanel" | "popup", into: string): Promise<string> {
  await cp(source, into, { recursive: true });
  const bundle = await bundlePanel(allScreensEntry(surface));
  await writeFile(path.join(into, "scripted.js"), `${bundle.script}\n${DRIVER}`);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>FluxIQ</title><link rel="stylesheet" href="./index.css"><style>${bundle.css}</style></head><body><div id="app"></div><script src="/scripted.js"></script></body></html>`;
  await writeFile(path.join(into, panelPage), html);
  return into;
}

async function browserPids(profileDir: string, firefoxBrowser: boolean): Promise<number[]> {
  const helper = await ensureWindowCaptureHelper();
  // The helper's own "processes" lists only chrome.exe and msedge.exe, so Firefox's processes come from WMI.
  const listing = firefoxBrowser
    ? (await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='firefox.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.ParentProcessId)`t$($_.CommandLine)\" }"], { windowsHide: true, timeout: 20_000 })).stdout
    : (await runWindowCaptureHelper(helper, ["processes"], AbortSignal.timeout(15_000))).toString("utf8");
  const processes = parseProcessList(listing);
  const norm = (value: string) => value.replaceAll("\\", "/").replace(/\/+$/u, "").toLowerCase();
  const candidates = processes.filter((entry) => norm(entry.commandLine).includes(norm(profileDir)) && (firefoxBrowser ? !/-contentproc\b/u.test(entry.commandLine) : !/(?:^|\s|")--type=/u.test(entry.commandLine)));
  const pids = new Set(candidates.map((entry) => entry.pid));
  if (candidates.length === 0) console.log(`PID-DIAG wanted ${norm(profileDir)} saw ${JSON.stringify(processes.filter((entry) => /firefox|chrome/iu.test(entry.commandLine)).slice(0, 4).map((entry) => entry.commandLine.slice(0, 260)))}`);
  const top = candidates.find((entry) => !pids.has(entry.parentPid));
  return [...(top ? [top.pid] : []), ...candidates.filter((entry) => entry !== top).map((entry) => entry.pid)];
}

async function photograph(profileDir: string, firefoxBrowser: boolean, name: string): Promise<void> {
  const pids = await browserPids(profileDir, firefoxBrowser);
  if (pids.length === 0) throw new Error(`no browser process on ${profileDir}`);
  const helper = await ensureWindowCaptureHelper();
  let bytes: Buffer | undefined;
  let last: unknown;
  for (const pid of pids) {
    try {
      bytes = await runWindowCaptureHelper(helper, ["capture", String(pid), "95"], AbortSignal.timeout(20_000));
      break;
    } catch (error) {
      last = error;
    }
  }
  if (bytes === undefined) throw last;
  const raw = await rawDir();
  await mkdir(raw, { recursive: true });
  await writeFile(path.join(raw, `${name}.jpg`), bytes);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Script = (shoot: (name: string) => Promise<void>, drive: (op: string, a?: string | number, b?: string | number) => Promise<unknown>, log: (line: string) => void) => Promise<void>;

/** The common run: set the panel up, then photograph each screen as the script says. */
async function walk(prefix: string, drive: Parameters<Script>[1], shoot: (name: string) => Promise<void>, log: (line: string) => void): Promise<void> {
  log(`size ${await drive("size")}`);
  await drive("show", "start");
  await sleep(1200);
  await shoot(`${prefix}-getting-started-dark`);
  await drive("theme", "light");
  await sleep(400);
  await shoot(`${prefix}-getting-started-light`);
  await drive("theme", "dark");
  await drive("reload", "empty");
  await sleep(2500);
  await drive("show", "connected");
  await sleep(1500);
  await shoot(`${prefix}-chat-empty-dark`);
  await drive("theme", "light");
  await sleep(400);
  await shoot(`${prefix}-chat-empty-light`);
  await drive("theme", "dark");
  await drive("reload", "thread");
  await sleep(2500);
  await drive("show", "connected");
  await sleep(1500);
  await shoot(`${prefix}-chat-thread-dark`);
  log(`click Chats ${await drive("click", "^Chats")}`);
  await sleep(1200);
  await shoot(`${prefix}-drawer-dark`);
  await drive("theme", "light");
  await sleep(400);
  await shoot(`${prefix}-drawer-light`);
  await drive("theme", "dark");
  log(`rename ${await drive("click", "^Rename Branch opening hours")}`);
  await sleep(500);
  await shoot(`${prefix}-drawer-rename-dark`);
  await drive("reload", "thread");
  await sleep(2500);
  await drive("show", "connected");
  await sleep(1000);
  await drive("click", "^Chats");
  await sleep(1000);
  log(`delete ${await drive("click", "^Delete Nightly listings run")}`);
  await sleep(500);
  await shoot(`${prefix}-drawer-delete-dark`);
  await drive("reload", "thread");
  await sleep(2500);
  await drive("show", "connected");
  await sleep(1000);
  log(`settings ${await drive("clickSel", "#settingsButton")}`);
  await sleep(1200);
  for (const mode of ["dark", "light"]) {
    await drive("theme", mode);
    const sizes = String(await drive("scroll", ".settings-screen", 0)).split(",").map(Number);
    log(`settings scroll ${sizes}`);
    await sleep(300);
    await shoot(`${prefix}-settings-1-${mode}`);
    const stride = Math.max(1, sizes[1]! - 80);
    for (let i = 1, y = stride; y < sizes[0]! - sizes[1]! + stride; i++, y += stride) {
      await drive("scroll", ".settings-screen", Math.min(y, sizes[0]! - sizes[1]!));
      await sleep(300);
      await shoot(`${prefix}-settings-${i + 1}-${mode}`);
    }
  }
}

test("chrome: the real side panel and the pinned toolbar icon", async () => {
  test.skip(WHICH !== "chrome", "FLUXIQ_REAL_BROWSER selects the browser");
  test.setTimeout(300_000);
  const work = await mkdtemp(path.join(tmpdir(), "fluxiq-real-chrome-"));
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  const log = (line: string) => console.log(`REAL-CHROME ${line}`);
  try {
    const extDir = await scriptedCopy(path.join(extensionRoot, "dist", "e2e-chromium"), "sidepanel/index.html", "sidepanel", path.join(work, "ext"));
    const profile = path.join(work, "profile");
    const launch = () => chromium.launchPersistentContext(profile, { headless: false, locale: "en-US", timezoneId: "UTC", viewport: { width: 1280, height: 720 }, colorScheme: "light",
      args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, "--no-first-run", "--disable-default-apps", "--window-size=1500,900", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"] });
    // First launch learns the id; the second runs with the extension pinned to the toolbar.
    let context = await launch();
    const first = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 20_000 });
    const id = new URL(first.url()).hostname;
    await context.close();
    const prefsPath = path.join(profile, "Default", "Preferences");
    const prefs = JSON.parse(await readFile(prefsPath, "utf8"));
    prefs.extensions = { ...(prefs.extensions ?? {}), pinned_extensions: [id] };
    await writeFile(prefsPath, JSON.stringify(prefs));
    context = await launch();
    await installRealisticScenarioGuard(context, "real panel capture");
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 20_000 });
    log(`id ${id} worker ${worker.url()}`);
    const control = context.pages()[0] ?? await context.newPage();
    await control.goto(`chrome-extension://${id}/popup/index.html`);
    const scenario = await context.newPage();
    await scenario.goto(new URL("/scenarios/company-website/", lab.origin).href);
    await scenario.bringToFront();
    await sleep(1500);
    // The toolbar, before any panel is open.
    await photograph(profile, false, "chrome-window-toolbar-nopanel");
    // Open the real side panel in a trusted click in the control page.
    await control.evaluate(async (origin) => {
      const tabs = await chrome.tabs.query({ url: `${origin}/*` });
      const tab = tabs.find((candidate) => candidate.active) ?? tabs[0];
      const button = document.createElement("button");
      button.id = "open-side-panel";
      button.style.cssText = "position:fixed;top:0;left:0;z-index:2147483647;width:160px;height:32px;opacity:0.01";
      button.onclick = () => {
        void chrome.sidePanel.open({ tabId: tab!.id! });
      };
      document.body.append(button);
    }, lab.origin);
    await control.locator("#open-side-panel").click({ force: true });
    await sleep(3000);
    await scenario.bringToFront();
    const viewProbe = () => control.evaluate(() => chrome.extension.getViews().filter((view) => view.location.pathname.endsWith("sidepanel/index.html")).length);
    log(`side panel views ${await viewProbe()}`);
    const drive: Parameters<Script>[1] = (op, a, b) => control.evaluate(({ op, a, b }) => {
      const view = chrome.extension.getViews().find((candidate) => candidate.location.pathname.endsWith("sidepanel/index.html")) as unknown as { __do?: (...args: unknown[]) => unknown } | undefined;
      return view?.__do ? view.__do(op, a, b) : "no panel view";
    }, { op, a, b });
    await walk("chrome-panel", drive, (name) => photograph(profile, false, name), log);
    await context.close();
  } finally {
    await lab.close().catch(() => undefined);
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
});

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

test("firefox: the real toolbar popup and the toolbar icon", async () => {
  test.skip(WHICH !== "firefox", "FLUXIQ_REAL_BROWSER selects the browser");
  test.setTimeout(300_000);
  const work = await mkdtemp(path.join(tmpdir(), "fluxiq-real-firefox-"));
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  const log = (line: string) => console.log(`REAL-FIREFOX ${line}`);
  let context: BrowserContext | undefined;
  try {
    // PLAIN=1 loads the unmodified build (a popup that is the real, unconnected one) instead of the scripted copy.
    const extDir = process.env.FLUXIQ_FIREFOX_PLAIN === "1" ? await cp(path.join(extensionRoot, "dist", "firefox"), path.join(work, "ext"), { recursive: true }).then(() => path.join(work, "ext")) : await scriptedCopy(path.join(extensionRoot, "dist", "firefox"), "popup/index.html", "popup", path.join(work, "ext"));
    const profile = path.join(work, "profile");
    const uuid = randomUUID();
    const port = await freePort();
    context = await firefox.launchPersistentContext(profile, { headless: false, locale: "en-US", timezoneId: "UTC", viewport: { width: 1280, height: 720 }, colorScheme: "light",
      args: ["-start-debugger-server", String(port)],
      firefoxUserPrefs: { "devtools.debugger.remote-enabled": true, "devtools.debugger.prompt-connection": false, "devtools.chrome.enabled": true,
        "extensions.webextensions.uuids": JSON.stringify({ "fluxiq-web-automation@example.local": uuid }), "extensions.openPopupWithoutUserGesture.enabled": true, "browser.shell.checkDefaultBrowser": false,
        ...(PIN ? { "browser.uiCustomization.state": JSON.stringify({ placements: { "nav-bar": ["back-button", "forward-button", "stop-reload-button", "customizableui-special-spring1", "urlbar-container", "customizableui-special-spring2", "downloads-button", "fxa-toolbar-menu-button", "fluxiq-web-automation_example_local-browser-action", "unified-extensions-button"] }, seen: ["fluxiq-web-automation_example_local-browser-action"], dirtyAreaCache: ["nav-bar"], currentVersion: 20, newElementCount: 1 }) } : {}) } });
    log("launched");
    await installRealisticScenarioGuard(context, "real popup capture");
    await installTemporaryAddon(port, extDir);
    log("add-on installed");
    const origin = `moz-extension://${uuid}`;
    // The toolbar first, with only the scenario page open: that photograph does not need the popup page.
    const first = context.pages()[0] ?? await context.newPage();
    await first.goto(new URL("/scenarios/company-website/", lab.origin).href, { timeout: 30_000 });
    await sleep(1500);
    await photograph(profile, true, PIN ? "firefox-window-toolbar-pinned" : "firefox-window-toolbar-nopopup");
    log("toolbar photographed");
    const control = await context.newPage();
    control.on("console", (message) => log(`control console ${message.type()}: ${message.text().slice(0, 200)}`));
    control.on("pageerror", (error) => log(`control pageerror: ${error.message.slice(0, 200)}`));
    try {
      await control.goto(`${origin}/popup/index.html`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    } catch (error) {
      log(`control goto: ${String(error).slice(0, 120)}`);
    }
    await control.waitForURL((url) => url.href.startsWith(origin), { timeout: 15_000 });
    log(`control url ${control.url()}`);
    await control.waitForFunction(() => typeof (globalThis as any).browser?.runtime?.sendMessage === "function", undefined, { timeout: 15_000 });
    await first.bringToFront();
    const refusal = await control.evaluate(async () => {
      try {
        await (globalThis as any).browser.action.openPopup();
        return null;
      } catch (error) {
        return String(error);
      }
    });
    log(`openPopup ${refusal ?? "resolved"}`);
    await sleep(2500);
    const probe = () => control.evaluate(() => (globalThis as any).browser.extension.getViews({ type: "popup" }).length);
    log(`popup views ${await probe()}`);
    const drive: Parameters<Script>[1] = (op, a, b) => control.evaluate(({ op, a, b }) => {
      const view = (globalThis as any).browser.extension.getViews({ type: "popup" })[0];
      if (!view) return "no popup view";
      if (view.__do) return view.__do(op, a, b);
      // The unmodified popup: the same few operations on its own document.
      if (op === "clickSel") {
        const e = view.document.querySelector(a);
        if (!e) return "missing:" + a;
        e.click();
        return "ok";
      }
      if (op === "theme") {
        if (a === "light") view.document.documentElement.dataset.theme = "light";
        else delete view.document.documentElement.dataset.theme;
        return "ok";
      }
      return "plain popup: " + op;
    }, { op, a, b });
    await photograph(profile, true, "firefox-window-popup-open");
    if (process.env.FLUXIQ_FIREFOX_PLAIN === "1") {
      await photograph(profile, true, "firefox-popup-plain-getting-started-dark");
      await drive("theme", "light");
      await sleep(400);
      await photograph(profile, true, "firefox-popup-plain-getting-started-light");
      await drive("theme", "dark");
      log(`settings ${await drive("clickSel", "#settingsButton")}`);
      await sleep(1200);
      await photograph(profile, true, "firefox-popup-plain-settings-dark");
      await drive("theme", "light");
      await sleep(400);
      await photograph(profile, true, "firefox-popup-plain-settings-light");
      return;
    }

    await walk("firefox-popup", drive, (name) => photograph(profile, true, name), log);
  } finally {
    await context?.close().catch(() => undefined);
    await lab.close().catch(() => undefined);
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
});
