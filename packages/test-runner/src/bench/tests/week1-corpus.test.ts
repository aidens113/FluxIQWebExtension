import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadScenarioManifests } from "../../scenarios.js";
import { benchCorpora, findBenchCorpus, smokeCorpus, week1Corpus } from "../corpus/index.js";
import { expandCorpus, type BenchPlanEntry } from "../expand-corpus.js";

// dist/bench/tests -> repository root, independent of the working directory.
const repositoryRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const label = (entry: BenchPlanEntry): string => `${entry.corpusRowId} ${entry.scenarioId}/${entry.workflowId ?? "primary"}/${entry.variantId ?? "unarmed"}`;

/**
 * Week 1 results whose variant the Scenario Lab does not define yet. When a
 * fixture adds one, this test fails until its entry is removed; a result that
 * stops resolving fails it too. Empty since the Wave 3 fixture work added the
 * last six (`navigation/broken-link`, `delayed-ui/too-slow`,
 * `ambiguous-targets/no-context`, and `failure-surfaces`'
 * `disabled`/`detached`/`blocked-url`): every week1 result now resolves, so
 * any entry appearing here again is a regression.
 */
const UNRESOLVED_TODAY: string[] = [];
/** The plan's corpus table: negative variants and the category each must be classified as. */
const PLAN_NEGATIVE_VARIANTS: Record<string, string> = {
  "W14 modal-flows/interstitial/armed": "user_intervention_required",
  "W19 auth-gate/primary/expired": "auth_required",
  "W24 intermediate-state/primary/unannounced": "output_not_observed",
  "W29 identity-drift/primary/save-and-exit": "target_not_found",
};
/** The plan's corpus table: variants expected to succeed. */
const PLAN_POSITIVE_VARIANTS = [
  "W04 product-catalog/primary/text-variant",
  "W05 product-catalog/paginated-extraction/short-catalog",
  "W06 product-catalog/search/no-results",
  "W08 data-table/primary/column-reorder",
  "W11 infinite-feed/primary/end-early",
  "W13 modal-flows/consent-then-click/banner-absent",
  "W20 identity-drift/primary/selector-only",
  "W21 identity-drift/primary/text-only",
  "W22 identity-drift/primary/moved",
  "W23 identity-drift/primary/wrapped-aria",
];

test("week1 lists W01 to W29 once each, in order; smoke is basic-form and one more week1 row, variant-free", () => {
  assert.deepEqual(week1Corpus.rows.map((row) => row.id), Array.from({ length: 29 }, (_, index) => `W${String(index + 1).padStart(2, "0")}`));
  assert.equal(smokeCorpus.rows[0]?.scenarioId, "basic-form");
  assert.ok(smokeCorpus.rows.length >= 2 && smokeCorpus.rows.length <= 3);
  for (const row of smokeCorpus.rows) {
    assert.deepEqual(row, week1Corpus.rows.find((candidate) => candidate.id === row.id));
    assert.deepEqual([row.unarmed, row.variantIds], [true, []]);
  }
  assert.deepEqual(benchCorpora.map((corpus) => corpus.id), ["week1", "smoke"]);
  assert.equal(findBenchCorpus("smoke"), smokeCorpus);
  assert.throws(() => findBenchCorpus("week2"), /Unknown bench corpus: week2\. Known corpora: week1, smoke/);
});

test("every week1 row resolves through resolveScenarioWorkflow against the built registry, apart from the named pending variants", async (t) => {
  const plan = expandCorpus(week1Corpus, await loadScenarioManifests(repositoryRoot));
  const unresolved = plan.filter((entry) => !entry.resolved).map(label);
  t.diagnostic(`rows with every result resolved: ${[...new Set(plan.map((entry) => entry.corpusRowId))].filter((row) => plan.every((entry) => entry.corpusRowId !== row || entry.resolved)).join(", ")}`);
  t.diagnostic(`unresolved results: ${unresolved.join(", ") || "none"}`);
  assert.deepEqual(unresolved, UNRESOLVED_TODAY, `week1 results that do not resolve against apps/scenario-lab/dist/registry.js: ${unresolved.join(", ")}`);
  assert.deepEqual(plan.filter((entry) => entry.resolved && entry.variantId === null && entry.expectedFailure !== null).map(label), [], "every unarmed week1 workflow expects success");
  const byLabel = new Map(plan.map((entry) => [label(entry), entry]));
  for (const [name, category] of Object.entries(PLAN_NEGATIVE_VARIANTS)) assert.equal(byLabel.get(name)?.expectedFailure?.category, category, name);
  for (const name of PLAN_POSITIVE_VARIANTS) assert.equal(byLabel.get(name)?.expectedFailure, null, name);
});

