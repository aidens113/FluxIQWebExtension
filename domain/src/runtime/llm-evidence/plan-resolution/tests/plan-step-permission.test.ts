// The permission gate on the steps a build writes into a Flow.
//
// The hole this exists for was measured live (`run-mud4ywy4-45c2002f`): a
// nine-node Flow that filled a scheduler's composer and submitted it -- a
// `delete` act -- was authored and replayed under a permission gate that
// permitted nothing, with `permissionRequest: null` and
// `instructedConsequences: []`. Nobody was asked anything, because the web
// domain never declared or called the per-step check Core hands it.
//
// These rows drive the real seam with no provider: Core's own
// `resolveAutomationStudioFlowBootstrapPlanParameters` over a plan, with a real
// `AutomationStudioActionPermissionGate` under real permitted consequences, against the real
// web runtime that issued the handles. The handles are issued by running the
// snapshot node through the library verb, because that is now the only way a
// build looks at a page at all. What they hold:
//
// - a step that presses and says nothing about what pressing would do never
//   builds, so the measured run cannot happen again by silence;
// - a step that says it would publish, under a gate that permits nothing,
//   raises the request a person answers -- naming the classes, and naming the
//   control in the words the model was shown;
// - the same step builds when the run permits the class, and when the person's
//   own instruction asked for it, which is the standing rule that FluxIQ is
//   capable by default and the instruction is the authority;
// - a press that says it causes nothing lasting builds with nobody asked, so
//   closing a banner or applying a filter needs no permission -- and Core still
//   hears the empty answer and keeps it, which is what makes the declaration
//   readable rather than deducible;
// - a step that only reads the page is never put to a person at all, whatever
//   class the model wrote on it. That is the fault of `run-mueozmp8-348a2057`:
//   a build told to collect a page of products into a table declared
//   `create_new` for the node that reads the list, and stopped to ask a person
//   for permission to read the page its instruction told it to read;
// - the declaration never reaches the node the Flow runs;
// - it is read off the node's own `consequences` field, which is where the
//   draft a build accrues writes it and where the Flow script's reserved step
//   word lands it, and off the step's parameters as a fallback.
//
// And where the step's control sits (t751 G): a step's declaration carries the
// same opaque spot tokens an exploration press declares (`../../control-spot/`
// `webTargetSpot`), taken on the view its target handle was shown in, so Core
// can admit each lasting step of a submitted Flow by the witness rule it holds a
// press to. Those rows use a generic notebook: a complete list of notes, each
// row holding a Star toggle about its note.

import assert from "node:assert/strict";
import test from "node:test";
import {
  AutomationStudioActionPermissionGate,
  resolveAutomationStudioFlowBootstrapPlanParameters,
  type AutomationStudioActionDeclaration,
  type AutomationStudioActionPermissionCheck,
  type AutomationStudioInstructedConsequence
} from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { webResetResource, webTargetSpot } from "../../control-spot";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../../sanitize";
import { createWebLlmExtractionHandles } from "../../structure";
import { createWebLlmTargetPackets, resolveWebPlanNode, webPlanStepPermission } from "..";

const TYPE_NODE = webAutomationOutputNodeId("web.dom.type");
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const SNAPSHOT_NODE = webAutomationOutputNodeId("web.dom.capture_snapshot");
/** A step that only reads: it waits for the page to say something and changes nothing. */
const READ_NODE = webAutomationOutputNodeId("web.dom.wait_for_text");

const COMPOSER_URL = "https://scheduler.test/compose";
const body: JsonObject = { tagName: "textarea", selector: "#body", accessibleName: "Post body", attributes: { name: "body" } };
const schedule: JsonObject = { tagName: "button", selector: "#schedule", visibleText: "Schedule post" };

function runtimeOver(elements: JsonObject[], calls?: string[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      calls?.push(command.actionType);
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: { url: COMPOSER_URL, title: "Compose", interactiveElements: elements } } };
    },
  });
}

/**
 * The plan a build writes for "fill the composer and schedule it".
 *
 * `declared` is the press step's own `consequences` field -- where a draft
 * accrued from run-node calls writes it, and where the Flow script's reserved
 * step word lands. A row that is about the parameter fallback puts it in
 * `clickParameters` instead and leaves this out.
 */
