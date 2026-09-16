// The dataset a recorded list extraction proposes, checked against the rules
// Core's parser applies to it (`record-sets/parse-output.ts`).
//
// The rule with the most riding on it is D12: an excluded column stays in the
// schema. Dropping it would leave the next field detection free to propose the
// column again, so a user who excluded their password column would have to
// exclude it a second time.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio";
import type { WebAutomationRecordedListExtraction } from "../../../actions/extraction";
import { webAutomationRecordOutput } from "../record-output";

function definition(overrides: Partial<WebAutomationRecordedListExtraction> = {}): WebAutomationRecordedListExtraction {
  return {
    form: "list",
    datasetId: "products:4f1c9a",
    label: "Products",
    itemCount: 24,
    request: {
      item: "li.product",
      fields: {
        name: { kind: "text", selector: ".name" },
        link: { kind: "link", selector: "a" },
        email: { kind: "text", selector: ".email", handling: "exclude" },
        stock: { kind: "text", selector: ".stock", required: false }
      }
    },
    fieldLabels: { name: "Product name", link: "Link", email: "Email", stock: "In stock" },
    ...overrides
  };
}

/** Core resolves the path from the output's own metadata, so a candidate names none. */
const RECORDS_PATH = "extracted";

test("the record output is one Core's own parser accepts", () => {
  const parsed = parseAutomationStudioRecordOutput({ ...webAutomationRecordOutput(definition()), recordsPath: RECORDS_PATH });
  assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.issues.join(", "));
});

test("it names no records path: Core takes that from the output definition", () => {
  assert.equal("recordsPath" in webAutomationRecordOutput(definition()), false);
});

test("every field the request declares is in the schema, the excluded one included (D12)", () => {
  const output = webAutomationRecordOutput(definition());
  assert.deepEqual(output.schema.fields.map((field) => field.id), ["name", "link", "email", "stock"]);
  const email = output.schema.fields.find((field) => field.id === "email");
  assert.equal(email?.handling, "exclude", "the exclusion persists, so detection does not propose the column again");
  assert.equal(output.schema.fields.filter((field) => field.handling !== undefined).length, 1, "no other field claims a handling");
});

test("a link is a URL and everything else is text, and only an optional field is optional", () => {
  const fields = new Map(webAutomationRecordOutput(definition()).schema.fields.map((field) => [field.id, field]));
  assert.equal(fields.get("link")?.valueType, "url");
  assert.equal(fields.get("name")?.valueType, "string");
  assert.equal(fields.get("stock")?.required, false, "a field picked as optional may be null in a row");
  assert.equal(fields.get("name")?.required, true);
});

test("a field key that is a bare selector string still becomes a required text column", () => {
  const output = webAutomationRecordOutput(definition({
    request: { item: "tr", fields: { name: "td.name" } },
    fieldLabels: { name: "Name" }
  }));
  assert.deepEqual(output.schema.fields, [{ id: "name", label: "Name", valueType: "string", required: true }]);
});

test("a field with no label of its own is named by its key", () => {
  const output = webAutomationRecordOutput(definition({ fieldLabels: {} }));
  assert.deepEqual(output.schema.fields.map((field) => field.label), ["name", "link", "email", "stock"]);
});

test("two columns with the same header do not make a schema Core refuses", () => {
  // A page can easily carry the same header twice, and Core refuses a schema
  // whose labels collide. The key disambiguates them, since it is unique.
  const output = webAutomationRecordOutput(definition({
    request: { item: "tr", fields: { price_net: "td.net", price_gross: "td.gross" } },
    fieldLabels: { price_net: "Price", price_gross: "Price" }
  }));
  assert.deepEqual(output.schema.fields.map((field) => field.label), ["Price", "Price (price_gross)"]);
  const parsed = parseAutomationStudioRecordOutput({ ...output, recordsPath: RECORDS_PATH });
  assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.issues.join(", "));
});

test("the rows one run keeps follow the request, held to Core's ceiling", () => {
  assert.equal(webAutomationRecordOutput(definition()).maxRecords, 1_000, "the default when the request names no maximum");
  assert.equal(webAutomationRecordOutput(definition({ request: { item: "tr", fields: { name: "td" }, maxItems: 200 } })).maxRecords, 200);
  assert.equal(webAutomationRecordOutput(definition({ request: { item: "tr", fields: { name: "td" }, maxItems: 50_000 } })).maxRecords, 10_000, "Core's ceiling");
});

test("a paginated read appends, so later pages do not replace the rows earlier ones stored", () => {
  assert.equal(webAutomationRecordOutput(definition()).writeMode, "append");
});

test("the dataset keeps the id and the name the recording gave it", () => {
  const output = webAutomationRecordOutput(definition());
  assert.equal(output.datasetId, "products:4f1c9a");
  assert.equal(output.label, "Products");
});
