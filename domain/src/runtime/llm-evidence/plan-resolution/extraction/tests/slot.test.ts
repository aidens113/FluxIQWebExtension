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
const MAX_PAGES_INSIDE_PAGINATE = "web.handle.expected.extract_list.paginate.maxPages";

const CARD = '[data-testid="product-card"]';
const testId = (id: string) => `[data-testid="${id}"]`;
const NEXT = { next: testId("pagination-next"), maxPages: 3 };
/** What the fixture's recording reads from each card, as a request. None is required: a read requires a column only where it says so, whatever coverage the detection measured (`../columns.ts`, `unrequired`). */
const CARD_FIELDS = {
  name: { kind: "text", selector: testId("product-name"), required: false },
  price: { kind: "text", selector: testId("product-price"), required: false },
  rating: { kind: "text", selector: testId("product-rating"), required: false },
  url: { kind: "attribute", selector: testId("product-link"), attribute: "href", required: false }
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
    resolvedList({ item: CARD, fields: { url: { kind: "link", selector: testId("product-link"), required: false } } })
  );
});

test("a column named in the instruction's own words resolves to the detected one rather than refusing", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);

  // Word for word what the seven catalog builds of `run-mu4wwkbc-df6cfe60` and
  // its neighbours wrote, because those are the instruction's words. Every
  // column was refused `web.handle.unknown_field`, and the build fell back to
  // guessed CSS that read eight cards and no field. It now resolves to the
  // request the fixture's own recording reads, and a condition written in the
  // same words resolves with it.
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, {
      extractList: {
        handle: extraction,
        fields: { name: "name", price: "price", rating: "rating", url: "product-link@href" },
        where: [{ field: "rating", atLeast: 4 }, { field: "stock", is: "present" }],
        paginate: false
      }
    }),
    resolvedList({
      item: CARD,
      fields: CARD_FIELDS,
      where: [
        { field: "rating", atLeast: 4 },
        { read: { kind: "text", selector: testId("stock-badge"), required: true }, is: "present" }
      ]
    })
  );

  // A selector written where a column name goes is a name too: Core's normalizer
  // folds `.` with the other separators, so `.product-name` is the `product-name`
  // column spelled differently rather than a guess at one.
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: { name: ".product-name" }, paginate: false } }),
    resolvedList({ item: CARD, fields: { name: CARD_FIELDS.name } })
  );
  // A field that names its column by nothing but the key it is kept under.
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: { name: { handle: extraction } }, paginate: false } }),
    resolvedList({ item: CARD, fields: { name: CARD_FIELDS.name } })
  );

  // What each name assumed to get there is on the slot's own resolution, which
  // `column-match.test.ts` measures; `resolvePlanNodeParameters` does not carry
  // it yet, and that hop is named on `WebExtractionSlotResolution`.
});

test("a list of the instruction's column names keeps each column under the name written, not the detected key it was read as", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);

  // "Columns item, quantity and price" written as a list: until 2026-09-29 each
  // guessed column was kept under its detected key, so the rows came back as
  // `product-name`, `product-price` and `product-rating` and an oracle comparing
  // by the instruction's names found none of them
  // (`lane-run-mum06sfc-f1d9403f.md`, cause 2).
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: ["name", "price", "rating", "url@href"], paginate: false } }),
    resolvedList({ item: CARD, fields: { name: CARD_FIELDS.name, price: CARD_FIELDS.price, rating: CARD_FIELDS.rating, url: CARD_FIELDS.url } })
  );
  // A name that is the detected key, or that could not be a key itself, keeps the detected key.
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: ["product-name", ".product-price"], paginate: false } }),
    resolvedList({ item: CARD, fields: { "product-name": CARD_FIELDS.name, "product-price": CARD_FIELDS.price } })
  );
});

