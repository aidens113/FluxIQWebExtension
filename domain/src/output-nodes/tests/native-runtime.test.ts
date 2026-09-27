// T1 for Phase 1.2 step 5 on the node path. A node implementation runs before
// its output is dispatched — Core executes it, then dispatches the effects it
// returned and merges the dispatcher's status, message, and failure over the
// result (`runtime/executor/node-execution.ts`) — so it cannot and must not
// report the command's outcome. What it owes Core is one dispatch effect
// naming its own output and carrying the node's parameters unchanged; the
// status fidelity itself is covered by `io/tests/gateway-output-dispatcher`
// and `runtime/tests/adapter`.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio";
import type { AutomationNodeExecutionResult, AutomationStudioNativeNodeContext } from "fluxiq/automation-studio/nodes";
import type { JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionType } from "../../actions/types";
import { WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH } from "../extract-list";
import { createWebAutomationOutputNodeImplementationBundle } from "../native-runtime";

const bundle = createWebAutomationOutputNodeImplementationBundle();

async function execute(outputId: WebAutomationActionType, parameters: Record<string, JsonValue>): Promise<AutomationNodeExecutionResult> {
  const implementation = bundle.implementations[outputId];
  if (!implementation) throw new Error(`No trusted-local implementation is bound for ${outputId}.`);
  const context = { inputs: {}, parameters, log: () => undefined } as unknown as AutomationStudioNativeNodeContext;
  return await implementation(context);
}

test("every web automation action type has a bound implementation", () => {
  assert.deepEqual(Object.keys(bundle.implementations).sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort());
  assert.equal(bundle.packageId, "@fluxiq-web-extension/domain");
});

test("an implementation emits exactly one dispatch effect naming its own output", async () => {
  const result = await execute("web.dom.click", { selector: "#save", timeoutMs: 10_000 });
  assert.deepEqual(result.effects, [{
    type: "policy.output.dispatch",
    payload: { outputId: "web.dom.click", parameters: { selector: "#save", timeoutMs: 10_000 } }
  }]);
});

test("an implementation reports no status of its own for Core to trust", async () => {
  const result = await execute("web.dom.wait_for_selector", { selector: "#late" });
  // Core's merge overwrites status, route, message, and failure from the
  // dispatcher whenever the dispatch fails, so anything stated here about the
  // command's outcome would be a guess made before the command ran.
  assert.equal(result.status, "success");
  assert.equal(result.route, "success");
  assert.equal(result.message, undefined);
  assert.equal(result.failure, undefined);
});

// A list extraction built from an instruction names only the extraction. Core
// saves rows only when the dispatch carries `recordOutput`, so the node sends
// one whose schema is the request's field map, or the one its author set.
const extractList = {
  item: "li.product",
  fields: {
    name: ".name",
    link: { kind: "link", selector: "a" },
    email: { kind: "text", selector: ".email", handling: "exclude" },
    stock: { kind: "text", selector: ".stock", required: false }
  }
};

function dispatchedPayload(result: AutomationNodeExecutionResult): Record<string, JsonValue> {
  assert.equal(result.effects?.length, 1);
  const effect = result.effects?.[0];
  assert.equal(effect?.type, "policy.output.dispatch");
  return effect?.payload as Record<string, JsonValue>;
}

test("a created list extraction with no record output dispatches one derived from its fields", async () => {
  const payload = dispatchedPayload(await execute("web.dom.extract_list", { extractList }));
  const parsed = parseAutomationStudioRecordOutput(payload.recordOutput);
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  if (!parsed.ok) return;
  assert.deepEqual(parsed.output.schema.fields.map((field) => field.id), Object.keys(extractList.fields));
  assert.deepEqual(parsed.output.schema.fields.map((field) => [field.valueType, field.required, field.handling ?? "include"]), [
    ["string", true, "include"],
    ["url", true, "include"],
    ["string", true, "exclude"],
    ["string", false, "include"]
  ]);
  assert.equal(parsed.output.recordsPath, WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH);
  assert.equal(parsed.output.writeMode, "append");
  // The record output is Core's instruction, not the page's, and the node's
  // own parameters reach the page unchanged apart from the timeout.
  assert.deepEqual(payload.parameters, { extractList, timeoutMs: 10_000 });
  assert.equal(payload.outputId, "web.dom.extract_list");
});

test("an explicit null record output is the same as none", async () => {
  const absent = dispatchedPayload(await execute("web.dom.extract_list", { extractList }));
  const explicit = dispatchedPayload(await execute("web.dom.extract_list", { extractList, recordOutput: null }));
  assert.deepEqual(explicit, absent);
});

test("a created list extraction dispatches the record output its author set, with the output's records path", async () => {
  const recordOutput = {
    datasetId: "catalog",
    label: "Catalog",
    writeMode: "replace",
    schema: { schemaVersion: "0.1", fields: [{ id: "name", label: "Name", valueType: "string", required: true }] }
  };
  const payload = dispatchedPayload(await execute("web.dom.extract_list", { extractList: { item: "li", fields: { name: ".name" } }, recordOutput }));
  assert.deepEqual(payload.recordOutput, { ...recordOutput, recordsPath: WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH });
  assert.equal("recordOutput" in (payload.parameters as Record<string, JsonValue>), false);
  const parsed = parseAutomationStudioRecordOutput(payload.recordOutput);
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
});

