// Coverage of active-page.ts: which tab the extension believes is active, and
// the two paths that change that belief. Selecting a tab must finish on the
// facade's public update path, so a caller that replaced that path still sees
// the selection. Every tab change and removal is handed to the tab recorder with
// the page that was in front before it.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { ActivityEntry, ConnectionState, RecordingState, TabDescriptor } from "../../../shared/protocol";
import { ActivePage, type ActivePageDeps } from "../active-page";
import type { KnownActiveTab } from "../tab-recorder";

type HarnessOptions = {
  recordingState?: RecordingState;
  gatewayState?: ConnectionState;
  failTabRecorder?: boolean;
};

function harness(options: HarnessOptions = {}) {
  const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const attached: number[] = [];
  const activities: Array<{ label: string; tone: ActivityEntry["tone"] | undefined }> = [];
  const updates: chrome.tabs.Tab[] = [];
  const tabChanges: Array<{ tabId: number | undefined; lastActive: KnownActiveTab | undefined; pageTabId: number | undefined }> = [];
  const removals: Array<{ tabId: number; lastActive: KnownActiveTab | undefined }> = [];
  const active: TabDescriptor = { tabId: 5, url: "https://shop.test/" };
  let page: ActivePage | undefined;
  const deps: ActivePageDeps = {
    send: (async (type: string, payload: Record<string, unknown>) => {
      sent.push({ type, payload });
    }) as ActivePageDeps["send"],
    gatewayState: () => options.gatewayState ?? "connected",
    clientId: () => "client-1",
    recordingState: () => options.recordingState ?? "recording",
    attachTabForRecording: async (tabId) => {
      attached.push(tabId);
    },
    activeTab: async () => active,
    allTabs: async () => [active],
    onActivity: (_kind, label, _detail, tone) => {
      activities.push({ label, tone });
    },
    emitStatus: () => undefined,
    updateTab: async (tab) => {
      updates.push(tab);
    },
    noteTabChange: async (tab, lastActive) => {
      tabChanges.push({ tabId: tab.id, lastActive, pageTabId: page?.tabId() });
      if (options.failTabRecorder) throw new Error("recorder failed");
    },
    noteTabRemoved: async (tabId, lastActive) => {
      removals.push({ tabId, lastActive });
      if (options.failTabRecorder) throw new Error("recorder failed");
    }
  };
  page = new ActivePage(deps);
  return { page, sent, attached, activities, updates, tabChanges, removals };
}

function tab(fields: Partial<chrome.tabs.Tab>): chrome.tabs.Tab {
  return fields as chrome.tabs.Tab;
}

test("a tab becoming active is adopted, attached while recording, and published while connected", async () => {
  const h = harness();
  await h.page.handleTabUpdate(tab({ id: 5, active: true, url: "https://shop.test/", title: "Shop", status: "complete" }));
  assert.equal(h.page.tabId(), 5);
  assert.equal(h.page.url(), "https://shop.test/");
  assert.equal(h.page.unsupported(), undefined);
  assert.deepEqual(h.attached, [5]);
  assert.deepEqual(h.activities.map((activity) => activity.label), ["Recording active tab"]);
  assert.deepEqual(h.sent.map((message) => message.type), ["client.state_update", "client.state_update"]);
  assert.equal((h.sent[0]?.payload.metadata as Record<string, unknown>).reason, "tab-updated");

  await h.page.handleTabUpdate(tab({ id: 5, active: true, url: "https://shop.test/", status: "complete" }));
  assert.equal(h.activities.length, 1, "the same tab updating again is not a new active tab");
});

test("an unsupported page is adopted but not attached, and nothing is published while disconnected", async () => {
  const h = harness({ gatewayState: "disconnected" });
  await h.page.handleTabUpdate(tab({ id: 6, active: true, url: "chrome://extensions/" }));
  assert.equal(h.page.tabId(), 6);
  assert.ok(h.page.unsupported(), "a browser page cannot be recorded");
  assert.deepEqual(h.attached, []);
  assert.deepEqual(h.sent, []);
});

test("every tab change reaches the tab recorder with the page in front before it, once this page has moved", async () => {
  const h = harness();
  await h.page.refresh();
  await h.page.handleTabUpdate(tab({ id: 6, active: true, url: "https://shop.test/orders" }));
  await h.page.handleTabUpdate(tab({ id: 7, active: false, url: "https://shop.test/help" }));
  await h.page.handleTabUpdate(tab({ id: 8, active: true, url: "chrome://extensions/" }));
  await h.page.handleTabUpdate(tab({ id: 6, active: true, url: "https://shop.test/orders" }));
  assert.deepEqual(h.tabChanges, [
    { tabId: 6, lastActive: { tabId: 5, url: "https://shop.test/" }, pageTabId: 6 },
    { tabId: 7, lastActive: { tabId: 6, url: "https://shop.test/orders" }, pageTabId: 6 },
    { tabId: 8, lastActive: { tabId: 6, url: "https://shop.test/orders" }, pageTabId: 8 },
    { tabId: 6, lastActive: undefined, pageTabId: 6 }
  ], "a page a recording cannot be in is never handed on as the page in front");
});

test("a removed tab reaches the tab recorder with the page in front", async () => {
  const h = harness();
  await h.page.handleTabUpdate(tab({ id: 6, active: true, url: "https://shop.test/orders" }));
  await h.page.handleTabRemoved(6);
  assert.deepEqual(h.removals, [{ tabId: 6, lastActive: { tabId: 6, url: "https://shop.test/orders" } }]);
});

test("a tab recorder that fails does not stop the page being attached and published", async () => {
  const h = harness({ failTabRecorder: true });
  await h.page.handleTabUpdate(tab({ id: 5, active: true, url: "https://shop.test/", status: "complete" }));
  assert.deepEqual(h.attached, [5]);
  assert.equal(h.sent.length, 2);
  await h.page.handleTabRemoved(5);
  assert.equal(h.removals.length, 1);
});

test("selecting a tab finishes through the facade's update path; an unavailable one is refused", async (t: TestContext) => {
  const h = harness();
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  const tabs = new Map<number, chrome.tabs.Tab>([
    [9, tab({ id: 9, active: false, url: "https://shop.test/checkout" })],
    [10, tab({ id: 10, active: false, url: "chrome://settings/" })]
  ]);
  holder.chrome = { tabs: { update: async (tabId: number) => tabs.get(tabId) ?? tab({ id: -1 }) } };
  t.after(() => {
    holder.chrome = previous;
  });

  await h.page.select(9);
  assert.equal(h.updates.length, 1);
  assert.equal(h.updates[0]?.id, 9);
  assert.equal(h.updates[0]?.active, true, "the selected tab is reported as active");
  assert.equal(h.page.tabId(), undefined, "state changes only through the update path");

  await assert.rejects(h.page.select(10), /unavailable or unsupported/);
  await assert.rejects(h.page.select(11), /unavailable or unsupported/);
  assert.equal(h.updates.length, 1);
});

test("a finished action's tab and URL replace the last tab event, and a missing value does not", async () => {
  const h = harness();
  await h.page.refresh();
  h.page.noteActionResult(3, "https://shop.test/done");
  assert.equal(h.page.tabId(), 3);
  assert.equal(h.page.url(), "https://shop.test/done");
  h.page.noteActionResult(undefined, "");
  assert.equal(h.page.tabId(), 3);
  assert.equal(h.page.url(), "https://shop.test/done");
});