function composerPlan(clickParameters: JsonObject, declared?: string[]) {
  // Written by name rather than spread in conditionally: a step that declared
  // nothing and one that declared nothing lasting are different answers, and
  // the field carrying them is the one this whole file is about.
  const post: { key: string; definitionId: string; definitionVersion: string; parameters: JsonObject; consequences?: string[] } = {
    key: "post", definitionId: CLICK_NODE, definitionVersion: "1.0.0", parameters: clickParameters
  };
  if (declared) post.consequences = declared;
  return {
    schemaVersion: "0.1" as const,
    router: { name: "Router", rules: [], fallback: { kind: "fail" as const } },
    subflows: [{
      key: "main",
      name: "Main",
      role: "primary" as const,
      nodes: [
        { key: "write", definitionId: TYPE_NODE, definitionVersion: "1.0.0", parameters: { target: { handle: "t1" }, text: "Hello" } },
        post
      ],
      edges: []
    }]
  };
}

/** A build that has looked at the composer, with the gate shown what the model was shown. */
async function explored(gate: AutomationStudioActionPermissionGate, calls?: string[]) {
  const runtime = runtimeOver([body, schedule], calls);
  const shown = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT_NODE, parameters: {}, consequences: [] } });
  gate.observe(shown);
  return runtime;
}

function gateHolding(permitted: string[], instructed: AutomationStudioInstructedConsequence[] = []) {
  return new AutomationStudioActionPermissionGate({
    permittedConsequences: permitted,
    stage: "authoring",
    instructionIds: ["instruction.one"],
    instructed
  });
}

async function resolveUnder(gate: AutomationStudioActionPermissionGate, runtime: WebAutomationLlmEvidenceRuntime, clickParameters: JsonObject, declared?: string[]) {
  return await resolveAutomationStudioFlowBootstrapPlanParameters({
    plan: composerPlan(clickParameters, declared),
    projectId: "project.one",
    flowId: "flow.one",
    binding: runtime,
    handlesIssued: true,
    permissionFor: (step) => gate.checkFor({ kind: "flow_step", id: step.definitionId, ref: step.ref })
  });
}

const PRESS_SCHEDULE: JsonObject = { target: { handle: "t2" } };

async function resolveSubmittingType(gate: AutomationStudioActionPermissionGate, submit: boolean, declared?: string[], calls?: string[]) {
  const runtime = await explored(gate, calls);
  const plan = composerPlan({ target: { handle: "t1" }, text: "Hello", submit }, declared);
  plan.subflows[0]!.nodes[1]!.definitionId = TYPE_NODE;
  return await resolveAutomationStudioFlowBootstrapPlanParameters({
    plan, projectId: "project.one", flowId: "flow.one", binding: runtime,
    handlesIssued: true,
    permissionFor: (step) => gate.checkFor({ kind: "flow_step", id: step.definitionId, ref: step.ref })
  });
}

test("submitting type without consequences is refused before any submission; unsent typing remains compatible", async () => {
  const gate = gateHolding([]);
  const calls: string[] = [];
  const submitted = await resolveSubmittingType(gate, true, undefined, calls);
  assert.equal(submitted.ok, false);
  assert.equal(submitted.ok ? undefined : submitted.issues[0]?.code, "web.step.consequences_undeclared");
  assert.deepEqual(calls, ["web.dom.capture_snapshot"], "authoring refusal dispatched no type or submit command");
  const unsent = await resolveSubmittingType(gateHolding([]), false);
  assert.equal(unsent.ok, true);
});

test("submitting type reaches the same real Core gate for declared consequences", async () => {
  const denied = gateHolding([]);
  const rejected = await resolveSubmittingType(denied, true, ["delete"]);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.ok ? undefined : rejected.issues[0]?.code, "bootstrap.step_permission_required");
  assert.deepEqual(denied.request?.missing, ["delete"]);
  assert.equal(denied.request?.control.name, "Post body");
  assert.equal((await resolveSubmittingType(gateHolding(["delete"]), true, ["delete"])).ok, true);
  assert.equal((await resolveSubmittingType(gateHolding([]), true, [])).ok, true);
});

