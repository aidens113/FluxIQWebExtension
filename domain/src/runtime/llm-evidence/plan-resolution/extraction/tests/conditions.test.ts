// Which items of a detected list a plan wants (C5), and what a refusal tells
// the model when it names none.
//
// The live failure these rows exist for is `everything-store-first-page-plus-earbuds`
// on 2026-09-22: the instruction said "collect every product on the first page
// of results, leaving out sponsored placements", the model kept the right four
// columns, and the read returned twenty rows because the store's four sponsored
// cards are the same template as its sixteen results. The model could say which
// columns to keep and not which items, so the answer was wrong before it chose
// anything.
//
// The rows below are about the resolver's half: a condition written in the
// vocabulary the detection showed -- a detected column key -- becomes a request
// the page can run with no handle, no detection and no model in it. The page's
// half is measured against the real sites in
// `apps/extension/e2e/content/tests/extraction/tests/item-conditions.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListRequestValue } from "../../../../../actions/extraction";
import { webAutomationOutputNodeId } from "../../../../../output-nodes";
import { webAutomationDerivedRecordOutput, webAutomationExtractListIssues } from "../../../../../output-nodes/extract-list";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmRepeatingStructure
} from "../../..";
import { CAPTURED_DETECTIONS } from "../../../structure/tests/captured-detections";

const EXTRACT_LIST_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const CATALOG = CAPTURED_DETECTIONS["product-catalog-largest"];
const CARD = '[data-testid="product-card"]';
/** The shape a refused `extractList` is told to take, which every refusal here carries. */
const HINT = "web.handle.expected.extract_list.handle_fields_paginate";
const NAME = { kind: "text", selector: '[data-testid="product-name"]', required: true } satisfies JsonObject;
const BADGE = { kind: "text", selector: '[data-testid="stock-badge"]', required: true } satisfies JsonObject;
const PRICE = { kind: "text", selector: '[data-testid="product-price"]', required: true } satisfies JsonObject;

function runtime(): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return {
        status: "succeeded",
        payload: { snapshot: { url: CATALOG.url, title: CATALOG.title, interactiveElements: [] }, structure: structuredClone(CATALOG.structure) }
      };
    }
  });
}

