import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadScenarioManifests } from "../../scenarios.js";
import { findBenchCorpus, week2Corpus } from "../corpus/index.js";
import { expandCorpus, FLOW_LANE_RETIRED, type BenchPlanEntry } from "../expand-corpus.js";

// dist/bench/tests -> repository root, independent of the working directory.
const repositoryRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const label = (entry: BenchPlanEntry): string => `${entry.corpusRowId} ${entry.scenarioId}/${entry.workflowId ?? "primary"}/${entry.variantId ?? "unarmed"}`;

/**
 * Week 2 measured adaptations, which only a Flow Core ran can have, so every
 * result is planned on the Flow lane. That lane built its Flow from the run's
 * own recording and is retired (t519), so every result is skipped as retired:
 * still planned, still resolved, so a result that stops resolving -- a variant
 * renamed in the Scenario Lab -- fails here rather than going unnoticed.
 */
test("every week2 result resolves against the built registry, on the Flow lane, where it is skipped as retired", async () => {
  assert.equal(findBenchCorpus("week2"), week2Corpus);
  const plan = expandCorpus(week2Corpus, await loadScenarioManifests(repositoryRoot));
  assert.deepEqual(plan.map((entry) => [label(entry), entry.resolved, entry.lane, entry.skipReason ?? null]), [
    ["A01 identity-drift/primary/unarmed", true, "flow", FLOW_LANE_RETIRED],
    ["A01 identity-drift/primary/renamed-redesign", true, "flow", FLOW_LANE_RETIRED],
    ["A02 product-catalog/primary/text-variant", true, "flow", FLOW_LANE_RETIRED],
    ["A03 data-table/primary/column-reorder", true, "flow", FLOW_LANE_RETIRED],
    ["A04 modal-flows/consent-then-click/banner-absent", true, "flow", FLOW_LANE_RETIRED],
    ["A05 intermediate-state/primary/unannounced", true, "flow", FLOW_LANE_RETIRED],
    ["A06 member-directory/primary/unarmed", true, "flow", FLOW_LANE_RETIRED],
    ["A06 member-directory/primary/restyled", true, "flow", FLOW_LANE_RETIRED],
  ]);
});
