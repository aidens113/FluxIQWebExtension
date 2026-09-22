// The permission gate on the steps a build writes into a Flow.
//
// The hole this exists for was measured live (`run-mud4ywy4-45c2002f`): a
// nine-node Flow that filled a scheduler's composer and submitted it -- a
// `send_or_publish` act -- was authored and replayed under a grant that
// permitted nothing, with `permissionRequest: null` and
// `instructedConsequences: []`. Nobody was asked anything, because the web
// domain never declared or called the per-step check Core hands it.
//
// These rows drive the real seam with no provider: Core's own
// `resolveAutomationStudioFlowBootstrapPlanParameters` over a plan, with a real
// `AutomationStudioActionPermissionGate` under a real grant, against the real
// web runtime that issued the handles. What they hold:
//
// - a step that presses and says nothing about what pressing would do never
//   builds, so the measured run cannot happen again by silence;
// - a step that says it would publish, under a grant that permits nothing,
//   raises the request a person answers -- naming the classes, and naming the
//   control in the words the model was shown;
// - the same step builds when a grant holds the class, and when the person's
//   own instruction asked for it, which is the standing rule that FluxIQ is
//   capable by default and the instruction is the authority;
// - a press that says it causes nothing lasting builds with nobody asked, so
//   closing a banner or applying a filter needs no permission;
// - the declaration never reaches the node the Flow runs.

import assert from "node:assert/strict";
import test from "node:test";
import {
  AutomationStudioActionPermissionGate,
  resolveAutomationStudioFlowBootstrapPlanParameters,
  type AutomationStudioInstructedConsequence
} from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_INSPECT_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";

const TYPE_NODE = webAutomationOutputNodeId("web.dom.type");
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");

const COMPOSER_URL = "https://scheduler.test/compose";
const body: JsonObject = { tagName: "textarea", selector: "#body", accessibleName: "Post body", attributes: { name: "body" } };
const schedule: JsonObject = { tagName: "button", selector: "#schedule", visibleText: "Schedule post" };

function runtimeOver(elements: JsonObject[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: { url: COMPOSER_URL, title: "Compose", interactiveElements: elements } } };
    },
  });
}

/** The plan a build writes for "fill the composer and schedule it". */
function composerPlan(clickParameters: JsonObject) {
  return {
    schemaVersion: "0.1" as const,
    router: { name: "Router", rules: [], fallback: { kind: "fail" as const } },
    subflows: [{
      key: "main",
      name: "Main",
      role: "primary" as const,
      nodes: [
        { key: "write", definitionId: TYPE_NODE, definitionVersion: "1.0.0", parameters: { target: { handle: "target.1" }, text: "Hello" } },
        { key: "post", definitionId: CLICK_NODE, definitionVersion: "1.0.0", parameters: clickParameters }
      ],
      edges: []
    }]
  };
}

/** A build that has looked at the composer, with the gate shown what the model was shown. */
async function explored(gate: AutomationStudioActionPermissionGate) {
  const runtime = runtimeOver([body, schedule]);
  const shown = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.inspect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
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

async function resolveUnder(gate: AutomationStudioActionPermissionGate, runtime: WebAutomationLlmEvidenceRuntime, clickParameters: JsonObject) {
  return await resolveAutomationStudioFlowBootstrapPlanParameters({
    plan: composerPlan(clickParameters),
    projectId: "project.one",
    flowId: "flow.one",
    binding: runtime,
    handlesIssued: true,
    permissionFor: (step) => gate.checkFor({ kind: "flow_step", id: step.definitionId, ref: step.ref })
  });
}

const PRESS_SCHEDULE: JsonObject = { target: { handle: "target.2" } };

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

test("a step that says it would publish, under a grant that permits nothing, asks the person", async () => {
  const gate = gateHolding([]);
  const resolved = await resolveUnder(gate, await explored(gate), { ...PRESS_SCHEDULE, consequences: "send_or_publish" });

  assert.equal(resolved.ok, false);
  const issue = resolved.ok === false ? resolved.issues[0] : undefined;
  assert.equal(issue?.code, "bootstrap.step_permission_required");
  assert.match(issue?.message ?? "", /send_or_publish/u);

  // The request a person answers, with the control named in the words the
  // evidence carried and the class a later grant must add.
  const request = gate.request;
  assert.equal(request?.missing.join(","), "send_or_publish");
  assert.equal(request?.action.kind, "flow_step");
  assert.equal(request?.action.ref, "main.post");
  assert.equal(request?.control.name, "Schedule post");
  assert.equal(request?.control.kind, "button");
  assert.equal(request?.sentence, "The Flow its instruction describes would press \"Schedule post\" (button) each time it runs, which would send or publish something that others will receive or see. Neither its instruction nor a grant allows that, so the build stopped to ask.");
  // The issue names the request the person is answering, so the record joins them.
  assert.equal(issue?.message.includes(request?.requestId ?? "-"), true);
});

test("a grant that holds the class builds it, and so does an instruction that asked for it", async () => {
  const granted = gateHolding(["send_or_publish"]);
  const byGrant = await resolveUnder(granted, await explored(granted), { ...PRESS_SCHEDULE, consequences: "send_or_publish" });
  assert.equal(byGrant.ok, true);
  assert.equal(granted.request, undefined);

  // FluxIQ is capable by default and the person's instruction is the authority.
  const instructed = gateHolding([], [{ consequence: "send_or_publish", instructionId: "instruction.one", instructionDigest: `sha256:${"a".repeat(64)}`, quote: "schedule the post" }]);
  const byInstruction = await resolveUnder(instructed, await explored(instructed), { ...PRESS_SCHEDULE, consequences: "send_or_publish" });
  assert.equal(byInstruction.ok, true);
  assert.equal(instructed.request, undefined);
});

test("a press that causes nothing lasting builds with nobody asked, and the declaration never reaches the Flow", async () => {
  const gate = gateHolding([]);
  const resolved = await resolveUnder(gate, await explored(gate), { ...PRESS_SCHEDULE, consequences: "none" });

  assert.equal(resolved.ok, true);
  assert.equal(gate.request, undefined);
  const node = resolved.ok ? resolved.plan.subflows[0]?.nodes[1] : undefined;
  assert.equal(node?.parameters && "consequences" in node.parameters, false, "the declaration is read by Core, never run by the Flow");
  assert.equal(node?.parameters?.selector, "#schedule");
  // The step beside it only enters text, which is not a consequence and is never asked about.
  assert.equal(resolved.ok && resolved.plan.subflows[0]?.nodes[0]?.parameters?.text, "Hello");
});

test("a declaration Core cannot read is not a declaration, and the step is refused", async () => {
  const gate = gateHolding([]);
  const resolved = await resolveUnder(gate, await explored(gate), { ...PRESS_SCHEDULE, consequences: "publish it" });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.ok === false ? resolved.issues[0]?.code : undefined, "bootstrap.step_consequences_invalid");
  assert.equal(gate.request, undefined);
});

test("with no build behind the resolution there is nobody to ask, and a lasting step is still not built", async () => {
  const runtime = runtimeOver([body, schedule]);
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.inspect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  const resolved = await resolveAutomationStudioFlowBootstrapPlanParameters({
    plan: composerPlan({ ...PRESS_SCHEDULE, consequences: "move_money" }),
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