test("a bound target uses its concrete observed fallback for permission but keeps only the dynamic target in the accepted plan", async () => {
  const target = { $state: { path: "chosenControl", fallback: { handle: "t2" } } };
  const denied = gateHolding([]);
  const refusal = await resolveUnder(denied, await explored(denied), { target }, ["delete"]);
  assert.equal(refusal.ok, false);
  assert.equal(denied.request?.control.name, "Schedule post");
  assert.equal(denied.request?.control.kind, "button");
  assert.deepEqual(denied.request?.missing, ["delete"]);
  const allowed = gateHolding(["delete"]);
  const accepted = await resolveUnder(allowed, await explored(allowed), { target }, ["delete"]);
  assert.equal(accepted.ok, true);
  assert.equal(allowed.request, undefined);
  if (!accepted.ok) return;
  const parameters = accepted.plan.subflows[0]!.nodes[1]!.parameters;
  assert.ok(parameters);
  assert.equal("selector" in parameters, false);
  assert.equal("element" in parameters, false);
  assert.equal(JSON.stringify(parameters).includes('"handle"'), false);
  assert.deepEqual(parameters.target, { $state: { path: "chosenControl", fallback: {
    selector: "#schedule", element: { tagName: "button", visibleText: "Schedule post", selector: "#schedule" }
  } } });
});

test("a step that presses and says nothing about it never builds", async () => {
  const gate = gateHolding([]);
  const resolved = await resolveUnder(gate, await explored(gate), PRESS_SCHEDULE);

  // Exactly what the live run did build, and the reason it could: nothing the
  // model wrote said what pressing "Schedule post" would do.
  assert.equal(resolved.ok, false);
  assert.deepEqual(resolved.ok === false ? resolved.issues.map((issue) => issue.code) : [], [
    "web.step.consequences_undeclared",
    "web.step.expected.consequences_classes_or_none"
  ]);
  assert.equal(resolved.ok === false ? resolved.issues[0]?.path : undefined, "plan.subflows.0.nodes.1.parameters");
});

test("a step that says it would publish, under a gate that permits nothing, asks the person", async () => {
  const gate = gateHolding([]);
  const resolved = await resolveUnder(gate, await explored(gate), PRESS_SCHEDULE, ["delete"]);

  assert.equal(resolved.ok, false);
  const issue = resolved.ok === false ? resolved.issues[0] : undefined;
  assert.equal(issue?.code, "bootstrap.step_permission_required");
  assert.match(issue?.message ?? "", /delete/u);

  // The request a person answers, with the control named in the words the
  // evidence carried and the class a later permission must add.
  const request = gate.request;
  assert.equal(request?.missing.join(","), "delete");
  assert.equal(request?.action.kind, "flow_step");
  assert.equal(request?.action.ref, "main.post");
  assert.equal(request?.control.name, "Schedule post");
  assert.equal(request?.control.kind, "button");
  assert.equal(request?.sentence, "The Flow would press \"Schedule post\" (button) each time it runs. That would delete or remove something, and that always needs your permission, even when your instruction asks for it.");
  // The issue names the request the person is answering, so the record joins them.
  assert.equal(issue?.message.includes(request?.requestId ?? "-"), true);
});

test("a permission that holds the class builds it, and an instruction that asked for it does not", async () => {
  const permitting = gateHolding(["delete"]);
  const byPermit = await resolveUnder(permitting, await explored(permitting), PRESS_SCHEDULE, ["delete"]);
  assert.equal(byPermit.ok, true);
  assert.equal(permitting.request, undefined);

  // Deleting needs a person's permission every time, even when the instruction
  // asked for it (the user's rule, restored 2026-09-30); the instruction's words
  // travel with the question.
  const instructed = gateHolding([], [{ consequence: "delete", instructionId: "instruction.one", instructionDigest: `sha256:${"a".repeat(64)}`, quote: "delete the post" }]);
  const byInstruction = await resolveUnder(instructed, await explored(instructed), PRESS_SCHEDULE, ["delete"]);
  assert.equal(byInstruction.ok, false);
  assert.equal(instructed.request?.missing.join(","), "delete");
  assert.equal(instructed.request?.authority.instructed[0]?.consequence, "delete");
});

