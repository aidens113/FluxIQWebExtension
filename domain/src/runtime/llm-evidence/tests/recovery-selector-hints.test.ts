// A repair may name a control only the recovery's exploration showed, and it
// must get back the selector hint behind exactly that control.
//
// Core carries the packets an exploration returned into the patch request,
// qualifies a handle taken from one as `explored.N:target.M`, and asks this
// domain about exactly that packet with the qualifier removed (Core `a8ce814`,
// `AS/runtime/recovery/annotation/{exploration,patches}.ts`). What reaches
// `validateTargetOverrideEvidence` is a JSON clone of the packet the option
// returned (`AS/runtime/llm/harness/context-packet.ts`); the failure packet is
// a JSON clone too (`failure-evidence.ts`). These rows drive the recovery
// options through Core's registry, built from the bound runtime at `gather` as
// the recovery path builds it, and hand the target check exactly that.
//
// Handles are numbered from 1 in every packet, so two captures of one page
// with the same number of elements use the same handles for different
// controls. The rows below hold the domain to never lending one packet's
// selectors to another, and to never letting an exploration push the failure
// packet's selectors out.

import assert from "node:assert/strict";
import test from "node:test";
import {
  automationStudioHarnessOptionRegistry,
  type AutomationStudioAdaptationPolicy,
  type AutomationStudioRuntimeTargetOverrideEvidenceValidation
} from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../constants";
import { createWebAutomationLlmEvidenceRuntime, type WebAutomationLlmEvidenceRuntime, type WebLlmEvidenceGateway } from "..";
import { CAPTURED_DETECTIONS } from "../structure/tests/captured-detections";

const SCOPE = { projectId: "project.repair", flowId: "flow.repair", runId: "run.repair" };
const CLICK = { nodeId: "node.save", definitionId: "web.output.dom-click" };

/** What the recording addressed, for a row that resolves the control named by `handle`: the same control. */
function asRecorded(packet: JsonObject, handle: string) {
  const element = (packet.elements as Array<{ target: string; name?: string }>).find((candidate) => candidate.target === handle);
  const accessibleName = typeof element?.name === "string" ? element.name : undefined;
  // A handle the packet never issued names no control, and the recording is
  // then a button and nothing more: the rows that pass one are about the handle
  // being refused before anything is compared.
  const recorded: JsonObject = accessibleName === undefined
    ? { tagName: "button", role: "button" }
    : { tagName: "button", role: "button", accessibleName };
  return { ...CLICK, recordedTarget: { element: recorded } };
}
const DOMAIN = { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID } as const;

/** A policy that lets the exploration change the page, as a repair preset may. */
const POLICY: AutomationStudioAdaptationPolicy = {
  schemaVersion: "0.1",
  policyId: "policy.repair",
  scope: { kind: "flow", flowId: SCOPE.flowId },
  preset: "repair",
  proposalMode: "manual",
  allowRuntimeRecovery: true,
  allowCreateRecoveryPaths: true,
  allowModifySubflows: true,
  allowCreateSubflows: true,
  allowModifyRouter: true,
  allowModifyExpectations: true,
  allowModifyActionTargets: true,
  allowDeleteOrDisableBehavior: false,
  allowExternalSideEffects: true,
  requireApprovalForDestructiveChanges: true,
  requireApprovalForExternalSideEffects: false,
  createdAt: 1,
  updatedAt: 1
};

type Control = { selector: string; name: string; inDialog?: boolean };
type Page = { path: string; dialog: boolean; controls: Control[] };

/** The settings page as the save failed: a dialog covers it. */
const COVERED: Page = { path: "/settings", dialog: true, controls: [{ selector: "#close", name: "Close", inDialog: true }, { selector: "#keep", name: "Keep editing", inDialog: true }] };
/** The same page once the dialog is dismissed: the same number of controls, none of them the same. */
const UNCOVERED: Page = { path: "/settings", dialog: false, controls: [{ selector: "#apply", name: "Apply changes" }, { selector: "#discard", name: "Discard changes" }] };

