// What an element is called in state. The cases that matter are the ones where
// two elements want the same name: before the assigner existed, the second one
// was dropped and the page lost every repeat of a control.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationElementStateInput } from "../../types";
import { elementStateId, elementStateIdAssigner, meaningfulText, stableAttribute, stableElementId } from "../identity";

function element(input: Partial<WebAutomationElementStateInput> & { selector: string }): WebAutomationElementStateInput {
  return { tagName: "button", ...input };
}

test("the state key comes from the authored identifier a re-render preserves", () => {
  assert.equal(elementStateId(element({ selector: "button.a", attributes: { "data-testid": "Save Row" } })), "save.row");
  assert.equal(elementStateId(element({ selector: "button.a", attributes: { "data-test": "save" } })), "save");
  assert.equal(elementStateId(element({ selector: "button.a", attributes: { "data-cy": "save" } })), "save");
  assert.equal(elementStateId(element({ selector: "button.a", attributes: { id: "save" } })), "save");
});

test("a name is folded in with the selector, because a group shares it", () => {
  const first = element({ tagName: "input", selector: "form > label:nth-of-type(1) > input", attributes: { name: "plan" } });
  const second = element({ tagName: "input", selector: "form > label:nth-of-type(2) > input", attributes: { name: "plan" } });
  assert.notEqual(elementStateId(first), elementStateId(second));
  assert.equal(elementStateId(first).startsWith("plan."), true);
});

test("with nothing authored the selector is the key, sanitized, never empty", () => {
  assert.equal(elementStateId(element({ selector: "button.save" })), "button.save");
  assert.equal(elementStateId(element({ selector: "#$%" })), "element");
});

test("a shared authored identifier is disambiguated, not collapsed", () => {
  const rows = [
    element({ selector: "tr:nth-child(1) button", attributes: { "data-testid": "row-action" } }),
    element({ selector: "tr:nth-child(2) button", attributes: { "data-testid": "row-action" } }),
    element({ selector: "tr:nth-child(3) button", attributes: { "data-testid": "row-action" } })
  ];
  const assign = elementStateIdAssigner();
  assert.deepEqual(rows.map(assign), ["row.action", "row.action.2", "row.action.3"]);
});

test("an element that is alone keeps the bare key, so unrepeated pages see no churn", () => {
  const assign = elementStateIdAssigner();
  assert.equal(assign(element({ selector: "button.save", attributes: { id: "save" } })), "save");
  assert.equal(assign(element({ selector: "button.cancel", attributes: { id: "cancel" } })), "cancel");
});

test("a suffixed key never overwrites an element whose own identifier spells it", () => {
  const assign = elementStateIdAssigner();
  const keys = [
    element({ selector: "button.a", attributes: { id: "row-action" } }),
    element({ selector: "button.b", attributes: { id: "row-action-2" } }),
    element({ selector: "button.c", attributes: { id: "row-action" } })
  ].map(assign);
  assert.deepEqual(keys, ["row.action", "row.action.2", "row.action.3"]);
  assert.equal(new Set(keys).size, keys.length);
});

test("a reserved key is not handed to an element", () => {
  const assign = elementStateIdAssigner(["count"]);
  assert.equal(assign(element({ selector: "span.total", attributes: { "data-testid": "count" } })), "count.2");
});

test("stableElementId reports the authored identifier, including a shared name", () => {
  assert.equal(stableElementId(element({ selector: "input", attributes: { name: "plan" } })), "plan");
  assert.equal(stableElementId(element({ selector: "input" })), undefined);
  assert.equal(stableAttribute(element({ selector: "input", attributes: { id: " " } }), "id"), undefined);
  assert.equal(meaningfulText("a"), false);
  assert.equal(meaningfulText(" ab "), true);
});