test("the handle keeps every detected column and the detected pagination unless the plan says otherwise", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);
  const whole = await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction } });
  const request = whole.status === "resolved" ? whole.parameters.extractList as JsonObject : {};
  assert.deepEqual(Object.keys(request.fields as JsonObject), ["product-image_src", "product-image_alt", "product-name", "product-link", "product-price", "product-rating", "stock-badge"]);
  assert.deepEqual(request.paginate, NEXT);

  // A pagination the model wrote names controls it was never shown: the detected one is read, bounded as the model said whatever mode it named.
  // Until 2026-10-01 a bound under another mode was dropped for the detected one, and detection
  // now proposes one page: a plan that saw Guildline's numbered pager and asked for five pages
  // read one, truncated (t194-w27 G2).
  const rows: Array<[JsonValue, JsonObject]> = [
    [true, NEXT],
    [{ mode: "next", next: "a.next" }, NEXT],
    [{ mode: "next", next: "a.next", maxPages: 2 }, { ...NEXT, maxPages: 2 }],
    [{ maxPages: 1 }, { ...NEXT, maxPages: 1 }],
    [{ mode: "numbered", pages: "button.page", maxPages: 2 }, { ...NEXT, maxPages: 2 }],
    [{ mode: "numbered", pages: "button.page" }, NEXT],
    // A scroll count says how far to read as a page count does.
    [{ mode: "scroll", maxScrolls: 2 }, { ...NEXT, maxPages: 2 }],
    [{ mode: "numbered", maxPages: 4, maxScrolls: 2 }, { ...NEXT, maxPages: 4 }]
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

test("a page bound written beside paginate instead of inside it bounds the read's paging, and only where it can mean nothing else", async () => {
  // Live run `run-mustvzvg-99695308` (steps 0057, 0060): the model reran a list
  // read with `maxPages: 10` beside `paginate: {next: "a[rel=next]"}` and was
  // refused `web.handle.malformed:extractList.maxPages`. A read that pages has
  // one place a page count can go, so it is read there, and the Flow keeps it
  // there: the resolved request carries `paginate.maxPages` and no top-level key.
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);
  const fields = { name: "product-name" };
  const read = { item: CARD, fields: { name: CARD_FIELDS.name } };
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields, paginate: { next: "a[rel=next]" }, minItems: 0, maxPages: 10 } }),
    resolvedList({ ...read, paginate: { ...NEXT, maxPages: 10 }, minItems: 0 })
  );
  // The same value written in both places says it once; the detected pagination, read when nothing is written, is bounded the same way.
  for (const paginate of [{ next: "a[rel=next]", maxPages: 10 }, true, undefined]) {
    const extractList: JsonObject = { handle: extraction, fields, maxPages: 10 };
    if (paginate !== undefined) extractList.paginate = paginate;
    assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList }), resolvedList({ ...read, paginate: { ...NEXT, maxPages: 10 } }), JSON.stringify(paginate));
  }
  // Two different page counts are not one: refused, naming both.
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields, paginate: { next: "a[rel=next]", maxPages: 3 }, maxPages: 10 } }), {
    status: "refused",
    issueCodes: ["web.handle.malformed", EXTRACTION_HINT, "web.handle.malformed:extractList.maxPages", "web.handle.malformed:extractList.paginate.maxPages"]
  });
  // A read that does not page has nowhere for a page count: refused, saying it belongs inside paginate.
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields, paginate: false, maxPages: 10 } }), {
    status: "refused",
    issueCodes: ["web.handle.malformed", EXTRACTION_HINT, MAX_PAGES_INSIDE_PAGINATE, "web.handle.malformed:extractList.maxPages"]
  });
  // A scroll count beside paginate is the same mistake on a feed.
  const feed = runtimeOver(CAPTURED_DETECTIONS["infinite-feed-largest"]);
  const posts = await detect(feed);
  const scrolled = await resolve(feed, EXTRACT_LIST_NODE, { extractList: { handle: posts.extraction, paginate: { mode: "scroll" }, maxScrolls: 4 } });
  assert.deepEqual(scrolled.status === "resolved" ? (scrolled.parameters.extractList as JsonObject).paginate : scrolled, { mode: "scroll", maxScrolls: 4 });
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
  const header = (name: string) => ({ kind: "column", header: name, required: false });
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
        title: { kind: "text", selector: testId("feed-item-title"), required: false },
        author: { kind: "text", selector: testId("feed-item-author"), required: false },
        published: { kind: "attribute", selector: testId("feed-item-time"), attribute: "datetime", required: false }
      },
      paginate: { mode: "scroll", maxScrolls: 10 },
      maxItems: 40
    })
  );
  assert.deepEqual(await resolve(feed, EXTRACT_LIST_NODE, { extractList: { handle: posts.extraction, paginate: { mode: "scroll", maxScrolls: 51 } } }), refusedAt("web.handle.malformed", "extractList.paginate", EXTRACTION_HINT));
  // A bound under a mode the detection did not find bounds the detected scroll, and is held to the same cap.
  const scrolled = await resolve(feed, EXTRACT_LIST_NODE, { extractList: { handle: posts.extraction, paginate: { mode: "next", maxPages: 4 } } });
  assert.deepEqual(scrolled.status === "resolved" ? (scrolled.parameters.extractList as JsonObject).paginate : scrolled, { mode: "scroll", maxScrolls: 4 });
  assert.deepEqual(await resolve(feed, EXTRACT_LIST_NODE, { extractList: { handle: posts.extraction, paginate: { mode: "numbered", maxPages: 51 } } }), refusedAt("web.handle.malformed", "extractList.paginate", EXTRACTION_HINT));
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

  // A name with no plausible candidate at all. `banana` is a measured miss
  // below Core's floor, and `column:Name` names a header where nothing has one.
  // `title` is not such a miss: the matcher plausibly relates ordinary title
  // vocabulary to product-name, which is the recovery this module promises.
  // `column-match.test.ts` holds the names that now resolve instead.
  const unknownField: JsonObject[] = [
    { handle: extraction, fields: { name: "banana" } },
    { handle: extraction, fields: { name: "column:Name" } },
    { item: { handle: extraction }, fields: { name: { handle: extraction, key: "banana" } } }
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
    // The reader now drops an unreadable `minItems` rather than refusing the
    // whole request, so the resolver's own check of it names the member.
    [{ handle: extraction, minItems: 9, maxItems: 8 }, "extractList.minItems"],
    [{ handle: extraction, minItems: -1 }, "extractList.minItems"],
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
    [{ extractList: { handle: "t1" } }, "extractList"],
    [{ extractList: { item: { handle: "t1" }, fields: { name: "td" } } }, "extractList.item"],
    [{ extractList: { item: "li", fields: { name: { kind: "text", selector: { handle: "t1" } } } } }, "extractList.fields.0.selector"],
    [{ target: { handle: extraction } }, "target"],
    [{ selector: { handle: "t1" } }, "selector"]
  ];
  for (const [parameters, position] of misplaced) {
    assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, parameters), refusedAt("web.handle.misplaced", position, EXTRACTION_HINT), JSON.stringify(parameters));
  }
  // An extraction handle on an element node belongs in an extraction node; a target handle on one belongs in its selector.
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: { handle: extraction } }), refusedAt("web.handle.misplaced", "selector", EXTRACTION_HINT));
  assert.deepEqual(await resolve(runtime, CLICK_NODE, { selector: "#go", text: { handle: "t1" } }), refusedAt("web.handle.misplaced", "text", TARGET_HINT));
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

