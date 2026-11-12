// The web output nodes' parameter contracts, which Core's Flow Bootstrap runs
// on a generated plan's literal values so a malformed `extractList` or
// `extract` is refused before the plan is accepted rather than when the page is
// asked to read it. The single-value read's own rows are in
// `extract/tests/parameter-contract.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../definitions";
import { webAutomationExtractParameterContract } from "../extract";
import { webAutomationExtractListParameterContract } from "../extract-list";
import { webAutomationOutputNodeParameterContracts } from "../parameter-contracts";
import { webAutomationScrollParameterContract } from "../scroll";

const extractListNodeId = webAutomationOutputNodeId("web.dom.extract_list");
const extractNodeId = webAutomationOutputNodeId("web.dom.extract");
const scrollNodeId = webAutomationOutputNodeId("web.dom.scroll");

test("only the two extraction nodes and the scroll have a contract, and each names a registered node", () => {
  assert.deepEqual(Object.keys(webAutomationOutputNodeParameterContracts).sort(), [extractNodeId, extractListNodeId, scrollNodeId].sort());
  for (const id of [extractNodeId, extractListNodeId, scrollNodeId]) {
    const node = webAutomationOutputNodeDefinitions.find((definition) => definition.id === id);
    // Core refuses to bind a contract to a built-in or unregistered node.
    assert.equal(node?.source.kind, "importer", id);
  }
  assert.equal(webAutomationOutputNodeParameterContracts[extractListNodeId], webAutomationExtractListParameterContract);
  assert.equal(webAutomationOutputNodeParameterContracts[extractNodeId], webAutomationExtractParameterContract);
  assert.equal(webAutomationOutputNodeParameterContracts[scrollNodeId], webAutomationScrollParameterContract);
});

test("the contract checks extractList and nothing else", () => {
  const ask = (parameterId: string, value: Parameters<typeof webAutomationExtractListParameterContract>[0]["value"]) =>
    webAutomationExtractListParameterContract({ definitionId: extractListNodeId, parameterId, value });
  assert.deepEqual(ask("extractList", { item: "li", fields: { name: ".name" } }), []);
  assert.deepEqual([...ask("extractList", { nonsense: true })].sort(), [
    "web.extract_list.invalid_fields",
    "web.extract_list.invalid_item",
    "web.extract_list.unknown_key"
  ]);
  // A nested binding is passed to the contract as it is, and the dispatch
  // would refuse it unresolved.
  assert.deepEqual(ask("extractList", { item: { $state: { path: "run.item" } }, fields: { name: ".name" } }), ["web.extract_list.invalid_item"]);
  assert.deepEqual(ask("timeoutMs", "not a number"), []);
  assert.deepEqual(ask("recordOutput", { nonsense: true }), [], "Core parses a record output itself");
});

test("every code the contract can return has the form Core accepts", () => {
  // Core keeps a code that is lower-case and dot-separated, at most 120
  // characters, and not in its own `bootstrap.` namespace; anything else is
  // reported as a generic violation, and at most 8 are kept for one value.
  const malformed = [
    null, "x", {}, { item: "", fields: { "bad key": 1, a: { kind: "text", nope: 1 } }, itemElement: 1, paginate: { mode: "x", extra: 1 }, maxItems: 0, minItems: -1, frame: 1 },
    { item: "li", fields: { a: { kind: "text", handling: "exclude" } }, minItems: 2_000 },
    { item: "li", fields: {} }
  ];
  const seen = new Set<string>();
  for (const value of malformed) {
    const codes = webAutomationExtractListParameterContract({ definitionId: extractListNodeId, parameterId: "extractList", value });
    assert.notDeepEqual(codes, [], JSON.stringify(value));
    for (const code of codes) seen.add(code);
  }
  for (const code of seen) {
    assert.match(code, /^[a-z0-9_]+(\.[a-z0-9_]+)+$/u);
    assert.equal(code.length <= 120, true);
    assert.equal(code.startsWith("bootstrap."), false);
    assert.equal(code.startsWith("web.extract_list."), true);
  }
});

test("the implementation bundle hands Core the extraction contract, so a bad plan is refused before it runs", async () => {
  const { createWebAutomationOutputNodeImplementationBundle } = await import("../native-runtime");
  const bundle = createWebAutomationOutputNodeImplementationBundle();
  const id = webAutomationOutputNodeId("web.dom.extract_list");
  assert.equal(bundle.parameterContracts?.[id], webAutomationExtractListParameterContract);
  assert.equal(bundle.parameterContracts?.[webAutomationOutputNodeId("web.dom.extract")], webAutomationExtractParameterContract);
  // Only the two extractions and the scroll declare one; nothing else is silently bound.
  assert.deepEqual(Object.keys(bundle.parameterContracts ?? {}).sort(), [webAutomationOutputNodeId("web.dom.extract"), id, webAutomationOutputNodeId("web.dom.scroll")].sort());
  // A host extension may add to the bundle, but the contracts are still there.
  assert.equal(createWebAutomationOutputNodeImplementationBundle({}).parameterContracts?.[id], webAutomationExtractListParameterContract);
});

// A wait bound says how long a node waits for its act, not what it asks, so
// Core's repeat guard leaves it out of a call's identity only when the node
// declares it as timing (Core `runtime/llm/repeat-guard/timing-free.ts`; run
// `run-mwc6ut8u-52e3c1b3`, where a refused press ran again thirteen times with
// a changed `timeoutMs`). Every web node's wait bound is declared that way, and
// nothing that names what the act does is.
test("every web node declares its wait bound as timing, and only its wait bound", () => {
  const timing = webAutomationOutputNodeDefinitions.flatMap((definition) => definition.parameters.filter((parameter) => parameter.timing === true).map((parameter) => `${definition.id}:${parameter.id}`));
  assert.ok(timing.length > 0);
  for (const entry of timing) assert.match(entry, /:timeoutMs$/);
  for (const definition of webAutomationOutputNodeDefinitions) {
    const bound = definition.parameters.find((parameter) => parameter.id === "timeoutMs");
    if (bound) assert.equal(bound.timing, true, definition.id);
  }
  assert.ok(timing.includes(`${webAutomationOutputNodeId("web.dom.extract_list")}:timeoutMs`));
  assert.ok(timing.includes(`${webAutomationOutputNodeId("web.dom.click")}:timeoutMs`));
});
