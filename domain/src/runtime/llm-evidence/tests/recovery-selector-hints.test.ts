// A repair may name a control only the recovery's exploration showed, and it
// must get back the selector hint behind exactly that control.
//
// Core carries the packets an exploration returned into the patch request,
// qualifies a handle taken from one as `explored.N:tM`, and asks this
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
//
// Since t223 what Core carries is the page as the model read it, the compact
// view (`web-llm-page.v3`): its handles are in its `page` text, and the
// structured packet behind it is retained by the domain under that text.

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
import { shownHandle, shownPageLines } from "../page-view/tests/shown-page-lines";

const SCOPE = { projectId: "project.repair", flowId: "flow.repair", runId: "run.repair" };
const CLICK = { nodeId: "node.save", definitionId: "web.output.dom-click" };

/** What the recording addressed, for a row that resolves the control named by `handle`: the same control. */
function asRecorded(packet: JsonObject, handle: string) {
  const line = shownPageLines(packet).find((candidate) => candidate.target === handle);
  const accessibleName = typeof line?.words === "string" ? line.words : undefined;
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

/** `described`: what else the capture says of the control, beside its tag, role and name. */
type Control = { selector: string; name: string; inDialog?: boolean; described?: JsonObject };
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
    interactiveElements: page.controls.map((control) => Object.assign({
      tagName: "button",
      selector: control.selector,
      role: "button",
      name: control.name,
      context: control.inDialog ? { landmark: "dialog" } : {}
    }, control.described))
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
      const execution = await loop.executeTool({ callId: `call.${calls}`, toolId, value });
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
    failedAction: { attemptId: "attempt.1", nodeId: CLICK.nodeId, definitionId: CLICK.definitionId, status: "failed" }
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
  return shownHandle(packet, name);
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
  await recovery.call("web.recovery.press", { target: handleNamed(inspected, "Close"), consequences: [] });
  return { runtime, failure, explored: recovery.explored };
}

test("a repair naming a control only the exploration revealed resolves with the selector behind that handle", async () => {
  const { runtime, explored } = await dismissedDialog();
  const revealed = explored[1]!;
  assert.equal(revealed.toolId, "web.recovery.press");

  const target = resolvedTarget(askAsCore(runtime, explored, `${revealed.evidenceId}:${handleNamed(revealed.packet, "Apply changes")}`));

  assert.equal(target.selector, "#apply");
  assert.equal(target.accessibleName, "Apply changes");
  assert.equal(target.handleResolution, "named");
  // What Core stores is the handle as the packet issued it, never Core's qualifier.
  assert.deepEqual(target.handles, { element: handleNamed(revealed.packet, "Apply changes") });
});

test("a handle no page issued is still refused, and a page this domain never issued is not one it can check", async () => {
  const { runtime, failure, explored } = await dismissedDialog();

  assert.deepEqual(askAsCore(runtime, explored, "explored.2:t9"), { status: "absent", reason: "handle_not_issued" });
  assert.deepEqual(askFailure(runtime, failure, "t9"), { status: "absent", reason: "handle_not_issued" });

  // An edited page names no packet this runtime kept, and the compact view
  // holds no element to check a handle against, so it is refused outright.
  const altered = structuredClone(explored[1]!.packet);
  altered.page = String(altered.page).replace("Apply changes", "Apply changes (edited)");
  assert.deepEqual(runtime.validateTargetOverrideEvidence(altered, { handles: { element: "t1" } }, asRecorded(altered, "t1")), { status: "absent", reason: "evidence_unrecognized" });
});

test("a failure packet and explored packets of the same page, with the same element count, never lend each other selector hints", async () => {
  const { runtime, failure, explored } = await dismissedDialog();
  const [looked, revealed] = [explored[0]!, explored[1]!];
  // The collision this row exists for: one location, one count, other controls.
  for (const packet of [looked.packet, revealed.packet]) {
    assert.equal(packet.location, failure.location);
    assert.equal(shownPageLines(packet).length, shownPageLines(failure).length);
  }
  assert.notDeepEqual(shownPageLines(revealed.packet), shownPageLines(looked.packet));

  assert.equal(resolvedTarget(askFailure(runtime, failure, handleNamed(failure, "Close"))).selector, "#close");
  assert.equal(resolvedTarget(askFailure(runtime, failure, handleNamed(failure, "Keep editing"))).selector, "#keep");
  assert.equal(resolvedTarget(askAsCore(runtime, explored, `explored.1:${handleNamed(looked.packet, "Close")}`)).selector, "#close");
  assert.equal(resolvedTarget(askAsCore(runtime, explored, `explored.2:${handleNamed(revealed.packet, "Apply changes")}`)).selector, "#apply");
  assert.equal(resolvedTarget(askAsCore(runtime, explored, `explored.2:${handleNamed(revealed.packet, "Discard changes")}`)).selector, "#discard");
});