test("a press that causes nothing lasting builds with nobody asked, and the declaration never reaches the Flow", async () => {
  const gate = gateHolding([]);
  // `[]` on the node's own field is exactly what a draft accrued from run-node
  // calls writes for a press the model declared `consequences: []` on, through
  // `authoring/consequences.ts`. It is a statement, not a silence.
  const resolved = await resolveUnder(gate, await explored(gate), PRESS_SCHEDULE, []);

  assert.equal(resolved.ok, true);
  assert.equal(gate.request, undefined);
  // And Core heard it. Until 2026-09-22 this domain returned "no consequence"
  // without calling the check, so an empty declaration reached nobody and the
  // only record a permitted press left was that it had not been refused --
  // which is why four live builds could not say what any press had declared.
  assert.deepEqual(gate.declarations.map((entry) => ({ ref: entry.action.ref, name: entry.control.name, consequences: entry.consequences, permitted: entry.permitted })), [
    { ref: "main.post", name: "Schedule post", consequences: [], permitted: true }
  ]);
  const node = resolved.ok ? resolved.plan.subflows[0]?.nodes[1] : undefined;
  assert.equal(node?.parameters && "consequences" in node.parameters, false, "the declaration is read by Core, never run by the Flow");
  assert.equal(node?.parameters?.selector, "#schedule");
  // The step beside it only enters text, which is not a consequence and is never asked about.
  assert.equal(resolved.ok && resolved.plan.subflows[0]?.nodes[0]?.parameters?.text, "Hello");
});

test("a step that only reads builds with nobody asked, whatever class was written on it", async () => {
  const gate = gateHolding([]);
  const runtime = await explored(gate);
  const resolved = await resolveAutomationStudioFlowBootstrapPlanParameters({
    plan: {
      schemaVersion: "0.1" as const,
      router: { name: "Router", rules: [], fallback: { kind: "fail" as const } },
      subflows: [{
        key: "main",
        name: "Main",
        role: "primary" as const,
        nodes: [{ key: "read", definitionId: READ_NODE, definitionVersion: "1.0.0", parameters: { text: "Results" }, consequences: ["create_new"] }],
        edges: []
      }]
    },
    projectId: "project.one",
    flowId: "flow.one",
    binding: runtime,
    handlesIssued: true,
    permissionFor: (step) => gate.checkFor({ kind: "flow_step", id: step.definitionId, ref: step.ref })
  });

  // The Flow this step belongs to is the one whose instruction asked for the
  // reading. Waiting for text, asserting, extracting a list: none of them
  // leaves anything behind, so none of them is a question for anybody.
  assert.equal(resolved.ok, true);
  assert.equal(gate.request, undefined);
  assert.deepEqual(
    gate.declarations.map((entry) => ({ ref: entry.action.ref, effect: entry.action.effect, consequences: entry.consequences, disregarded: entry.disregarded, permitted: entry.permitted })),
    [{ ref: "main.read", effect: "observe", consequences: [], disregarded: ["create_new"], permitted: true }]
  );
  const node = resolved.ok ? resolved.plan.subflows[0]?.nodes[0] : undefined;
  assert.equal(node?.parameters && "consequences" in node.parameters, false, "the declaration is read by Core, never run by the Flow");
});

test("a declaration Core cannot read is not a declaration, and the step is refused", async () => {
  const gate = gateHolding([]);
  const resolved = await resolveUnder(gate, await explored(gate), PRESS_SCHEDULE, ["publish it"]);

  assert.equal(resolved.ok, false);
  assert.equal(resolved.ok === false ? resolved.issues[0]?.code : undefined, "bootstrap.step_consequences_invalid");
  assert.equal(gate.request, undefined);
});

test("with no build behind the resolution there is nobody to ask, and a lasting step is still not built", async () => {
  const runtime = runtimeOver([body, schedule]);
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT_NODE, parameters: {}, consequences: [] } });
  const resolved = await resolveAutomationStudioFlowBootstrapPlanParameters({
    plan: composerPlan(PRESS_SCHEDULE, ["move_money"]),
    projectId: "project.one",
    flowId: "flow.one",
    binding: runtime,
    handlesIssued: true
  });

  assert.equal(resolved.ok, false);
  const issue = resolved.ok === false ? resolved.issues[0] : undefined;
  assert.equal(issue?.code, "bootstrap.step_permission_required");
  assert.equal(issue?.message, "A step would do something lasting the run is not permitted (move_money); nobody was there to ask.");
});

test("a declaration written onto the step's parameters is read, and is still taken off before the Flow runs", async () => {
  // The fallback carrier. The node's own field is where the draft and the Flow
  // script's reserved step word put it, but a caller that already has it on the
  // parameters is read too -- and either way it is a statement about the step
  // and never a parameter the registry sees.
  const gate = gateHolding([]);
  const resolved = await resolveUnder(gate, await explored(gate), { ...PRESS_SCHEDULE, consequences: "delete" });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.ok === false ? resolved.issues[0]?.code : undefined, "bootstrap.step_permission_required");
  assert.equal(gate.request?.control.name, "Schedule post");

  // And when the class is permitted it builds, with the declaration gone.
  const permitting = gateHolding(["delete"]);
  const built = await resolveUnder(permitting, await explored(permitting), { ...PRESS_SCHEDULE, consequences: "delete" });
  assert.equal(built.ok, true);
  const node = built.ok ? built.plan.subflows[0]?.nodes[1] : undefined;
  assert.equal(node?.parameters && "consequences" in node.parameters, false);
  assert.equal(node?.parameters?.selector, "#schedule");
});

