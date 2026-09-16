// src/recording/web-state/element/tests/identity.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/recording/web-state/element/identity.ts
var MAX_STATE_ID_LENGTH = 120;
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}
function stableAttribute(element2, name) {
  const value = element2.attributes?.[name];
  return meaningfulText(value) ? value : void 0;
}
function stableElementId(element2) {
  return stableAttribute(element2, "data-testid") ?? stableAttribute(element2, "data-test") ?? stableAttribute(element2, "data-cy") ?? stableAttribute(element2, "id") ?? stableAttribute(element2, "name");
}
function elementStateId(element2) {
  const stable = stableElementPathId(element2);
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element2, "name");
  if (name) return sanitizeStateId(`${name}.${element2.selector}`);
  return sanitizeStateId(element2.selector);
}
function elementStateIdAssigner(reservedIds = []) {
  const taken = new Set(reservedIds);
  const occurrences = /* @__PURE__ */ new Map();
  return (element2) => {
    const base = elementStateId(element2);
    let occurrence = (occurrences.get(base) ?? 0) + 1;
    let candidate = occurrence === 1 ? base : `${base}.${occurrence}`;
    while (taken.has(candidate)) {
      occurrence += 1;
      candidate = `${base}.${occurrence}`;
    }
    occurrences.set(base, occurrence);
    taken.add(candidate);
    return candidate;
  };
}
function stableElementPathId(element2) {
  return stableAttribute(element2, "data-testid") ?? stableAttribute(element2, "data-test") ?? stableAttribute(element2, "data-cy") ?? stableAttribute(element2, "id");
}
function sanitizeStateId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, MAX_STATE_ID_LENGTH) || "element";
}

// src/recording/web-state/element/tests/identity.test.ts
function element(input) {
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
  assert.equal(stableElementId(element({ selector: "input" })), void 0);
  assert.equal(stableAttribute(element({ selector: "input", attributes: { id: " " } }), "id"), void 0);
  assert.equal(meaningfulText("a"), false);
  assert.equal(meaningfulText(" ab "), true);
});
