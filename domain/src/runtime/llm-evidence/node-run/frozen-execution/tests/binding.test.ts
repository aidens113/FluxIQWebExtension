import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebNodeFrozenExecution } from "..";
import { captureEvidence } from "../../../capture";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../../../failure";
import { EXTRACT, FLOW, NOW, PAGE, SNAPSHOT, TYPE, field, frozenHarness } from "./harness";

const TYPE_CALL: JsonObject = { node: TYPE, parameters: { target: { handle: "t1" }, text: "Fixed value" }, consequences: [] };

async function capturedType() {
  const host = frozenHarness();
  await host.run({ node: SNAPSHOT, parameters: {}, consequences: [] });
  const result = await host.run(TYPE_CALL);
  assert.equal(result.resultCode, "web.action.succeeded");
  const capture = host.snapshots.at(-1)!;
  assert.equal(capture.definitionId, TYPE);
  return { host, capture };
}

test("actual concrete inputs, scope, final lowering and successful receipt are captured privately", async () => {
  const { host, capture } = await capturedType();
  const command = host.mainCommands()[0]!;
  assert.deepEqual(capture.adapterValue, TYPE_CALL);
  assert.equal(capture.referenceNow, NOW);
  assert.deepEqual(capture.effectiveInputs, {});
  assert.equal(capture.definitionVersion, "1.0.0");
  assert.equal(capture.parameters.selector, "#original");
  assert.equal(capture.parameters.browserTabId, 4);
  assert.equal(capture.parameters.browserFrameId, 0);
  assert.equal(capture.dispatch.attempts.at(-1)?.identity, capture.dispatch.selected);
  assert.equal(capture.dispatch.attempts.at(-1)?.outcome, "succeeded");
  assert.ok(capture.dispatch.attempts.at(-1)?.receipt);
  assert.equal(Object.isFrozen(capture.parameters), true);
  assert.deepEqual(command.parameters.text, "Fixed value");
  assert.equal(JSON.stringify(capture.capsule), "{}");
});

test("a new target map reusing t1 cannot redirect a frozen node from its original record", async () => {
  const { host, capture } = await capturedType();
  host.replaceMaps();
  host.replaceControls([field("B", "#other"), field("A", "#refreshed")]);
  // Actually populate the replacement store, assigning the old public t1 to B.
  const page = await captureEvidence(host.base.gateway, "session.one", host.request({}));
  host.stores.targets.remember(FLOW, page);
  assert.equal(host.stores.targets.resolve(FLOW, "t1", page.evidence.location).ok, true);
  const resolve = host.stores.targets.resolve.bind(host.stores.targets);
  const resolveOn = host.stores.targets.resolveOn.bind(host.stores.targets);
  host.stores.targets.resolve = (...args) => {
    assert.notEqual(args[1], "t1", "the original model handle is never resolved in the replacement map");
    return resolve(...args);
  };
  host.stores.targets.resolveOn = (...args) => {
    assert.notEqual(args[1], "t1", "the original model handle is never resolved on the current page");
    return resolveOn(...args);
  };
  host.select(capture);
  let permissions = 0;
  const result = await host.run(TYPE_CALL, { permission: async () => {
    permissions += 1;
    return { permitted: true };
  } });
  assert.equal(result.resultCode, "web.action.succeeded");
  assert.equal(host.mainCommands().at(-1)?.parameters.selector, "#refreshed");
  assert.equal(host.mainCommands().at(-1)?.parameters.text, "Fixed value");
  assert.equal((result.evidence as JsonObject).controlHandle, "t2");
  assert.equal(permissions, 1);
  assert.equal(host.consumeCalls, 1);
  assert.equal(result.outputs, undefined);
  assert.equal(host.commands.some((command) => /navigate|reset/u.test(command.actionType)), false);
});

test("foreign, JSON-shaped and refused capsules stop before any new command", async () => {
  for (const mode of ["foreign", "json", "refused"] as const) {
    const { host, capture } = await capturedType();
    const before = host.commands.length;
    if (mode === "refused") host.refuse();
    else host.select(capture, mode === "json" ? JSON.parse(JSON.stringify(capture.capsule)) as object : {});
    const result = await host.run(TYPE_CALL);
    assert.equal(result.effectApplied, false);
    assert.equal(host.commands.length, before);
    assert.equal(host.consumeCalls, 0);
  }
});

test("another adapter binding cannot acknowledge this binding's capsule", async () => {
  const { host, capture } = await capturedType();
  const other = createWebNodeFrozenExecution({ capture: () => ({ kind: "unavailable", reason: "inactive" }), execution: () => ({ kind: "selected", capsule: capture.capsule, consume: () => { throw new Error("foreign consume"); } }) });
  assert.deepEqual(other.select(host.asRun(TYPE_CALL)), { kind: "refused" });
});

