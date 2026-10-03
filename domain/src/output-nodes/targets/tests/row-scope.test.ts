// The row scope of a recorded target (t195, moved here in t252 so the Flow's
// For Each pass and the build's test of a loop scope a control the same way).
// `../../tests/native-runtime.test.ts` covers the scope through the node
// implementation; these rows pin the function both callers share.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationScopedToRow } from "..";

const inRecord: JsonObject = {
  selector: "li.result:nth-of-type(1) button.add",
  element: { tagName: "BUTTON", visibleText: "Add to cart", context: { record: { text: "Blue Kettle $24.99 Add to cart" } } }
};

const atListPosition: JsonObject = {
  selector: "div[role=listitem]:nth-of-type(1) [aria-label=Confirm]",
  element: { tagName: "DIV", accessibleName: "Confirm", context: { listPosition: { index: 1, total: 8 } } }
};

test("a control the build saw in a record is scoped to the row's own values", () => {
  assert.deepEqual(webAutomationScopedToRow(inRecord, { title: "Red Toaster", price: "$39.99" }), {
    selector: inRecord.selector,
    element: { tagName: "BUTTON", visibleText: "Add to cart", context: { record: { values: ["Red Toaster", "$39.99"] } } }
  });
});

test("a control a built Flow found at a list position is scoped too, keeping its position", () => {
  assert.deepEqual(webAutomationScopedToRow(atListPosition, { name: "Amara Osei" }), {
    selector: atListPosition.selector,
    element: { tagName: "DIV", accessibleName: "Confirm", context: { listPosition: { index: 1, total: 8 }, record: { values: ["Amara Osei"] } } }
  });
});

test("no row, a row that is not an object, or a row with no text leaves the parameters as they are", () => {
  for (const item of [undefined, null, "Red Toaster", ["a"], { count: 3, blank: " " }] as Array<JsonValue | undefined>) {
    assert.equal(webAutomationScopedToRow(inRecord, item), inRecord, JSON.stringify(item));
  }
});

test("a control in no repeated thing is the same control on every pass", () => {
  const close: JsonObject = { selector: "dialog button.close", element: { tagName: "BUTTON", context: { landmark: "dialog" } } };
  assert.equal(webAutomationScopedToRow(close, { title: "Red Toaster" }), close);
  const bare: JsonObject = { selector: "#save" };
  assert.equal(webAutomationScopedToRow(bare, { title: "Red Toaster" }), bare);
});