test("an exploration of more than twenty-four pages never evicts the failure page, and drops the oldest explored page first", async () => {
  const { runtime } = site(COVERED);
  const failure = await failurePacket(runtime);
  const recovery = exploration(runtime);
  for (let index = 1; index <= 25; index += 1) await recovery.call("web.recovery.navigate_in_scope", { url: `https://example.test/results/${index}` });
  assert.equal(recovery.explored.length, 25);

  assert.equal(resolvedTarget(askFailure(runtime, failure, handleNamed(failure, "Close"))).selector, "#close");
  assert.equal(resolvedTarget(askFailure(runtime, failure, handleNamed(failure, "Keep editing"))).selector, "#keep");
  // The oldest explored page was let go. The compact view it was read as holds
  // no element to check the handle against, so it is refused, not guessed at.
  const oldest = recovery.explored[0]!;
  assert.deepEqual(askAsCore(runtime, recovery.explored, `${oldest.evidenceId}:${handleNamed(oldest.packet, "Apply result 1")}`), { status: "absent", reason: "evidence_unrecognized" });
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
  assert.deepEqual(runtime.validateTargetOverrideEvidence(recovery.explored[0]!.packet, { handles: { element: "t1" } }, CLICK), { status: "absent", reason: "evidence_unrecognized" });
});

test("a repair naming a handle a recovery search printed resolves with the selector behind it", async () => {
  const { runtime } = site(UNCOVERED);
  const recovery = exploration(runtime);
  await recovery.call("web.recovery.inspect", {});
  const found = await recovery.call("web.recovery.find_on_page", { query: "discard" });
  assert.equal(found.schemaVersion, "web-llm-find.v1");
  const handle = /^(t\d+) button "Discard changes"/mu.exec(String(found.found))?.[1];
  assert.ok(handle, String(found.found));
  const searched = recovery.explored.at(-1)!;
  const recorded = { ...CLICK, recordedTarget: { element: { tagName: "button", role: "button", accessibleName: "Discard changes" } } };
  const target = resolvedTarget(runtime.validateTargetOverrideEvidence(searched.packet, { handles: { element: handle } }, recorded));
  assert.equal(target.selector, "#discard");
  // An edited search result is not one this runtime kept.
  const edited = { ...searched.packet, found: `${String(searched.packet.found)}\n(edited)` };
  assert.deepEqual(runtime.validateTargetOverrideEvidence(edited, { handles: { element: handle } }, recorded), { status: "absent", reason: "evidence_unrecognized" });
});

// A step a repair writes (a handler's body, a unit's replacement, steps
// inserted before a node) names its control by a handle from the same
// packets, and Core hands back the one packet the step's handles came from as
// `handleEvidence` (t429, Core `recovery/annotation/step-evidence-resolution.ts`).
// The step resolves from that packet alone, through the build's own
// resolution: the selector and the full identity a built step is saved with,
// or a refusal. It never resolves from the build's views, and a handle that
// resolves to nothing is refused, never saved as written.

/** Core's question about one repair step: a press of `handle`, from `packet`. */
function askStep(runtime: WebAutomationLlmEvidenceRuntime, packet: JsonObject | undefined, handle: string) {
  return runtime.resolvePlanNodeParameters({
    projectId: SCOPE.projectId,
    flowId: SCOPE.flowId,
    nodeDefinitionId: CLICK.definitionId,
    parameters: { target: { handle } },
    declaredConsequences: [],
    permission: async () => ({ permitted: true as const }),
    handleEvidence: packet
  });
}

type ResolvedStep = { selector?: string; element?: { tagName?: string; accessibleName?: string; visibleText?: string; role?: string } };

function resolvedStep(answer: Awaited<ReturnType<typeof askStep>>): ResolvedStep {
  if (answer.status !== "resolved") assert.fail(`expected a resolved step, got ${JSON.stringify(answer)}`);
  return answer.parameters as ResolvedStep;
}