// `dedupe` and `sort` live inside `extractList` (decided 2026-09-28), so the
// handle form takes them too. Live run `run-mulwm2dc-0bd95f22` asked for roles
// "deduplicated, newest first" over a detected list, the verifier said to add
// both, and the repair had nowhere to write either: this slot refused every key
// it did not list.

test("a detected list may be deduplicated and sorted by the plan's own column keys, resolved to canonical form", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);

  // Forgiving spellings in, canonical out: `true` keys on the list's link column,
  // and a column named by the plan's key sorts by that column.
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: RENAMED, dedupe: true, sort: "price desc", paginate: false } }),
    resolvedList({ item: CARD, fields: CARD_FIELDS, dedupe: { by: ["url"] }, sort: [{ field: "price", order: "desc" }] })
  );
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: RENAMED, dedupe: ["name"], sort: [{ field: "rating", order: "desc", as: "number" }, "name"], paginate: false } }),
    resolvedList({ item: CARD, fields: CARD_FIELDS, dedupe: { by: ["name"] }, sort: [{ field: "rating", order: "desc", as: "number" }, { field: "name", order: "asc" }] })
  );
  // What runs is a request the page reads as resolved, with no issue left in it.
  const resolved = await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: RENAMED, dedupe: true, sort: "-price", paginate: false } });
  const request = resolved.status === "resolved" ? resolved.parameters.extractList : undefined;
  assert.deepEqual(webAutomationExtractListIssues(request), []);
  assert.deepEqual(webAutomationExtractListRequestValue(request)?.sort, [{ field: "price", order: "desc" }]);

  // Off is nothing, not a fault.
  assert.deepEqual(
    await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: extraction, fields: RENAMED, dedupe: false, sort: [], paginate: false } }),
    resolvedList({ item: CARD, fields: CARD_FIELDS })
  );
});

