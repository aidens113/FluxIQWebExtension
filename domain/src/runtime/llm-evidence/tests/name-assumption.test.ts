// A column name the resolution had to guess at survives the hop that used to
// drop it, in the shape a run's record will carry.
//
// What these rows are really proving:
// - a column named nearly right resolves (t149) and the guess -- what was
//   written, what it was read as, how, and with what score -- comes back out of
//   `resolveWebPlanNode`, which is the hop `resolve-plan-node.ts` dropped: the
//   slot computed the whole assumption and the resolver kept only `parameters`;
// - a column named **exactly** produces no assumption at all, so the field's
//   presence means something;
// - the answer **Core** reads still carries exactly `status` and `parameters`.
//   Core accepts no other key on a resolved answer
//   (`AS/runtime/llm/harness-options/plan-parameter-resolution.ts` `exactKeys`),
//   so a diagnostic that leaked onto it would refuse every resolved node of
//   every plan;
// - an execution result carries **no key Core's own reader has not learned**.
//   That list is the reason `assumed` does not reach the wire yet, and it is the
//   row that would have caught the same mistake being made in the other
//   direction: Core refuses the *call*, not the field
//   (`llm_evidence_loop.tool_result_invalid`);
// - the screen: what a name may be spelled with before it may travel, the cap
//   on how many one call publishes, and absent rather than empty for a call
//   that assumed nothing.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationExtractField } from "../../../actions/extraction";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import {
  createWebAutomationLlmEvidenceRuntime,
  MAX_WEB_LLM_NAME_ASSUMPTIONS,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmNameAssumption,
  type WebLlmRepeatingStructure
} from "..";
import { WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS } from "../capture";
import { webLlmNameAssumptions, type WebLlmNameAssumptionSaid } from "../name-assumption";
import { createWebLlmTargetPackets, resolveWebPlanNode, type WebPlanHandleStores } from "../plan-resolution";
import { createWebLlmExtractionHandles, type WebLlmExtractionHandleScope } from "../structure";
import { CAPTURED_DETECTIONS } from "../structure/tests/captured-detections";

const EXTRACT_LIST_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const CATALOG_CAPTURE = CAPTURED_DETECTIONS["product-catalog-largest"];
const testId = (id: string) => `[data-testid="${id}"]`;

/** The product-catalog detection's columns, as `structure/packet.ts` binds them. */
const CATALOG = {
  "product-name": { kind: "text", selector: testId("product-name"), required: true },
  "product-link": { kind: "link", selector: testId("product-link"), required: true },
  "product-price": { kind: "text", selector: testId("product-price"), required: true },
  "product-rating": { kind: "text", selector: testId("product-rating"), required: true }
} as const satisfies Record<string, WebAutomationExtractField>;

const SCOPE: WebLlmExtractionHandleScope = { projectId: "project.one", flowId: "flow.one" };

/** A handle store holding the catalog's list, and the handle that names it. */
function catalogStores(): { stores: WebPlanHandleStores; handle: string } {
  const extractions = createWebLlmExtractionHandles();
  const handle = extractions.reserve();
  extractions.retain(SCOPE, {
    handle,
    location: CATALOG_CAPTURE.url,
    extractList: { item: testId("product-card"), fields: CATALOG },
    itemCount: 8
  });
  return { stores: { targets: createWebLlmTargetPackets(), extractions }, handle };
}

/** Resolve the extraction node, as Core's binding and the live node run both do. */
async function resolveNode(parameters: (handle: string) => JsonObject) {
  const { stores, handle } = catalogStores();
  return await resolveWebPlanNode(
    { projectId: SCOPE.projectId, flowId: SCOPE.flowId, nodeDefinitionId: EXTRACT_LIST_NODE, parameters: parameters(handle), gatedByCaller: true },
    stores
  );
}

/** Resolve one `extractList` beside its handle. */
async function resolveExtraction(extractList: JsonObject) {
  return await resolveNode((handle) => ({ extractList: withHandle(handle, extractList) }));
}

