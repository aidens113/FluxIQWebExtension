// A Flow Bootstrap proposal as Core stores one when the build finished and its
// question was never answered: the declarations the gate kept, its reading of
// them against the instruction, and the request itself.
//
// Built by Core's own gate and cross-check and carried through JSON, so the Lab
// is tested against what Core sends rather than a hand-written copy its strict
// parser might refuse.

import assert from "node:assert/strict";
import { AutomationStudioActionPermissionGate, automationStudioActionDeclarationCrossCheck } from "fluxiq/automation-studio";
import { adaptationConsequences } from "../../../existing-fluxiq-control/index.js";
import type { ExistingFlowAdaptation } from "../../../existing-fluxiq-control.js";

/**
 * A build that read a page, then reached for a control that would publish.
 * Nothing permitted that, so the gate raised a request; the build carried on,
 * finished, and left the proposal with the question on it. Core refuses to
 * approve or apply such a proposal until somebody answers.
 */
export async function parkedProposalConsequences(): Promise<NonNullable<ExistingFlowAdaptation["consequences"]>> {
  const gate = new AutomationStudioActionPermissionGate({ stage: "authoring", instructionIds: ["instruction.schedule"], now: () => 5, newRequestId: () => "permission-request:one" });
  gate.observe({ controls: [{ handle: "c1", name: "Post text" }, { handle: "c7", name: "Schedule post" }] });
  await gate.checkFor({ kind: "exploration_step", id: "web.output.dom-type", ref: "call-2" })({ consequences: [], control: { name: "Post text", kind: "textbox" }, verb: "enter" });
  await gate.checkFor({ kind: "flow_step", id: "web.output.dom-click", ref: "main.s6" })({ consequences: ["send_or_publish"], control: { name: "Schedule post", kind: "button" }, verb: "press" });
  assert.ok(gate.request, "the gate raised a request");
  const crossCheck = automationStudioActionDeclarationCrossCheck({ declarations: gate.declarations, instructed: [] });
  // Through Core, through JSON, and through the Lab's own reader, which is
  // where the four members are found on a real proposal.
  const bootstrap = JSON.parse(JSON.stringify({
    instructedConsequences: [],
    declaredConsequences: gate.declarations,
    consequenceCrossCheck: crossCheck,
    permissionRequest: gate.request,
  })) as Record<string, unknown>;
  const parsed = adaptationConsequences(bootstrap, "adaptation.metadata.bootstrap");
  assert.ok(parsed, "the reader found the proposal's declarations");
  return parsed;
}