test("a dedupe that is not one, or a sort key naming no column, is refused where it was written rather than dropped", async () => {
  const runtime = runtimeOver(CATALOG);
  const { extraction } = await detect(runtime);
  // Dropped, it would dedupe or sort nothing while the model believed it had
  // asked; refused, the model is told where, by the key's own name
  // (`../issue-position.ts`).
  const refusals: Array<[JsonObject, string]> = [
    [{ handle: extraction, fields: RENAMED, dedupe: 7 }, "extractList.dedupe"],
    [{ handle: extraction, fields: RENAMED, sort: "newest" }, "extractList.sort"],
    [{ handle: extraction, fields: RENAMED, sort: ["price desc", { field: "price", order: "sideways" }] }, "extractList.sort.1"],
    [{ handle: extraction, fields: RENAMED, sort: ["price desc, newest"] }, "extractList.sort"]
  ];
  for (const [extractList, position] of refusals) {
    assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList }), refusedAt("web.handle.malformed", position, EXTRACTION_HINT), JSON.stringify(extractList));
  }
});

test("true keeps the detected one-page bound while an explicit nested bound reads five pages", async () => {
  const capture = structuredClone(CATALOG);
  if (!capture.structure.ok) throw new Error("catalog detection failed");
  capture.structure.proposal.pagination = { ...NEXT, maxPages: 1 };
  const runtime = runtimeOver(capture);
  const shown = await detect(runtime);
  assert.deepEqual((shown as WebLlmRepeatingStructure & { paginationBound?: object }).paginationBound, { maxPages: 1 });
  for (const paginate of [true, undefined]) {
    const written: JsonObject = { handle: shown.extraction, fields: { name: "product-name" } };
    if (paginate !== undefined) written.paginate = paginate;
    assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: written }),
      resolvedList({ item: CARD, fields: { name: CARD_FIELDS.name }, paginate: { ...NEXT, maxPages: 1 } }));
  }
  assert.deepEqual(await resolve(runtime, EXTRACT_LIST_NODE, { extractList: { handle: shown.extraction, fields: { name: "product-name" }, paginate: { maxPages: 5 } } }),
    resolvedList({ item: CARD, fields: { name: CARD_FIELDS.name }, paginate: { ...NEXT, maxPages: 5 } }));
});
