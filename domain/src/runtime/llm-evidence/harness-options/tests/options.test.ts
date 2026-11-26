import assert from "node:assert/strict";
import test from "node:test";
import {
  AutomationStudioHarnessOptionRegistry,
  resolveAutomationStudioExplorationBudget,
  runAutomationStudioRuntimeExploration,
  type AutomationStudioHarnessOptionResolution
} from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../../constants";
import type { WebLlmEvidenceGateway } from "../../capture";
import { present } from "../../present";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { createWebLlmExtractionHandles } from "../../structure";
import type { WebRecoveryHarnessContext } from "../execute";
import { publishedWebLlmPage } from "../../page-view";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import {
  webAutomationExplorationRefusalClassifier,
  webAutomationRecoveryHarnessOptionBundle,
  WEB_RECOVERY_HARNESS_OPTION_IDS,
  WEB_RECOVERY_NAVIGATE_OPTION_ID
} from "..";

/** Core's opening look, and the look after a person's Continue: the navigate option with no address (t1042). */
const OPENING = WEB_RECOVERY_NAVIGATE_OPTION_ID;

// Decision L14: the web domain's exploration actions are **registered into**
// Core's harness-option registry, not built into Core. Every assertion below
// goes through the real registry, so "registered" means the registry accepted
// them, offered them, and dispatched to them.
test("registers six options into Core's registry and offers them only while exploring", () => {
  const registry = registered();

  assert.deepEqual(registry.list(resolution()).map((option) => option.toolId), [...WEB_RECOVERY_HARNESS_OPTION_IDS]);
  assert.deepEqual(registry.list(resolution({ stage: "iterate" })).map((option) => option.toolId), [...WEB_RECOVERY_HARNESS_OPTION_IDS]);
  // Flow authoring names no stage, and a stage-pinned option is withheld from a
  // call that names none. That is the separation the old single evidence-runtime
  // slot could not express: its tools went to every caller there was.
  assert.deepEqual(registry.list({ scope: { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID }, allowSideEffectsWithoutPolicy: true }).map((option) => option.toolId), []);
  assert.deepEqual(registry.list(resolution({ stage: "implement" })).map((option) => option.toolId), []);
});

test("hands the model the tool fields and none of the gate metadata", () => {
  const tools = registered().tools(resolution());

  for (const tool of tools) {
    assert.deepEqual(Object.keys(tool).filter((key) => !["toolId", "description", "inputSchema", "effect", "perCallEffect", "repeatPolicy", "initialObservation"].includes(key)), [], tool.toolId);
  }
  // t1042, the user's "no more look command": no option is a look. The opening look is Core's first call of the
  // navigate option with no address, an input its schema refuses from the model, as a build's rides `core.run_node`.
  assert.equal(tools.some((tool) => tool.toolId === "web.recovery.inspect"), false);
  const opening = tools.filter((tool) => tool.initialObservation !== undefined);
  assert.deepEqual(opening.map((tool) => [tool.toolId, tool.initialObservation, tool.perCallEffect]), [[OPENING, { input: {} }, true]]);
  assert.deepEqual((opening[0]!.inputSchema as { required?: string[] }).required, ["url"], "the model cannot send the opening's input");
  for (const tool of tools) assert.doesNotMatch(tool.description, /\b[Ll]ook\b/u, `${tool.toolId} says to look`);
  for (const tool of tools) assert.equal(tool.description.length <= 2_000, true, `${tool.toolId}: ${tool.description.length} characters, over Core's 2,000`);
  assert.deepEqual(tools.filter((tool) => tool.effect === "mutate").map((tool) => tool.toolId), ["web.recovery.press", "web.recovery.enter_field", "web.recovery.navigate_in_scope"]);
});

// Gathering information never requires destroying anything, and the registry
// enforces that by never offering a destructive option. Declaring one here
// would be declaring something unreachable, so the check is that none is
// declared and that the mutating ones still need permission to be offered.
test("declares nothing destructive, and withholds the mutating options from a caller that did not opt in", () => {
  const registry = registered();

  assert.deepEqual(registry.list(resolution()).filter((option) => option.safety?.sideEffect === "destructive"), []);
  assert.deepEqual(
    registry.list({ scope: { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID }, stage: "gather" }).map((option) => option.toolId),
    ["web.recovery.wait_for_change", "web.recovery.detect_repeating_structure", "web.recovery.describe_element"]
  );
});