test("a list extraction whose record output does not parse fails before the page is read", async () => {
  const result = await execute("web.dom.extract_list", { extractList, recordOutput: { nonsense: true } });
  assert.deepEqual(result.effects, []);
  assert.equal(result.status, "failed");
  assert.equal(result.route, "failed");
  assert.equal(result.failure?.code, "record_output.invalid");
  assert.equal(result.failure?.category, "graph_validation_or_unknown_node");
  assert.equal(result.failure?.retryable, false);
});

test("a list extraction whose field asks to be encrypted fails with Core's own code", async () => {
  const result = await execute("web.dom.extract_list", {
    extractList: { item: "li", fields: { name: ".name", card: { kind: "text", selector: ".card", handling: "encrypt" } } }
  });
  assert.deepEqual(result.effects, []);
  assert.equal(result.failure?.code, "record_output.encrypt_unavailable");
});

test("a list extraction left at the default timeout is given one per page it may read", async () => {
  const paged = { ...extractList, paginate: { mode: "next", next: "a.next", maxPages: 3 } };
  for (const timeoutMs of [undefined, 10_000]) {
    const parameters = timeoutMs === undefined ? { extractList: paged } : { extractList: paged, timeoutMs };
    const payload = dispatchedPayload(await execute("web.dom.extract_list", parameters));
    assert.equal((payload.parameters as Record<string, JsonValue>).timeoutMs, 30_000);
  }
  const scrolled = dispatchedPayload(await execute("web.dom.extract_list", { extractList: { ...extractList, paginate: { mode: "scroll", maxScrolls: 20 } } }));
  assert.equal((scrolled.parameters as Record<string, JsonValue>).timeoutMs, 200_000);
  const authored = dispatchedPayload(await execute("web.dom.extract_list", { extractList: paged, timeoutMs: 12_000 }));
  assert.equal((authored.parameters as Record<string, JsonValue>).timeoutMs, 12_000);
});

test("a list extraction whose request does not parse is sent as authored, for the dispatch to refuse", async () => {
  const payload = dispatchedPayload(await execute("web.dom.extract_list", { extractList: { nonsense: true } }));
  assert.deepEqual(payload, { outputId: "web.dom.extract_list", parameters: { extractList: { nonsense: true } } });
});

test("each of the seven new action types dispatches under its own output id", async () => {
  for (const outputId of ["web.dom.check", "web.dom.assert", "web.dom.extract_list", "web.dom.upload", "web.dom.dialog", "web.browser.tab", "web.browser.download"] as WebAutomationActionType[]) {
    const result = await execute(outputId, { selector: "#target" });
    const effect = result.effects?.[0];
    assert.equal(effect?.type, "policy.output.dispatch");
    assert.deepEqual(effect?.payload, { outputId, parameters: { selector: "#target" } });
  }
});

/**
 * A throw out of the implementation, which used to end the whole session.
 *
 * All eighteen of these nodes run through Core's `options.nativeNodeExecutor`
 * (`AS/runtime/executor/node-execution.ts:87`), which sits **outside** the try
 * block that guards `definition.execute`. A throw here propagated to
 * `service.ts`, which ended the session and rethrew: no attempt row, no ladder,
 * no repair, and no trace row naming the node that did it
 * (`docs/working/language-driven-flow-loop-plan/reports/t163-defensive-runtime-audit.md`,
 * section 3). Core gaining that guard is Core's half; this is the half that does
 * not depend on it.
 *
 * The throw is provoked through the parameters rather than by stubbing, because a
 * `getter` on the context's own parameters is what a real fault looks like here:
 * something the implementation reads while preparing the command misbehaves.
 */
test("an implementation that throws while preparing its command returns a failed result instead of ending the run", async () => {
  const implementation = bundle.implementations["web.dom.click"];
  assert.ok(implementation, "web.dom.click has no bound implementation");
  const parameters = {} as Record<string, JsonValue>;
  Object.defineProperty(parameters, "selector", {
    enumerable: true,
    get() {
      throw new Error("reading the parameter threw");
    }
  });
  const context = { inputs: {}, parameters, log: () => undefined } as unknown as AutomationStudioNativeNodeContext;

  const result = await implementation(context);
  assert.equal(result.status, "failed");
  assert.equal(result.route, "failed");
  assert.deepEqual(result.effects, [], "nothing may be dispatched for a command that could not be prepared");
  assert.equal(result.failure?.code, "output_node.implementation_threw");
  assert.equal(result.failure?.retryable, false, "the same parameters will not parse differently next time");
  assert.equal(result.failure?.stage, "dispatch");
  assert.match(String(result.failure?.actual), /reading the parameter threw/u);
  assert.match(String(result.message), /could not be prepared/u);
});

test("the extraction node's own throw is caught the same way, and reports the node rather than the reason alone", async () => {
  const implementation = bundle.implementations["web.dom.extract_list"];
  assert.ok(implementation, "web.dom.extract_list has no bound implementation");
  const parameters = {} as Record<string, JsonValue>;
  Object.defineProperty(parameters, "extractList", {
    enumerable: true,
    get() {
      throw new Error("the request threw while being read");
    }
  });
  const context = { inputs: {}, parameters, log: () => undefined } as unknown as AutomationStudioNativeNodeContext;

  const result = await implementation(context);
  assert.equal(result.status, "failed");
  assert.deepEqual(result.outputs, { error: { code: "output_node.implementation_threw", outputId: "web.dom.extract_list" } });
});