const resultPage = (index: number): Page => ({
  path: `/results/${index}`,
  dialog: false,
  controls: [{ selector: `#apply-${index}`, name: `Apply result ${index}` }, { selector: `#open-${index}`, name: `Open result ${index}` }]
});

function site(first: Page): { runtime: WebAutomationLlmEvidenceRuntime; commands: string[] } {
  let page = first;
  const commands: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      if (command.actionType === "web.dom.click" && command.parameters.selector === "#close") page = UNCOVERED;
      if (command.actionType === "web.browser.navigate") page = resultPage(Number(new URL(String(command.parameters.url)).pathname.split("/").at(-1)));
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const payload: JsonObject = { snapshot: snapshot(page) };
      if (command.parameters.detectStructure !== undefined) payload.structure = structuredClone(CAPTURED_DETECTIONS["product-catalog-largest"].structure) as JsonValue;
      return { status: "succeeded", payload };
    }
  };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway), commands };
}

function snapshot(page: Page): JsonObject {
  return {
    url: `https://example.test${page.path}`,
    title: "Settings",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    evidence: page.dialog ? { dialogs: { open: [{ role: "dialog", modal: true }] } } : {},
    interactiveElements: page.controls.map((control) => ({
      tagName: "button",
      selector: control.selector,
      role: "button",
      name: control.name,
      context: control.inDialog ? { landmark: "dialog" } : {}
    }))
  };
}

type Explored = { evidenceId: string; toolId: string; packet: JsonObject };

/**
 * A recovery exploration as Core drives it: the bound runtime's options through
 * Core's registry at `gather`, under a policy. Every packet an option returns
 * is labelled and cloned the way Core carries it to the patch.
 */
function exploration(runtime: WebAutomationLlmEvidenceRuntime): { explored: Explored[]; call(toolId: string, value: JsonObject): Promise<JsonObject> } {
  const loop = automationStudioHarnessOptionRegistry({ binding: runtime }).evidenceLoopBinding(SCOPE, { scope: DOMAIN, stage: "gather", policy: POLICY });
  const explored: Explored[] = [];
  let calls = 0;
  return {
    explored,
    async call(toolId, value) {
      calls += 1;
      const execution = await loop.executeTool({ callId: `call.${calls}`, toolId, value, maxEvidenceBytes: 6_000 });
      const evidence = (execution as { evidence: JsonObject }).evidence;
      assert.notEqual(evidence.ok, false, `${toolId} was refused: ${JSON.stringify(evidence)}`);
      explored.push({ evidenceId: `explored.${explored.length + 1}`, toolId, packet: JSON.parse(JSON.stringify(evidence)) as JsonObject });
      return evidence;
    }
  };
}

/** The failure packet as Core holds it for the target check: a JSON clone of the capture. */
async function failurePacket(runtime: WebAutomationLlmEvidenceRuntime): Promise<JsonObject> {
  const evidence = await runtime.captureSanitizedFailureEvidence({
    ...SCOPE,
    failedAction: { attemptId: "attempt.1", nodeId: CLICK.nodeId, definitionId: CLICK.definitionId, status: "failed" },
    maxEvidenceBytes: 6_000
  });
  return JSON.parse(JSON.stringify(evidence)) as JsonObject;
}

/** Core's reading of a qualified handle (`automationStudioExploredEvidenceHandle`), mirrored because the built Core this suite imports predates it. */
const CORE_QUALIFIED_HANDLE = /^(explored\.[1-9][0-9]{0,2}):(.+)$/u;

