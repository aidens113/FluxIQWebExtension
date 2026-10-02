// A build told where its Flow starts, handed a tab that is already there.
//
// Run 6 (`run-muncqlr0-3348202b`, 2026-09-29): the tab already stood on
// `/scenarios/bigbox-retail/`, the build's opening look read it, nothing ever
// navigated, and Core refused completion `bootstrap.cannot_reach_start_location`.
// The gateway below is that tab: every capture succeeds on the start location
// from the first call. Arrival is now a fact of the build, not of the tab
// (`../arrival.ts`), so the build is held to the same rule as from a blank tab
// -- except a look, which reads the page as it stands: on
// `run-muqc07fh-eeffbc86` (2026-10-01) refusing the free look on the start
// location left the model's first decision blind.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioHarnessOptionRegistry } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../../constants";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";

const PROJECT = { projectId: "project.bigbox", flowId: "flow.bigbox" };
const START = "http://127.0.0.1:41873/scenarios/bigbox-retail/";
const NAVIGATE = "web.output.browser-navigate";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const PERMITTED = async () => ({ permitted: true as const });
const NOT_THERE = { reason: "start_location_not_reached", startLocation: START };

test("the opening look on an already-open start location reads the page as it stands", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);

  const looked = await runtime.executeTool({
    ...PROJECT, callId: "initial.core.run_node", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });

  assert.equal(looked.resultCode, "web.inspect.succeeded");
  assert.equal((looked.evidence as JsonObject).location, START);
  assert.match(JSON.stringify((looked.evidence as JsonObject).page), /Set as my store/u);
  // Seeing the page is not arriving: a look is never a step of the Flow.
  assert.equal(looked.draft?.proposes, false);
});

test("a press before the build has navigated is refused the same way, and never dispatched", async () => {
  const stubbed = openTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  await opening(runtime);

  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] }
  });

  assert.equal(pressed.resultCode, "web.action.rejected.not_at_start_location");
  assert.equal(pressed.effectApplied, false);
  // The look before it read the page; arriving takes the navigation.
  const detail = (pressed.evidence as JsonObject).detail as JsonObject;
  assert.equal(detail.reason, NOT_THERE.reason);
  assert.equal(detail.startLocation, START);
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
});

test("the navigation to the start location runs, and is a proposable step carrying the address", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);
  await opening(runtime);

  const went = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: NAVIGATE, parameters: { url: START }, consequences: [] }
  });

  assert.equal(went.resultCode, "web.action.succeeded");
  assert.equal(went.effectApplied, true);
  assert.equal(went.draft?.actionId, NAVIGATE);
  assert.equal(went.draft?.effect, "mutate");
  assert.equal(went.draft?.proposes, true);
  assert.deepEqual(went.draft?.ranWith, { node: NAVIGATE, parameters: { url: START }, consequences: [] });
  assert.deepEqual(went.draft?.replay?.from, { location: START });
});

test("once the build has navigated, a look and a press run as they always did", async () => {
  const stubbed = openTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  await opening(runtime);
  await arrive(runtime);

  const looked = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });
  assert.equal(looked.resultCode, "web.inspect.succeeded");
  assert.equal((looked.evidence as JsonObject & { location: string }).location, START);

  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.three", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] }
  });
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), true);
});

test("a build's opening call re-arms the rule, so a second build of the flow is held to it again", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);
  await opening(runtime);
  await arrive(runtime);

  const again = await opening(runtime);
  assert.equal(again.resultCode, "web.inspect.succeeded");
  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.again", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] }
  });
  assert.equal(pressed.resultCode, "web.action.rejected.not_at_start_location");
});

test("a build told no start location is unchanged: the open page is read and pressed on", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);

  const looked = await runtime.executeTool({
    ...PROJECT, callId: "initial.core.run_node", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });
  assert.equal(looked.resultCode, "web.inspect.succeeded");

  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] }
  });
  assert.equal(pressed.resultCode, "web.action.succeeded");
});

test("the dry run after arrival resets and replays as before, and the build stays arrived", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);
  await opening(runtime);
  await arrive(runtime);

  const answers = await dryRun(runtime);
  assert.deepEqual(answers, ["core.replay.replayed", "core.replay.replayed", "core.replay.replayed"]);

  const looked = await runtime.executeTool({
    ...PROJECT, callId: "call.after", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });
  assert.equal(looked.resultCode, "web.inspect.succeeded");
});

