import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { formatMoney, PAPER_TOWELS, variantTitle } from "../../catalog/index.js";
import { BIGBOX_RETAIL_LIVE_TASKS } from "../../live-tasks.js";
import { bigboxRetailManifest } from "../../manifest/index.js";
import { readSearchState, runSearch } from "../../search/index.js";
import { createBigboxState } from "../../state/index.js";
import { RATED_DELIVERY_TOWELS_WORKFLOW, soapQuantityAccountFacts } from "../index.js";

const records = () => RATED_DELIVERY_TOWELS_WORKFLOW.expected.extracted![0]!.records!;
const FILTERED = "q=paper+towels&sort=rating_high&facet=" + encodeURIComponent("dept:Paper Towels||fulfillment_method:Delivery");

test("the task names the workflow's one dataset and the manifest resolves it unchanged", () => {
  const task = BIGBOX_RETAIL_LIVE_TASKS.find(({ id }) => id === "bigbox-retail-rated-delivery-towels")!;
  const resolved = resolveScenarioWorkflow(bigboxRetailManifest, { workflowId: "rated-delivery-towels" });
  assert.equal(task.expectedDatasetId, resolved.expected.extracted![0]!.step);
  assert.deepEqual(resolved.expected, RATED_DELIVERY_TOWELS_WORKFLOW.expected);
  assert.equal(task.permissionPoint, undefined, "a read asks nothing");
});

test("the sixteen records are the catalog's deliverable paper towels rated 4.5 or better, by rating then reviews", () => {
  const derived = PAPER_TOWELS.filter((product) => product.department === "Paper Towels" && product.variants[0]!.delivery !== "none" && product.rating >= 4.5)
    .sort((left, right) => right.rating - left.rating || right.reviews - left.reviews)
    .map((product) => ({ name: variantTitle(product, product.variants[0]!), price: formatMoney(product.variants[0]!.priceCents), rating: product.rating.toFixed(1) }));
  assert.equal(derived.length, 16);
  assert.deepEqual(derived, records());
});

test("the filtered, sorted results run to two pages whose non-ad listings rated 4.5 or better are the records, and a read of every listing is not", () => {
  const pages = [1, 2].map((page) => runSearch(readSearchState(new URLSearchParams(`${FILTERED}&page=${page}`)), "2291"));
  assert.deepEqual(pages.map((page) => [page.total, page.pageCount]), [[18, 2], [18, 2]]);
  const listed = pages.flatMap((page) => page.entries.filter((entry) => !entry.sponsored).map((entry) => entry.product));
  const kept = listed.filter((product) => product.rating >= 4.5).map((product) => variantTitle(product, product.variants[0]!));
  assert.deepEqual(kept, records().map((record) => record.name));
  assert.deepEqual(listed.filter((product) => product.rating < 4.5).map((product) => product.name), ["Loftwell Paper Towels, Prints, 6 Double Rolls", "Hearthside Kitchen Paper Towels, 2 Rolls"]);
  const everything = pages.flatMap((page) => page.entries.map((entry) => entry.product.id));
  assert.ok(everything.length > new Set(everything).size, "ads repeat listings, so reading every tile duplicates rows");
  const bestMatch = runSearch(readSearchState(new URLSearchParams(FILTERED.replace("sort=rating_high&", ""))), "2291").entries.filter((entry) => !entry.sponsored);
  assert.notEqual(bestMatch[0]!.product.id, "417553188", "unsorted, the best-rated listing is not first");
});

test("the read leaves the account exactly as it started", () => {
  const { pageFacts, finalState } = RATED_DELIVERY_TOWELS_WORKFLOW.expected;
  assert.equal(pageFacts![0]!.value, soapQuantityAccountFacts(createBigboxState()));
  assert.equal(finalState![0]!.value, soapQuantityAccountFacts(createBigboxState()));
});
