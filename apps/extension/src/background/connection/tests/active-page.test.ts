// Coverage of active-page.ts: which tab the extension believes is active, and
// the two paths that change that belief. Selecting a tab must finish on the
// facade's public update path, so a caller that replaced that path still sees
// the selection.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { ActivityEntry, ConnectionState, RecordingState, TabDescriptor } from "../../../shared/protocol";
import { ActivePage, type ActivePageDeps } from "../active-page";

function harness(options: { recordingState?: RecordingState; gatewayState?: ConnectionState } = {}) {
  const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const attached: number[] = [];
  const activities: Array<{ label: string; tone: ActivityEntry["tone"] | undefined }> = [];
  const updates: chrome.tabs.Tab[] = [];
  const active: TabDescriptor = { tabId: 5, url: "https://shop.test/" };
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
    }
  };
  return { page: new ActivePage(deps), sent, attached, activities, updates };
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