let calls = 0;
async function detect(instance: WebAutomationLlmEvidenceRuntime): Promise<WebLlmRepeatingStructure> {
  calls += 1;
  const result = await instance.executeTool({ projectId: "project.one", flowId: "flow.one", callId: `call.detect.${calls}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  assert.equal(result.resultCode, "web.structure.detected");
  return result.evidence as WebLlmRepeatingStructure;
}

async function resolve(instance: WebAutomationLlmEvidenceRuntime, extractList: JsonObject) {
  return await instance.resolvePlanNodeParameters({
    projectId: "project.one",
    flowId: "flow.one",
    nodeDefinitionId: EXTRACT_LIST_NODE,
    parameters: { extractList },
    declaredConsequences: []
  });
}

test("a condition names a detected column and becomes the column's own read, so the saved request needs no field map", async () => {
  const instance = runtime();
  const { extraction } = await detect(instance);

  // The mark is a column the table does not keep: a Flow that leaves the
  // out-of-stock cards out wants no stock column in its answer.
  const resolved = await resolve(instance, {
    handle: extraction,
    fields: { name: "product-name" },
    where: [{ field: "stock-badge", is: "absent" }],
    paginate: false
  });
  assert.deepEqual(resolved, {
    status: "resolved",
    parameters: { extractList: { item: CARD, fields: { name: NAME }, where: [{ read: BADGE, is: "absent" }] } }
  });

  // And it is a request the page reads as written, with no issue to repair.
  const request = resolved.status === "resolved" ? resolved.parameters.extractList : undefined;
  assert.notEqual(webAutomationExtractListRequestValue(request), undefined);
  assert.deepEqual(webAutomationExtractListIssues(request), []);
});

test("a condition may be written every way a column may be named, on its own or as a list, with bounds", async () => {
  const instance = runtime();
  const { extraction } = await detect(instance);
  const rows: Array<[JsonValue, JsonObject[]]> = [
    // The four keys that name a column, and a key in another case.
    [[{ field: "stock-badge", is: "absent" }], [{ read: BADGE, is: "absent" }]],
    [[{ key: "stock-badge" }], [{ read: BADGE }]],
    [[{ column: "STOCK-BADGE" }], [{ read: BADGE }]],
    [[{ read: "stock-badge", is: "present" }], [{ read: BADGE, is: "present" }]],
    // One condition written on its own, rather than as a list of one.
    [{ field: "stock-badge", is: "absent" }, [{ read: BADGE, is: "absent" }]],
    // Bounds on the number in the column, and several conditions at once.
    [[{ field: "product-price", lessThan: 50 }], [{ read: PRICE, lessThan: 50 }]],
    [
      [{ field: "product-price", atLeast: 10, atMost: 50 }, { field: "stock-badge", is: "absent" }],
      [{ read: PRICE, atLeast: 10, atMost: 50 }, { read: BADGE, is: "absent" }]
    ]
  ];
  for (const [where, expected] of rows) {
    assert.deepEqual(
      await resolve(instance, { handle: extraction, fields: { name: "product-name" }, where, paginate: false }),
      { status: "resolved", parameters: { extractList: { item: CARD, fields: { name: NAME }, where: expected } } },
      JSON.stringify(where)
    );
  }
});

test("a condition may name a column by the key this plan keeps it under, which is the name the plan has just invented for it", async () => {
  const instance = runtime();
  const { extraction } = await detect(instance);

  // The live shape, on a site whose detected keys are hashed class paths: the
  // plan renames the columns it keeps and then says what it wants of them in
  // its own words. Refused as `web.handle.unknown_field` until 2026-09-23, so
  // the only condition that ever survived a live build was the one over a
  // column the plan did not keep and therefore did not rename -- the
  // advertisement mark (`run-mudwci8d-de88aa32`, `run-mudw1ktb-0557816b`).
  assert.deepEqual(
    await resolve(instance, {
      handle: extraction,
      fields: { title: "product-name", cost: "product-price" },
      where: [{ field: "cost", lessThan: 50 }, { field: "stock-badge", is: "absent" }],
      paginate: false
    }),
    {
      status: "resolved",
      parameters: {
        extractList: {
          item: CARD,
          fields: { title: NAME, cost: PRICE },
          // Still the column's own read: a saved request needs no field map,
          // whichever vocabulary named the column.
          where: [{ read: PRICE, lessThan: 50 }, { read: BADGE, is: "absent" }]
        }
      }
    }
  );

  // The detection's vocabulary is still read first, so a name that means
  // something to the detection goes on meaning it, whatever the plan calls its
  // own columns. Here `stock-badge` is both a detected key and this plan's key
  // for the price, and it resolves to the column the detection showed.
  assert.deepEqual(
    await resolve(instance, {
      handle: extraction,
      fields: { "stock-badge": "product-price" },
      where: [{ field: "stock-badge", is: "absent" }],
      paginate: false
    }),
    { status: "resolved", parameters: { extractList: { item: CARD, fields: { "stock-badge": PRICE }, where: [{ read: BADGE, is: "absent" }] } } }
  );
});

test("a condition that names no one detected column, or contradicts itself, is refused where it was written", async () => {
  const instance = runtime();
  const { extraction } = await detect(instance);
  const rows: Array<[JsonValue, string, string]> = [
    // A column nothing detected: the model was shown the keys and may only use them.
    [[{ field: "sponsored" }], "web.handle.unknown_field", "extractList.where.0"],
    // A bare string could only mean "present", which is the opposite of what a
    // person writing it about sponsored placements means.
    [["stock-badge"], "web.handle.malformed", "extractList.where.0"],
    // A selector, which the model was never shown and could only have guessed.
    [[{ field: '[data-testid="stock-badge"]' }], "web.handle.unknown_field", "extractList.where.0"],
    // "Not there" and "under fifty" cannot both have been meant.
    [[{ field: "product-price", is: "absent", lessThan: 50 }], "web.handle.malformed", "extractList.where.0"],
    [[{ field: "product-price", is: "sometimes" }], "web.handle.malformed", "extractList.where.0.is"],
    [[{ field: "product-price", lessThan: "50" }], "web.handle.malformed", "extractList.where.0.lessThan"],
    [[{ field: "product-price", selector: ".price" }], "web.handle.malformed", "extractList.where.0.selector"],
    [[{ is: "absent" }], "web.handle.malformed", "extractList.where.0"],
    [[], "web.handle.malformed", "extractList.where"],
    // The second condition is the bad one, and the position says so.
    [[{ field: "product-price", lessThan: 50 }, { field: "nothing" }], "web.handle.unknown_field", "extractList.where.1"]
  ];
  for (const [where, reason, position] of rows) {
    const refused = await resolve(instance, { handle: extraction, fields: { name: "product-name" }, where, paginate: false });
    // Every one of these is a shape the grammar could have taken, so the
    // refusal carries the shape it accepts beside the position it refused at.
    assert.deepEqual(refused, { status: "refused", issueCodes: [reason, HINT, `${reason}:${position}`] }, JSON.stringify(where));
  }
});

test("two nodes that read the same columns and keep different items save into different datasets", async () => {
  const instance = runtime();
  const { extraction } = await detect(instance);
  const requestFor = async (where: JsonValue | undefined): Promise<JsonObject> => {
    const extractList: JsonObject = { handle: extraction, fields: { name: "product-name" }, paginate: false };
    if (where !== undefined) extractList.where = where;
    const resolved = await resolve(instance, extractList);
    assert.equal(resolved.status, "resolved");
    return resolved.status === "resolved" ? resolved.parameters.extractList as JsonObject : {};
  };
  const [whole, filtered] = await Promise.all([requestFor(undefined), requestFor([{ field: "stock-badge", is: "absent" }])]);
  const datasetFor = (request: JsonObject): string =>
    webAutomationDerivedRecordOutput(webAutomationExtractListRequestValue(request)!).datasetId;
  const [wholeId, filteredId] = [datasetFor(whole), datasetFor(filtered)];
  // The rows differ, so the tables must: appended into one dataset, a read that
  // left the advertisements out would be indistinguishable from one that did not.
  assert.notEqual(wholeId, filteredId);
});
