// Whether an element can actually be acted on right now, and where to hit it.
//
// The gate is visible (a non-zero box, not hidden, not inert), enabled (no
// `disabled` and no `aria-disabled`), and reachable: after scrolling the
// element into view, the point at its centre must land on the element itself or
// one of its descendants rather than on an overlay. A refusal names which of
// the three failed, so the result can report ACTION_REJECTED with a code
// instead of a generic failure.
//
// Owned by `w2-click`, which replaces this stub.

export type ActionabilityRejectionCode = "disabled" | "hidden" | "covered";

export type ActionabilityReport =
  | { actionable: true; point: { x: number; y: number }; detail: string }
  | { actionable: false; code: ActionabilityRejectionCode; detail: string; point?: { x: number; y: number } | undefined };

export function checkActionability(_element: Element): ActionabilityReport {
  throw new Error("The actionability capability is not implemented yet.");
}