/** The `extractList` a model wrote, with the list it names put in front of it. */
function withHandle(handle: string, extractList: JsonObject): JsonObject {
  const named: JsonObject = { handle };
  for (const [key, value] of Object.entries(extractList)) named[key] = value;
  return named;
}

test("a column named nearly right resolves, and the guess survives the resolver", async () => {
  // Run 8's own words for this list, which were refused `web.handle.unknown_field`
  // on every column before t149 and now resolve.
  const guessed = await resolveExtraction({ fields: { name: "name", price: "price", rating: "rating" } });
  assert.equal(guessed.resolution.status, "resolved");
  assert.deepEqual(guessed.assumed, [
    { path: "extractList.fields.name", written: "name", field: "product-name", how: "nearest", score: 0.733 },
    { path: "extractList.fields.price", written: "price", field: "product-price", how: "nearest", score: 0.746 },
    { path: "extractList.fields.rating", written: "rating", field: "product-rating", how: "nearest", score: 0.757 }
  ] satisfies WebLlmNameAssumption[]);

  // A spelling variant is said to be one: `normalized` is the same name folded,
  // and a reader does not owe it the attention a scored guess is owed.
  const spelt = await resolveExtraction({ fields: { name: "productName" } });
  assert.deepEqual(spelt.assumed, [{ path: "extractList.fields.name", written: "productName", field: "product-name", how: "normalized", score: 1 }]);

  // A condition's column is the same rule at its own position -- the condition's,
  // measured: `conditions.ts` records the clause rather than the `field` key
  // inside it, so a reader is pointed at `where.0` and finds the written name
  // there, while a `fields` entry is named one step finer.
  const filtered = await resolveExtraction({ fields: { name: "product-name" }, where: [{ field: "product-ratings", atLeast: 4 }] });
  assert.deepEqual(filtered.assumed, [{ path: "extractList.where.0", written: "product-ratings", field: "product-rating", how: "nearest", score: 0.933 }]);
});

test("a column named exactly assumes nothing, and says so by reporting no assumption", async () => {
  const exact = await resolveExtraction({ fields: { name: "product-name", price: "product-price" }, where: [{ field: "product-price", lessThan: 50 }] });
  assert.equal(exact.resolution.status, "resolved");
  // Absent, not empty. A call that guessed at nothing and a call that reported
  // an empty list are different facts, and only absence reads as the first
  // without knowing which producer wrote the row.
  assert.equal(exact.assumed, undefined);
  // A node with no handle resolves nothing, so it assumes nothing either.
  const literal = await resolveNode(() => ({ timeoutMs: 20_000 }));
  assert.deepEqual(literal, { resolution: { status: "unchanged" }, assumed: undefined });
});

test("the answer Core reads carries exactly the keys Core accepts, assumption or not", async () => {
  // Core refuses a resolved answer with any other key
  // (`bootstrap.parameter_resolution_invalid`), so this is not a matter of taste:
  // one extra member would stop every resolved node of every plan. The second
  // row guesses -- `product-prce` is a typo t149 measured as resolving -- so the
  // answer is checked with an assumption in hand as well as without one.
  for (const fields of [{ name: "product-name" }, { name: "name", price: "product-prce" }]) {
    const resolved = await resolveExtraction({ fields });
    assert.equal(resolved.resolution.status, "resolved", JSON.stringify(fields));
    assert.deepEqual(Object.keys(resolved.resolution).sort(), ["parameters", "status"], JSON.stringify(fields));
  }
});

