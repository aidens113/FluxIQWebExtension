/**
 * Improving a Flow that already exists, rather than building one, on the
 * provider-free fixture. Live runs use only the ten realistic scenarios, so
 * the Week 2 exit row's live proof is everything-store's `deal-wheel` twin;
 * this is the same shape on a fixture the unit and Lab tests can drive.
 *
 * The Flow is built first from `baseTaskId` on the unarmed console, where no
 * announcement ever shows, so it knows nothing about one. The console is then
 * armed into `improveOnVariantId`, and the person tells the existing Flow, in
 * the panel, what it should now do (`instruction`). FluxIQ amends the Flow's
 * own steps from the live page -- Core's `extend`, which keeps its Router,
 * Subflow and node ids -- and the person accepts the suggested change. The
 * improved Flow must then pass every task in `verifyTaskIds` by replay alone,
 * with no provider call: with the announcement showing, and without it.
 *
 * Like the creation catalog, the instruction is what a person would say: a
 * goal, never a selector, test id or step list.
 */
export type ExistingFlowImprovementTask = {
  id: string;
  scenarioId: string;
  /** The creation task whose Flow is improved. Built on its own rendering, unarmed. */
  baseTaskId: string;
  /** The rendering the improvement is worked out on. */
  improveOnVariantId: string;
  /** What the person tells the existing Flow in the panel. */
  instruction: string;
  /** Creation tasks whose judgement the improved Flow must pass by replay, each on its own rendering. */
  verifyTaskIds: readonly string[];
};

export const WEEK_AHEAD_IMPROVEMENT: ExistingFlowImprovementTask = Object.freeze({
  id: "social-scheduler-week-ahead-improved-past-announcements",
  scenarioId: "social-scheduler",
  baseTaskId: "social-scheduler-week-ahead",
  improveOnVariantId: "whats-new",
  instruction: "After an update the console sometimes opens with a What's new announcement in front of the queue. When one is showing, close it first; when none is, go straight to the queue as before.",
  verifyTaskIds: Object.freeze(["social-scheduler-week-ahead-whats-new", "social-scheduler-week-ahead-no-announcement"]),
});
