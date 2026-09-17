import assert from "node:assert/strict";
import test from "node:test";
import {
  AutomationStudioHarnessOptionRegistry,
  resolveAutomationStudioExplorationBudget,
  runAutomationStudioRuntimeExploration,
  type AutomationStudioHarnessOptionResolution
} from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../../constants";
import type { WebLlmEvidenceGateway } from "../../capture";
import { present } from "../../present";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { createWebLlmExtractionHandles } from "../../structure";
import type { WebRecoveryHarnessContext } from "../execute";
import {
  webAutomationExplorationRefusalClassifier,
  webAutomationRecoveryHarnessOptionBundle,
  WEB_RECOVERY_HARNESS_OPTION_IDS
} from "..";

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

test("hands the model the six tool fields and none of the gate metadata", () => {
  const tools = registered().tools(resolution());

  for (const tool of tools) {
    assert.deepEqual(Object.keys(tool).filter((key) => !["toolId", "description", "inputSchema", "effect", "repeatPolicy", "initialObservation"].includes(key)), [], tool.toolId);
  }
  assert.equal(tools.filter((tool) => tool.initialObservation !== undefined).length, 1);
  assert.deepEqual(tools.filter((tool) => tool.effect === "mutate").map((tool) => tool.toolId), ["web.recovery.reveal", "web.recovery.act_safe", "web.recovery.navigate_in_scope"]);
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
    ["web.recovery.inspect", "web.recovery.wait_for_change", "web.recovery.detect_repeating_structure"]
  );
});

test("inspects the page, returns a sanitized packet naming elements by opaque handle, and keeps its selectors for the repair", async () => {
  const { registry, commands, retained } = registeredWith();

  const evidence = await execute(registry, "web.recovery.inspect", {});

  assert.equal((evidence as JsonObject).schemaVersion, "web-llm-evidence.v2");
  assert.deepEqual(((evidence as { elements: Array<{ target: string }> }).elements).map((element) => element.target), ["target.1", "target.2", "target.3"]);
  assert.equal(JSON.stringify(evidence).includes("#delete"), false);
  assert.deepEqual(commands, ["web.dom.capture_snapshot"]);
  // The packet the model was shown is the one retained, with the selectors
  // behind its handles, so a repair naming one of them gets its hint back.
  assert.equal(retained.length, 1);
  assert.deepEqual(retained[0]!.evidence, evidence);
  assert.equal(retained[0]!.selectors.get("target.2"), "#delete");
});

test("dismisses a corroborated control and refuses the destructive one beside it, retaining only what the model was shown", async () => {
  const { registry, commands, retained } = registeredWith();
  await execute(registry, "web.recovery.inspect", {});

  const refused = await run(registry, "web.recovery.act_safe", { target: "target.2" });
  assert.deepEqual(refused, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "target_unsafe" }, effectApplied: false, resultCode: "web.action.rejected.target_unsafe" });
  assert.equal(commands.includes("web.dom.click"), false);
  // The capture a refusal took was never shown, so nothing new is retained.
  assert.equal(retained.length, 1);

  const dismissed = await run(registry, "web.recovery.act_safe", { target: "target.1" });
  assert.equal((dismissed as { resultCode: string }).resultCode, "web.action.succeeded");
  assert.equal(commands.includes("web.dom.click"), true);
  // The pre-click capture is not a packet the model saw; the recapture is.
  assert.equal(retained.length, 2);
  assert.deepEqual(retained[1]!.evidence, (dismissed as { evidence: unknown }).evidence);
});

