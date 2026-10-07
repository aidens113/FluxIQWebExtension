import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { presentFlowTab, type FlowTabMoment } from "../present-flow-tab.js";

const ORIGIN = "http://127.0.0.1:4100";
const START = `${ORIGIN}/scenarios/crossborder-marketplace/`;
const LISTING = `${ORIGIN}/scenarios/crossborder-marketplace/item/1005008123450`;
const BLANK = "about:blank";
const CONTROL = "chrome-extension://abc/sidepanel/index.html";

/**
 * A browser of this test's own: numbered tabs, one of them active, an extension
 * whose status reports the active tab as the one it holds (as
 * `apps/extension/src/background/connection/active-page.ts` does on
 * `tabs.onActivated`), and closing the active tab activating the extension's
 * own page. Chrome picks a neighbour or the opener instead; which one is not
 * something a run may rely on, so this browser picks the least helpful. The
 * extension page's `evaluate` runs its callback here over a fake `chrome`,
 * exactly as `activate-scenario-tab.test.ts` drives it.
 */
function browser(urls: string[], activeIndex: number) {
  const tabs = urls.map((url, index) => ({ id: 40 + index, url, open: true }));
  const state = { active: tabs[activeIndex]!.id, closed: [] as string[], fronted: [] as number[] };
  const openTabs = () => tabs.filter(tab => tab.open);
  const chrome = {
    tabs: {
      query: async ({ url }: { url: string }) => openTabs().filter(tab => tab.url.startsWith(url.replace(/\*$/u, ""))).map(tab => ({ id: tab.id, url: tab.url })),
      update: async (id: number) => { state.active = id; },
    },
    runtime: {
      sendMessage: async () => {
        const held = tabs.find(tab => tab.id === state.active)!;
        return { ok: true, status: { activeTabId: held.id, activeTabUrl: held.url } };
      },
    },
  };
  const pages = tabs.map(tab => ({
    url: () => tab.url,
    close: async () => {
      tab.open = false; state.closed.push(tab.url);
      if (state.active === tab.id) state.active = openTabs().find(open => open.url === CONTROL)!.id;
    },
    bringToFront: async () => { state.fronted.push(tab.id); state.active = tab.id; },
    evaluate: async (callback: (argument: any) => unknown, argument: unknown) => {
      const previous = (globalThis as any).chrome;
      (globalThis as any).chrome = chrome;
      try { return await callback(argument); }
      finally { if (previous === undefined) delete (globalThis as any).chrome; else (globalThis as any).chrome = previous; }
    },
  }) as unknown as Page);
  const heldUrl = () => tabs.find(tab => tab.id === state.active)!.url;
  return { pages, state, heldUrl, tabIdOf: (index: number) => tabs[index]!.id };
}

const isScenarioUrl = (url: string) => url.startsWith(ORIGIN);

function present(session: ReturnType<typeof browser>, pageIndex: number, moment: FlowTabMoment, startsOnScenarioPage = true) {
  return presentFlowTab({
    page: session.pages[pageIndex]!, pages: session.pages, extensionControl: session.pages[1]!,
    scenarioOrigin: ORIGIN, isScenarioUrl, blankTabUrl: BLANK, moment, startsOnScenarioPage,
  });
}

// run-muykc54t-0cefc7eb (2026-10-07): crossborder-marketplace's recording opens
// the official listing in a new tab and switches to it. The Flow lane reloaded
// the start page in the runner's tab, but the listing tab stayed open and in
// front, so the extension ran the Flow there: its first step waited for the
// start page's welcome dialog on the listing page and timed out three times.
test("a Flow built from the recording runs on the start page, not on the tab the recording ended in", async () => {
  // about:blank, the extension's control page, the runner's fixture tab, and the listing tab the recording switched to, in front.
  const session = browser([BLANK, CONTROL, START, LISTING], 3);
  await present(session, 2, undefined);
  assert.deepEqual(session.state.closed, [BLANK, LISTING], "every other fixture tab and the blank one are closed; the extension's own page is not");
  assert.equal(session.heldUrl(), START, "the extension holds the runner's tab, which is the tab a Flow run lands on");
});

test("a created Flow's playback likewise starts with the extension holding the runner's tab", async () => {
  const session = browser([BLANK, CONTROL, START, LISTING], 3);
  await present(session, 2, "playback");
  assert.deepEqual(session.state.closed, [BLANK, LISTING]);
  assert.equal(session.heldUrl(), START);
});

test("an exploration keeps every tab: the build's own tabs are its evidence", async () => {
  const session = browser([BLANK, CONTROL, START, LISTING], 3);
  await present(session, 2, "build");
  assert.deepEqual(session.state.closed, []);
  assert.deepEqual(session.state.fronted, []);
});

test("a Flow that starts on a blank tab has its other tabs closed but is not handed a fixture page", async () => {
  const session = browser([BLANK, CONTROL, BLANK, LISTING], 3);
  await present(session, 2, "playback", false);
  assert.deepEqual(session.state.closed, [BLANK, LISTING]);
  assert.deepEqual(session.state.fronted, [], "reaching the page is the Flow's own first step (`lane-rules/flow-start-page.ts`)");
});

test("a run that never paired has its tabs closed and its page brought forward without asking the extension", async () => {
  const session = browser([BLANK, CONTROL, START, LISTING], 3);
  await presentFlowTab({ page: session.pages[2]!, pages: session.pages, extensionControl: undefined, scenarioOrigin: ORIGIN, isScenarioUrl, blankTabUrl: BLANK, moment: undefined, startsOnScenarioPage: true });
  assert.deepEqual(session.state.closed, [BLANK, LISTING]);
  assert.deepEqual(session.state.fronted, [session.tabIdOf(2)]);
});