test("every smoke result resolves and runs on the recording lane", async () => {
  const plan = expandCorpus(smokeCorpus, await loadScenarioManifests(repositoryRoot));
  assert.deepEqual(plan.map((entry) => [label(entry), entry.resolved, entry.lane, entry.skipReason ?? null]), [["W01 basic-form/primary/unarmed", true, "recording", null], ["W28 iframe-checkout/primary/unarmed", true, "recording", null]]);
  assert.deepEqual(smokeCorpus.lanes, ["recording"], "smoke is the corpus every historical bench was measured on: its plan must not change");
});

/** The week1 rows whose workflow's script records no action (`flowLaneExclusion`). */
const NO_FLOW_LANE_ROWS = new Set(["W04", "W08"]);

/**
 * The corpus runs both lanes, and every unarmed workflow runs on both. Before
 * the Flow lane ran the variants, every variant carried
 * `VARIANT_NEEDS_FLOW_LANE`, which left drift recovery, fuzzy recovery and
 * failure classification with a provably empty population. Before it ran the
 * unarmed workflows too, FluxIQ executed W01-W18 on no lane at all: the
 * recording lane executes at most a two-action Core probe.
 *
 * The exception is a workflow whose script records no action. W04 and W08 only
 * read the page, so no recording of either yields a Flow, and their four
 * Flow-lane results failed every bench as `recording.contract` whatever FluxIQ
 * did. They are planned and skipped with the shared check's reason, and W04
 * and W08 count for criterion 1 on the recording lane only.
 */
test("week1 plans 63 runnable results per repeat: every unarmed workflow on both lanes and every resolved variant on the Flow lane, except a workflow whose script records no action, which the Flow lane skips", async (t) => {
  const plan = expandCorpus(week1Corpus, await loadScenarioManifests(repositoryRoot));
  const runnable = plan.filter((entry) => entry.skipReason === undefined);
  const byLane = (lane: string) => runnable.filter((entry) => entry.lane === lane);
  const unarmedOn = (lane: string) => byLane(lane).filter((entry) => entry.variantId === null);
  const variantsOn = (lane: string) => byLane(lane).filter((entry) => entry.variantId !== null);
  t.diagnostic(`runnable: ${runnable.length} (${byLane("recording").length} recording; ${byLane("flow").length} flow, ${unarmedOn("flow").length} unarmed and ${variantsOn("flow").length} variants); skipped: ${plan.length - runnable.length}`);
  assert.deepEqual(week1Corpus.lanes, ["recording", "flow"]);
  // The count a week1 bench's run time is estimated from. A new corpus row changes it: W29's variant made it 67, and skipping W04's and W08's four Flow-lane results made it 63.
  assert.deepEqual([runnable.length, unarmedOn("recording").length, variantsOn("recording").length, unarmedOn("flow").length, variantsOn("flow").length], [63, 23, 0, 21, 19]);
  // The Flow lane runs the unarmed workflows the recording lane runs, bar W04 and W08: the rest of W01-W18 for criterion 1, and W24-W28.
  assert.deepEqual(unarmedOn("flow").map(label), unarmedOn("recording").filter((entry) => !NO_FLOW_LANE_ROWS.has(entry.corpusRowId)).map(label));
  const criterionOne = Array.from({ length: 18 }, (_, index) => `W${String(index + 1).padStart(2, "0")}`).filter((row) => !NO_FLOW_LANE_ROWS.has(row));
  assert.deepEqual(unarmedOn("flow").map((entry) => entry.corpusRowId), [...criterionOne, "W24", "W25", "W26", "W27", "W28"]);
  assert.deepEqual(unarmedOn("recording").filter((entry) => NO_FLOW_LANE_ROWS.has(entry.corpusRowId)).map(label), ["W04 product-catalog/primary/unarmed", "W08 data-table/primary/unarmed"], "W04 and W08 still run on the recording lane");
  // Every other resolved result runs. The skips are those four Flow-lane results, each with the shared check's reason, and any variant no fixture defines.
  const skippedResolved = plan.filter((entry) => entry.resolved && entry.skipReason !== undefined);
  assert.deepEqual(skippedResolved.map((entry) => `${label(entry)} on ${entry.lane}`), ["W04 product-catalog/primary/unarmed", "W04 product-catalog/primary/text-variant", "W08 data-table/primary/unarmed", "W08 data-table/primary/column-reorder"].map((name) => `${name} on flow`));
  for (const entry of skippedResolved) assert.match(entry.skipReason ?? "", /no step of the workflow's recordingScript records an action \(operations: extract\b/u, label(entry));
  assert.deepEqual(plan.filter((entry) => !entry.resolved).map(label), UNRESOLVED_TODAY);
  const negatives = byLane("flow").filter((entry) => entry.expectedFailure !== null);
  t.diagnostic(`flow-lane results with an expected failure: ${negatives.length} (${negatives.map((entry) => `${label(entry)}=${entry.expectedFailure?.category ?? ""}`).join(", ")})`);
  assert.ok(negatives.length > 0, "failure classification accuracy has a population only because negative variants now run");
});