test("describes one element of the page the exploration showed, and keeps what the model read for the repair", async () => {
  const { registry, commands, retained } = registeredWith();

  await execute(registry, OPENING, {});
  assert.deepEqual(commands, ["web.dom.capture_snapshot"]);
  // The page's capture is retained beside what the model read of it.
  assert.equal(retained.length, 1);
  assert.equal(retained[0]!.selectors.get("t2"), "#delete");

  const described = await execute(registry, "web.recovery.describe_element", { target: "t2" }) as JsonObject;
  assert.equal(described.schemaVersion, "web-llm-describe.v1");
  assert.match(String(described.element), /^t2 <button> button "Delete item"$/mu);
  // Described from the packet the page showed: nothing was captured again.
  assert.deepEqual(commands, ["web.dom.capture_snapshot"]);
  assert.equal(retained.length, 2);

  const pressed = await run(registry, "web.recovery.press", { target: "t2", consequences: [] }) as { resultCode: string };
  assert.equal(pressed.resultCode, "web.action.succeeded", "a handle the page printed is one a press binds");
});

test("describe refuses before this exploration has shown anything, and a handle no page showed", async () => {
  const { registry, commands } = registeredWith();
  const before = await run(registry, "web.recovery.describe_element", { target: "t1" }) as { resultCode: string; resultReason?: string };
  assert.deepEqual([before.resultCode, before.resultReason], ["web.action.rejected.target_unobserved", "nothing_observed_yet"]);
  await execute(registry, OPENING, {});
  const unknown = await run(registry, "web.recovery.describe_element", { target: "t9" }) as { resultCode: string; resultReason?: string };
  assert.deepEqual([unknown.resultCode, unknown.resultReason], ["web.action.rejected.target_unobserved", "handle_not_in_packet"]);
  assert.deepEqual(commands, ["web.dom.capture_snapshot"]);
});

test("the opening look returns the compact view naming elements by opaque handle, moves nothing, and keeps its selectors for the repair", async () => {
  const { registry, commands, retained } = registeredWith();

  const evidence = await execute(registry, OPENING, {});

  // The page as the model reads every page (t223), with no element objects.
  assert.equal((evidence as JsonObject).schemaVersion, "web-llm-page.v4");
  assert.equal(Object.hasOwn(evidence as JsonObject, "elements"), false);
  assert.deepEqual(shownPageLines(evidence).map((line) => line.target), ["t1", "t2", "t3"]);
  assert.equal(JSON.stringify(evidence).includes("#delete"), false);
  assert.deepEqual(commands, ["web.dom.capture_snapshot"]);
  // The packet behind the page the model was shown is the one retained, with
  // the selectors behind its handles, so a repair naming one of them gets its
  // hint back.
  assert.equal(retained.length, 1);
  assert.deepEqual(publishedWebLlmPage(retained[0]!.evidence), evidence);
  assert.equal(retained[0]!.selectors.get("t2"), "#delete");
});

// FluxIQ does not refuse a control on its own judgement of what it looks like.
// This option used to be two -- `reveal` and `act_safe` -- each with its own
// list of what it would not press, and "Delete item" here was refused on its
// wording. The user's instruction is the authority now, and a lasting press is
// a matter of permission carried by Core and put to the person (the seam is in
// `../../press.ts`). Until Core carries it, the press is made: pinning that here
// is what stops a word list being quietly put back in its place.
test("presses the control it is asked to, whatever it says, and retains only what the model was shown", async () => {
  const { registry, commands, retained } = registeredWith();
  await execute(registry, OPENING, {});

  const pressed = await run(registry, "web.recovery.press", { target: "t2", consequences: [] });

  assert.equal((pressed as { resultCode: string }).resultCode, "web.action.succeeded");
  assert.equal((pressed as { effectApplied: boolean }).effectApplied, true);
  assert.equal(commands.filter((command) => command === "web.dom.click").length, 1);
  // The pre-press capture is not a packet the model saw; the recapture is.
  assert.equal(retained.length, 2);
  assert.deepEqual(publishedWebLlmPage(retained[1]!.evidence), (pressed as { evidence: unknown }).evidence);
});

// A handle means something only against a packet this exploration returned.
// Before any packet, there is nothing the model could have copied it from, so
// the option refuses rather than binding the handle against a capture the
// model never saw.
test("refuses a target handle before this exploration has shown any packet, and clicks nothing", async () => {
  const { registry, commands } = registeredWith();

  for (const optionId of ["web.recovery.press", "web.recovery.detect_repeating_structure"]) {
    const refused = await run(registry, optionId, optionId === "web.recovery.press" ? { target: "t1", consequences: [] } : { target: "t1" });
    // The refusal says which of the ways a handle names nothing this was. (In a
    // run Core's opening look comes first, so a page has always been shown.)
    // `resultReason` beside the code is the same word the model is given, kept
    // where whoever reads the run afterwards can see it (`../../capture.ts`).
    assert.deepEqual(refused, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "target_unobserved", detail: { reason: "nothing_observed_yet" } }, effectApplied: false, resultCode: "web.action.rejected.target_unobserved", resultReason: "nothing_observed_yet" }, optionId);
  }
  assert.equal(commands.includes("web.dom.click"), false);
});

