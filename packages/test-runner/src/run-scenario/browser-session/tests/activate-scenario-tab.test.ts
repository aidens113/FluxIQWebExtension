import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { activateScenarioTab } from "../activate-scenario-tab.js";

type Tab = { id?: unknown; url: string; active?: boolean };

/**
 * A page whose `evaluate` runs the callback here rather than in a browser, over a
 * fake `chrome` of this test's own. That is exactly what the real one does inside
 * the extension's page, and it is the only way to drive both halves of this
 * module: the tab the extension API picks, and the status it then reports.
 */
function extensionPage(tabs: Tab[], statuses: unknown[]): { page: Page; updates: { id: unknown; active: boolean }[]; polls: number } {
  const updates: { id: unknown; active: boolean }[] = [];
  const state = { polls: 0 };
  const chrome = {
    tabs: {
      query: async ({ url }: { url: string }) => tabs.filter(tab => tab.url.startsWith(url.replace(/\*$/u, ""))),
      update: async (id: unknown, changes: { active: boolean }) => { updates.push({ id, active: changes.active }); },
    },
    runtime: {
      sendMessage: async () => {
        const status = statuses[Math.min(state.polls, statuses.length - 1)];
        state.polls += 1;
        return { ok: true, status };
      },
    },
  };
  const page = {
    evaluate: async (callback: (argument: any) => unknown, argument: unknown) => {
      const previous = (globalThis as any).chrome;
      (globalThis as any).chrome = chrome;
      try { return await callback(argument); }
      finally { if (previous === undefined) delete (globalThis as any).chrome; else (globalThis as any).chrome = previous; }
    },
  } as unknown as Page;
  return { page, updates, get polls() { return state.polls; } };
}

const ORIGIN = "http://127.0.0.1:4100";

test("the fixture tab is activated and the run waits until the extension reports holding that exact tab", async () => {
  const session = extensionPage(
    [{ id: 41, url: "chrome-extension://abc/sidepanel/index.html" }, { id: 42, url: `${ORIGIN}/scenarios/basic-form/` }],
    [{ activeTabId: 41, activeTabUrl: "chrome-extension://abc/sidepanel/index.html" }, { activeTabId: 42, activeTabUrl: `${ORIGIN}/scenarios/basic-form/` }],
  );
  await activateScenarioTab(session.page, ORIGIN);
  assert.deepEqual(session.updates, [{ id: 42, active: true }], "the tab on the fixture origin is the one brought to the front");
  assert.ok(session.polls >= 2, "the run waits past the extension's stale status rather than moving on the moment the update resolves");
});

test("a tab the extension API answers without a numeric id is not a tab a run can drive", async () => {
  const session = extensionPage([{ url: `${ORIGIN}/scenarios/basic-form/` }, { id: "42", url: `${ORIGIN}/other` }], [{}]);
  await assert.rejects(() => activateScenarioTab(session.page, ORIGIN), new Error(`Scenario tab is unavailable for ${ORIGIN}`));
  assert.deepEqual(session.updates, []);
});

test("no fixture tab at all names the origin it looked for", async () => {
  const session = extensionPage([{ id: 41, url: "chrome-extension://abc/sidepanel/index.html" }], [{}]);
  await assert.rejects(() => activateScenarioTab(session.page, ORIGIN), /Scenario tab is unavailable for http:\/\/127\.0\.0\.1:4100/u);
});

/**
 * An id alone can belong to a tab that has since navigated away, which is why the
 * wait reads the reported URL too.
 */
test("the extension reporting the right tab id on a page off the fixture origin is not yet ready", async () => {
  const session = extensionPage(
    [{ id: 42, url: `${ORIGIN}/scenarios/basic-form/` }],
    [{ activeTabId: 42, activeTabUrl: "https://elsewhere.example.test/" }, { activeTabId: 42, activeTabUrl: 42 }, { activeTabId: 42, activeTabUrl: `${ORIGIN}/scenarios/basic-form/` }],
  );
  await activateScenarioTab(session.page, ORIGIN);
  assert.ok(session.polls >= 3, "both the wrong origin and a non-string URL are waited past");
});