// A handle means something only against a packet this exploration returned.
// Before any packet, there is nothing the model could have copied it from, so
// the option refuses rather than binding the handle against a capture the
// model never saw.
test("refuses a target handle before this exploration has shown any packet, and clicks nothing", async () => {
  const { registry, commands } = registeredWith();

  for (const optionId of ["web.recovery.act_safe", "web.recovery.reveal", "web.recovery.detect_repeating_structure"]) {
    const refused = await run(registry, optionId, { target: "target.1" });
    assert.deepEqual(refused, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "target_unobserved" }, effectApplied: false, resultCode: "web.action.rejected.target_unobserved" }, optionId);
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

test("refuses a bounded wait that changed nothing rather than returning the same packet again", async () => {
  const still = registeredWith({ sleep: async () => {} });
  const unchanged = await run(still.registry, "web.recovery.wait_for_change", { maxWaitMs: 250 });

  assert.deepEqual(unchanged, { kind: "llm_evidence_tool_execution", evidence: { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "no_progress" }, effectApplied: false, resultCode: "web.action.rejected.no_progress" });

  const settling = registeredWith({ sleep: async () => { settling.setTitle("Loaded"); } });
  const changed = await run(settling.registry, "web.recovery.wait_for_change", { maxWaitMs: 9_999_999 });

  assert.equal((changed as { resultCode: string }).resultCode, "web.inspect.succeeded");
  assert.equal((changed as { effectApplied: boolean }).effectApplied, false);
});

// The whole seam in one run: Core's loop, Core's budget, Core's registry, this
// domain's options, this domain's semantic refusal. A model that asks to click
// "Delete" ends the exploration in `unsafe_action_blocked` -- not in
// `budget_exhausted`, and not in an exploration that quietly found nothing.
test("ends a run that asked for a destructive click in unsafe_action_blocked, through Core's own runner", async () => {
  const { registry, commands } = registeredWith();
  const decisions: JsonObject[] = [{ kind: "tool_call", callId: "call.one", toolId: "web.recovery.act_safe", input: { target: "target.2" } }];
  let index = 0;

  const exploration = await runAutomationStudioRuntimeExploration({
    loop: registry.evidenceLoopBinding({ projectId: "project.one", flowId: "flow.one" }, resolution()),
    decide: async () => decisions[index++] ?? { kind: "complete", result: { finding: "unreached" } },
    budget: resolveAutomationStudioExplorationBudget({ maxRefusedActions: 1 }),
    classifyRefusal: webAutomationExplorationRefusalClassifier
  });

  assert.equal(exploration.outcome, "unsafe_action_blocked");
  assert.equal(exploration.stopReason, "destructive_action_refused");
  assert.equal(exploration.result, undefined);
  assert.equal(exploration.refusedActions, 1);
  // The initial observation ran, so "it found nothing" would have been a
  // separate and equally wrong answer. It is not the one that came back.
  assert.equal(exploration.observedActions, 1);
  assert.equal(commands.includes("web.dom.click"), false);
});

function registered(): AutomationStudioHarnessOptionRegistry {
  return registeredWith().registry;
}

function registeredWith(overrides: { scopePolicy?: { kind: "same_scope" } | { kind: "allowlist"; scopes: string[] }; sleep?: () => Promise<void> } = {}): {
  registry: AutomationStudioHarnessOptionRegistry;
  commands: string[];
  retained: WebLlmSnapshotBinding[];
  setTitle(title: string): void;
} {
  const commands: string[] = [];
  const retained: WebLlmSnapshotBinding[] = [];
  let title = "Fixture";
  let location = "https://example.test/start";
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      if (command.actionType === "web.browser.navigate") location = String(command.parameters.url);
      if (command.actionType === "web.dom.click") title = `${title} (opened)`;
      return command.actionType === "web.dom.capture_snapshot"
        ? { status: "succeeded", payload: { snapshot: snapshot(location, title) } }
        : { status: "succeeded" };
    },
  };
  const registry = new AutomationStudioHarnessOptionRegistry();
  registry.register(webAutomationRecoveryHarnessOptionBundle(present<WebRecoveryHarnessContext>({
    gateway,
    scopePolicy: overrides.scopePolicy ?? { kind: "same_scope" },
    retainSelectors: (binding) => { retained.push(binding); },
    extractionHandles: createWebLlmExtractionHandles(),
    sleep: overrides.sleep
  })));
  return { registry, commands, retained, setTitle: (next) => { title = next; } };
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
    { projectId: "project.one", flowId: "flow.one", callId: `call.${callSequence}`, optionId, value, maxEvidenceBytes: 64_000 },
    resolution()
  );
}

async function execute(registry: AutomationStudioHarnessOptionRegistry, optionId: string, value: JsonObject): Promise<unknown> {
  const result = await run(registry, optionId, value);
  return (result as { evidence: unknown }).evidence;
}

function snapshot(url: string, title: string): JsonObject {
  return {
    url,
    title,
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    evidence: { dialogs: { open: [{ role: "dialog", modal: true }] } },
    interactiveElements: [
      { tagName: "button", selector: "#close", role: "button", name: "Close", context: { landmark: "dialog" } },
      { tagName: "button", selector: "#delete", role: "button", name: "Delete item", context: { landmark: "dialog" } },
      { tagName: "a", selector: "#next", name: "Next", href: `${new URL(url).origin}/next` }
    ]
  };
}
