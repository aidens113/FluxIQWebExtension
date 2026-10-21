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
import { automationStudioHarnessOptionRegistry, runWithAutomationStudioEvidenceBuildScope } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../../constants";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { coreBuildStateStore } from "../build-state/tests/core-store";

const PROJECT = { projectId: "project.bigbox", flowId: "flow.bigbox" };
const START = "http://127.0.0.1:41873/scenarios/bigbox-retail/";
const NAVIGATE = "web.output.browser-navigate";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const TYPE = "web.output.dom-type";
const PERMITTED = async () => ({ permitted: true as const });
const NOT_THERE = { reason: "start_location_not_reached", startLocation: START };

test("the opening look on an already-open start location reads the page as it stands", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);

  const looked = await exec(runtime, {
    ...PROJECT, callId: "call.opening", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  }, "fresh");

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

  const pressed = await exec(runtime, {
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

  const went = await exec(runtime, {
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

  const looked = await exec(runtime, {
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });
  assert.equal(looked.resultCode, "web.inspect.succeeded");
  assert.equal((looked.evidence as JsonObject & { location: string }).location, START);

  const pressed = await exec(runtime, {
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
  const pressed = await exec(runtime, {
    ...PROJECT, callId: "call.again", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] }
  });
  assert.equal(pressed.resultCode, "web.action.rejected.not_at_start_location");
});

// Live run 38 (`run-muqilf9s-c3211328`, C3): a round whose draft already holds
// the Flow ran the arrival again and began off the page the test left. It now
// opens with Core's look carrying the Flow's calls (`held`), which reads the
// page as it stands and does not re-arm the rule: a held navigation is the
// build's arrival, as a replayed one is.
test("a round whose draft holds the Flow looks at the page as it stands, and is arrived, from nothing remembered", async () => {
  const stubbed = openTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const looked = await continuing(runtime, [{ node: NAVIGATE, parameters: { url: START } }, { node: CLICK, parameters: { selector: "#go" } }]);
  assert.equal(looked.resultCode, "web.inspect.succeeded");
  assert.equal((looked.evidence as JsonObject).location, START);
  assert.equal(looked.draft?.proposes, false);
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.browser.navigate"), false);

  const pressed = await press(runtime, "call.press");
  assert.equal(pressed.resultCode, "web.action.succeeded");
});

test("a round whose draft holds the Flow does not re-arm the rule a build arrived under", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);
  await opening(runtime);
  await arrive(runtime);

  assert.equal((await continuing(runtime, [])).resultCode, "web.inspect.succeeded");
  assert.equal((await press(runtime, "call.again")).resultCode, "web.action.succeeded");
});

test("a held Flow with no navigation in it is not an arrival", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);

  assert.equal((await continuing(runtime, [{ node: CLICK, parameters: { selector: "#go" } }])).resultCode, "web.inspect.succeeded");
  assert.equal((await press(runtime, "call.press")).resultCode, "web.action.rejected.not_at_start_location");
});

// A8 launch 6 (`run-mv85vjqo-4c022aec`, t585): a dependent builder opened with
// a look on the entry Core had prepared by running its predecessors from the
// start location, and every typed search it made there was refused
// `not_at_start_location`. Core now marks that opening look `arrived`.
test("a builder whose opening look is on its prepared entry has arrived: a typed action runs without navigating", async () => {
  const stubbed = openTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const looked = await prepared(runtime, "fresh");
  assert.equal(looked.resultCode, "web.inspect.succeeded", JSON.stringify(looked.evidence));
  assert.equal(looked.draft?.proposes, false);

  const typed = await type(runtime, fieldHandle(looked));
  assert.equal(typed.resultCode, "web.action.succeeded", JSON.stringify(typed.evidence));
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.type"), true);
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.browser.navigate"), false);
});

