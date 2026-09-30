import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { openDockedPopup } from "../docked-popup.js";
import { openLivePanel } from "../open-live-panel.js";
import { openSidePanel } from "../side-panel.js";

const ORIGIN = "http://127.0.0.1:4100";
const EXTENSION = "chrome-extension://abc";

type Tab = { id?: unknown; url: string; active?: boolean; windowId?: number; status?: string };
type Browser = {
  tabs: Tab[];
  /** What `chrome.sidePanel.open` does when called: resolve, or reject with this message. */
  sidePanel?: "opens" | { rejects: string } | "absent";
  /** How many `getContexts` polls answer no side panel before one appears; `Infinity` never. */
  sidePanelAppearsAfter?: number;
  /** What the popup tab reports once loaded. */
  popupTab?: { status: string; url: string };
  screenWidth?: number;
};

/**
 * An extension control page whose `evaluate` runs the callback here, over a
 * `chrome`, `document` and `screen` of this test's own, and whose locator click
 * calls the button's handler the way Playwright's trusted click would.
 */
function extensionPage(browser: Browser) {
  const log = { sidePanelOpens: [] as unknown[], created: [] as any[], updates: [] as unknown[], removed: [] as unknown[], contextPolls: 0 };
  const elements = new Map<string, any>();
  const document = {
    createElement: () => ({ id: "", style: {}, remove(this: any) { elements.delete(this.id); } }),
    body: { append: (element: any) => { elements.set(element.id, element); } },
    getElementById: (id: string) => elements.get(id) ?? null,
  };
  const windows = new Map<number, any>([[1, { id: 1, left: 0, top: 0, width: 1700, height: 1000 }]]);
  const chrome = {
    sidePanel: browser.sidePanel === "absent" ? undefined : {
      open: (options: unknown) => {
        log.sidePanelOpens.push(options);
        const behaviour = browser.sidePanel ?? "opens";
        return behaviour === "opens" ? Promise.resolve() : Promise.reject(new Error((behaviour as { rejects: string }).rejects));
      },
    },
    runtime: {
      getURL: (path: string) => `${EXTENSION}/${path}`,
      getContexts: async () => { log.contextPolls += 1; return log.contextPolls > (browser.sidePanelAppearsAfter ?? 0) ? [{ contextType: "SIDE_PANEL" }] : []; },
    },
    tabs: {
      query: async (query: { url?: string; windowId?: number }) => browser.tabs.filter(tab => (query.url === undefined || tab.url.startsWith(query.url.replace(/\*$/u, ""))) && (query.windowId === undefined || tab.windowId === query.windowId)),
      get: async (id: number) => browser.tabs.find(tab => tab.id === id),
      update: async (id: unknown, changes: unknown) => { log.updates.push({ id, ...(changes as object) }); },
    },
    windows: {
      get: async (id: number) => windows.get(id),
      create: async (options: any) => {
        log.created.push(options);
        const popupTab = { id: 99, windowId: 2, ...(browser.popupTab ?? { status: "complete", url: options.url }) };
        browser.tabs.push(popupTab);
        return { id: 2, tabs: [{ id: 99 }] };
      },
      remove: async (id: number) => { log.removed.push(id); },
    },
  };
  const scope = { chrome, document, screen: browser.screenWidth === undefined ? undefined : { availWidth: browser.screenWidth } };
  const withScope = async <T>(run: () => Promise<T> | T): Promise<T> => {
    const previous = Object.fromEntries(Object.keys(scope).map(key => [key, (globalThis as any)[key]]));
    Object.assign(globalThis, scope);
    try { return await run(); }
    finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete (globalThis as any)[key]; else (globalThis as any)[key] = value; } }
  };
  const page = {
    evaluate: (callback: (argument: any) => unknown, argument: unknown) => withScope(() => callback(argument)),
    locator: (selector: string) => ({
      click: async () => withScope(() => {
        const element = elements.get(selector.replace(/^#/u, ""));
        if (!element) throw new Error(`locator.click: ${selector} not found`);
        element.onclick();
      }),
    }),
  } as unknown as Page;
  return { page, log, elements };
}

const scenarioTabs = (): Tab[] => [
  { id: 41, url: `${EXTENSION}/sidepanel/index.html`, windowId: 1 },
  { id: 42, url: `${ORIGIN}/scenarios/basic-form/`, active: true, windowId: 1 },
];

test("the side panel is opened for the scenario tab, never the extension's own page, and counts only once a SIDE_PANEL context exists", async () => {
  const fake = extensionPage({ tabs: scenarioTabs(), sidePanelAppearsAfter: 2 });
  assert.deepEqual(await openSidePanel(fake.page, ORIGIN, 2_000), { ok: true });
  assert.deepEqual(fake.log.sidePanelOpens, [{ tabId: 42 }]);
  assert.ok(fake.log.contextPolls >= 3, "a resolved open() is not proof; the run waits for the side panel's context");
  assert.equal(fake.elements.size, 0, "the button is removed from the control page afterwards");
});

test("a refused sidePanel.open is reported with the browser's reason, and the button is still removed", async () => {
  const fake = extensionPage({ tabs: scenarioTabs(), sidePanel: { rejects: "`sidePanel.open()` may only be called in response to a user gesture." } });
  assert.deepEqual(await openSidePanel(fake.page, ORIGIN, 2_000), { ok: false, reason: "chrome.sidePanel.open refused: `sidePanel.open()` may only be called in response to a user gesture." });
  assert.equal(fake.elements.size, 0);
});

test("an open() that resolves with no side panel ever appearing is not a verified panel", async () => {
  const fake = extensionPage({ tabs: scenarioTabs(), sidePanelAppearsAfter: Number.POSITIVE_INFINITY });
  const attempt = await openSidePanel(fake.page, ORIGIN, 250);
  assert.equal(attempt.ok, false);
  assert.match((attempt as { reason: string }).reason, /no SIDE_PANEL context appeared within 250 ms/u);
});

test("no scenario tab and no sidePanel API are refusals the caller can record", async () => {
  assert.deepEqual(await openSidePanel(extensionPage({ tabs: [scenarioTabs()[0]!] }).page, ORIGIN, 250), { ok: false, reason: `no scenario tab is open on ${ORIGIN}` });
  assert.deepEqual(await openSidePanel(extensionPage({ tabs: scenarioTabs(), sidePanel: "absent" }).page, ORIGIN, 250), { ok: false, reason: "chrome.sidePanel.open is unavailable in this browser" });
});

test("the popup docks to the right of the scenario window, unfocused, then hands the extension the scenario tab back", async () => {
  const fake = extensionPage({ tabs: scenarioTabs(), screenWidth: 2560 });
  assert.deepEqual(await openDockedPopup(fake.page, ORIGIN, 1_000), { ok: true });
  assert.deepEqual(fake.log.created, [{ url: `${EXTENSION}/sidepanel/index.html`, type: "popup", focused: false, left: 1700, top: 0, width: 420, height: 1000 }]);
  assert.deepEqual(fake.log.updates, [{ id: 41, active: true }, { id: 42, active: true }], "the scenario tab is the last one activated, so the extension holds it and not the popup");
  assert.deepEqual(fake.log.removed, []);
});

test("on a narrow screen the popup is pulled back on screen", async () => {
  const fake = extensionPage({ tabs: scenarioTabs(), screenWidth: 1920 });
  await openDockedPopup(fake.page, ORIGIN, 1_000);
  assert.equal(fake.log.created[0].left, 1500);
});

test("a popup that loaded something other than the panel is closed and reported, and the scenario tab is still handed back", async () => {
  const fake = extensionPage({ tabs: scenarioTabs(), popupTab: { status: "complete", url: "chrome-error://chromewebdata/" } });
  assert.deepEqual(await openDockedPopup(fake.page, ORIGIN, 1_000), { ok: false, reason: "the popup loaded chrome-error://chromewebdata/ instead of the panel" });
  assert.deepEqual(fake.log.removed, [2]);
  assert.deepEqual(fake.log.updates.at(-1), { id: 42, active: true });
});

test("openLivePanel records the popup mode with the side panel's refusal and logs one line", async () => {
  const fake = extensionPage({ tabs: scenarioTabs(), sidePanel: { rejects: "No active side panel for tabId: 42" } });
  const lines: string[] = [];
  assert.deepEqual(await openLivePanel(fake.page, { enabled: true, headless: false, scenarioOrigin: ORIGIN, timeoutMs: 500, log: line => lines.push(line) }), { mode: "popup", sidePanelRefusal: "chrome.sidePanel.open refused: No active side panel for tabId: 42" });
  assert.deepEqual(lines, ["[lab] live panel: popup (side panel refused: chrome.sidePanel.open refused: No active side panel for tabId: 42)"]);
});

test("openLivePanel with --no-live-panel touches nothing in the browser", async () => {
  const fake = extensionPage({ tabs: scenarioTabs() });
  assert.deepEqual(await openLivePanel(fake.page, { enabled: false, headless: false, scenarioOrigin: ORIGIN }), { mode: "skipped", reason: "--no-live-panel" });
  assert.deepEqual([fake.log.sidePanelOpens, fake.log.created, fake.log.updates], [[], [], []]);
});