test("inactive and unreadable entry copies report closed provenance unavailability", () => {
  const inactive = createWebNodeFrozenExecution({ capture: () => ({ kind: "unavailable", reason: "inactive" }), execution: () => ({ kind: "ordinary" }) });
  assert.deepEqual(inactive.entry(TYPE_CALL), { kind: "unavailable", reason: "inactive" });
  const host = frozenHarness();
  const unreadable = new Proxy(TYPE_CALL, {});
  assert.deepEqual(host.binding.entry(unreadable), { kind: "unavailable", reason: "adapter_value_unreadable" });
  assert.equal(host.snapshots.length, 0);
});

test("changed document/resource/address and gone/ambiguous subjects dispatch no selected node", async () => {
  for (const change of ["document", "resource", "location", "gone", "ambiguous"] as const) {
    const { host, capture } = await capturedType();
    host.select(capture);
    if (change === "document") host.document(124);
    if (change === "resource") host.source("tab:5:frame:0");
    if (change === "location") host.location("https://workspace.test/elsewhere");
    if (change === "gone") host.replaceControls([]);
    if (change === "ambiguous") host.replaceControls([field("A", "#one"), field("A", "#two")]);
    const before = host.mainCommands().length;
    const result = await host.run(TYPE_CALL);
    assert.equal(result.effectApplied, false, change);
    assert.equal(host.mainCommands().length, before, change);
    assert.equal(host.consumeCalls, 0, change);
  }
});

test("a current permission refusal is retained and does not send a selected command", async () => {
  const { host, capture } = await capturedType();
  host.select(capture);
  const before = host.mainCommands().length;
  let permissions = 0;
  const result = await host.run(TYPE_CALL, { permission: async () => {
    permissions += 1;
    return { permitted: false, missing: [], requestId: "request.one" };
  } });
  assert.equal(result.resultCode, "web.action.rejected.permission_required");
  assert.equal(permissions, 1);
  assert.equal(host.mainCommands().length, before);
  assert.equal(host.consumeCalls, 0);
});

test("same-subject captures intern one stable private subject instead of a per-call nonce", async () => {
  const { host, capture } = await capturedType();
  await host.run(TYPE_CALL);
  assert.equal(host.snapshots.at(-1)?.subject, capture.subject);
  assert.equal(host.snapshots.at(-1)?.owner, capture.owner);
  assert.equal(host.snapshots.at(-1)?.generation, capture.generation);
});

test("adapter input is copied at entry before legacy handle/declaration shaping without freezing caller data", async () => {
  const host = frozenHarness();
  await host.run({ node: SNAPSHOT, parameters: {}, consequences: [] });
  const value: JsonObject = { node: TYPE, parameters: { target: { handle: "target.1" }, text: "Fixed value", consequences: [] } };
  const original = structuredClone(value);
  assert.equal((await host.run(value)).resultCode, "web.action.succeeded");
  const snapshot = host.snapshots.at(-1)!;
  assert.deepEqual(snapshot.adapterValue, original);
  assert.equal(Object.isFrozen(value.parameters), false);
  (value.parameters as JsonObject).text = "Later caller mutation";
  assert.equal((snapshot.adapterValue.parameters as JsonObject).text, "Fixed value");
});

test("an observation rereads current evidence under the captured scope and preserves its inspect code", async () => {
  const host = frozenHarness();
  const value = { node: SNAPSHOT, parameters: {}, consequences: [] };
  await host.run(value);
  const capture = host.snapshots.at(-1)!;
  host.select(capture);
  host.replaceControls([field("B", "#current")]);
  const result = await host.run(value);
  assert.equal(result.resultCode, "web.inspect.succeeded");
  assert.equal((result.evidence as JsonObject).ok, true);
  assert.equal(host.consumeCalls, 1);
  assert.equal(host.mainCommands().length, 0);
  assert.equal(host.commands.at(-1)?.parameters.browserTabId, 4);
  assert.equal(result.outputs, undefined);
});

test("missing implicit scope stays unproven and does not change an ordinary call", async () => {
  const host = frozenHarness();
  host.source("unaccounted");
  await host.run({ node: SNAPSHOT, parameters: {}, consequences: [] });
  assert.equal(host.snapshots.length, 0);
  const result = await host.run(TYPE_CALL);
  assert.equal(result.resultCode, "web.action.succeeded");
  assert.equal(host.snapshots.length, 0);
  assert.equal(host.mainCommands()[0]?.parameters.browserTabId, undefined);
});