test("a repair's step naming a failure-packet handle resolves to its control and the identity a built step is saved with", async () => {
  const { runtime, failure } = await dismissedDialog();

  const step = resolvedStep(await askStep(runtime, failure, handleNamed(failure, "Keep editing")));

  assert.equal(step.selector, "#keep");
  assert.equal(step.element?.tagName, "button");
  assert.equal(step.element?.role, "button");
  assert.equal(step.element?.accessibleName ?? step.element?.visibleText, "Keep editing");
  assert.doesNotMatch(JSON.stringify(step), /"handles?":/u);
});

test("a repair's step naming an explored handle resolves from that packet alone, never another with the same numbers", async () => {
  const { runtime, failure, explored } = await dismissedDialog();
  const revealed = explored[1]!.packet;
  const handle = handleNamed(revealed, "Apply changes");

  assert.equal(resolvedStep(await askStep(runtime, revealed, handle)).selector, "#apply");
  // The same number in the failure packet is another control, and resolves to it.
  assert.equal(resolvedStep(await askStep(runtime, failure, handle)).selector, "#close");
  // Without its packet the step is a build's, and this build was shown nothing.
  assert.deepEqual(await askStep(runtime, undefined, handle), { status: "refused", issueCodes: ["web.handle.unknown", "web.handle.unknown:target"] });
});

test("a repair's step naming a handle its packet never gave, or a packet this runtime never kept, is refused", async () => {
  const { runtime, failure } = await dismissedDialog();

  assert.deepEqual(await askStep(runtime, failure, "t99"), { status: "refused", issueCodes: ["web.handle.unknown", "web.handle.unknown:target"] });
  const altered = { ...failure, page: `${String(failure.page)}\n(edited)` };
  assert.deepEqual(await askStep(runtime, altered, handleNamed(failure, "Close")), { status: "refused", issueCodes: ["web.handle.unknown"] });
});

test("a repair's step naming a control known by too little to be found again is refused, as a build's is", async () => {
  const { runtime } = site({ path: "/settings", dialog: false, controls: [{ selector: "#apply", name: "Apply changes" }, { selector: "#icon", name: "" }] });
  const failure = await failurePacket(runtime);
  const wordless = shownPageLines(failure).find((line) => line.words === undefined || line.words === "")?.target;
  assert.ok(wordless, JSON.stringify(shownPageLines(failure)));

  const answer = await askStep(runtime, failure, String(wordless));

  assert.equal(answer.status, "refused");
  assert.ok(answer.status === "refused" && answer.issueCodes.includes("web.handle.unidentifiable"), JSON.stringify(answer));
  // The worded control beside it resolves.
  assert.equal(resolvedStep(await askStep(runtime, failure, handleNamed(failure, "Apply changes"))).selector, "#apply");
});

test("a repair's step carries every signal the packet holds for its control, through the one builder a built step uses", async () => {
  const quantity: Control = {
    selector: "#qty-4f1",
    name: "",
    described: {
      tagName: "input", role: "spinbutton", inputType: "number", label: "Quantity", id: "qty-4f1", value: "2",
      attributes: { id: "qty-4f1", name: "quantity", class: "qty-box field", type: "number", "data-testid": "cart-qty", value: "2" }
    }
  };
  const { runtime } = site({ path: "/cart", dialog: false, controls: [{ selector: "#apply", name: "Apply changes" }, quantity] });
  const failure = await failurePacket(runtime);
  const handle = shownHandle(failure, "Quantity");

  const step = (await runtime.resolvePlanNodeParameters({
    projectId: SCOPE.projectId, flowId: SCOPE.flowId, nodeDefinitionId: "web.output.dom-type", parameters: { target: { handle }, text: "3" }, declaredConsequences: [],
    permission: async () => ({ permitted: true as const }),
    handleEvidence: failure
  }));
  if (step.status !== "resolved") assert.fail(JSON.stringify(step));
  const element = step.parameters.element as JsonObject;
  assert.equal(step.parameters.selector, "#qty-4f1");
  assert.equal(element.tagName, "input");
  assert.equal(element.label, "Quantity");
  assert.equal(element.name, "quantity");
  assert.equal(element.testId, "cart-qty");
  assert.deepEqual(element.classNames, ["qty-box", "field"]);
  // What the field holds is never part of who it is.
  assert.doesNotMatch(JSON.stringify(element), /"value"/u);
});