test("an execution result carries no key Core's reader has not learned", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: CATALOG_CAPTURE.url, title: CATALOG_CAPTURE.title, interactiveElements: [] };
      return { status: "succeeded", payload: { snapshot, structure: structuredClone(CATALOG_CAPTURE.structure) as JsonValue } };
    },
  });
  const detected = await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  const handle = (detected.evidence as WebLlmRepeatingStructure).extraction;
  const ran = await runtime.executeTool({
    projectId: "project.one", flowId: "flow.one", callId: "call.run", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: "web.output.dom-extract_list", parameters: { extractList: { handle, fields: { name: "name", price: "price" } } }, consequences: [] }
  });
  assert.equal(ran.resultCode, "web.inspect.succeeded");
  // The whole point of the list. Core reads an execution result against an
  // allow-list and refuses the *call* over one key it has not learned, so a
  // result that grew a member is a live build every node run of which is
  // recorded as a failure that never happened.
  for (const key of Object.keys(ran)) {
    assert.equal(WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS.includes(key), true, `Core's reader has not learned "${key}"`);
  }
  // And `assumed` is the member being withheld today: this call resolved two
  // guessed columns, the resolver reported both, and the wire carries neither
  // until Core's list learns the key. When it does, this row is what has to
  // change, and `capture.ts` says which Core files come first.
  assert.equal(Object.hasOwn(ran, "assumed"), false);
  assert.equal(WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS.includes("assumed"), false);
  assert.equal((await resolveExtraction({ fields: { name: "name", price: "price" } })).assumed?.length, 2);
});

test("the screen decides what a name may be spelled with before it travels", () => {
  const said = (written: string, path: (string | number)[] = ["extractList", "fields", "price"]): WebLlmNameAssumptionSaid =>
    ({ path, written, field: "product-price", how: "nearest", score: 0.5 });

  assert.deepEqual(webLlmNameAssumptions([]), undefined, "nothing assumed is absent, never an empty list");
  assert.deepEqual(webLlmNameAssumptions([said("prce")]), [
    { path: "extractList.fields.price", written: "prce", field: "product-price", how: "nearest", score: 0.5 }
  ]);
  // A separator or a dot is how the same name is spelled differently, and both travel.
  for (const written of ["product_price", "Product.Price", "price:2", "a-b"]) {
    assert.equal(webLlmNameAssumptions([said(written)])?.length, 1, written);
  }
  // Whitespace is what keeps the page out: a column named as a table **header**
  // carries the page's own words, and an entry whose written name is a phrase is
  // dropped rather than spelling one into a bundle. So is a whole selector, and
  // so is a name longer than a name.
  for (const written of ["Unit price", "column:Unit price", '[data-testid="price"]', "#card > .price", "x".repeat(101)]) {
    assert.deepEqual(webLlmNameAssumptions([said(written)]), undefined, written);
  }
  // The position is screened by the same rule, because it is made of the model's
  // own keys.
  assert.deepEqual(webLlmNameAssumptions([said("prce", ["extractList", "fields", "unit price"])]), undefined);

  // A similarity is published to three places -- the precision the measurements
  // are stated at -- so a score cannot become a channel of its own.
  assert.equal(webLlmNameAssumptions([{ path: ["a"], written: "b", field: "c", how: "nearest", score: 1 / 3 }])?.[0]?.score, 0.333);
  // Nothing outside the closed vocabulary or the unit interval travels at all.
  assert.deepEqual(webLlmNameAssumptions([{ path: ["a"], written: "b", field: "c", how: "guessed" as "nearest", score: 0.5 }]), undefined);
  assert.deepEqual(webLlmNameAssumptions([{ path: ["a"], written: "b", field: "c", how: "nearest", score: 1.5 }]), undefined);
  assert.deepEqual(webLlmNameAssumptions([{ path: ["a"], written: "b", field: "c", how: "nearest", score: Number.NaN }]), undefined);

  // One call publishes at most the same number of diagnostics Core lets a
  // refusal carry, and the ones it keeps are the first it made.
  const many = Array.from({ length: MAX_WEB_LLM_NAME_ASSUMPTIONS + 4 }, (_unused, index) => said(`prce${index}`));
  const published = webLlmNameAssumptions(many);
  assert.equal(published?.length, MAX_WEB_LLM_NAME_ASSUMPTIONS);
  assert.equal(published?.[0]?.written, "prce0");
});