test("navigates only where Core's scope policy allows, and says which refusal it was", async () => {
  const sameScope = registeredWith();
  const refused = await run(sameScope.registry, "web.recovery.navigate_in_scope", { url: "https://other.test/next" });

  assert.equal((refused as { resultCode: string }).resultCode, "web.action.rejected.out_of_scope");
  assert.equal(sameScope.commands.includes("web.browser.navigate"), false);

  const allowlisted = registeredWith({ scopePolicy: { kind: "allowlist", scopes: ["https://example.test", "https://other.test"] } });
  const moved = await run(allowlisted.registry, "web.recovery.navigate_in_scope", { url: "https://other.test/next" });

  assert.equal((moved as { resultCode: string }).resultCode, "web.action.succeeded");
  assert.equal(allowlisted.commands.includes("web.browser.navigate"), true);
});

// t1042 (page-diff D2): every capture a recovery takes is numbered by the run's stable handles, so a handle the page as
// it is now still gives to an element binds to that element, whichever view printed it -- the one check a detection
// makes (`../../structure/held-now.ts`). Before, a press refused it `page_moved_since_packet` and the model had to be
// shown the page again. Only a handle the page now gives to no element is refused.
test("a press binds a handle the page as it is now still gives to an element, after the page moved on", async () => {
  const { registry, commands, setPage } = registeredWith();
  const remove = shownPageLines(await execute(registry, OPENING, {})).find((line) => line.words === "Delete item")!.target;
  setPage("https://example.test/start?sort=newest", true);
  const pressed = await run(registry, "web.recovery.press", { target: remove, consequences: [] }) as { resultCode: string; effectApplied: boolean };
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed));
  assert.equal(pressed.effectApplied, true);
  assert.equal(commands.filter((command) => command === "web.dom.click").length, 1);
});

test("a press of a handle the page as it is now gives to no element is refused, and nothing is clicked", async () => {
  const { registry, commands, setPage } = registeredWith();
  const remove = shownPageLines(await execute(registry, OPENING, {})).find((line) => line.words === "Delete item")!.target;
  setPage("https://example.test/start?sort=newest", false);
  const refused = await run(registry, "web.recovery.press", { target: remove, consequences: [] }) as { resultCode: string; resultReason?: string };
  assert.deepEqual([refused.resultCode, refused.resultReason], ["web.action.rejected.target_unobserved", "page_moved_since_packet"]);
  assert.equal(commands.includes("web.dom.click"), false);
});

test("an opening look moves nothing, and a navigate the model makes still needs an address", async () => {
  const { registry, commands } = registeredWith();
  const opened = await run(registry, OPENING, {}) as { resultCode: string; effectApplied: boolean };
  assert.deepEqual([opened.resultCode, opened.effectApplied], ["web.inspect.succeeded", false]);
  assert.deepEqual(commands, ["web.dom.capture_snapshot"]);
  const extra = await run(registry, OPENING, { url: "https://example.test/next", hint: "x" }) as { resultCode: string; resultReason?: string };
  assert.deepEqual([extra.resultCode, extra.resultReason], ["web.action.rejected.invalid_input", "unexpected_input_keys"]);
  assert.equal(commands.includes("web.browser.navigate"), false);
});

test("refuses a bounded wait that changed nothing rather than returning the same packet again", async () => {
  const still = registeredWith({ sleep: async () => {} });
  const unchanged = await run(still.registry, "web.recovery.wait_for_change", { maxWaitMs: 250 });

  assert.deepEqual(unchanged, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "no_progress", detail: { reason: "nothing_changed_while_waiting" } }, effectApplied: false, resultCode: "web.action.rejected.no_progress", resultReason: "nothing_changed_while_waiting" });

  const settling = registeredWith({ sleep: async () => { settling.setTitle("Loaded"); } });
  const changed = await run(settling.registry, "web.recovery.wait_for_change", { maxWaitMs: 9_999_999 });

  assert.equal((changed as { resultCode: string }).resultCode, "web.inspect.succeeded");
  assert.equal((changed as { effectApplied: boolean }).effectApplied, false);
});