test("a resumed build replays its saved draft from nothing remembered, and its navigation counts as arrival", async () => {
  // A new process: a new runtime, nothing remembered, the tab already open.
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);

  const answers = await dryRun(runtime);
  assert.deepEqual(answers, ["core.replay.replayed", "core.replay.replayed", "core.replay.replayed"]);

  const looked = await runtime.executeTool({
    ...PROJECT, callId: "call.after", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });
  assert.equal(looked.resultCode, "web.inspect.succeeded");
});

// Across the seam (F31): Core builds a build's opening call from this domain's
// `runsNodes.arrival` and the start location, and this domain runs it as the
// navigation that is the Flow's first step. Core's loop records it (its own
// tests); these check that the two sides agree on the call.
test("a build told where it starts opens, through Core's registry, with this domain's navigation there, and arrives", async () => {
  const stubbed = openTab();
  const loop = bound(createWebAutomationLlmEvidenceRuntime(stubbed.gateway), START);
  const runNode = loop.tools.find((tool) => tool.toolId === WEB_LLM_RUN_NODE_TOOL_ID);
  const arrival = runNode?.initialObservation?.arrival;
  assert.deepEqual(arrival, { node: NAVIGATE, parameters: { url: START }, consequences: [] });
  // The look stays the look, for whatever takes a fresh one.
  assert.equal((runNode?.initialObservation?.input as JsonObject | undefined)?.node, SNAPSHOT);

  const opened = await loop.executeTool({ callId: "initial.core.run_node", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: arrival! }) as unknown as Execution;
  assert.equal(opened.evidence.ok, true, JSON.stringify(opened.evidence));
  assert.equal(opened.effectApplied, true);
  assert.equal(opened.draft?.proposes, true);
  assert.deepEqual(stubbed.commands.filter((command) => command.actionType === "web.browser.navigate").map((command) => command.parameters.url), [START]);

  // Arrived: an action now runs instead of being refused for where the build is.
  const pressed = await loop.executeTool({ callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { selector: "#go" }, consequences: [] } }) as unknown as Execution;
  assert.notEqual(pressed.resultCode, "web.action.rejected.not_at_start_location", JSON.stringify(pressed.evidence));
});

test("a build told no start location opens, through Core's registry, with the look", () => {
  const runNode = bound(createWebAutomationLlmEvidenceRuntime(openTab().gateway), undefined).tools.find((tool) => tool.toolId === WEB_LLM_RUN_NODE_TOOL_ID);
  assert.equal(runNode?.initialObservation?.arrival, undefined);
  assert.equal((runNode?.initialObservation?.input as JsonObject | undefined)?.node, SNAPSHOT);
});

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;
type Execution = { evidence: JsonObject; effectApplied?: boolean; resultCode?: string; draft?: { proposes?: boolean } };

/** The runtime as a build binds it: through Core's registry, with the library it runs and the start it was told. */
function bound(runtime: Runtime, startLocation: string | undefined) {
  return automationStudioHarnessOptionRegistry({ binding: runtime, nodeIds: runtime.runsNodes?.runnable ?? [], startLocation })
    .evidenceLoopBinding(PROJECT, { scope: { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID }, stage: "gather", allowSideEffectsWithoutPolicy: true });
}

/** Core's opening look, named as Core names it (`AS/runtime/llm/evidence-loop.ts`). */
async function opening(runtime: Runtime) {
  return await runtime.executeTool({
    ...PROJECT, callId: "initial.core.run_node", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });
}

async function arrive(runtime: Runtime): Promise<void> {
  const went = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: NAVIGATE, parameters: { url: START }, consequences: [] }
  });
  assert.equal(went.resultCode, "web.action.succeeded");
}

/** Core's dry run of a draft whose first step is the navigation: reset, then each step. */
async function dryRun(runtime: Runtime): Promise<string[]> {
  const calls: Array<{ callId: string; value: JsonObject }> = [
    { callId: "dryrun.1.reset", value: { replay: "reset", from: { location: START } } },
    { callId: "dryrun.1.1", value: { replay: "step", node: NAVIGATE, parameters: { url: START }, consequences: [] } },
    { callId: "dryrun.1.2", value: { replay: "step", node: CLICK, parameters: { selector: "#go" }, consequences: [] } }
  ];
  const answers: string[] = [];
  for (const call of calls) {
    const answered = await runtime.executeTool({ ...PROJECT, ...call, toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, permission: PERMITTED });
    answers.push(answered.resultCode ?? "no result code");
  }
  return answers;
}

/** A tab that already stands on the start location: every capture reads it. */
function openTab() {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  let location = START;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.browser.navigate") {
        location = String(command.parameters.url);
        return { status: "succeeded", payload: { value: "ok" } };
      }
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(location) } };
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, commands };
}

function page(url: string): JsonObject {
  return {
    url,
    title: "Bigbox",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Set as my store" }]
  };
}