test("a builder that never arrived is still refused its typed action", async () => {
  const stubbed = openTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const looked = await opening(runtime);
  const typed = await type(runtime, fieldHandle(looked));
  assert.equal(typed.resultCode, "web.action.rejected.not_at_start_location");
  assert.deepEqual(((typed.evidence as JsonObject).detail as JsonObject).reason, NOT_THERE.reason);
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.type"), false);
});

test("the arrival mark on any call Core did not mark as its opening is refused as an unexpected key, and arrives nothing", async () => {
  const stubbed = openTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await opening(runtime);

  const claimed = await prepared(runtime, undefined);
  assert.equal(claimed.resultCode, "web.action.rejected.invalid_input");
  const typed = await type(runtime, fieldHandle(looked));
  assert.equal(typed.resultCode, "web.action.rejected.not_at_start_location");
});

test("a build told no start location is unchanged: the open page is read and pressed on", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway);

  const looked = await exec(runtime, {
    ...PROJECT, callId: "call.opening", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  }, "fresh");
  assert.equal(looked.resultCode, "web.inspect.succeeded");

  const pressed = await exec(runtime, {
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

  const looked = await exec(runtime, {
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

  const looked = await exec(runtime, {
    ...PROJECT, callId: "call.after", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });
  assert.equal(looked.resultCode, "web.inspect.succeeded");
});

// t728: arrival is kept in Core's durable build state too, so a host restarted
// mid-build still knows its build arrived, and Core's opening of a fresh round
// forgets it there as well.
test("a host restarted mid-build still knows its build arrived, and a fresh round re-arms the rule in the store too (t728)", async () => {
  const store = coreBuildStateStore();
  const before = createWebAutomationLlmEvidenceRuntime(openTab().gateway, undefined, () => store);
  await opening(before);
  await arrive(before);

  // A new process over the same storage: the press runs without navigating again.
  const restarted = openTab();
  const after = createWebAutomationLlmEvidenceRuntime(restarted.gateway, undefined, () => store);
  assert.equal((await press(after, "call.after-restart")).resultCode, "web.action.succeeded");
  assert.equal(restarted.commands.some((command) => command.actionType === "web.browser.navigate"), false);

  // A fresh round re-arms it, and a host restarted after that is held to it again.
  await opening(after);
  const again = createWebAutomationLlmEvidenceRuntime(openTab().gateway, undefined, () => store);
  assert.equal((await press(again, "call.after-reopening")).resultCode, "web.action.rejected.not_at_start_location");
});

test("another build of the same Flow is not arrived by this one's arrival, before or after a restart (t728)", async () => {
  const store = coreBuildStateStore();
  const runtime = createWebAutomationLlmEvidenceRuntime(openTab().gateway, undefined, () => store);
  await opening(runtime);
  await arrive(runtime);
  const otherBuild = (callId: string) => runWithAutomationStudioEvidenceBuildScope({ ...PROJECT, buildId: "build.other" }, () => runtime.executeTool({
    ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] }
  }));
  assert.equal((await otherBuild("call.other")).resultCode, "web.action.rejected.not_at_start_location");
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

test("a round whose draft holds the Flow opens, through Core's registry, with the look carrying its calls, and is arrived", async () => {
  const stubbed = openTab();
  const loop = bound(createWebAutomationLlmEvidenceRuntime(stubbed.gateway), START);
  const look = loop.tools.find((tool) => tool.toolId === WEB_LLM_RUN_NODE_TOOL_ID)?.initialObservation?.input as JsonObject;
  // As Core's loop sends it: the look, and each kept step's call as written (`AS/runtime/llm/evidence-loop.ts`).
  const held = [{ node: NAVIGATE, parameters: { url: START } }, { node: CLICK, parameters: { target: { handle: "t1" } } }];

  const opened = await loop.executeTool({ callId: "initial.core.run_node", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { ...look, held } }) as unknown as Execution;
  assert.equal(opened.resultCode, "web.inspect.succeeded", JSON.stringify(opened.evidence));
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.browser.navigate"), false);

  const pressed = await loop.executeTool({ callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { selector: "#go" }, consequences: [] } }) as unknown as Execution;
  assert.notEqual(pressed.resultCode, "web.action.rejected.not_at_start_location", JSON.stringify(pressed.evidence));
});

// Office run `run-mvgf04kw-310fc169` (t738): every dependent builder's opening
// look on its prepared entry, `initial.core.run_node` carrying Core's
// `arrived`, was refused `unexpected_input_keys`.
test("a builder on its prepared entry opens, through Core's registry, with the look marked arrived, and is arrived", async () => {
  const stubbed = openTab();
  const loop = bound(createWebAutomationLlmEvidenceRuntime(stubbed.gateway), START);
  const look = loop.tools.find((tool) => tool.toolId === WEB_LLM_RUN_NODE_TOOL_ID)?.initialObservation?.input as JsonObject;

  const opened = await loop.executeTool({ callId: "initial.core.run_node", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { ...look, arrived: true } }) as unknown as Execution;
  assert.equal(opened.resultCode, "web.inspect.succeeded", JSON.stringify(opened.evidence));

  const typed = await loop.executeTool({ callId: "call.type", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { node: TYPE, parameters: { target: { handle: fieldHandle(opened) }, text: "paper towels" }, consequences: [] } }) as unknown as Execution;
  assert.equal(typed.resultCode, "web.action.succeeded", JSON.stringify(typed.evidence));
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.browser.navigate"), false);
});

// The cause on that run: the web panel bundles Core and ran the build with its
// copy, while this domain imports Core's `dist`, so the frame Core set was in
// the other copy. Core keeps one frame per process (its
// `llm/harness-options/evidence-build-scope.ts`); this sets it through a second
// copy of that module, as the panel's bundled one.
test("a builder on its prepared entry has arrived when Core's frame is set by another copy of Core, as the web panel's", async () => {
  const panelUrl = new URL(import.meta.resolve("fluxiq/automation-studio/evidence-build-scope"));
  panelUrl.searchParams.set("copy", "panel");
  const panel = await import(panelUrl.href) as { runWithAutomationStudioEvidenceBuildScope: typeof runWithAutomationStudioEvidenceBuildScope };
  assert.notEqual(panel.runWithAutomationStudioEvidenceBuildScope, runWithAutomationStudioEvidenceBuildScope);
  const framed = <T>(opening: "fresh" | undefined, fn: () => T) => panel.runWithAutomationStudioEvidenceBuildScope(opening ? { ...PROJECT, buildId: BUILD_ID, opening } : { ...PROJECT, buildId: BUILD_ID }, fn);
  const stubbed = openTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const looked = await framed("fresh", () => runtime.executeTool({
    ...PROJECT, callId: "initial.core.run_node", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [], arrived: true }
  }));
  assert.equal(looked.resultCode, "web.inspect.succeeded", JSON.stringify(looked.evidence));

  const typed = await framed(undefined, () => runtime.executeTool({
    ...PROJECT, callId: "call.type", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, permission: PERMITTED,
    value: { node: TYPE, parameters: { target: { handle: fieldHandle(looked) }, text: "paper towels" }, consequences: [] }
  }));
  assert.equal(typed.resultCode, "web.action.succeeded", JSON.stringify(typed.evidence));
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.browser.navigate"), false);

  // A model-written call carrying the mark, in the same frame, is still refused.
  const claimed = await framed(undefined, () => runtime.executeTool({
    ...PROJECT, callId: "call.claim", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [], arrived: true }
  }));
  assert.equal(claimed.resultCode, "web.action.rejected.invalid_input");
});

