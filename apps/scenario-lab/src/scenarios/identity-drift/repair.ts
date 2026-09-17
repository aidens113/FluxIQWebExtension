import type { ExpectedAction, ExpectedFact, ScenarioExpected } from "@fluxiq-web-extension/test-contracts";

/**
 * What a correct repair of one of this scenario's variants looks like, for the
 * Lab's Flow lane to judge a live run on (`packages/test-runner/src/flow-lane/repair/`),
 * which reads it from this module's build (`scenarios/<scenario id>/repair.js`).
 *
 * A variant's `expected` has one shape for every run, and a live run's outcome
 * depends on what its grant allows. Under a grant that may only *propose* a
 * repair -- the Lab's `--llm-task adapt`, Core's `diagnose_and_adapt` -- Core
 * never retries the click, so even a perfect repair ends with the click failed
 * and nothing saved. That run is held to `proposalOnlyOutcome` instead of the
 * variant's own expectations, and judged by whether the change proposal it
 * saved names `proposal.target`. Every other run -- a provider-free one, or one
 * whose grant executes the repair -- is held to the variant's `expected`.
 */
export type ScenarioRepair = {
  variantId: string;
  /** Replaces these fields of the variant's `expected` for a run whose grant only proposes. */
  proposalOnlyOutcome: Pick<ScenarioExpected, "actions" | "finalState" | "failure">;
  /** The repair a correct run proposes: its patch kind, and the control its target names. */
  proposal: {
    patchKind: "temporary_target_override";
    /** The fingerprint fields the domain resolves a handle to, compared exactly. At least one. */
    target: { tagName?: string; accessibleName?: string; controlType?: string };
  };
};

const NOTHING_SAVED: ExpectedFact = { id: "nothing-saved", subject: "save-status", predicate: "text", value: "" };
const CLICK_REFUSED: ExpectedAction[] = [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "failed" }];

export const SCENARIO_REPAIRS: readonly ScenarioRepair[] = [
  {
    // The matcher refuses the redesigned Save (-0.104 against the 0.35 floor,
    // `modes.ts`), so the click fails with `target_not_found`: that is the
    // declared outcome of a proposal-only run, and a correct run still ends
    // there, with the status line empty. What it is judged on is the proposal:
    // a target override naming the page's one submit control, Apply changes.
    // Discard changes is the pressable wrong answer; a proposal naming it is a
    // `wrong_target`, and a refused or missing one fails the run too.
    variantId: "renamed-redesign",
    proposalOnlyOutcome: {
      actions: CLICK_REFUSED,
      finalState: [NOTHING_SAVED],
      failure: { category: "target_not_found", code: "web.target.not_found" },
    },
    proposal: {
      patchKind: "temporary_target_override",
      target: { tagName: "button", accessibleName: "Apply changes", controlType: "submit" },
    },
  },
];
