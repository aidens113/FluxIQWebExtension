// An extraction node naming the list a detection found, in every placement a
// model was seen or is told to write it, and what a refusal tells it.
//
// The live failures these rows exist for:
// - `run-mu4wwkbc-df6cfe60` and six more catalog builds: the model detected
//   the 8 product cards, then wrote a literal `extractList` keyed
//   `name, price, rating, url`, because the handle could not rename a column
//   and the node's text offered only CSS. Its guessed selectors read 8 cards
//   and no field;
// - `run-mu4x5m2p-a4a4a29d`, `run-mu4xatjs-12a5a5c7`, `run-mu4xhkd9-d82265dc`,
//   `run-mu4xn1wz-6cdb8bbf` and `run-mu4xoqmk-e046f7bf`: the model wrote the
//   handle, and attempt after attempt was refused `web.handle.misplaced` or
//   `web.handle.malformed` with nothing saying where or why, until the build
//   gave up. Core tells it to add the `location` its evidence reported, which
//   this slot refused.
//
// The catalog request each row expects is the one the fixture's own recording
// reads (`apps/scenario-lab/src/scenarios/product-catalog/manifest.ts`,
// `cardFields`): the name, price and rating text and the link's `href` as
// written, inside each product card, on the page shown.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListRequestValue } from "../../../../../actions/extraction";
import { webAutomationOutputNodeId } from "../../../../../output-nodes";
import { webAutomationDerivedRecordOutput, webAutomationExtractListIssues } from "../../../../../output-nodes/extract-list";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../../..";
import { CAPTURED_DETECTIONS, type CapturedDetection } from "../../../structure/tests/captured-detections";

const EXTRACT_LIST_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const CATALOG = CAPTURED_DETECTIONS["product-catalog-largest"];
const EXTRACTION_HINT = "web.handle.expected.extract_list.handle_fields_paginate";
const TARGET_HINT = "web.handle.expected.selector.handle_location";

const CARD = '[data-testid="product-card"]';
const testId = (id: string) => `[data-testid="${id}"]`;
const NEXT = { next: testId("pagination-next"), maxPages: 3 };
/** What the fixture's recording reads from each card, as a request. */
const CARD_FIELDS = {
  name: { kind: "text", selector: testId("product-name"), required: true },
  price: { kind: "text", selector: testId("product-price"), required: true },
  rating: { kind: "text", selector: testId("product-rating"), required: true },
  url: { kind: "attribute", selector: testId("product-link"), attribute: "href", required: true }
} satisfies JsonObject;
/** The columns the instruction asked for, named by the detected keys the model was shown. */
const RENAMED = { name: "product-name", price: "product-price", rating: "product-rating", url: "product-link@href" };

function runtimeOver(capture: CapturedDetection): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: capture.url, title: capture.title, interactiveElements: [] };
      return { status: "succeeded", payload: { snapshot, structure: structuredClone(capture.structure) as JsonValue } };
    }
  });
}

