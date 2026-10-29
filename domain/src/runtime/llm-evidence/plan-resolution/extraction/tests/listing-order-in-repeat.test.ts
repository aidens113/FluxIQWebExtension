// Core's listing-order rule asks only for what this domain's read can do (t751).
//
// Photo rerun 5 (`run-mvhibis0-b536958b`, 0112-0113): a script with
// `extractList.where`, `extractList.maxItems: 3`, a click `repeat over` the
// listing and `repeat most: 3` was refused at `recordOutput.process.limit`, a
// key the model never wrote: the resolver writes the record output the dispatch
// runs (`../run-record-output.ts`), which carries the read's
// `maxItems` as `process.limit`. The rule's own answer, `extractList.sort`, maps
// to `process.sort` the same way and was refused too, and the brief ended
// between the two. Core's rule was tested on a Core plan, never on one this
// domain resolved, so these tests run Core's completion check on a script whose
// listing this domain resolves, with the read's definition as this domain
// declares it (`output-nodes/extract-list/rows-order.ts`). Since t796 Core
// hands a repeat over the listing the listing's own sort as its order, so a
// sort written on the listing is admitted and one written only in the process
// is refused with an instead that puts it there.

import assert from "node:assert/strict";
import test from "node:test";
import { checkAutomationStudioFlowBootstrapCompletion } from "fluxiq/automation-studio";
import { AutomationStudioNodeRegistry } from "fluxiq/automation-studio/nodes";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../../../constants";
import type { WebAutomationStructureDetection } from "../../../../../extraction";
import {
  WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  WEB_AUTOMATION_RUNTIME_PERMISSIONS,
  webAutomationOutputNodeDefinitions,
  webAutomationOutputNodeId,
  webAutomationOutputNodeParameterContracts
} from "../../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, type WebAutomationLlmEvidenceRuntime, type WebLlmRepeatingStructure } from "../../..";

const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const CODE = "record_output.process_order_in_repeat";
const resolution = {
  scope: { kind: "domain" as const, domainId: WEB_AUTOMATION_DOMAIN_ID },
  runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS
};

function registry(): AutomationStudioNodeRegistry {
  const value = new AutomationStudioNodeRegistry();
  for (const definition of webAutomationOutputNodeDefinitions) value.register(definition);
  for (const [nodeId, contract] of Object.entries(webAutomationOutputNodeParameterContracts)) value.bindParameterContract(nodeId, contract);
  return value;
}

/** A generic task list's columns under detector-shaped keys, with synthetic selectors. */
const COLUMNS = ["name", "due", "marker"] as const;
const keyOf = (name: string) => `div_task_div_${name}_span`;
const DETECTION: WebAutomationStructureDetection = {
  ok: true,
  proposal: {
    container: "ul.tasks",
    item: "ul.tasks > li.task",
    itemCount: 9,
    fields: COLUMNS.map((name) => ({ key: keyOf(name), label: `span.${name}`, spec: { kind: "text", selector: `span.${name}`, required: false }, coverage: 1 })),
    confidence: 0.8
  }
} as unknown as WebAutomationStructureDetection;

async function detected(): Promise<{ runtime: WebAutomationLlmEvidenceRuntime; handle: string }> {
  const shown = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: "http://127.0.0.1:4173/tasks/", title: "Tasks", interactiveElements: [] };
      return { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot } : { snapshot, structure: structuredClone(DETECTION) as unknown as JsonValue } };
    }
  });
  const result = await shown.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, "web.structure.detected");
  return { runtime: shown, handle: (result.evidence as WebLlmRepeatingStructure).extraction };
}

/** The listing's lines a script carries beside its handle and record output, keyed by what they set. */
type ListingLines = Map<string, string>;

/** The script: open the list, read it (this domain resolves it), and a lasting press repeated over the first three rows. */
function script(handle: string, listing: ListingLines): string {
  const fields = JSON.stringify(Object.fromEntries(COLUMNS.map((name) => [name, keyOf(name)])));
  return [
    "flow: Mark the first three unmarked tasks as done",
    "step: open the tasks",
    "  node: web.browser.navigate",
    "  url: http://127.0.0.1:4173/tasks/",
    "step tasks: list the unmarked tasks",
    "  node: web.dom.extract_list",
    `  extractList: {"handle": "${handle}", "fields": ${fields}}`,
    // The record output first: a dotted `recordOutput.process:` line below sets a key inside it.
    "  recordOutput: {\"datasetId\": \"done-tasks\", \"writeMode\": \"replace\"}",
    ...[...listing].map(([key, value]) => `  ${key}: ${value}`),
    "step: mark the task as done",
    "  node: web.dom.click",
    "  selector: .done",
    "  consequences: modify_existing",
    "  repeat over: tasks",
    "  repeat most: 3"
  ].join("\n");
}

/** Core's completion check, with this domain resolving the listing and nothing else changed. */
async function check(runtime: WebAutomationLlmEvidenceRuntime, flow: string) {
  return await checkAutomationStudioFlowBootstrapCompletion({
    result: { summary: "tasks", flow }, ...SCOPE, registry: registry(), resolution,
    binding: {
      resolvePlanNodeParameters: async (request) => request.nodeDefinitionId === EXTRACT_NODE ? await runtime.resolvePlanNodeParameters(request) : { status: "unchanged" }
    },
    permissionFor: () => async () => ({ permitted: true })
  });
}

