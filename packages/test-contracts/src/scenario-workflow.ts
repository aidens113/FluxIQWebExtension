import type { ExpectedFact, ScenarioExpected, ScenarioStep, ScenarioVariant, WebScenario } from "./scenario.js";

/**
 * One run's workflow: what the recording lane performs and what the run must
 * meet. `expected` is the replace-or-inherit merge of the workflow's and the
 * variant's expectations.
 *
 * **`expected.pageFacts` is dead weight: no lane reads it.** It is the same
 * merge as every other field, which for page facts is meaningless -- a page
 * fact describes one rendering, an armed run presents two, and the merge
 * flattens both into a set that cannot say which. Every lane reads
 * `scenarioPageFactSchedule` instead. It survives only because `expected` is
 * typed as `ScenarioExpected`, the authored manifest shape, where `pageFacts`
 * is a legitimate field an author writes: dropping it from the resolved value
 * means giving the resolved value a type of its own, and three fixture
 * assertions still read the merge (`product-catalog.spec.ts`, and the
 * `intermediate-state` and `multi-tab` unit tests, which assert that a variant
 * inherits it). Read it for nothing, and write no new reader.
 */
export type ResolvedScenarioWorkflow = {
  workflowId: string | undefined;
  variant: ScenarioVariant | undefined;
  recordingScript: ScenarioStep[];
  expected: ScenarioExpected;
};

/**
 * When a lane arms the variant, relative to the first time it loads the
 * fixture. That is the only property of a lane the page-fact schedule depends
 * on, so it is named for it rather than for the product lane.
 *
 * - `unarmed`: nothing is armed -- the recording lane, and any lane running a
 *   workflow with no variant selected.
 * - `arms-after-loading`: the Flow lane. It records the workflow against the
 *   unarmed rendering, then resets, arms and reloads before running the Flow
 *   it built from that recording, so one run presents both renderings.
 * - `arms-before-loading`: the existing and clone lanes. They replay a
 *   pre-existing Flow and build no recording, so the variant is armed before
 *   the fixture is opened and the unarmed rendering is never presented.
 */
export type ScenarioArming = "unarmed" | "arms-after-loading" | "arms-before-loading";

/**
 * Which page facts a lane checks, and against which rendering. `atLoad` is
 * checked once the fixture has first loaded; `afterArm` once the variant has
 * been armed and the page reloaded. Either is empty when the lane never
 * presents the rendering it describes, or when nothing was declared about it.
 */
export type ScenarioPageFactSchedule = { atLoad: readonly ExpectedFact[]; afterArm: readonly ExpectedFact[] };

/**
 * The page-fact contract in one place, so that no lane decides it again.
 *
 * A page fact describes the rendering it is declared on, at the moment that
 * rendering is first presented to the run: a workflow's facts describe its
 * unarmed page, a variant's describe its armed page, and neither inherits the
 * other's (`ScenarioVariant`). Every lane therefore checks the same declared
 * set against the same page state, and the lanes differ only in which of the
 * two renderings they present.
 */
export function scenarioPageFactSchedule(
  scenario: WebScenario,
  selection: { workflowId?: string; variantId?: string } = {},
  arming: ScenarioArming = "unarmed",
): ScenarioPageFactSchedule {
  const workflowFacts = resolveScenarioWorkflow(scenario, selection.workflowId === undefined ? {} : { workflowId: selection.workflowId }).expected.pageFacts ?? [];
  const { variant } = resolveScenarioWorkflow(scenario, selection);
  const armedFacts = variant?.expected.pageFacts ?? [];
  if (arming === "arms-before-loading") return { atLoad: variant ? armedFacts : workflowFacts, afterArm: [] };
  if (arming === "arms-after-loading") return { atLoad: workflowFacts, afterArm: armedFacts };
  return { atLoad: workflowFacts, afterArm: [] };
}

/**
 * Resolves the primary workflow (no `workflowId`) or a named `workflows[]`
 * entry, then applies `variantId` from that workflow's own variants: every
 * field the variant's `expected` sets replaces the workflow's field.
 */
export function resolveScenarioWorkflow(
  scenario: WebScenario,
  selection: { workflowId?: string; variantId?: string } = {},
): ResolvedScenarioWorkflow {
  const { workflowId, variantId } = selection;
  const workflow = workflowId === undefined ? scenario : scenario.workflows?.find((candidate) => candidate.id === workflowId);
  if (!workflow) throw new Error(`Scenario ${scenario.id} has no workflow ${workflowId}`);
  const variant = variantId === undefined ? undefined : workflow.variants?.find((candidate) => candidate.id === variantId);
  if (variantId !== undefined && !variant) throw new Error(`Scenario ${scenario.id} workflow ${workflowId ?? "primary"} has no variant ${variantId}`);
  return {
    workflowId,
    variant,
    recordingScript: workflow.recordingScript,
    expected: variant ? { ...workflow.expected, ...variant.expected } : workflow.expected,
  };
}
