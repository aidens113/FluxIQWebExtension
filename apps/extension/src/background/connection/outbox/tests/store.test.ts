// The extension's outbox store: the offline queue kept under one key in a
// session-long storage area, never in `chrome.storage.local`, and read through
// the saved-state reader so a malformed state is repaired rather than thrown.

import assert from "node:assert/strict";
import test from "node:test";

import { ClientGatewayOutbox, clientGatewayMemoryArea, createClientGatewayMessage, type ClientGatewayOutboxState } from "@fluxiq/client-gateway-websocket";
import { gatewayActionResultFromBrowserResult, type WebAutomationActionResult } from "@fluxiq-web-extension/domain/client";
import type { AutomationStudioTargetActionabilityRecord } from "fluxiq/automation-studio/actionability";
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

test("measured controls survive the existing wire envelope and a serialized offline queue restart", async () => {
  const measurements: AutomationStudioTargetActionabilityRecord[] = [
    { actionable: true },
    { actionable: false, cause: "hidden" },
    { actionable: false, cause: "disabled" },
    { actionable: false, cause: "covered" }
  ];
  // The unchanged Core 0.18 durable result schema closes only these top keys.
  const oldWireKeys = new Set(["commandId", "status", "startedAt", "completedAt", "message", "target", "payload", "error", "clearedWait", "failure", "metadata"]);
  for (const measurement of measurements) {
    const raw: WebAutomationActionResult = {
      commandId: "queued.measured",
      actionType: "web.dom.click",
      status: measurement.actionable ? "succeeded" : "failed",
      validation: { status: measurement.actionable ? "passed" : "failed", expected: "measured target", actual: "measured target" },
      actionability: measurement,
      failure: measurement.actionable ? undefined : {
        category: "action_failed", code: "web.action.failed", retryable: true,
        stage: "execution", effect: "ambiguous"
      },
      startedAt: 1,
      finishedAt: 2
    };
    const before = JSON.stringify(raw);
    const wire = gatewayActionResultFromBrowserResult(raw);
    assert.ok(Object.keys(wire).every((key) => oldWireKeys.has(key)));
    assert.equal(Object.hasOwn(wire, "actionability"), false);
    assert.deepEqual(wire.payload?.actionability, measurement);
    assert.equal(JSON.stringify(raw), before, "mapping cannot mutate the digest's source");
    const area = clientGatewayMemoryArea();
    const first = new ClientGatewayOutbox(extensionOutboxStore(area));
    await first.setLineage(binding.session);
    await first.enqueue(createClientGatewayMessage("client.action_result", wire), binding);
    // Serialize the actual stored state, then reconstruct the old saved-state
    // reader and public outbox exactly as a new background worker does.
    await area.set(JSON.parse(JSON.stringify(await area.get(null))));
    const repairs: string[][] = [];
    const restarted = new ClientGatewayOutbox(extensionOutboxStore(area, { onRepaired: (fields) => repairs.push(fields) }));
    const replayed = await restarted.actionResult(wire.commandId, binding.session);
    assert.deepEqual(replayed, wire);
    assert.deepEqual(replayed?.payload?.actionability, measurement);
    assert.equal(replayed?.status, raw.status);
    assert.equal(replayed?.failure?.effect, measurement.actionable ? undefined : "ambiguous");
    assert.deepEqual(repairs, [], "optional payload metadata cannot invalidate a completed result");
  }
});

test("an unreadable optional browser control cannot erase the succeeded queued result", async () => {
  let reads = 0;
  const raw: WebAutomationActionResult = {
    commandId: "queued.unreadable", actionType: "web.dom.click", status: "succeeded",
    validation: { status: "passed", expected: "measured target", actual: "measured target" }, startedAt: 1, finishedAt: 2
  };
  Object.defineProperty(raw, "actionability", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("Optional control is unreadable.");
    }
  });
  const wire = gatewayActionResultFromBrowserResult(raw);
  assert.equal(reads, 0);
  assert.equal(wire.status, "succeeded");
  assert.equal(Object.hasOwn(wire.payload ?? {}, "actionability"), false);
  const area = clientGatewayMemoryArea();
  const first = new ClientGatewayOutbox(extensionOutboxStore(area));
  await first.enqueue(createClientGatewayMessage("client.action_result", wire), binding);
  const restarted = new ClientGatewayOutbox(extensionOutboxStore(area));
  assert.deepEqual(await restarted.actionResult(wire.commandId, binding.session), wire);
});