// The whole seam in one run: Core's loop, Core's budget, Core's registry, this
// domain's options, this domain's scope refusal. A model that asks to leave the
// scope it was given is refused, and the refusal is recorded by its kind,
// `out_of_scope_refused` -- and it ends nothing (Core t1057): the model is shown
// the refusal and the exploration goes on to its answer (or, failing that, its
// purse). It used to end the exploration `unsafe_action_blocked` at the
// refusal; no count of refusals ends one now.
test("records a run's request to leave its scope as a refusal and goes on to its answer, through Core's own runner", async () => {
  const { registry, commands } = registeredWith();
  const decisions: JsonObject[] = [
    { kind: "tool_call", callId: "call.one", toolId: "web.recovery.navigate_in_scope", input: { url: "https://other.test/next" } },
    { kind: "complete", result: { finding: "the next page is outside the scope this exploration may reach" } }
  ];
  let index = 0;

  const exploration = await runAutomationStudioRuntimeExploration({
    loop: registry.evidenceLoopBinding({ projectId: "project.one", flowId: "flow.one" }, resolution()),
    decide: async () => decisions[index++] ?? { kind: "complete", result: {} },
    budget: resolveAutomationStudioExplorationBudget(),
    classifyRefusal: webAutomationExplorationRefusalClassifier
  });

  assert.equal(exploration.stopReason, undefined);
  assert.equal(exploration.endedBy, "exploration.completed");
  assert.deepEqual(exploration.refusals, { out_of_scope_refused: 1 });
  assert.equal(exploration.refusedActions, 1);
  // Only the initial observation is evidence: the refused navigation never is.
  assert.equal(exploration.observedActions, 1);
  assert.equal(exploration.outcome, "evidence_gathered");
  assert.deepEqual(exploration.result, { finding: "the next page is outside the scope this exploration may reach" });
  assert.equal(commands.includes("web.browser.navigate"), false);
});

function registered(): AutomationStudioHarnessOptionRegistry {
  return registeredWith().registry;
}

function registeredWith(overrides: { scopePolicy?: { kind: "same_scope" } | { kind: "allowlist"; scopes: string[] }; sleep?: () => Promise<void> } = {}): {
  registry: AutomationStudioHarnessOptionRegistry;
  commands: string[];
  retained: WebLlmSnapshotBinding[];
  setTitle(title: string): void;
  /** The page the browser is on from now on, and whether it still shows the "Delete item" button. */
  setPage(url: string, withDelete: boolean): void;
} {
  const commands: string[] = [];
  const retained: WebLlmSnapshotBinding[] = [];
  let title = "Fixture";
  let location = "https://example.test/start";
  let withDelete = true;
  const handles = createWebLlmStableTargetHandles();
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      if (command.actionType === "web.browser.navigate") location = String(command.parameters.url);
      if (command.actionType === "web.dom.click") title = `${title} (opened)`;
      return command.actionType === "web.dom.capture_snapshot"
        ? { status: "succeeded", payload: { snapshot: snapshot(location, title, withDelete) } }
        : { status: "succeeded" };
    },
  };
  const registry = new AutomationStudioHarnessOptionRegistry();
  registry.register(webAutomationRecoveryHarnessOptionBundle(present<WebRecoveryHarnessContext>({
    gateway,
    scopePolicy: overrides.scopePolicy ?? { kind: "same_scope" },
    retainSelectors: (binding) => { retained.push(binding); },
    extractionHandles: createWebLlmExtractionHandles(),
    restamp: (scope, binding) => handles.restamp(scope, binding),
    sleep: overrides.sleep
  })));
  const setPage = (url: string, kept: boolean): void => {
    location = url;
    withDelete = kept;
  };
  return { registry, commands, retained, setTitle: (next) => { title = next; }, setPage };
}

function resolution(overrides: Partial<AutomationStudioHarnessOptionResolution> = {}): AutomationStudioHarnessOptionResolution {
  return {
    scope: { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID },
    stage: "gather",
    allowSideEffectsWithoutPolicy: true,
    ...overrides
  };
}

let callSequence = 0;

async function run(registry: AutomationStudioHarnessOptionRegistry, optionId: string, value: JsonObject): Promise<unknown> {
  callSequence += 1;
  return await registry.execute(
    { projectId: "project.one", flowId: "flow.one", callId: `call.${callSequence}`, optionId, value },
    resolution()
  );
}

async function execute(registry: AutomationStudioHarnessOptionRegistry, optionId: string, value: JsonObject): Promise<unknown> {
  const result = await run(registry, optionId, value);
  return (result as { evidence: unknown }).evidence;
}

function snapshot(url: string, title: string, withDelete = true): JsonObject {
  return {
    url,
    title,
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    evidence: { dialogs: { open: [{ role: "dialog", modal: true }] } },
    interactiveElements: [
      { tagName: "button", selector: "#close", role: "button", name: "Close", context: { landmark: "dialog" } },
      ...(withDelete ? [{ tagName: "button", selector: "#delete", role: "button", name: "Delete item", context: { landmark: "dialog" } }] : []),
      { tagName: "a", selector: "#next", name: "Next", href: `${new URL(url).origin}/next` }
    ]
  };
}