test("the node's own field wins over anything left on the parameters, and the parameter is still removed", async () => {
  // Two statements about one step is a contradiction, and the node's field is
  // the one the authoring readers write: it is what the draft and the script's
  // reserved word produce. Reading the parameter instead would let a stale
  // value decide what a person is asked.
  const gate = gateHolding([]);
  const resolved = await resolveUnder(gate, await explored(gate), { ...PRESS_SCHEDULE, consequences: "move_money" }, []);

  assert.equal(resolved.ok, true, "the node said it causes nothing lasting");
  assert.equal(gate.request, undefined);
  const node = resolved.ok ? resolved.plan.subflows[0]?.nodes[1] : undefined;
  assert.equal(node?.parameters && "consequences" in node.parameters, false);
});

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const SPOT_KEYS = ["item", "dialog", "subject", "page", "scope", "resource", "place", "state"] as const;

/** A notebook page: a heading, then a complete list whose every row holds a Star toggle about its note; `starred` names the row already starred. */
function notebook(starred?: number): WebLlmSnapshotBinding {
  const notes = ["Barley stew", "Pea soup"];
  const elements: JsonObject[] = [
    { tagName: "h1", selector: "h1", visibleText: "My notes", context: { subject: "My notes" } },
    { tagName: "div", role: "list", selector: "#notes" }
  ];
  notes.forEach((note, index) => {
    const row = elements.length;
    elements.push({ tagName: "div", role: "listitem", selector: `#note-${index}`, parent: 1, context: { record: { text: `${note} 2 days ago` } }, attributes: { "aria-setsize": String(notes.length), "aria-posinset": String(index + 1) } });
    elements.push({ tagName: "div", role: "button", selector: `#star-${index}`, parent: row, accessibleName: "Star", attributes: { "aria-pressed": String(index === starred) }, context: { record: { text: `${note} 2 days ago` }, subject: note } });
  });
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://notebook.test/notes", title: "Notebook", interactiveElements: elements });
  binding.resetResource = webResetResource("session", "tab:1:frame:0")!;
  return binding;
}

function handleOf(binding: WebLlmSnapshotBinding, selector: string): string {
  const handle = [...binding.selectors].find(([, written]) => written === selector)?.[0];
  assert.ok(handle, `no element at ${selector}`);
  return handle;
}

/** A permission check that permits everything and keeps each declaration's control. */
function recordingCheck(): { check: AutomationStudioActionPermissionCheck; controls: AutomationStudioActionDeclaration["control"][] } {
  const controls: AutomationStudioActionDeclaration["control"][] = [];
  const check: AutomationStudioActionPermissionCheck = async (declaration) => {
    controls.push(declaration.control);
    return { permitted: true, missing: [], requestId: null };
  };
  return { controls, check };
}

function spotOf(control: object | undefined): Record<string, unknown> {
  const fields = (control ?? {}) as Record<string, unknown>;
  return Object.fromEntries(SPOT_KEYS.filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]));
}

async function pressDeclaration(targets: ReturnType<typeof createWebLlmTargetPackets>, parameters: JsonObject, gatedByCaller?: true) {
  const { check, controls } = recordingCheck();
  const input = { ...SCOPE, nodeDefinitionId: CLICK_NODE, parameters, permission: check, declaredConsequences: [] };
  const outcome = await resolveWebPlanNode(gatedByCaller ? { ...input, gatedByCaller } : input, { targets, extractions: createWebLlmExtractionHandles() });
  return { outcome, controls };
}

test("a step pressing a row's stateful control declares the spot webTargetSpot gives for that handle on its view", async () => {
  const binding = notebook();
  const handle = handleOf(binding, "#star-1");
  const expected = webTargetSpot(binding, handle);
  for (const key of ["item", "subject", "page", "scope", "resource", "place", "state"] as const) assert.ok(expected[key], `the fixture gives the control a ${key}`);
  const targets = createWebLlmTargetPackets();
  targets.remember(SCOPE, binding);
  const { outcome, controls } = await pressDeclaration(targets, { target: { handle } });
  assert.equal(outcome.resolution.status, "resolved");
  assert.equal(controls.length, 1);
  assert.deepEqual(spotOf(controls[0]), expected);
  // Opaque: none of the row's words reach Core, and the spot never reaches the Flow's node.
  assert.doesNotMatch(JSON.stringify(spotOf(controls[0])), /Pea|Barley|notes/u);
  assert.doesNotMatch(JSON.stringify(outcome.resolution), /"spot"|"place"|"state"/u);
});