test("a model-written call carrying the arrival mark, through Core's registry, is refused as an unexpected key", async () => {
  const loop = bound(createWebAutomationLlmEvidenceRuntime(openTab().gateway), START);
  const look = loop.tools.find((tool) => tool.toolId === WEB_LLM_RUN_NODE_TOOL_ID)?.initialObservation?.input as JsonObject;

  const claimed = await loop.executeTool({ callId: "call.claim", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { ...look, arrived: true } }) as unknown as Execution;
  assert.equal(claimed.resultCode, "web.action.rejected.invalid_input", JSON.stringify(claimed.evidence));
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

/** The build Core frames every call of these tests with. */
const BUILD_ID = "build.bigbox";

/**
 * A call as Core's registry runs it: inside the build's frame, marked as Core's
 * opening of a round, fresh or continuing, only where Core would mark it
 * (`AS/runtime/llm/harness-options/evidence-build-scope.ts`).
 */
async function exec(runtime: Runtime, input: Parameters<Runtime["executeTool"]>[0], opening?: "fresh" | "continuing") {
  return await runWithAutomationStudioEvidenceBuildScope(opening ? { ...PROJECT, buildId: BUILD_ID, opening } : { ...PROJECT, buildId: BUILD_ID }, () => runtime.executeTool(input));
}

/** Core's opening look of a fresh round. */
async function opening(runtime: Runtime) {
  return await exec(runtime, {
    ...PROJECT, callId: "call.opening", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  }, "fresh");
}

/** Core's opening look of a round whose draft already holds the Flow, carrying its calls. */
async function continuing(runtime: Runtime, held: JsonObject[]) {
  return await exec(runtime, {
    ...PROJECT, callId: "call.opening", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [], held }
  }, "continuing");
}

/** Core's opening look of a builder that starts on its prepared entry, marked so (Core `service/project-build/brief-ports.ts`); or, `undefined`, the mark on a call Core did not open with. */
async function prepared(runtime: Runtime, marked: "fresh" | undefined) {
  return await exec(runtime, {
    ...PROJECT, callId: marked ? "call.opening" : "call.claim", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [], arrived: true }
  }, marked);
}