/** What Core asks this domain about a repair whose one handle is qualified: that packet alone, the qualifier removed. */
function askAsCore(runtime: WebAutomationLlmEvidenceRuntime, explored: Explored[], handle: string): AutomationStudioRuntimeTargetOverrideEvidenceValidation {
  const qualified = CORE_QUALIFIED_HANDLE.exec(handle);
  assert.ok(qualified, handle);
  const carried = explored.find((entry) => entry.evidenceId === qualified[1]);
  assert.ok(carried, `Core carried ${qualified[1]}`);
  return runtime.validateTargetOverrideEvidence(carried.packet, { handles: { element: qualified[2]! } }, asRecorded(carried.packet, qualified[2]!));
}

function askFailure(runtime: WebAutomationLlmEvidenceRuntime, failure: JsonObject, handle: string): AutomationStudioRuntimeTargetOverrideEvidenceValidation {
  return runtime.validateTargetOverrideEvidence(failure, { handles: { element: handle } }, asRecorded(failure, handle));
}

function handleNamed(packet: JsonObject, name: string): string {
  const element = (packet.elements as Array<{ target: string; name?: string }>).find((candidate) => candidate.name === name);
  assert.ok(element, `the packet describes ${name}`);
  return element.target;
}

/** The fields of the domain's resolution these rows read. Core types the target opaquely, and carries it without reading. */
type ResolvedRepair = { selector?: string; accessibleName?: string; handles: Record<string, string>; handleResolution: string };

function resolvedTarget(validation: AutomationStudioRuntimeTargetOverrideEvidenceValidation): ResolvedRepair {
  if (validation.status !== "resolved") assert.fail(`expected a resolved target, got ${JSON.stringify(validation)}`);
  return validation.target as unknown as ResolvedRepair;
}

/** A covered page, its failure packet, one look, and the dismissal that revealed the real controls. */
async function dismissedDialog(): Promise<{ runtime: WebAutomationLlmEvidenceRuntime; failure: JsonObject; explored: Explored[] }> {
  const { runtime } = site(COVERED);
  const failure = await failurePacket(runtime);
  const recovery = exploration(runtime);
  const inspected = await recovery.call("web.recovery.inspect", {});
  await recovery.call("web.recovery.act_safe", { target: handleNamed(inspected, "Close") });
  return { runtime, failure, explored: recovery.explored };
}

test("a repair naming a control only the exploration revealed resolves with the selector behind that handle", async () => {
  const { runtime, explored } = await dismissedDialog();
  const revealed = explored[1]!;
  assert.equal(revealed.toolId, "web.recovery.act_safe");

  const target = resolvedTarget(askAsCore(runtime, explored, `${revealed.evidenceId}:${handleNamed(revealed.packet, "Apply changes")}`));

  assert.equal(target.selector, "#apply");
  assert.equal(target.accessibleName, "Apply changes");
  assert.equal(target.handleResolution, "named");
  // What Core stores is the handle as the packet issued it, never Core's qualifier.
  assert.deepEqual(target.handles, { element: handleNamed(revealed.packet, "Apply changes") });
});

test("a handle no packet issued is still refused, and a packet this domain never issued gets no selector hint", async () => {
  const { runtime, failure, explored } = await dismissedDialog();

  assert.deepEqual(askAsCore(runtime, explored, "explored.2:target.9"), { status: "absent", reason: "handle_not_issued" });
  assert.deepEqual(askFailure(runtime, failure, "target.9"), { status: "absent", reason: "handle_not_issued" });

  const altered = structuredClone(explored[1]!.packet);
  for (const element of altered.elements as Array<{ name?: string }>) element.name = `${element.name} (edited)`;
  const target = resolvedTarget(runtime.validateTargetOverrideEvidence(altered, { handles: { element: "target.1" } }, asRecorded(altered, "target.1")));
  assert.equal(target.selector, undefined);
});

