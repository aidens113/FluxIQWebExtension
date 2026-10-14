// Which tab a command issued under a host lease runs on (automation-project-
// agents plan, `Extension And Domain Wiring` 2). The lease grants the
// automation tab, so a leased command that names no tab runs there even while
// another tab -- a person's own -- is in front; an unleased command still runs
// on the tab in front, as it always has, and a named tab still wins.
//
// The chrome API the runner drives is stubbed and read back, as in
// `action-runner.test.ts` and `navigate-action.test.ts`. What this cannot prove
// is a real browser's focus while a builder works; only a loaded extension does.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrowserActionCommand } from "../../shared/protocol";
import { runBrowserActionCommand, type BrowserActionRunRequest } from "../action-runner";
import { forgetAutomationTab, setAutomationTab } from "../automation-tab";

const AUTOMATION_TAB = 12;
const IN_FRONT = 41;
const STORE = "http://127.0.0.1:64130/scenarios/everything-store/";
const RESULTS = "http://127.0.0.1:64130/scenarios/everything-store/s?k=wireless+earbuds";
const PERSONS_PAGE = "http://127.0.0.1:64130/scenarios/company-website/";

type Calls = { sent: number[]; updated: number[]; created: string[] };

/** Tabs at their addresses; actions answer success, navigations load, and every tab the runner touches is recorded. */
function installStub(urls: Record<number, string>): Calls {
  const calls: Calls = { sent: [], updated: [], created: [] };
  const documents: Record<number, number> = {};
  const listeners = () => ({ addListener: () => undefined, removeListener: () => undefined });
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: {},
    tabs: {
      get: (tabId: number) => urls[tabId] !== undefined
        ? Promise.resolve({ id: tabId, url: urls[tabId], status: "complete" })
        : Promise.reject(new Error(`No tab with id: ${tabId}.`)),
      update: (tabId: number, properties: { url?: string }) => {
        calls.updated.push(tabId);
        if (properties.url !== undefined) {
          urls[tabId] = properties.url;
          documents[tabId] = (documents[tabId] ?? 0) + 1;
        }
        return Promise.resolve({ id: tabId, url: urls[tabId] });
      },
      reload: (tabId: number) => {
        documents[tabId] = (documents[tabId] ?? 0) + 1;
        return Promise.resolve();
      },
      create: (properties: { url: string }) => {
        calls.created.push(properties.url);
        urls[900] = properties.url;
        return Promise.resolve({ id: 900, url: properties.url });
      },
      onUpdated: listeners(),
      sendMessage: (tabId: number, message: { type?: string; action?: BrowserActionCommand }, third?: unknown, fourth?: unknown) => {
        const callback = (typeof third === "function" ? third : fourth) as ((response: unknown) => void) | undefined;
        if (message.type === "fluxiq.ping") return callback?.({ ok: true, active: true, version: 2 });
        if (message.type === "fluxiq.pageChallenge") return callback?.({ challenge: null });
        calls.sent.push(tabId);
        return callback?.({
          commandId: message.action?.commandId,
          actionType: message.action?.actionType,
          status: "succeeded",
          validation: { status: "passed", expected: "the click lands", actual: "it did" },
          startedAt: 1,
          finishedAt: 2
        });
      }
    },
    scripting: { executeScript: () => Promise.resolve([{ frameId: 0, result: 200 }]) },
    webNavigation: {
      getAllFrames: (details: { tabId: number }, callback: (found: unknown[]) => void) =>
        callback([{ frameId: 0, documentId: `document.${details.tabId}.${documents[details.tabId] ?? 0}` }]),
      onBeforeNavigate: listeners(),
      onCommitted: listeners(),
      onErrorOccurred: listeners()
    }
  };
  return calls;
}

async function run(action: BrowserActionCommand, extra: Partial<BrowserActionRunRequest>): Promise<Awaited<ReturnType<typeof runBrowserActionCommand>>> {
  try {
    return await runBrowserActionCommand({ action, activeTabId: IN_FRONT, attachTabForRecording: () => Promise.resolve(), ...extra });
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

const click: BrowserActionCommand = { commandId: "c-click", actionType: "web.dom.click", selector: "#add" };
const navigate: BrowserActionCommand = { commandId: "c-nav", actionType: "web.browser.navigate", url: RESULTS };

test("a leased click runs on the automation tab while another tab is in front", async () => {
  forgetAutomationTab();
  setAutomationTab(AUTOMATION_TAB);
  const calls = installStub({ [AUTOMATION_TAB]: STORE, [IN_FRONT]: PERSONS_PAGE });
  const result = await run(click, { leased: true });
  assert.deepEqual(calls.sent, [AUTOMATION_TAB]);
  assert.equal(result.tabId, AUTOMATION_TAB);
  assert.equal(result.result.status, "succeeded");
});

test("an unleased click still runs on the tab in front, as it always has", async () => {
  forgetAutomationTab();
  setAutomationTab(AUTOMATION_TAB);
  const calls = installStub({ [AUTOMATION_TAB]: STORE, [IN_FRONT]: PERSONS_PAGE });
  await run(click, {});
  assert.deepEqual(calls.sent, [IN_FRONT]);
});

test("a leased navigation drives the automation tab, not the page in front", async () => {
  forgetAutomationTab();
  setAutomationTab(AUTOMATION_TAB);
  const calls = installStub({ [AUTOMATION_TAB]: STORE, [IN_FRONT]: PERSONS_PAGE });
  const result = await run(navigate, { leased: true });
  assert.deepEqual(calls.updated, [AUTOMATION_TAB]);
  assert.deepEqual(calls.created, []);
  assert.equal(result.tabId, AUTOMATION_TAB);
  assert.equal(result.result.status, "succeeded");
});

test("a leased command that names a tab runs there", async () => {
  forgetAutomationTab();
  setAutomationTab(AUTOMATION_TAB);
  const calls = installStub({ [AUTOMATION_TAB]: STORE, [IN_FRONT]: PERSONS_PAGE });
  await run({ ...click, tabId: IN_FRONT }, { leased: true });
  assert.deepEqual(calls.sent, [IN_FRONT]);
});

test("with no automation tab open yet, a leased command runs where an unleased one would", async () => {
  forgetAutomationTab();
  const calls = installStub({ [IN_FRONT]: PERSONS_PAGE });
  await run(click, { leased: true });
  assert.deepEqual(calls.sent, [IN_FRONT]);
});

test("a page in front the extension cannot automate does not refuse a leased command bound for the automation tab", async () => {
  forgetAutomationTab();
  setAutomationTab(AUTOMATION_TAB);
  const calls = installStub({ [AUTOMATION_TAB]: STORE, [IN_FRONT]: "chrome://settings/" });
  const result = await run(click, { leased: true, unsupportedPageReason: "Browser and extension pages cannot be automated." });
  assert.deepEqual(calls.sent, [AUTOMATION_TAB]);
  assert.equal(result.result.status, "succeeded");
});