async function type(runtime: Runtime, handle: string) {
  return await exec(runtime, {
    ...PROJECT, callId: "call.type", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, permission: PERMITTED,
    value: { node: TYPE, parameters: { target: { handle }, text: "paper towels" }, consequences: [] }
  });
}

/** The search field's handle, as the look showed it. */
function fieldHandle(looked: { evidence: unknown }): string {
  const handle = /\b(t\d+) [a-z]+ "Search"/u.exec(String((looked.evidence as JsonObject).page))?.[1];
  assert.ok(handle, JSON.stringify((looked.evidence as JsonObject).page));
  return handle;
}

async function press(runtime: Runtime, callId: string) {
  return await exec(runtime, {
    ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: CLICK, parameters: { target: { handle: "t1" } }, consequences: [] }
  });
}

async function arrive(runtime: Runtime): Promise<void> {
  const went = await exec(runtime, {
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
    const answered = await exec(runtime, { ...PROJECT, ...call, toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START, permission: PERMITTED });
    answers.push(answered.resultCode ?? "no result code");
  }
  return answers;
}

/** A tab that already stands on the start location: every capture reads it. */
function openTab() {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  let location = START;
  let presses = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.browser.navigate") {
        location = String(command.parameters.url);
        return { status: "succeeded", payload: { value: "ok" } };
      }
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(location, presses) } };
      if (command.actionType === "web.dom.click") presses += 1;
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, commands };
}

// A press that lands counts on the page's status line, as a real page answers
// a press, so no press here is taken for one that changed nothing (t511) and
// pressed once more.
function page(url: string, presses = 0): JsonObject {
  return {
    url,
    title: "Bigbox",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "#go", visibleText: "Set as my store" }, { tagName: "span", selector: "#status", visibleText: presses === 0 ? "No store chosen" : "Store chosen" },
      { tagName: "input", selector: "#q", type: "search", accessibleName: "Search", placeholder: "Search" }
    ]
  };
}
