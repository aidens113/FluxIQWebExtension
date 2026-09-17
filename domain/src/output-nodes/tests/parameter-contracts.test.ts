// The web output nodes' parameter contracts, which Core's Flow Bootstrap runs
// on a generated plan's literal values so a malformed `extractList` is refused
// before the plan is accepted rather than when the page is asked to read it.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../definitions";
import { webAutomationExtractListParameterContract } from "../extract-list";
import { webAutomationOutputNodeParameterContracts } from "../parameter-contracts";

const extractListNodeId = webAutomationOutputNodeId("web.dom.extract_list");

test("only the list extraction node has a contract, and it names a registered node", () => {
  assert.deepEqual(Object.keys(webAutomationOutputNodeParameterContracts), [extractListNodeId]);
  const node = webAutomationOutputNodeDefinitions.find((definition) => definition.id === extractListNodeId);
  // Core refuses to bind a contract to a built-in or unregistered node.
  assert.equal(node?.source.kind, "importer");
  assert.equal(webAutomationOutputNodeParameterContracts[extractListNodeId], webAutomationExtractListParameterContract);
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
