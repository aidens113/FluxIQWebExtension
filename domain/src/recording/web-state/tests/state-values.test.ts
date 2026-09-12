// Writing one element into the `web` namespace, and the two different things
// this file calls sensitive.
//
// `StateValue.sensitive` is Core's marking on a stored value: "handle this
// carefully", set for any element carrying a value. The shared rule in
// `domain/src/sensitivity/` decides something stronger -- that the value must
// not be stored at all. These rows pin both, and pin that the marking is a
// superset of the rule, because collapsing the two would either stop marking
// ordinary typed values or start dropping them.
//
// Web state is persisted, replayed and displayed, which is why the value is
// dropped here as well as at the extension's reader. The reducer next door
// takes the same second look. Neither is the primary guard; both are the fence
// behind it.
//
// The values below are synthetic strings, named for their field. Nothing here
// resembles a real secret.

import assert from "node:assert/strict";
import test from "node:test";
import { addElementStateValues, elementStatePayload } from "../state-values";
import type { WebAutomationElementStateInput } from "../types";

const EMPTY = { schemaId: "test", schemaVersion: 1, timestamp: 0, namespaces: {} } as unknown as Parameters<typeof addElementStateValues>[0];

/** A value the producer was supposed to have withheld. Every sensitive row sends one anyway. */
const LEAKED = "synthetic-value-the-producer-should-have-withheld";

function element(overrides: Partial<WebAutomationElementStateInput>): WebAutomationElementStateInput {
  return { tagName: "input", selector: "#field", ...overrides };
}

function storedValue(input: WebAutomationElementStateInput): { payload: Record<string, unknown>; sensitive: unknown; label: unknown } {
  const state = addElementStateValues(EMPTY, { element: input, stateId: "field" }, 1_000, "source.1");
  const value = state.namespaces.web?.values["elements.field"] as Record<string, unknown> | undefined;
  assert.ok(value, "the element was not written into the web namespace");
  return {
    payload: value.value as Record<string, unknown>,
    sensitive: value.sensitive,
    label: (value.presentation as Record<string, unknown> | undefined)?.label
  };
}

test("a secret-bearing control's value is not stored, however it is marked", () => {
  for (const input of [
    element({ inputType: "password", value: LEAKED }),
    element({ attributes: { type: "password" }, value: LEAKED }),
    element({ attributes: { autocomplete: "billing cc-number" }, value: LEAKED }),
    element({ attributes: { autocomplete: "one-time-code" }, value: LEAKED }),
    element({ tagName: "select", attributes: { "data-sensitive": "true" }, value: LEAKED })
  ]) {
    const stored = storedValue(input);
    assert.equal(stored.payload.value, undefined, JSON.stringify(input.attributes ?? input.inputType));
    // The whole state value, not just the one field: a value that reappeared
    // in the label or an attribute would still be stored.
    assert.doesNotMatch(JSON.stringify(stored), new RegExp(LEAKED, "u"));
  }
});

test("presence and identity still land for a secret-bearing control", () => {
  const stored = storedValue(element({ inputType: "password", name: "Password", value: LEAKED }));
  assert.equal(stored.payload.tagName, "input");
  assert.equal(stored.payload.selector, "#field");
  assert.equal(stored.payload.name, "Password");
  assert.equal(stored.payload.inputType, "password");
});

test("a secret-bearing control with no other identity does not fall back to its value as a label", () => {
  const stored = storedValue(element({ inputType: "password", value: LEAKED }));
  assert.equal(stored.label, "#field");
});

test("an ordinary control keeps its value and its value as a label", () => {
  const stored = storedValue(element({ inputType: "email", value: "synthetic-user@example.test" }));
  assert.equal(stored.payload.value, "synthetic-user@example.test");
  assert.equal(stored.label, "synthetic-user@example.test");
  // The marking is unchanged for an ordinary value-bearing control.
  assert.equal(stored.sensitive, true);
});

test("the sensitive marking is a superset of the rule, never narrower", () => {
  // Marked because it carries a value, as before.
  assert.equal(storedValue(element({ inputType: "text", value: "synthetic-text" })).sensitive, true);
  // Marked because the rule protects it, even though no value survives to mark.
  assert.equal(storedValue(element({ inputType: "password" })).sensitive, true);
  assert.equal(storedValue(element({ attributes: { autocomplete: "billing cc-number" } })).sensitive, true);
  // Not marked: no value and nothing the rule protects. The marking is written
  // as an explicit `false` rather than omitted, as it always has been.
  assert.equal(storedValue(element({ tagName: "button", selector: "#go", name: "Go" })).sensitive, false);
});

test("the payload builder drops the value on its own, without the writer above it", () => {
  assert.equal(elementStatePayload(element({ inputType: "password", value: LEAKED })).value, undefined);
  assert.equal(elementStatePayload(element({ inputType: "text", value: "synthetic-text" })).value, "synthetic-text");
});
