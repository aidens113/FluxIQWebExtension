// The translation from the runner's extract grammar into FluxIQ's own
// extraction request, and the driver that hands it to the extension.
//
// One row per grammar form, because each is a separate clause of the
// translation and a wrong one is silent: a mis-keyed field or a pagination mode
// that lost its control does not throw, it just measures something else.

import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { createExtractionIntentDriver, scenarioExtractionDefinition } from "../extract-intent.js";

// `imageAlt` is deliberately mixed case. The runner's field name is the record
// key verbatim, because that is what `expected.extracted` names its columns and
// what the recorded definition carries into Core's dataset schema; a key
// derived from it -- lower-cased, say -- would mis-align both silently.
const cardFields = { name: "testid:product-name", imageAlt: "testid:product-image@alt" };

function extractStep(step: Partial<ScenarioStep> = {}): ScenarioStep {
  return { id: "read", operation: "extract", target: "testid:product-card", fields: cardFields, ...step };
}

/** A control page whose `evaluate` records the message and answers with `reply`. */
function controlPage(reply: unknown | (() => unknown)) {
  const sent: unknown[] = [];
  const page = {
    evaluate: async (_callback: unknown, message: unknown) => {
      sent.push(message);
      return typeof reply === "function" ? (reply as () => unknown)() : reply;
    },
  } as unknown as Page;
  return { page, sent };
}

const scenarioPage = {} as unknown as Page;

test("a testid target and a testid field become CSS selectors, and the field names are the keys", () => {
  const definition = scenarioExtractionDefinition(extractStep());
  assert.deepEqual(definition, {
    form: "list",
    datasetId: "read:lab",
    label: "read",
    request: {
      item: '[data-testid="product-card"]',
      fields: {
        name: { kind: "text", selector: '[data-testid="product-name"]', handling: "include" },
        imageAlt: { kind: "attribute", selector: '[data-testid="product-image"]', attribute: "alt", handling: "include" },
      },
    },
    fieldLabels: { name: "name", imageAlt: "imageAlt" },
    itemCount: 0,
  });
});

test("a raw CSS target stays the selector it already is, in the item and in a field", () => {
  const definition = scenarioExtractionDefinition(extractStep({
    target: "tr[data-row]",
    fields: { title: ".card > h3" },
  }));
  assert.equal(definition.request.item, "tr[data-row]");
  assert.deepEqual(definition.request.fields.title, { kind: "text", selector: ".card > h3", handling: "include" });
});

test("column: keeps its header rather than becoming a selector, since the page supports it", () => {
  const definition = scenarioExtractionDefinition(extractStep({ fields: { total: "column:Order total" } }));
  assert.deepEqual(definition.request.fields.total, { kind: "column", header: "Order total", handling: "include" });
});

test("a bare @attribute reads the item itself, so the field carries no selector", () => {
  const definition = scenarioExtractionDefinition(extractStep({ fields: { href: "@href" } }));
  assert.deepEqual(definition.request.fields.href, { kind: "attribute", attribute: "href", handling: "include" });
});

test("no field declares required, so a value the page cannot read is null rather than a failed read", () => {
  const definition = scenarioExtractionDefinition(extractStep({ fields: { deferredImage: "testid:product-image@data-src" } }));
  // deepEqual refuses an extra key, so this is also the assertion that no
  // `required` travelled with the field.
  assert.deepEqual(definition.request.fields.deferredImage, {
    kind: "attribute", selector: '[data-testid="product-image"]', attribute: "data-src", handling: "include",
  });
});

test("next pagination carries its control, named as the domain names it", () => {
  const definition = scenarioExtractionDefinition(extractStep({ pagination: { next: "testid:pagination-next", maxPages: 5 } }));
  assert.deepEqual(definition.request.paginate, { mode: "next", next: '[data-testid="pagination-next"]', maxPages: 5 });
});

test("an explicit next mode reads the same as an absent one", () => {
  const definition = scenarioExtractionDefinition(extractStep({ pagination: { mode: "next", next: "testid:pagination-next", maxPages: 2 } }));
  assert.deepEqual(definition.request.paginate, { mode: "next", next: '[data-testid="pagination-next"]', maxPages: 2 });
});

test("loadMore pagination carries its control", () => {
  const definition = scenarioExtractionDefinition(extractStep({ pagination: { mode: "loadMore", control: "testid:load-more", maxPages: 10 } }));
  assert.deepEqual(definition.request.paginate, { mode: "loadMore", control: '[data-testid="load-more"]', maxPages: 10 });
});

test("scroll pagination carries its scroll bound and no selector", () => {
  const definition = scenarioExtractionDefinition(extractStep({ pagination: { mode: "scroll", maxScrolls: 20 } }));
  assert.deepEqual(definition.request.paginate, { mode: "scroll", maxScrolls: 20 });
});

