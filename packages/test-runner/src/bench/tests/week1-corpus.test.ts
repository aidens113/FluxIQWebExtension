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
 * stops resolving fails it too.
 */
const UNRESOLVED_TODAY = [
  "W10 navigation/primary/broken-link",
  "W25 delayed-ui/primary/too-slow",
  "W26 ambiguous-targets/primary/no-context",
  "W27 failure-surfaces/primary/disabled",
  "W27 failure-surfaces/primary/detached",
  "W27 failure-surfaces/primary/blocked-url",
];
/** The plan's corpus table: negative variants and the category each must be classified as. */
const PLAN_NEGATIVE_VARIANTS: Record<string, string> = {
  "W14 modal-flows/interstitial/armed": "user_intervention_required",
  "W19 auth-gate/primary/expired": "auth_required",
  "W24 intermediate-state/primary/unannounced": "output_not_observed",
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

test("week1 lists W01 to W28 once each, in order; smoke is basic-form and one more week1 row, variant-free", () => {
  assert.deepEqual(week1Corpus.rows.map((row) => row.id), Array.from({ length: 28 }, (_, index) => `W${String(index + 1).padStart(2, "0")}`));
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
  assert.deepEqual(plan.map((entry) => [label(entry), entry.resolved, entry.skipReason ?? null]), [["W01 basic-form/primary/unarmed", true, null], ["W28 iframe-checkout/primary/unarmed", true, null]]);
});
