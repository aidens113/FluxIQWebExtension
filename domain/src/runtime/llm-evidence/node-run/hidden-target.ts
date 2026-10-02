// What hid a step's target, when the page judged it there and not visible.
//
// A dry run checks a step whose effect lasts rather than taking it
// (`./verify.ts`). Its `visible` check tells a target that is not there from
// one that is there and not shown; this tells the second kind apart again,
// because the two mean opposite things for the Flow:
//
//   enclosed -- a container the target sits in is closed: a flyout, menu, panel
//     or disclosure the steps before it never opened. The Flow cannot take the
//     step on a fresh site either. Lane A's run 40 (`run-muq6lqnw-fdfa7aac`):
//     bigbox's "Set as my store" inside the store chooser's closed flyout, in a
//     Flow that never pressed the chip that opens it.
//   itself -- every container is open and the control alone is not shown, which
//     is how a control withdrawn by its own effect looks: a "Follow" hidden
//     beside the "Following" that replaced it.
//
// The page says which in the failure record's `actual`
// (`apps/extension/src/content/action-runtime/assertion-evaluation.ts`): the
// closed word `enclosed:` leads it for the first, and the second is the
// sentence a not-visible claim has always said, which the harness pins word
// for word. Only those two readings are made. Anything else -- a client that
// does not say, a record whose text was withheld -- is neither, and the check
// answers as it always did for a hidden target: failed.

/** Which of the two a hidden target is. */
export type WebNodeHiddenTarget = "enclosed" | "itself";

/** The closed word that leads `actual` when a closed container hides the target. */
const ENCLOSED_WORD = "enclosed:";

/** What a `visible` claim says of a target that is there and alone not shown. */
const ITSELF_ACTUAL = "it is present but not visible";

/** What hid the target a `visible` check judged not shown, or `undefined` when the page did not say. */
export function webNodeHiddenTarget(result: { failure?: { actual?: unknown } | undefined }): WebNodeHiddenTarget | undefined {
  const actual = result.failure?.actual;
  if (typeof actual !== "string") return undefined;
  if (actual.startsWith(ENCLOSED_WORD)) return "enclosed";
  return actual === ITSELF_ACTUAL ? "itself" : undefined;
}
