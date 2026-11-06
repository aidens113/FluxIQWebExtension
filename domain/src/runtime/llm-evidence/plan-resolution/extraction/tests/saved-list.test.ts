// A saved list read needs no handle in memory (t869, `../saved-list.ts`), through the real runtime:
// a detection, a read by its handle, and then what that read saved, handed to a runtime that has never
// seen it, as a restarted process or the next attempt's Flow is. Core's half, a real service over the
// same data directory, is `answer-first/tests/saved-read-restart.test.ts` in Core.

import assert from "node:assert/strict";
import test from "node:test";
import { runWithAutomationStudioEvidenceBuildScope } from "fluxiq/automation";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../../output-nodes";
import type { WebLlmRepeatingStructure } from "../../../structure";
import { CAPTURED_DETECTIONS } from "../../../structure/tests/captured-detections";
import { createWebAutomationLlmEvidenceRuntime } from "../../../tools";
import { WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID } from "../../../vocabulary";

const SCOPE = { projectId: "project.one", flowId: "flow.one" } as const;
const CAPTURE = CAPTURED_DETECTIONS["product-catalog-largest"];
const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const WRITTEN_FIELDS = { name: "product-name", price: "product-price" };
const KEY = "extractionBinding";

/** Saved parameters whose list is `list`, as a copy. */
function withList(parameters: JsonObject, list: JsonObject): JsonObject {
  const copy = structuredClone(parameters);
  copy.extractList = list;
  return copy;
}

/** The saved list with its binding changed, as a copy. */
function listWith(parameters: JsonObject, change: (list: JsonObject) => void): JsonObject {
  const list = structuredClone(parameters.extractList) as JsonObject;
  change(list);
  return withList(parameters, list);
}

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;

function aProcess(): { runtime: Runtime; reads: JsonObject[] } {
  const reads: JsonObject[] = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.extract_list") reads.push(structuredClone(command.parameters));
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: CAPTURE.url, title: CAPTURE.title, interactiveElements: [] };
      return { status: "succeeded", payload: { snapshot, structure: structuredClone(CAPTURE.structure) as JsonValue } };
    }
  });
  return { runtime, reads };
}

function inBuild<T>(scope: { projectId: string; flowId: string }, run: () => T, opening?: "fresh"): T {
  return runWithAutomationStudioEvidenceBuildScope(opening ? { ...scope, buildId: "build.one", opening } : { ...scope, buildId: "build.one" }, run);
}

const detect = async (runtime: Runtime, scope: { projectId: string; flowId: string } = SCOPE) => {
  await inBuild(scope, () => runtime.executeTool({ ...scope, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } }), "fresh");
  const detected = await inBuild(scope, () => runtime.executeTool({ ...scope, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} }));
  return (detected.evidence as WebLlmRepeatingStructure).extraction;
};

/** What a read by its handle saved, as what is saved comes back from disk. */
async function savedRead() {
  const first = aProcess();
  const handle = await detect(first.runtime);
  const read = await inBuild(SCOPE, () => first.runtime.executeTool({ ...SCOPE, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: EXTRACT_NODE, parameters: { extractList: { handle, fields: WRITTEN_FIELDS, minItems: 0 } }, consequences: [] } }));
  assert.equal(read.resultCode, "web.inspect.succeeded", JSON.stringify(read.evidence).slice(0, 300));
  const ranWith = JSON.parse(JSON.stringify(read.draft?.ranWith)) as { node: string; parameters: JsonObject; consequences?: JsonValue };
  const assembled = await first.runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: { extractList: { handle, fields: WRITTEN_FIELDS, minItems: 0 } }, declaredConsequences: [] });
  assert.equal(assembled.status, "resolved");
  return { handle, read, ranWith, resolved: (assembled as { parameters: JsonObject }).parameters.extractList, reads: first.reads };
}

test("what a read saves holds what its handle stood for, beside the handle, with no name for it", async () => {
  const { handle, ranWith } = await savedRead();
  const list = ranWith.parameters.extractList as JsonObject;
  assert.equal(list.handle, handle);
  const binding = list[KEY] as JsonObject;
  assert.equal(typeof (binding.extractList as JsonObject).item, "string");
  assert.equal(binding.handle, undefined);
});

test("what the model is shown of the read holds none of it", async () => {
  const { read, handle } = await savedRead();
  const shown = JSON.stringify(read.draft?.input);
  assert.equal(shown.includes(KEY), false);
  assert.equal((read.draft?.input as { parameters: { extractList: JsonObject } }).parameters.extractList.handle, handle);
  assert.equal(JSON.stringify(read.evidence).includes(KEY), false);
});