let detections = 0;
async function detect(runtime: WebAutomationLlmEvidenceRuntime, flowId = "flow.one"): Promise<WebLlmRepeatingStructure> {
  detections += 1;
  const result = await runtime.executeTool({ projectId: "project.one", flowId, callId: `call.detect.${detections}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, "web.structure.detected");
  return result.evidence as WebLlmRepeatingStructure;
}

async function resolve(runtime: WebAutomationLlmEvidenceRuntime, nodeDefinitionId: string, parameters: JsonObject, flowId = "flow.one") {
  return await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId, nodeDefinitionId, parameters, declaredConsequences: NOTHING_LASTING });
}

function resolvedList(extractList: JsonObject) {
  return { status: "resolved", parameters: { extractList } };
}

/** A refusal for one reason at one position, with the placement it points to when it has one. */
function refusedAt(reason: string, position: string, hint?: string) {
  return { status: "refused", issueCodes: [reason, ...(hint ? [hint] : []), `${reason}:${position}`] };
}

/**
 * These rows are about handles, not permission. Every step they stand for
 * declared that it causes nothing lasting, which is what a build writes for a
 * press that only reveals: `plan-step-permission.test.ts` holds the rest.
 */
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

test("a detected list keeps the columns the plan names, under the plan's keys, on the page shown", async () => {
  const runtime = runtimeOver(CATALOG);
  const shown = await detect(runtime);
  assert.deepEqual(shown.fields.map((field) => field.key), ["product-image_src", "product-image_alt", "product-name", "product-link", "product-price", "product-rating", "stock-badge"]);

  const resolved = await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: shown.extraction, fields: RENAMED, paginate: false } });
  assert.deepEqual(resolved, resolvedList({ item: CARD, fields: CARD_FIELDS }));

  // What runs is a request the page reads as written, saved under the instruction's column names.
  const request = resolved.status === "resolved" ? resolved.parameters.extractList : undefined;
  const read = webAutomationExtractListRequestValue(request);
  assert.notEqual(read, undefined);
  assert.deepEqual(webAutomationExtractListIssues(request), []);
  assert.equal(webAutomationDerivedRecordOutput(read!).label, "Extracted list: name, price, rating, url");

  // The link column itself is the absolute address; only `@href` is the href as written.
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: shown.extraction, fields: { url: "product-link" }, paginate: false } }),
    resolvedList({ item: CARD, fields: { url: { kind: "link", selector: testId("product-link"), required: true } } })
  );
});

test("the handle keeps every detected column and the detected pagination unless the plan says otherwise", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);
  const whole = await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction } });
  const request = whole.status === "resolved" ? whole.parameters.extractList as JsonObject : {};
  assert.deepEqual(Object.keys(request.fields as JsonObject), ["product-image_src", "product-image_alt", "product-name", "product-link", "product-price", "product-rating", "stock-badge"]);
  assert.deepEqual(request.paginate, NEXT);

  // A pagination the model wrote names controls it was never shown: the detected one is read, bounded as the model said when the mode agrees.
  const rows: Array<[JsonValue, JsonObject]> = [
    [true, NEXT],
    [{ mode: "next", next: "a.next" }, NEXT],
    [{ mode: "next", next: "a.next", maxPages: 2 }, { ...NEXT, maxPages: 2 }],
    [{ maxPages: 1 }, { ...NEXT, maxPages: 1 }],
    [{ mode: "numbered", pages: "button.page", maxPages: 2 }, NEXT]
  ];
  for (const [paginate, expected] of rows) {
    assert.deepEqual(
      await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: { name: "product-name" }, paginate } }),
      resolvedList({ item: CARD, fields: { name: CARD_FIELDS.name }, paginate: expected }),
      JSON.stringify(paginate)
    );
  }
  // A column may be read twice, and the plan's bounds still apply.
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: { title: "product-name", name: "product-name" }, paginate: false, minItems: 0, maxItems: 8 }, timeoutMs: 20_000 }), {
    status: "resolved",
    parameters: { extractList: { item: CARD, fields: { title: CARD_FIELDS.name, name: CARD_FIELDS.name }, minItems: 0, maxItems: 8 }, timeoutMs: 20_000 }
  });
});

test("the list may be named with the location its evidence reported, at the item, or at each field", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction, location } = await detect(runtime);
  assert.equal(location, "http://127.0.0.1:4173/scenarios/product-catalog/");
  const reference = { handle: extraction, location };
  const byField = (extra: JsonObject) => Object.fromEntries(Object.entries(RENAMED).map(([key, column]) => [key, { ...extra, key: column }]));
  const placements: JsonObject[] = [
    // Core tells the model to add the location after exploring more than one place.
    { ...reference, fields: RENAMED, paginate: false },
    // The list named where a literal request names its items; a guessed item beside a handle is replaced by the detected one.
    { item: reference, fields: RENAMED, paginate: false },
    { item: { handle: extraction }, fields: RENAMED, paginate: false },
    // Each column named by the list's handle and the detected key it reads.
    { item: "li.product", fields: byField({ handle: extraction }), paginate: false },
    { fields: byField(reference), paginate: false },
    // `columns` for `fields`, and the map written the other way round.
    { handle: extraction, columns: RENAMED, paginate: false },
    { handle: extraction, fields: { "product-name": "name", "product-price": "price", "product-rating": "rating", "product-link@href": "url" }, paginate: false },
    // A column named by an object, a key in another case, or `@attr` written as its own key.
    {
      handle: extraction,
      fields: { name: { key: "Product-Name" }, price: { field: "product-price" }, rating: "PRODUCT-RATING", url: { column: "product-link", attribute: "href", kind: "attribute" } },
      paginate: false
    }
  ];
  for (const extractList of placements) {
    assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList }), resolvedList({ item: CARD, fields: CARD_FIELDS }), JSON.stringify(extractList));
  }
  // A bare reference names the column its own key names; an array keeps columns under their detected keys; a field may be made optional.
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: { "product-price": { handle: extraction }, name: { key: "product-name", required: false } }, paginate: false } }),
    resolvedList({ item: CARD, fields: { "product-price": CARD_FIELDS.price, name: { ...CARD_FIELDS.name, required: false } } })
  );
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: ["product-name", "product-link@href"], paginate: false } }),
    resolvedList({ item: CARD, fields: { "product-name": CARD_FIELDS.name, "product-link": CARD_FIELDS.url } })
  );
});

test("a table's columns may be named by header, and a feed's by attribute, with its scroll bounded", async () => {
  const table = runtimeOver(CAPTURED_DETECTIONS["data-table-largest"]);
  const rows = await detect(table);
  const header = (name: string) => ({ kind: "column", header: name, required: true });
  const inventory = { product: header("Product"), category: header("Category"), price: header("Price"), stock: header("Stock") };
  const item = CAPTURED_DETECTIONS["data-table-largest"].structure.ok ? CAPTURED_DETECTIONS["data-table-largest"].structure.proposal.item : "";
  for (const fields of [
    { product: "column:Product", category: "Category", price: "price", stock: { header: "Stock" } },
    ["product", "category", "price", "stock"],
    { product: { handle: rows.extraction }, category: { handle: rows.extraction }, price: { handle: rows.extraction }, stock: { handle: rows.extraction } }
  ] as JsonValue[]) {
    assert.deepEqual(await resolve(table, EXTRACT_LIST_NODE, { extractList: { handle: rows.extraction, fields } }), resolvedList({ item, fields: inventory }), JSON.stringify(fields));
  }
  assert.deepEqual(await resolve(table, EXTRACT_LIST_NODE, { extractList: { item: { handle: rows.extraction }, fields: { cheapest: "column:Price" }, maxItems: 1 } }), resolvedList({ item, fields: { cheapest: inventory.price }, maxItems: 1 }));
  // A table cell has no one element whose attribute could be read.
  assert.deepEqual(await resolve(table, EXTRACT_LIST_NODE, { extractList: { handle: rows.extraction, fields: { price: "price@title" } } }), refusedAt("web.handle.malformed", "extractList.fields.0", EXTRACTION_HINT));

  const feed = runtimeOver(CAPTURED_DETECTIONS["infinite-feed-largest"]);
  const posts = await detect(feed);
  assert.equal(posts.pagination, "infinite_scroll");
  assert.deepEqual(
    await resolve(feed, EXTRACT_LIST_NODE, { extractList: { handle: posts.extraction, fields: { title: "feed-item-title", author: "feed-item-author", published: "feed-item-time@datetime" }, paginate: { mode: "scroll", maxScrolls: 10 }, maxItems: 40 } }),
    resolvedList({
      item: testId("feed-item"),
      fields: {
        title: { kind: "text", selector: testId("feed-item-title"), required: true },
        author: { kind: "text", selector: testId("feed-item-author"), required: true },
        published: { kind: "attribute", selector: testId("feed-item-time"), attribute: "datetime", required: true }
      },
      paginate: { mode: "scroll", maxScrolls: 10 },
      maxItems: 40
    })
  );
  assert.deepEqual(await resolve(feed, EXTRACT_LIST_NODE, { extractList: { handle: posts.extraction, paginate: { mode: "scroll", maxScrolls: 51 } } }), refusedAt("web.handle.malformed", "extractList.paginate", EXTRACTION_HINT));
});

test("a Run Output node naming a web output resolves its payload as that output's own node would", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);
  assert.deepEqual(await resolve(runtime, "builtin.policy.action", { outputId: "web.dom.extract_list", parameters: { extractList: { handle: extraction, fields: RENAMED, paginate: false } }, timeoutMs: 30_000 }), {
    status: "resolved",
    parameters: { outputId: "web.dom.extract_list", parameters: { extractList: { item: CARD, fields: CARD_FIELDS } }, timeoutMs: 30_000 }
  });
  // An output that is not the web domain's, or a handle beside the payload, is not.
  assert.deepEqual(await resolve(runtime, "builtin.policy.action", { outputId: "other.output", parameters: { extractList: { handle: extraction } } }), refusedAt("web.handle.misplaced", "parameters.extractList", EXTRACTION_HINT));
  assert.deepEqual(await resolve(runtime, "builtin.policy.action", { outputId: "web.dom.extract_list", parameters: {}, recordOutput: { handle: extraction } }), refusedAt("web.handle.misplaced", "recordOutput", EXTRACTION_HINT));
});

test("what cannot name one detected list or column is refused with where the handle goes and where it went wrong", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);
  const second = (await detect(runtime)).extraction;
  assert.notEqual(second, extraction);

  const unknownField: JsonObject[] = [
    { handle: extraction, fields: { name: "name" } },
    { handle: extraction, fields: { name: ".product-name" } },
    { handle: extraction, fields: { name: "column:Name" } },
    { item: { handle: extraction }, fields: { name: { handle: extraction, key: "title" } } },
    { handle: extraction, fields: { name: { handle: extraction } } }
  ];
  for (const extractList of unknownField) {
    assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList }), refusedAt("web.handle.unknown_field", "extractList.fields.0", EXTRACTION_HINT), JSON.stringify(extractList));
  }
  const malformed: Array<[JsonObject, string]> = [
    [{ handle: extraction, fields: {} }, "extractList.fields"],
    [{ handle: extraction, fields: [] }, "extractList.fields"],
    [{ handle: extraction, fields: [7] }, "extractList.fields.0"],
    [{ handle: extraction, fields: { "a name": "product-name" } }, "extractList.fields.0"],
    [{ handle: extraction, fields: { title: "product-name", other: "product-name", "a name": "stock-badge" } }, "extractList.fields.2"],
    [{ handle: extraction, fields: { name: { kind: "text", selector: ".name" } } }, "extractList.fields.0.selector"],
    [{ handle: extraction, fields: { name: { key: "product-name", kind: "link" } } }, "extractList.fields.0.kind"],
    [{ handle: extraction, fields: { name: { key: "product-name", field: "product-price" } } }, "extractList.fields.0"],
    [{ handle: extraction, fields: { url: "product-link@" } }, "extractList.fields.0"],
    [{ handle: extraction, fields: { url: "product-link@on click" } }, "extractList.fields.0"],
    [{ handle: extraction, fields: { name: { handle: extraction, key: "product-name", extra: 1 } } }, "extractList.fields.0.2"],
    [{ handle: extraction, fields: ["product-name", "product-name"] }, "extractList.fields.1"],
    [{ handle: extraction, fields: RENAMED, columns: RENAMED }, "extractList.columns"],
    [{ handle: extraction, paginate: "next" }, "extractList.paginate"],
    [{ handle: extraction, paginate: { maxPages: 500 } }, "extractList.paginate"],
    [{ handle: extraction, itemElement: { tagName: "li" } }, "extractList.itemElement"],
    [{ handle: extraction, location: "" }, "extractList.location"],
    [{ handle: 7 }, "extractList.handle"],
    [{ handle: extraction, minItems: 9, maxItems: 8 }, "extractList"],
    [{ handle: extraction, minItems: -1 }, "extractList"],
    [{ item: { handle: extraction, extra: true }, fields: RENAMED }, "extractList.item"],
    [{ item: 7, fields: { name: { handle: extraction, key: "product-name" } } }, "extractList.item"]
  ];
  for (const [extractList, position] of malformed) {
    assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList }), refusedAt("web.handle.malformed", position, EXTRACTION_HINT), JSON.stringify(extractList));
  }
  // Two lists in one request cannot be read as one.
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: { name: { handle: second, key: "product-name" } } } }), refusedAt("web.handle.ambiguous", "extractList.fields.0"));
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { item: { handle: extraction }, fields: { name: { handle: second } } } }), refusedAt("web.handle.ambiguous", "extractList.fields.0"));
  // A location the handle was not issued at is not this handle; a handle not issued to this Flow is unknown to it.
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, location: "http://127.0.0.1:4173/elsewhere" } }), refusedAt("web.handle.unknown", "extractList.location"));
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { item: { handle: extraction } } }, "flow.two"), refusedAt("web.handle.unknown", "extractList.item"));
  // A handle anywhere else in the request, or of the wrong kind, is misplaced.
  const misplaced: Array<[JsonObject, string]> = [
    [{ extractList: { handle: extraction, paginate: { next: { handle: extraction } } } }, "extractList.paginate.next"],
    [{ extractList: { handle: "target.1" } }, "extractList"],
    [{ extractList: { item: { handle: "target.1" }, fields: { name: "td" } } }, "extractList.item"],
    [{ extractList: { item: "li", fields: { name: { kind: "text", selector: { handle: "target.1" } } } } }, "extractList.fields.0.selector"],
    [{ target: { handle: extraction } }, "target"],
    [{ selector: { handle: "target.1" } }, "selector"]
  ];
  for (const [parameters, position] of misplaced) {
    assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, parameters), refusedAt("web.handle.misplaced", position, EXTRACTION_HINT), JSON.stringify(parameters));
  }
  // An extraction handle on an element node belongs in an extraction node; a target handle on one belongs in its selector.
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: extraction } }), refusedAt("web.handle.misplaced", "selector", EXTRACTION_HINT));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: "#go", text: { handle: "target.1" } }), refusedAt("web.handle.misplaced", "text", TARGET_HINT));
});

test("a refusal quotes where it went wrong by position, never a key or value the model chose", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);
  const refusal = await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: { Jane_Doe: "product-name", "Card 4111": "Card 4111" } } });
  assert.deepEqual(refusal, refusedAt("web.handle.unknown_field", "extractList.fields.1", EXTRACTION_HINT));
  assert.equal(JSON.stringify(refusal).includes("Jane"), false);
  assert.equal(JSON.stringify(refusal).includes("4111"), false);
  // Every code is one Core admits: at most 100 characters of `[a-z0-9_.:-]`.
  const deep = await resolve(runtime, "builtin.data.transform", { records: [{ nested: { deeper: { deepest: { again: { handle: extraction } } } } }] });
  assert.equal(deep.status, "refused");
  for (const code of deep.status === "refused" ? deep.issueCodes : []) assert.match(code, /^[a-z0-9_.:-]{1,100}$/iu, code);
  assert.deepEqual(deep, refusedAt("web.handle.misplaced", "records.0.0.0.0.0", EXTRACTION_HINT));
});

test("once the Flow was shown a detected list, a literal request is refused as a guess; before that it is the model's own", async () => {
  const runtime = runtimeOver(CATALOG);
  const literal = { item: "li", fields: RENAMED };
  // No detection yet in this Flow: the literal is left exactly as written, as it passed live on the numbered-pages build.
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: literal }), { status: "unchanged" });

  await detect(runtime);
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: literal }), refusedAt("web.handle.extraction_required", "extractList", EXTRACTION_HINT));
  assert.deepEqual(await resolve(runtime, "builtin.policy.action", { outputId: "web.dom.extract_list", parameters: { extractList: literal } }), refusedAt("web.handle.extraction_required", "parameters.extractList", EXTRACTION_HINT));
  // Another Flow was shown nothing, and a node without a request is not a guess.
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: literal }, "flow.two"), { status: "unchanged" });
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { timeoutMs: 5_000 }), { status: "unchanged" });
});
