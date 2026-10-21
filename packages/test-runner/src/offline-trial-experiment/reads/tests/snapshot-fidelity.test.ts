// A recorded read run over its own snapshot: the recorded command, as the
// domain reads it, over the snapshot recorded with its result, compared with
// what it returned live, with the domain's own control verdict beside it.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayTraceReevaluationRequest } from "fluxiq/client-gateway";
import type { WebAutomationActionCommand, WebAutomationActionResult, WebPageSnapshot, WebSnapshotPage } from "@fluxiq-web-extension/domain/node";
import { readFidelity } from "../snapshot-fidelity.js";
import type { TracedRead } from "../types.js";

const LIST = "web.dom.extract_list";
const SHA = "b".repeat(64);
const command = { commandId: "cA", actionType: LIST, parameters: { extractList: { item: "li", fields: { name: "b" }, minItems: 0 } } };
const recordedResult = {
  commandId: "cA", status: "succeeded", startedAt: 1, completedAt: 2,
  payload: { actionType: LIST, extracted: [{ name: "x" }] },
  metadata: { trace: { artifacts: [{ role: "primary", sha256: SHA, mediaType: "text/html", source: "http://127.0.0.1:4100/scenarios/site/list" }], unavailable: 0 } },
};
const request = {
  recordedCommand: command, recordedResult, artifacts: [{ id: "a1", sha256: SHA, mediaType: "text/html", sequence: 3 }],
  readArtifact: async (sha256: string) => sha256 === SHA ? new TextEncoder().encode("<ul><li><b>x</b></li></ul>") : undefined,
} as unknown as ClientGatewayTraceReevaluationRequest;
const read = { traceId: "trace.a", cursor: 0, sequence: 10, actionType: LIST, urlPath: "/scenarios/site/list", snapshot: SHA, request } as unknown as TracedRead;
const OBSERVED = { scriptsRan: 0, requestsLeaked: 0, navigationsHeld: 0, requestsRefused: 0, scrollsPastEnd: 1 };

function page(extracted: unknown[], seen: { snapshot?: WebPageSnapshot; action?: WebAutomationActionCommand } = {}): WebSnapshotPage {
  return {
    evaluate: async (snapshot, action) => {
      seen.snapshot = snapshot;
      seen.action = action;
      const result = { commandId: action.commandId, actionType: LIST, status: "succeeded", startedAt: 500, finishedAt: 600, extracted } as unknown as WebAutomationActionResult;
      return { status: "evaluated", result, observations: OBSERVED };
    },
  };
}

test("the recorded command runs over its own recorded snapshot, and an equal answer reproduces the live read", async () => {
  const seen: { snapshot?: WebPageSnapshot; action?: WebAutomationActionCommand } = {};
  const outcome = await readFidelity({ read, page: page([{ name: "x" }], seen) });
  assert.equal(outcome.status, "evaluated");
  if (outcome.status !== "evaluated") return;
  assert.deepEqual([outcome.comparison.equal, outcome.controlReproduced, outcome.observations], [true, true, OBSERVED]);
  assert.deepEqual([seen.snapshot?.url, seen.snapshot?.primary.sha256, seen.action?.commandId, seen.action?.actionType], ["http://127.0.0.1:4100/scenarios/site/list", SHA, "cA", LIST]);
});

test("an answer that differs is reported as a difference, and the domain's control verdict agrees", async () => {
  const outcome = await readFidelity({ read, page: page([{ name: "x" }, { name: "y" }]) });
  assert.equal(outcome.status === "evaluated" && outcome.comparison.equal, false);
  assert.equal(outcome.status === "evaluated" && outcome.controlReproduced, false);
});

test("no result, an unreadable command, a rejected command or a missing snapshot is never a reproduction", async () => {
  const never: WebSnapshotPage = { evaluate: async () => assert.fail("evaluated") };
  assert.deepEqual(await readFidelity({ read: { ...read, request: null }, page: never }), { status: "not_evaluated", reason: "its segment holds no single readable result" });
  assert.equal((await readFidelity({ read: { ...read, request: { ...request, recordedCommand: null } }, page: never })).status, "not_evaluated");
  const rejected = await readFidelity({ read: { ...read, request: { ...request, recordedCommand: { commandId: "cA", actionType: LIST, parameters: { extractList: {} } } } }, page: never });
  assert.equal(rejected.status, "not_evaluated");
  assert.match(rejected.status === "not_evaluated" ? rejected.reason : "", /the domain rejects/u);
  const missing = await readFidelity({ read: { ...read, request: { ...request, readArtifact: async () => undefined } }, page: never });
  assert.deepEqual(missing, { status: "unavailable", reason: "snapshot_unavailable" });
});