test("a process that never saw the list resolves the saved read to the request the first did, in the same Flow and under another", async () => {
  const { ranWith, resolved } = await savedRead();
  for (const flowId of ["flow.one", "flow.two"]) {
    const answer = await aProcess().runtime.resolvePlanNodeParameters({ projectId: SCOPE.projectId, flowId, nodeDefinitionId: EXTRACT_NODE, parameters: structuredClone(ranWith.parameters), declaredConsequences: [] });
    assert.equal(answer.status, "resolved", JSON.stringify(answer));
    assert.deepEqual((answer as { parameters: JsonObject }).parameters.extractList, resolved);
    assert.equal(JSON.stringify((answer as { parameters: JsonObject }).parameters).includes(KEY), false);
  }
});

test("the same process, under another Flow, and past the sixteen handles it keeps", async () => {
  const { runtime } = aProcess();
  const handle = await detect(runtime);
  const read = await inBuild(SCOPE, () => runtime.executeTool({ ...SCOPE, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: EXTRACT_NODE, parameters: { extractList: { handle, fields: WRITTEN_FIELDS, minItems: 0 } }, consequences: [] } }));
  const parameters = (read.draft?.ranWith as { parameters: JsonObject }).parameters;
  const other = await runtime.resolvePlanNodeParameters({ projectId: SCOPE.projectId, flowId: "flow.two", nodeDefinitionId: EXTRACT_NODE, parameters: structuredClone(parameters), declaredConsequences: [] });
  assert.equal(other.status, "resolved", JSON.stringify(other));
  for (let number = 0; number < 17; number += 1) await detect(runtime);
  const after = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: structuredClone(parameters), declaredConsequences: [] });
  assert.equal(after.status, "resolved", JSON.stringify(after));
});

test("a replay in a process that never saw the list reads the list the step saved", async () => {
  const { ranWith, resolved } = await savedRead();
  const fresh = aProcess();
  await inBuild(SCOPE, () => fresh.runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } }), "fresh");
  const replayed = await inBuild(SCOPE, () => fresh.runtime.executeTool({ ...SCOPE, callId: "replay.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { ...ranWith, replay: "step" } }));
  assert.equal(replayed.resultCode, "core.replay.replayed", JSON.stringify(replayed.evidence).slice(0, 300));
  assert.equal((fresh.reads.at(-1)?.extractList as JsonObject).item, (resolved as JsonObject).item);
});

test("where the store knows the same number as another list, the step's own list wins, and a new detection never issues a number a step holds", async () => {
  const { ranWith, resolved, handle } = await savedRead();
  const fresh = aProcess();
  const issued = await detect(fresh.runtime);
  assert.equal(issued, handle, "a new process counts from the start");
  const answer = await fresh.runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: structuredClone(ranWith.parameters), declaredConsequences: [] });
  assert.deepEqual((answer as { parameters: JsonObject }).parameters.extractList, resolved);
  const number = (name: string) => Number(name.slice(name.indexOf(".") + 1));
  const later = aProcess();
  const held = listWith(ranWith.parameters, (list) => { list.handle = "extraction.40"; });
  await later.runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: held, declaredConsequences: [] });
  assert.equal(number(await detect(later.runtime)) > 40, true);
});

test("a read saved before this, holding only its handle, is refused where the memory is gone, as it was", async () => {
  const { ranWith, handle } = await savedRead();
  const old = withList(ranWith.parameters, { handle, fields: WRITTEN_FIELDS, minItems: 0 });
  const answer = await aProcess().runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: old, declaredConsequences: [] });
  assert.equal(answer.status, "refused");
  assert.equal((answer as unknown as { issueCodes: string[] }).issueCodes.includes("web.handle.unknown"), true);
});

test("a model that writes one is refused: it is selectors it was never shown", async () => {
  const { ranWith } = await savedRead();
  const answer = await aProcess().runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: structuredClone(ranWith.parameters), declaredConsequences: [], writtenByModel: true });
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  const named = await aProcess().runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: structuredClone(ranWith.parameters), declaredConsequences: [], modelWrittenParameters: ["extractList"] });
  assert.equal(named.status, "refused", JSON.stringify(named));
});

test("what a step holds that cannot be read is as if it held nothing", async () => {
  const { ranWith } = await savedRead();
  const broken = listWith(ranWith.parameters, (list) => { list[KEY] = { extractList: "not a request" }; });
  const answer = await aProcess().runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: EXTRACT_NODE, parameters: broken, declaredConsequences: [] });
  assert.equal(answer.status, "refused");
  assert.equal((answer as unknown as { issueCodes: string[] }).issueCodes.includes("web.handle.unknown"), true);
});
