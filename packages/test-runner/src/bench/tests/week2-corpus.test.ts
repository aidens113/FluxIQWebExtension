import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadScenarioManifests } from "../../scenarios.js";
import { findBenchCorpus, week2Corpus } from "../corpus/index.js";
import { expandCorpus, type BenchPlanEntry } from "../expand-corpus.js";

// dist/bench/tests -> repository root, independent of the working directory.
const repositoryRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const label = (entry: BenchPlanEntry): string => `${entry.corpusRowId} ${entry.scenarioId}/${entry.workflowId ?? "primary"}/${entry.variantId ?? "unarmed"}`;

/**
 * Week 2 measures adaptations, which only a Flow Core ran can have, so every
 * result is planned on the Flow lane and nothing is skipped. A result that
 * stops resolving -- a variant renamed in the Scenario Lab -- fails here
 * rather than being skipped in a bench.
 */
test("every week2 result resolves against the built registry and runs on the Flow lane", async () => {
  assert.equal(findBenchCorpus("week2"), week2Corpus);
  const plan = expandCorpus(week2Corpus, await loadScenarioManifests(repositoryRoot));
  assert.deepEqual(plan.map((entry) => [label(entry), entry.resolved, entry.lane, entry.skipReason ?? null]), [
    ["A01 identity-drift/primary/unarmed", true, "flow", null],
    ["A01 identity-drift/primary/renamed-redesign", true, "flow", null],
    ["A02 product-catalog/primary/text-variant", true, "flow", null],
    ["A03 data-table/primary/column-reorder", true, "flow", null],
    ["A04 modal-flows/consent-then-click/banner-absent", true, "flow", null],
    ["A05 intermediate-state/primary/unannounced", true, "flow", null],
    ["A06 member-directory/primary/unarmed", true, "flow", null],
    ["A06 member-directory/primary/restyled", true, "flow", null],
  ]);
});
