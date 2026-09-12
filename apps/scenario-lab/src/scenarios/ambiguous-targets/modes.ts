/**
 * The three renderings of the same choice.
 *
 * `baseline` is the page as it has always been: two `Continue` buttons whose
 * only distinguishing signal is a `data-testid`. The two armed renderings drop
 * the test ids -- a design system that stopped emitting them, which is the
 * commonest way a recorded selector dies -- and differ from each other in one
 * thing only, whether the page still says where each button belongs.
 *
 * `no-context` merges the two panels into one unnamed group: the buttons then
 * share every signal a resolver reads (tag, role, accessible name, class,
 * owning form, fieldset legend, nearest heading, landmark), so no candidate can
 * be preferred and the honest answer is `target_ambiguous`.
 *
 * `form-context` keeps the very same two buttons and puts each back inside its
 * own named form and legend. Nothing else changes -- still no test ids, still
 * the same accessible name -- so the only thing that can tell them apart is the
 * context, which is what makes the pair the proof that context resolves
 * ambiguity rather than a page rigged to be confusing.
 */
export const ambiguousTargetsModes = ["baseline", "no-context", "form-context"] as const;

export type AmbiguousTargetsMode = (typeof ambiguousTargetsModes)[number];

export function readAmbiguousTargetsMode(payload: unknown): AmbiguousTargetsMode | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const mode = (payload as Record<string, unknown>).mode;
  return ambiguousTargetsModes.find((candidate) => candidate === mode);
}
