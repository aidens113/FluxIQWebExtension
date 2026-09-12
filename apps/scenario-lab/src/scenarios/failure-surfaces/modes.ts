/**
 * What happened to the recorded control between the recording and the run.
 *
 * The recording clicks `detach-target`, the one control on this page a person
 * can actually press, so each armed mode changes that control and nothing else.
 * Each is something a real site does to a control a recording captured:
 *
 * - `disabled`: the record was locked, so the button is still there and refuses
 *   to be pressed. A refusal, not a miss: `blocked_by_capability_or_policy`.
 * - `detached`: the item was deleted, so the button is not on the page at all
 *   and a deletion notice stands where it was: `target_not_found`.
 * - `blocked-url`: the action now leads off-site and the workspace's link guard
 *   refuses the destination, bouncing the run to an interstitial it never asked
 *   for: `navigation_unexpected`.
 *
 * The three are mutually exclusive by construction: in each mode the other two
 * failures cannot occur, so a run reporting the wrong one is wrong rather than
 * lucky.
 */
export const failureSurfacesModes = ["baseline", "disabled", "detached", "blocked-url"] as const;

export type FailureSurfacesMode = (typeof failureSurfacesModes)[number];

export function readFailureSurfacesMode(payload: unknown): FailureSurfacesMode | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const mode = (payload as Record<string, unknown>).mode;
  return failureSurfacesModes.find((candidate) => candidate === mode);
}