test("a real replacement extraction map cannot change fixed query fields/default/reference or current rows", async () => {
  const host = frozenHarness();
  const handle = host.stores.extractions.reserve();
  host.stores.extractions.retain(FLOW, { handle, location: PAGE, itemCount: 2, extractList: { item: ".original-row", fields: { name: { kind: "text", selector: ".name" } } } });
  const value: JsonObject = { node: "web.output.dom-extract-list", parameters: { extractList: { handle, sort: [{ field: "name", order: "asc" }] } }, consequences: [] };
  const original = await host.run(value);
  assert.equal(original.resultCode, "web.inspect.succeeded");
  const capture = host.snapshots.at(-1)!;
  assert.equal(capture.definitionId, EXTRACT);
  assert.equal(capture.adapterValue.node, "web.output.dom-extract-list");
  assert.equal((capture.parameters.extractList as JsonObject).now, NOW);
  host.replaceMaps();
  const reused = host.stores.extractions.reserve();
  assert.equal(reused, handle);
  host.stores.extractions.retain(FLOW, { handle: reused, location: PAGE, itemCount: 1, extractList: { item: ".other-row", fields: { changed: { kind: "text", selector: ".other" } } } });
  host.stores.extractions.resolve = () => { throw new Error("old extraction handle resolved"); };
  host.answer(() => ({ status: "succeeded", payload: { extracted: [{ name: "Fresh row" }], url: PAGE } }));
  host.select(capture);
  const result = await host.run(value);
  assert.equal(result.resultCode, "web.inspect.succeeded");
  const actual = host.mainCommands().at(-1)!.parameters.extractList as JsonObject;
  assert.equal(actual.item, ".original-row");
  assert.equal(actual.now, NOW);
  assert.deepEqual(actual.fields, (capture.parameters.extractList as JsonObject).fields);
  assert.match(JSON.stringify(result.evidence), /Fresh row/u);
  assert.equal(result.outputs, undefined);
  assert.equal(host.mainCommands().length, 2);
});

test("reference/session changes and refused consumption never send the selected command", async () => {
  for (const mode of ["reference", "session", "consume"] as const) {
    const { host, capture } = await capturedType();
    host.select(capture);
    const before = host.mainCommands().length;
    if (mode === "consume") host.refuseConsumption();
    if (mode === "session") {
      const run = host.asRun(TYPE_CALL);
      assert.deepEqual(host.binding.select({ ...run, sessionId: "session.other" }), { kind: "refused" });
    } else {
      const result = await host.run(TYPE_CALL, mode === "reference" ? { referenceNow: NOW + 1 } : {});
      assert.equal(result.effectApplied, false);
    }
    assert.equal(host.mainCommands().length, before);
  }
});

test("selected state operations retain the ordinary retry count, codes and current evidence", async () => {
  const { host, capture } = await capturedType();
  host.select(capture);
  let calls = 0;
  host.answer(() => ++calls === 1 ? { status: "failed", failure: { category: "target_not_found", code: "web.target.not_found", retryable: true, stage: "target_resolution", effect: "unacted" } } : { status: "succeeded", payload: { value: "latest" } });
  const before = host.mainCommands().length;
  const result = await host.run(TYPE_CALL);
  assert.equal(result.resultCode, "web.action.succeeded");
  assert.equal((result.evidence as JsonObject).attempts, 2);
  assert.equal(host.mainCommands().length - before, 2);
  assert.equal(host.snapshots.length, 2, "selected execution never creates a fresh ordinary capture");
  assert.doesNotMatch(JSON.stringify(result), /"(?:capsule|generation|effectiveInputs|resetResource)"/u);
});

test("an uncertain committing operation keeps its original refusal and is never repeated", async () => {
  const host = frozenHarness();
  const value: JsonObject = { node: "web.output.dom-keypress", parameters: { target: { handle: "t1" }, key: "Enter" }, consequences: [] };
  await host.run({ node: SNAPSHOT, parameters: {}, consequences: [] });
  assert.equal((await host.run(value)).resultCode, "web.action.succeeded");
  const capture = host.snapshots.at(-1)!;
  const reported = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
  const failure = { ...reported, effect: "ambiguous" as const };
  host.answer(() => ({ status: "failed", failure, error: failure.code }));
  const ordinary = await host.run(value);
  host.select(capture);
  const before = host.mainCommands().length;
  const frozen = await host.run(value);
  assert.equal(frozen.resultCode, ordinary.resultCode);
  assert.equal(frozen.resultReason, "outcome_uncertain");
  assert.equal(frozen.failure?.effect, "ambiguous");
  assert.equal(host.mainCommands().length - before, 1);
});