test("every handle the store keeps carries exactly the spot webTargetSpot gives it on its capture", () => {
  const binding = notebook(0);
  const targets = createWebLlmTargetPackets();
  targets.remember(SCOPE, binding);
  for (const handle of binding.selectors.keys()) {
    const resolution = targets.resolve(SCOPE, handle, binding.evidence.location);
    assert.ok(resolution.ok, handle);
    assert.deepEqual(resolution.spot ?? {}, webTargetSpot(binding, handle), handle);
  }
});

test("a step on a control exploration pressed declares the spot of the view the press was made from", () => {
  const before = notebook();
  const after = notebook(1);
  const handle = handleOf(before, "#star-1");
  assert.notEqual(webTargetSpot(before, handle).state, webTargetSpot(after, handle).state, "the press changed the control's state");
  const targets = createWebLlmTargetPackets();
  targets.remember(SCOPE, before);
  targets.acted(SCOPE, handle, before, after);
  targets.remember(SCOPE, after);
  const candidate = targets.resolve(SCOPE, handle, undefined, "view_history");
  assert.ok(candidate.ok);
  assert.deepEqual(candidate.spot, webTargetSpot(before, handle));
  // Exploration acts on the page as it now is, so its own resolution keeps the newest view's.
  const current = targets.resolve(SCOPE, handle, undefined);
  assert.ok(current.ok);
  assert.deepEqual(current.spot, webTargetSpot(after, handle));
});

test("a step with no target handle declares no spot", async () => {
  const targets = createWebLlmTargetPackets();
  targets.remember(SCOPE, notebook());
  const { controls } = await pressDeclaration(targets, { selector: "#star-0" });
  assert.equal(controls.length, 1);
  assert.deepEqual(spotOf(controls[0]), {});
});

test("exploration's own declaration is unchanged: a call its caller gated is never declared again here", async () => {
  const binding = notebook();
  const targets = createWebLlmTargetPackets();
  targets.remember(SCOPE, binding);
  const { outcome, controls } = await pressDeclaration(targets, { target: { handle: handleOf(binding, "#star-1") } }, true);
  assert.equal(outcome.resolution.status, "resolved");
  assert.deepEqual(controls, []);
});


test("plan permission projects the trusted parameter-sensitive floor without inventing prompts", async () => {
  for (const [actionType, parameters, effectClass] of [
    ["web.dom.click", {}, "commit"], ["web.dom.type", {}, "state"],
    ["web.dom.type", { submit: false }, "state"], ["web.dom.type", { submit: true }, "commit"],
    ["web.dom.type", { submit: { $state: { path: "send", fallback: false } } }, "commit"],
    ["web.browser.download", {}, "commit"], ["web.browser.tab", {}, "commit"], ["web.dom.next_page", {}, "commit"]
  ] as const) {
    const declarations: AutomationStudioActionDeclaration[] = [];
    const answer = await webPlanStepPermission({
      nodeDefinitionId: webAutomationOutputNodeId(actionType), parameters, declared: [],
      check: async (declaration) => {
        declarations.push(declaration);
        return { permitted: true };
      }
    });
    assert.equal(answer.kind, "clear");
    assert.equal(declarations[0]?.actionEffect?.effectClass, effectClass);
    assert.deepEqual(declarations[0]?.actionEffect?.permissionConsequences, []);
    assert.equal(declarations[0]?.actionEffect?.repeatSafe, effectClass === "state" ? true : undefined);
    assert.deepEqual(declarations[0]?.consequences, []);
  }
  for (const actionType of ["web.browser.download", "web.browser.tab", "web.dom.next_page"] as const) {
    let asked = false;
    assert.deepEqual(await webPlanStepPermission({ nodeDefinitionId: webAutomationOutputNodeId(actionType), parameters: {}, declared: undefined,
      check: async () => {
        asked = true;
        return { permitted: true };
      }
    }), { kind: "clear" });
    assert.equal(asked, false);
  }
});
