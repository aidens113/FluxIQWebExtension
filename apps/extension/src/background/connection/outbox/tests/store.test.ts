// The extension's outbox store: the offline queue kept under one key in a
// session-long storage area, never in `chrome.storage.local`, and read through
// the saved-state reader so a malformed state is repaired rather than thrown.

import assert from "node:assert/strict";
import test from "node:test";

import { ClientGatewayOutbox, clientGatewayMemoryArea, createClientGatewayMessage, type ClientGatewayOutboxState } from "@fluxiq/client-gateway-websocket";
import { extensionOutboxStore } from "../index";

const OUTBOX_STORAGE_KEY = "fluxiq.outbox";

const binding = { session: "lineage-1", projectId: "project-1", recordingId: null };

test("an empty area reads as an empty queue with no lineage", async () => {
  const store = extensionOutboxStore(clientGatewayMemoryArea());
  assert.deepEqual(await store.read(), { entries: [] });
});

test("the state is written under the outbox key and read back", async () => {
  const area = clientGatewayMemoryArea();
  const store = extensionOutboxStore(area);
  const state: ClientGatewayOutboxState = {
    lineage: "lineage-1",
    entries: [{ binding, message: createClientGatewayMessage("client.action_result", { commandId: "cmd-1", status: "succeeded" }) }]
  };
  await store.write(state);
  assert.deepEqual(Object.keys(await area.get(null)), [OUTBOX_STORAGE_KEY]);
  assert.deepEqual(await store.read(), state);
});

test("the store serves the Core outbox: a queued message survives a second outbox over the same area", async () => {
  const area = clientGatewayMemoryArea();
  const first = new ClientGatewayOutbox(extensionOutboxStore(area));
  await first.setLineage("lineage-1");
  await first.enqueue(createClientGatewayMessage("client.action_result", { commandId: "cmd-1", status: "succeeded" }), binding);
  // A restarted service worker builds a new outbox over the same session storage.
  const second = new ClientGatewayOutbox(extensionOutboxStore(area));
  assert.equal(await second.size(), 1);
  assert.equal(await second.lineage(), "lineage-1");
  assert.equal((await second.actionResult("cmd-1", "lineage-1"))?.status, "succeeded");
});

test("a malformed state is repaired, written back, and reported by field name only", async () => {
  const area = clientGatewayMemoryArea();
  const kept = { binding, message: createClientGatewayMessage("client.action_result", { commandId: "cmd-1", status: "succeeded" }) };
  await area.set({ [OUTBOX_STORAGE_KEY]: { lineage: "lineage-1", entries: [kept, { binding: "broken", message: null }] } });
  const reports: string[] = [];
  const store = extensionOutboxStore(area, { onRepaired: (fields) => reports.push(fields.join(",")) });
  assert.deepEqual(await store.read(), { lineage: "lineage-1", entries: [kept] });
  assert.deepEqual(reports, ["outbox.entries"]);
  assert.deepEqual((await area.get(null))[OUTBOX_STORAGE_KEY], { lineage: "lineage-1", entries: [kept] });
  // The next read is clean.
  await store.read();
  assert.deepEqual(reports, ["outbox.entries"]);
});

test("a state that is not an object reads as an empty queue", async () => {
  const area = clientGatewayMemoryArea();
  await area.set({ [OUTBOX_STORAGE_KEY]: "not a queue" });
  const reports: string[][] = [];
  const store = extensionOutboxStore(area, { onRepaired: (fields) => reports.push(fields) });
  assert.deepEqual(await store.read(), { entries: [] });
  assert.deepEqual(reports, [["outbox"]]);
});
