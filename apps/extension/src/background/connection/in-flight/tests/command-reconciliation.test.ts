// Coverage of command-reconciliation.ts (plan B3): a record is written before a
// command goes to a page and cleared when its result is sent; a record an
// earlier worker left is reported as interrupted with its effect unknown; and a
// repeated command id is answered with the result already in hand, never run.
//
// Two workers are two `CommandReconciliation`s over one session-storage
// stand-in, which is what `chrome.storage.session` is to a restarted worker.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActionResult } from "../../../../shared/protocol";
import { CommandReconciliation } from "../command-reconciliation";
import { workerMemoryRecordArea } from "../record-area";
import { InFlightRecordStore, type InFlightRecordArea } from "../record-store";

function worker(area: InFlightRecordArea, queued: readonly ClientGatewayActionResult[] = []) {
  const sent: ClientGatewayActionResult[] = [];
  const store = new InFlightRecordStore(area);
  const reconciliation = new CommandReconciliation({
    store,
    queuedResult: async (commandId) => queued.find((result) => result.commandId === commandId),
    send: async (result) => {
      sent.push(result);
    },
    documentOf: async (tabId, frameId) => `doc-${tabId}-${frameId}`,
    now: () => 500
  });
  return { reconciliation, store, sent };
}

const press = { commandId: "cmd-press", actionType: "web.dom.click" as const, options: {} };
const typing = { commandId: "cmd-type", actionType: "web.dom.type" as const, options: { text: "2" } };

function succeeded(commandId: string): ClientGatewayActionResult {
  return { commandId, status: "succeeded", startedAt: 100, completedAt: 200, payload: { commandId, status: "succeeded" } };
}

test("a record is written before the command is sent, names where it went, and is cleared when its result is sent", async () => {
  const w = worker(workerMemoryRecordArea());
  await w.reconciliation.begin(press, 7);
  assert.deepEqual(await w.store.all(), [{ commandId: "cmd-press", actionType: "web.dom.click", committing: true, startedAt: 500, tabId: 7 }]);
  await w.reconciliation.dispatched("cmd-press", 9, 0);
  assert.deepEqual(await w.store.read("cmd-press"), { commandId: "cmd-press", actionType: "web.dom.click", committing: true, startedAt: 500, tabId: 9, documentId: "doc-9-0" });
  await w.reconciliation.settled(succeeded("cmd-press"));
  assert.deepEqual(await w.store.all(), []);
  assert.deepEqual(w.sent, [], "settling sends nothing itself: the channel sent the result");
});

test("a typed value is never kept in the record", async () => {
  const w = worker(workerMemoryRecordArea());
  await w.reconciliation.begin({ ...typing, options: { text: "secret-value", submit: true } }, 3);
  const [record] = await w.store.all();
  assert.equal(record?.committing, true, "a submitting type commits");
  assert.doesNotMatch(JSON.stringify(record), /secret-value/u);
});

test("after a restart, a leftover record is reported as interrupted with its effect unknown, then cleared", async () => {
  const area = workerMemoryRecordArea();
  const before = worker(area);
  await before.reconciliation.begin(press, 7);
  await before.reconciliation.begin(typing, 7);
  // The worker stops here: neither result was sent.
  const after = worker(area);
  assert.equal(await after.reconciliation.reportLeftovers(), 2);
  const byId = new Map(after.sent.map((result) => [result.commandId, result]));
  const lostPress = byId.get("cmd-press");
  assert.equal(lostPress?.status, "unknown", "a committing act is an uncertain outcome, never a failure that did nothing");
  assert.equal(lostPress?.failure?.effect, "ambiguous");
  assert.equal(lostPress?.payload?.status, "interrupted");
  assert.equal(lostPress?.payload?.effect, "unknown");
  const lostType = byId.get("cmd-type");
  assert.equal(lostType?.status, "failed");
  assert.equal(lostType?.failure?.effect, "unacted");
  assert.equal(lostType?.payload?.status, "interrupted");
  assert.deepEqual(await after.store.all(), []);
  assert.equal(await after.reconciliation.reportLeftovers(), 0, "reported once");
});

test("a command still running in this worker is not a leftover when the socket comes back", async () => {
  const w = worker(workerMemoryRecordArea());
  await w.reconciliation.begin(press, 7);
  assert.equal(await w.reconciliation.reportLeftovers(), 0);
  assert.deepEqual(w.sent, []);
  assert.equal((await w.store.all()).length, 1);
});

test("a repeated command id is answered from what this worker has, and only a new one may run", async () => {
  const queued = succeeded("cmd-queued");
  const w = worker(workerMemoryRecordArea(), [queued]);
  assert.equal(await w.reconciliation.answerRepeat("cmd-new"), undefined, "a new id runs");

  await w.reconciliation.begin(press, 7);
  assert.equal(await w.reconciliation.answerRepeat("cmd-press"), "running", "still running: its own result will answer");
  assert.deepEqual(w.sent, []);

  const answer = succeeded("cmd-press");
  await w.reconciliation.settled(answer);
  assert.equal(await w.reconciliation.answerRepeat("cmd-press"), "resent");
  assert.deepEqual(w.sent, [answer], "the result just sent is sent again");

  assert.equal(await w.reconciliation.answerRepeat("cmd-queued"), "resent");
  assert.deepEqual(w.sent.at(-1), queued, "the result waiting in the offline queue is sent");
});

test("a repeat of a command an earlier worker lost is answered as interrupted, before the leftovers are reported", async () => {
  const area = workerMemoryRecordArea();
  await worker(area).reconciliation.begin(press, 7);
  const after = worker(area);
  assert.equal(await after.reconciliation.answerRepeat("cmd-press"), "resent");
  assert.equal(after.sent[0]?.status, "unknown");
  assert.deepEqual(await after.store.all(), []);
  assert.equal(await after.reconciliation.answerRepeat("cmd-press"), "resent", "and again from memory");
  assert.equal(after.sent.length, 2);
});

test("a command whose handler threw keeps its record, and a repeat is answered as interrupted rather than run", async () => {
  const w = worker(workerMemoryRecordArea());
  await w.reconciliation.begin(press, 7);
  w.reconciliation.release("cmd-press");
  assert.equal(await w.reconciliation.answerRepeat("cmd-press"), "resent");
  assert.equal(w.sent[0]?.payload?.status, "interrupted");
});
