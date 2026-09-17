// T1 coverage of structure detection at the gateway boundary: the flag the
// authoring runtime sends on `web.dom.capture_snapshot` reaches the command the
// page runs, the detection the page answers reaches the gateway result copied
// field by field, and the capability a client declares for it adds nothing a
// Flow could execute.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationActionCommand, WebAutomationActionResult } from "../../actions/types";
import { WEB_AUTOMATION_ACTION_TYPES } from "../../actions/types";
import { WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID, webAutomationClientCapabilities } from "..";
import { webAutomationReadActionParameters } from "../gateway-action-parameters";
import { webAutomationActionFromGatewayCommand, webAutomationActionResultPayload } from "../gateway-mapping";

function snapshotCommand(parameters: Record<string, unknown>): WebAutomationActionCommand {
  const mapped = webAutomationActionFromGatewayCommand({ commandId: "c1", actionType: "web.dom.capture_snapshot", parameters: parameters as never });
  assert.equal("status" in mapped, false, "a snapshot is never refused for its detection flag");
  return mapped as WebAutomationActionCommand;
}

test("the detection flag is lifted onto the command, and a malformed one is left off rather than coerced", () => {
  assert.deepEqual(snapshotCommand({ detectStructure: {} }).detectStructure, {});
  assert.deepEqual(snapshotCommand({ detectStructure: { selector: '[data-testid="product-link"]' } }).detectStructure, { selector: '[data-testid="product-link"]' });
  assert.equal(snapshotCommand({}).detectStructure, undefined);
  const malformed = snapshotCommand({ detectStructure: { selector: "" } });
  assert.equal(malformed.detectStructure, undefined);
  assert.deepEqual(webAutomationReadActionParameters({ detectStructure: { selector: 3 } }).refused, ["detectStructure"]);
  assert.deepEqual(webAutomationReadActionParameters({ detectStructure: {} }).refused, []);
});

test("the page's detection reaches the gateway payload copied, and a malformed one does not reach it at all", () => {
  const base: WebAutomationActionResult = {
    commandId: "c1",
    actionType: "web.dom.capture_snapshot",
    status: "succeeded",
    validation: { status: "none", reason: "evidence-only" },
    startedAt: 1,
    finishedAt: 2
  };
  const structure = {
    ok: true as const,
    proposal: {
      container: "#list",
      item: "#list > li",
      itemCount: 3,
      fields: [{ key: "name", label: "name", spec: { kind: "text" as const, selector: ".name" }, coverage: 1 }],
      confidence: 1
    }
  };
  const noisy = { ...structure, sample: "Ada Lovelace", proposal: { ...structure.proposal, sample: "Ada Lovelace" } };
  const payload = webAutomationActionResultPayload({ ...base, structure: noisy as never });
  assert.deepEqual(payload.structure, structure);
  assert.equal(JSON.stringify(payload).includes("Ada Lovelace"), false);

  assert.deepEqual(webAutomationActionResultPayload({ ...base, structure: { ok: false, refused: "no_repeating_run" } }).structure, { ok: false, refused: "no_repeating_run" });
  assert.equal("structure" in webAutomationActionResultPayload({ ...base, structure: { ok: false, refused: "because" } as never }), false);
  assert.equal("structure" in webAutomationActionResultPayload(base), false);
});

test("the client declares detection as a snapshot capability that makes nothing new executable", () => {
  const declared = webAutomationClientCapabilities.filter((capability) => capability.id === WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID);
  assert.equal(declared.length, 1);
  assert.equal(declared[0]!.kind, "snapshot");
  assert.equal(declared[0]!.actionTypes, undefined);
  assert.deepEqual(declared[0]!.metadata, { domainId: "web-automation", actionType: "web.dom.capture_snapshot", parameter: "detectStructure" });
  const executable = webAutomationClientCapabilities.flatMap((capability) => capability.actionTypes ?? []);
  assert.deepEqual([...new Set(executable)].sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort());
  assert.equal(WEB_AUTOMATION_ACTION_TYPES.length, 18);
});
