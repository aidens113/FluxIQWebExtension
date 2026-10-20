// The extension's reconciliation (plan B3, Core C8): Core's
// `ClientGatewayCommandReconciliation` with this domain's facts -- which acts
// commit, what an interrupted command is, and what a late copy of a command
// answered `not_seen` is refused with -- over the browser's session storage,
// under the keys earlier builds used. Core's own tests cover the mechanics;
// these rows cover what the web domain decides.
//
// Two workers are two reconciliations over one session-storage stand-in, which
// is what `chrome.storage.session` is to a restarted service worker.

import assert from "node:assert/strict";
import test from "node:test";
import { clientGatewayMemoryArea, ClientGatewayInFlightRecordStore, type ClientGatewayStorageArea } from "@fluxiq/client-gateway-websocket";
import type { ClientGatewayActionResult } from "../../../../shared/protocol";
import { webCommandReconciliation } from "..";

function worker(area: ClientGatewayStorageArea) {
  const sent: ClientGatewayActionResult[] = [];
  const reconciliation = webCommandReconciliation({
    area,
    queuedResult: async () => undefined,
    send: async (result) => {
      sent.push(result);
    },
    now: () => 500
  });
  return { reconciliation, store: new ClientGatewayInFlightRecordStore(area), sent };
}

const press = { commandId: "cmd-press", actionType: "web.dom.click", parameters: {} };
const typing = { commandId: "cmd-type", actionType: "web.dom.type", parameters: { text: "2" } };

test("a press is recorded as committing, under the key earlier builds used, with the tab and document it went to", async () => {
  const area = clientGatewayMemoryArea();
  const w = worker(area);
  await w.reconciliation.begin(press, { tabId: 7 });
  await w.reconciliation.placed("cmd-press", { tabId: 9, documentId: "doc-9-0" });
  const items = await area.get(null);
  assert.deepEqual(items["fluxiq.inFlight.cmd-press"], { commandId: "cmd-press", actionType: "web.dom.click", committing: true, startedAt: 500, place: { tabId: 9, documentId: "doc-9-0" } });
  assert.equal(items["fluxiq.commandSeen.cmd-press"], 500, "and the id is remembered as received");
});

test("a typing that submits commits, one that does not sets a state, and the typed value is never kept", async () => {
  const w = worker(clientGatewayMemoryArea());
  await w.reconciliation.begin({ ...typing, commandId: "cmd-submit", parameters: { text: "typed-value", submit: true } });
  await w.reconciliation.begin({ ...typing, parameters: { text: "typed-value" } });
  const byId = new Map((await w.store.all()).map((record) => [record.commandId, record]));
  assert.equal(byId.get("cmd-submit")?.committing, true);
  assert.equal(byId.get("cmd-type")?.committing, false);
  assert.doesNotMatch(JSON.stringify([...byId.values()]), /typed-value/u);
});

test("after a restart, a lost press is reported unknown and a lost typing a failure that did nothing", async () => {
  const area = clientGatewayMemoryArea();
  const before = worker(area);
  await before.reconciliation.begin(press, { tabId: 7 });
  await before.reconciliation.begin(typing, { tabId: 7 });
  const after = worker(area);
  assert.equal(await after.reconciliation.reportLeftovers(), 2);
  const byId = new Map(after.sent.map((result) => [result.commandId, result]));
  const lostPress = byId.get("cmd-press");
  assert.equal(lostPress?.status, "unknown", "a committing act is an uncertain outcome, never a failure that did nothing");
  assert.equal(lostPress?.failure?.effect, "ambiguous");
  assert.deepEqual({ status: lostPress?.payload?.status, effect: lostPress?.payload?.effect }, { status: "interrupted", effect: "unknown" });
  assert.doesNotMatch(JSON.stringify(lostPress), /tabId|documentId/u, "the report names nothing about the page");
  const lostType = byId.get("cmd-type");
  assert.equal(lostType?.status, "failed");
  assert.equal(lostType?.failure?.effect, "unacted");
  assert.deepEqual(await after.store.all(), []);
});

test("a late copy of a command answered not_seen is refused as one that never reached the page", async () => {
  const w = worker(clientGatewayMemoryArea());
  assert.deepEqual(await w.reconciliation.reconcile("cmd-press"), { commandId: "cmd-press", state: "not_seen" });
  assert.equal(await w.reconciliation.answerRepeat("cmd-press"), "refused");
  const [refused] = w.sent;
  assert.equal(refused?.status, "failed");
  assert.equal(refused?.failure?.code, "web.transport.transient");
  assert.equal(refused?.failure?.effect, "unacted");
  assert.deepEqual(refused?.payload, { commandId: "cmd-press", status: "not_seen" });
});