/** This rule's refusals in a verdict, with the sentence and the instead each carries. */
function orderRefusals(verdict: Awaited<ReturnType<typeof check>>): JsonObject[] {
  if (verdict.ok) return [];
  const issues = ((verdict.check.feedback as JsonObject).issues ?? []) as JsonObject[];
  return issues.filter((issue) => issue.code === CODE);
}

function issueCodes(verdict: Awaited<ReturnType<typeof check>>): string[] {
  return verdict.ok ? [] : [...verdict.check.issueCodes];
}

const WHERE = "[{\"field\": \"marker\", \"is\": \"absent\"}]";

test("the live shape -- where, maxItems 3, repeat most 3 over a lasting press -- is admitted once this domain resolved its listing", async () => {
  const { runtime, handle } = await detected();
  const verdict = await check(runtime, script(handle, new Map([["extractList.where", WHERE], ["extractList.maxItems", "3"]])));
  assert.deepEqual(issueCodes(verdict), []);
});

test("a maxItems that is not the repeat's own is refused at extractList.maxItems, the key the model wrote", async () => {
  const { runtime, handle } = await detected();
  const verdict = await check(runtime, script(handle, new Map([["extractList.where", WHERE], ["extractList.maxItems", "5"]])));
  assert.deepEqual(issueCodes(verdict), [CODE]);
  const [refusal] = orderRefusals(verdict);
  assert.ok(refusal, JSON.stringify(verdict));
  // Core's feedback names the key at which it was refused; it must be the key the model wrote.
  assert.match(JSON.stringify(refusal), /extractList\.maxItems/u);
  assert.doesNotMatch(JSON.stringify(refusal), /process\.limit/u);
});

const SORTED = "[{\"field\": \"due\", \"order\": \"asc\", \"as\": \"date\"}]";

test("a sort on the listing, with a maxItems equal to repeat most, is admitted: Core hands the repeat the listing's own order", async () => {
  // Refused until t796 (every live `extractList.sort` was, run-mvtdn37t); Core now gives the For Each this sort as its order.
  const { runtime, handle } = await detected();
  const verdict = await check(runtime, script(handle, new Map([["extractList.where", WHERE], ["extractList.sort", SORTED], ["extractList.maxItems", "3"]])));
  assert.deepEqual(issueCodes(verdict), []);
});

/**
 * The refusal's `instead`, applied literally to the listing's lines: a sort it
 * shows is written at the key it names in its shape, and each key it says to
 * take out is removed, from inside the JSON line that holds it when it is one.
 */
function applyInstead(instead: string, listing: ListingLines): ListingLines {
  const next = new Map(listing);
  const sortShape = /`(extractList\.sort)`, written `(\[.*?\])`/u.exec(instead);
  if (sortShape) next.set(sortShape[1]!, sortShape[2]!.replace("<column>", "due"));
  for (const taken of instead.matchAll(/Take `([^`]+)` out/gu)) {
    const key = taken[1]!;
    if (next.delete(key)) continue;
    const parent = key.slice(0, key.lastIndexOf("."));
    const line = next.get(parent);
    if (line === undefined) continue;
    const value = JSON.parse(line) as JsonObject;
    delete value[key.slice(key.lastIndexOf(".") + 1)];
    next.set(parent, JSON.stringify(value));
  }
  return next;
}

test("the refusal's own instead for a sort written only in the process, applied literally, gives a Flow the rule admits", async () => {
  const { runtime, handle } = await detected();
  const inProcess: ListingLines = new Map([["extractList.where", WHERE], ["recordOutput.process", `{"sort": ${SORTED}, "limit": 3}`]]);
  const first = await check(runtime, script(handle, inProcess));
  assert.deepEqual(issueCodes(first), [CODE]);
  const [refusal] = orderRefusals(first);
  assert.ok(refusal && typeof refusal.instead === "string", JSON.stringify(first));
  // The instead puts the order on the listing, at the key this domain declares its author writes a sort.
  assert.match(String(refusal.instead), /`extractList\.sort`/u);
  const answered = applyInstead(String(refusal.instead), inProcess);
  const second = await check(runtime, script(handle, answered));
  assert.deepEqual(issueCodes(second), [], `instead: ${String(refusal.instead)}\nlines: ${JSON.stringify([...answered])}`);
});

test("a process limit written beside the listing, equal to repeat most, is admitted; a process sort is not", async () => {
  const { runtime, handle } = await detected();
  const limited = await check(runtime, script(handle, new Map([["extractList.where", WHERE], ["recordOutput.process", "{\"limit\": 3}"]])));
  assert.deepEqual(issueCodes(limited), []);
  const sortedInProcess = await check(runtime, script(handle, new Map([["extractList.where", WHERE], ["recordOutput.process", "{\"sort\": [{\"field\": \"due\", \"order\": \"asc\"}], \"limit\": 3}"]])));
  assert.deepEqual(issueCodes(sortedInProcess), [CODE]);
});
