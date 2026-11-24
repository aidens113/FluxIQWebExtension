import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationActionType, WebPageSnapshot, WebSnapshotPage, WebSnapshotPageEvaluation } from "@fluxiq-web-extension/domain/node";
import { recordedSnapshotGateway } from "../snapshot-gateway.js";

const snapshot = { url: "http://127.0.0.1:4100/scenarios/everything-store/list", primary: { sha256: "0".repeat(64), mediaType: "text/html", role: "primary", source: null, bytes: new Uint8Array() }, resources: [], unavailable: 0 } satisfies WebPageSnapshot;
const observations = { scriptsRan: 0, requestsLeaked: 0, navigationsHeld: 0, requestsRefused: 0, scrollsPastEnd: 0 };

function page(answer: (actionType: WebAutomationActionType) => WebSnapshotPageEvaluation): WebSnapshotPage & { seen: string[] } {
  const seen: string[] = [];
  const evaluate: WebSnapshotPage["evaluate"] = async (given, action) => {
    assert.equal(given, snapshot);
    seen.push(action.actionType);
    return answer(action.actionType);
  };
  return { seen, evaluate };
}

test("every command runs over the one recorded snapshot and is answered by the gateway result builder", async () => {
  const fake = page((actionType) => ({ status: "evaluated", result: { commandId: "c", actionType, status: "succeeded", validation: { status: "passed", expected: "page", actual: "page" }, startedAt: 1, finishedAt: 2 }, observations }));
  const { gateway, commands } = recordedSnapshotGateway({ page: fake, snapshot, sessionId: "s" });
  assert.deepEqual(gateway.eligibleSessionIds(), ["s"]);
  assert.deepEqual(gateway.structureDetectionSessionIds?.(), ["s"]);
  const result = await gateway.executeAction("s", { actionType: "web.dom.capture_snapshot", parameters: {}, metadata: {} });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(fake.seen, ["web.dom.capture_snapshot"]);
  assert.equal(commands.length, 1);
  await assert.rejects(() => gateway.executeAction("other", { actionType: "web.dom.capture_snapshot", parameters: {}, metadata: {} }), /session_unknown/u);
});

test("a snapshot the sandbox cannot run is a refusal, never an invented answer", async () => {
  const fake = page(() => ({ status: "unavailable", reason: "snapshot_unavailable", detail: "fixture" }));
  const { gateway } = recordedSnapshotGateway({ page: fake, snapshot, sessionId: "s" });
  await assert.rejects(() => gateway.executeAction("s", { actionType: "web.dom.capture_snapshot", parameters: {}, metadata: {} }), /recorded_oracle_snapshot_snapshot_unavailable/u);
});