test("a failure packet and explored packets of the same page, with the same element count, never lend each other selector hints", async () => {
  const { runtime, failure, explored } = await dismissedDialog();
  const [looked, revealed] = [explored[0]!, explored[1]!];
  // The collision this row exists for: one location, one count, other controls.
  for (const packet of [looked.packet, revealed.packet]) {
    assert.equal(packet.location, failure.location);
    assert.equal((packet.elements as unknown[]).length, (failure.elements as unknown[]).length);
  }
  assert.notDeepEqual(revealed.packet.elements, looked.packet.elements);

  assert.equal(resolvedTarget(askFailure(runtime, failure, handleNamed(failure, "Close"))).selector, "#close");
  assert.equal(resolvedTarget(askFailure(runtime, failure, handleNamed(failure, "Keep editing"))).selector, "#keep");
  assert.equal(resolvedTarget(askAsCore(runtime, explored, `explored.1:${handleNamed(looked.packet, "Close")}`)).selector, "#close");
  assert.equal(resolvedTarget(askAsCore(runtime, explored, `explored.2:${handleNamed(revealed.packet, "Apply changes")}`)).selector, "#apply");
  assert.equal(resolvedTarget(askAsCore(runtime, explored, `explored.2:${handleNamed(revealed.packet, "Discard changes")}`)).selector, "#discard");
});

test("an exploration of more than eight packets never evicts the failure packet's hints, and drops the oldest explored binding first", async () => {
  const { runtime } = site(COVERED);
  const failure = await failurePacket(runtime);
  const recovery = exploration(runtime);
  for (let index = 1; index <= 9; index += 1) await recovery.call("web.recovery.navigate_in_scope", { url: `https://example.test/results/${index}` });
  assert.equal(recovery.explored.length, 9);

  assert.equal(resolvedTarget(askFailure(runtime, failure, handleNamed(failure, "Close"))).selector, "#close");
  assert.equal(resolvedTarget(askFailure(runtime, failure, handleNamed(failure, "Keep editing"))).selector, "#keep");
  // The oldest explored packet was let go: its repair still resolves, on the
  // fingerprint alone, rather than being refused.
  const oldest = recovery.explored[0]!;
  const dropped = resolvedTarget(askAsCore(runtime, recovery.explored, `${oldest.evidenceId}:${handleNamed(oldest.packet, "Apply result 1")}`));
  assert.equal(dropped.accessibleName, "Apply result 1");
  assert.equal(dropped.selector, undefined);
  for (const [position, entry] of recovery.explored.entries()) {
    if (position === 0) continue;
    const index = position + 1;
    assert.equal(resolvedTarget(askAsCore(runtime, recovery.explored, `${entry.evidenceId}:${handleNamed(entry.packet, `Apply result ${index}`)}`)).selector, `#apply-${index}`, entry.evidenceId);
  }
});

test("a recovery's structure detection is offered while exploring and kept where the runtime resolves extraction handles", async () => {
  const { runtime, commands } = site(COVERED);
  const registry = automationStudioHarnessOptionRegistry({ binding: runtime });
  for (const stage of ["gather", "iterate"] as const) {
    assert.equal(registry.list({ scope: DOMAIN, stage, policy: { ...POLICY, allowExternalSideEffects: false } }).some((option) => option.toolId === "web.recovery.detect_repeating_structure"), true, stage);
  }
  const recovery = exploration(runtime);

  const detected = await recovery.call("web.recovery.detect_repeating_structure", {});

  assert.equal(commands.at(-1), "web.dom.capture_snapshot");
  const resolved = runtime.resolveExtractionHandle({ projectId: SCOPE.projectId, flowId: SCOPE.flowId, handle: String(detected.extraction) });
  assert.equal(resolved.ok, true);
  assert.deepEqual(runtime.resolveExtractionHandle({ projectId: SCOPE.projectId, flowId: "flow.other", handle: String(detected.extraction) }), { ok: false, code: "unknown_handle" });
  // A structure packet names no element a click could be re-pointed at, so a
  // repair that names it is not one this domain issued a target for.
  assert.deepEqual(runtime.validateTargetOverrideEvidence(recovery.explored[0]!.packet, { handles: { element: "target.1" } }, CLICK), { status: "absent", reason: "evidence_unrecognized" });
});