test("numbered pagination carries the selector that matches every page control", () => {
  const definition = scenarioExtractionDefinition(extractStep({ pagination: { mode: "numbered", pages: '[data-testid^="pagination-page-"]', maxPages: 5 } }));
  assert.deepEqual(definition.request.paginate, { mode: "numbered", pages: '[data-testid^="pagination-page-"]', maxPages: 5 });
});

test("minItems is copied, so a workflow where an empty list is valid still says so", () => {
  assert.equal(scenarioExtractionDefinition(extractStep({ minItems: 0 })).request.minItems, 0);
  assert.equal(Object.hasOwn(scenarioExtractionDefinition(extractStep()).request, "minItems"), false);
});

test("the dataset id is the step's name made unique by the nonce", () => {
  const definition = scenarioExtractionDefinition(extractStep({ id: "extract-all-pages" }), "abc123");
  assert.equal(definition.datasetId, "extract-all-pages:abc123");
  assert.equal(definition.label, "extract-all-pages");
});

test("a role or frame target is a fixture defect, not a quiet fall back to reading the page here", () => {
  for (const target of ["role:listitem", "frame:Checkout/testid:line"]) {
    assert.throws(() => scenarioExtractionDefinition(extractStep({ target })), (error: unknown) =>
      error instanceof RunnerFailure && error.category === "fixture.invalid" && /CSS selector/.test(error.message));
  }
  assert.throws(() => scenarioExtractionDefinition(extractStep({ fields: { who: "role:heading" } })), (error: unknown) =>
    error instanceof RunnerFailure && error.category === "fixture.invalid");
});

test("a step naming no fields is a fixture defect", () => {
  assert.throws(() => scenarioExtractionDefinition(extractStep({ fields: {} })), (error: unknown) =>
    error instanceof RunnerFailure && error.category === "fixture.invalid" && /no fields/.test(error.message));
});

test("the driver sends one defineExtraction to the control page, carrying the definition and no timeout of its own", async () => {
  const { page, sent } = controlPage({ ok: true, records: [{ name: "Chair" }], pagesRead: 3, truncated: false, durationMs: 42 });
  const driver = createExtractionIntentDriver(page);

  const result = await driver(scenarioPage, extractStep({ timeoutMs: 1_000 }));

  assert.deepEqual(sent, [{ type: "fluxiq.test.defineExtraction", definition: scenarioExtractionDefinition(extractStep()) }]);
  assert.deepEqual(result, { records: [{ name: "Chair" }], nonStringValues: 0, pagesRead: 3, truncated: false, durationMs: 42 });
});

test("each definition gets its own nonce when the caller supplies one", async () => {
  const { page, sent } = controlPage({ ok: true, records: [] });
  let issued = 0;
  const driver = createExtractionIntentDriver(page, { newNonce: () => `n${(issued += 1)}` });

  await driver(scenarioPage, extractStep());
  await driver(scenarioPage, extractStep());

  assert.deepEqual(sent.map((message) => (message as { definition: { datasetId: string } }).definition.datasetId), ["read:n1", "read:n2"]);
});

test("a null value is kept as the answer an unread field gives, and anything else is counted out", async () => {
  const { page } = controlPage({
    ok: true,
    records: [{ name: "Chair", price: null }, { name: "Desk", price: 42, tags: ["a"] }, "not a record"],
  });

  const result = await createExtractionIntentDriver(page)(scenarioPage, extractStep());

  assert.deepEqual(result.records, [{ name: "Chair", price: null }, { name: "Desk" }]);
  assert.equal(result.nonStringValues, 3);
});

test("an unreported page count, truncation or duration is left out rather than invented", async () => {
  const { page } = controlPage({ ok: true, records: [{ name: "Chair" }] });

  const result = await createExtractionIntentDriver(page)(scenarioPage, extractStep());

  assert.deepEqual(result, { records: [{ name: "Chair" }], nonStringValues: 0 });
});

test("each refusal code is classified as what it actually says about the run", async () => {
  const rows: Array<[string, string]> = [
    ["invalid_definition", "fixture.invalid"],
    ["page_refused", "action.dispatch"],
    ["run_failed", "runtime.behavior"],
    ["not_recording", "recording.persistence"],
    ["forbidden", "extension.worker"],
    ["no_tab", "extension.worker"],
  ];
  for (const [code, category] of rows) {
    const { page } = controlPage({ ok: false, code, error: "The extraction did not run." });
    await assert.rejects(createExtractionIntentDriver(page)(scenarioPage, extractStep()), (error: unknown) =>
      error instanceof RunnerFailure && error.category === category && error.message.includes(code));
  }
});

test("an answer that is not the worker's is an extension failure rather than an empty read", async () => {
  for (const reply of [undefined, { ok: true }, { ok: true, records: "none" }]) {
    const { page } = controlPage(reply);
    await assert.rejects(createExtractionIntentDriver(page)(scenarioPage, extractStep()), (error: unknown) =>
      error instanceof RunnerFailure && error.category === "extension.worker");
  }
});
