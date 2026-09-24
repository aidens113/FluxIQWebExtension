import assert from "node:assert/strict";
import test from "node:test";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "@fluxiq-web-extension/domain/node";
import { validateAuthoredFlowNodes } from "@fluxiq-web-extension/test-contracts";
import { screenedNodeParameters } from "../parameter-screen.js";

const screen = (parameters: Record<string, unknown>) => screenedNodeParameters(parameters, WEB_LLM_DENIED_EVIDENCE_KEYS);

/**
 * The parameters six `product-catalog` runs failed on. Each returned 23 records
 * where 8 were asked for -- eight products a page across three pages -- and the
 * run's own artifacts could not say whether the Flow had been authored to
 * paginate at all. These are the values that answer it, and every one of them
 * is a number, a boolean or a closed word, so the answer costs nothing.
 */
test("a pagination parameter travels whole, which is the question six undiagnosable runs could not ask", () => {
  const screened = screen({ pagination: { mode: "next", maxPages: 3 }, paginate: true, minRecords: 8 });
  assert.deepEqual(screened.values, { pagination: { mode: "next", maxPages: 3 }, paginate: true, minRecords: 8 });
  assert.deepEqual(screened.withheld, [], "nothing here could carry a page");
});

test("the domain's denied key is withheld by its name alone, and its place does not survive to be misread as a value", () => {
  const screened = screen({ selector: "[data-testid=\"card\"]", html: "<ul><li>Lamp</li></ul>", pagination: { mode: "scroll", maxScrolls: 4 } });
  assert.deepEqual(screened.values, { pagination: { mode: "scroll", maxScrolls: 4 } });
  assert.deepEqual(screened.withheld, ["selector", "html"], "each is named where it was, so a screened-out parameter cannot read as one the step never had");
});

/**
 * The shape survives where the values cannot: an extraction's field map is
 * keyed by the columns the model asked the page for, and those keys are what
 * says whether it asked for the right ones.
 */
test("an extraction's column ids stay, with null where each column's locator was", () => {
  const screened = screen({ fields: { name: "[data-testid=\"name\"]", price: ".card > .price" } });
  assert.deepEqual(screened.values, { fields: { name: null, price: null } });
  assert.deepEqual(screened.withheld, ["fields.name", "fields.price"]);
});

test("an absolute URL is carried as its origin and never its path or query", () => {
  const screened = screen({ url: "http://127.0.0.1:4100/scenarios/product-catalog/?page=2&q=lamp" });
  assert.deepEqual(screened.values, { url: "http://127.0.0.1:4100" });
  assert.deepEqual(screened.withheld, []);
  assert.deepEqual(screen({ url: "https://user:secret@example.com/orders" }).values, { url: null }, "an authority carrying userinfo is refused rather than trimmed");
  assert.deepEqual(screen({ url: "/scenarios/product-catalog/?page=2" }).values, { url: null }, "a relative path is ordinary text and falls to the key rule");
});

test("a value a person or a page supplied is withheld whatever its key looks like", () => {
  assert.deepEqual(screen({ text: "hunter2", value: "4111 1111 1111 1111" }), { values: { text: null, value: null }, withheld: ["text", "value"] });
  assert.deepEqual(screen({ label: "x".repeat(81) }), { values: { label: null }, withheld: ["label"] }, "a name past the length bound is text, not a name");
  assert.deepEqual(screen({ label: "Add to cart" }), { values: { label: "Add to cart" }, withheld: [] });
  assert.deepEqual(screen({ target: { kind: "handle", handle: "el-3" } }), { values: {}, withheld: ["target"] }, "Core's own word for something a model could execute");
});

test("a list is carried as its count, with as much of it as survives the screen", () => {
  const screened = screen({ columns: [{ field: "name" }, { field: "price" }], steps: ["Click <b>here</b>"] });
  assert.deepEqual(screened.values, { columns: { count: 2, items: [{ field: "name" }, { field: "price" }] }, steps: { count: 1 } });
  assert.deepEqual(screened.withheld, ["steps[0]"], "a list's index is not a name, so its bare strings fall to the key rule");
});

test("the screen's output is a record the contract accepts, denied keys and all", () => {
  const screened = screen({ pagination: { mode: "next", maxPages: 3 }, selector: "#rows", fields: { name: "[data-testid=\"name\"]" }, url: "http://127.0.0.1:4100/catalog" });
  const node = { nodeId: "node.extract", definitionId: "web.output.dom-extract_list", outputId: "web.dom.extract_list", parameters: screened.values, parametersWithheld: screened.withheld };
  assert.deepEqual(validateAuthoredFlowNodes([node], WEB_LLM_DENIED_EVIDENCE_KEYS), { valid: true, value: [node] });
});
