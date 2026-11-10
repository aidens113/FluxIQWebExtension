// Which of the layers new after an act the act opened (`./memory.ts`).
//
// **The problem this closes.** A layer new on the look after an act was once
// credited to the act for that alone. Crossborder `run-mwa9oytn-d866da84`: a
// notification card the site raises on a timer rose in the instant after the
// build typed "10" into a price field. Remembered as the typing's own, the
// press of its "Not now" answered nothing, so it was saved as a required step,
// and a later run on a page that remembered "later" stopped on it
// (`executor.target.gone`). Timing says when a layer came, not what brought it.
//
// **What the page shows first.** A layer tied to the acted control
// (`./tied.ts`: the control names it, or it hangs from the control's edge) is
// the act's, whatever the act was. Where some new layers are tied, those alone
// are the act's.
//
// **Where the page shows no tie, the kind of act decides**, read from the
// domain's own trusted floor (`../../../../actions/action-effect/`), never from
// the model's words:
//
// - **A commit** -- a press, a key, a typing that sends its form, anything whose
//   effect the page defines -- opens what the page makes of it, and a page need
//   not tie a dialog to the button that opens it (bigbox's store chooser, t193).
//   Its new layers are its own, as they always were, less any standing over
//   another's controls (`./beneath.ts`, t869). The same holds for a control
//   whose own `aria-expanded` turned true across the act: it says it opened.
// - **A state setter** -- typing without sending, clearing, choosing an option,
//   setting a box, choosing files -- sets the value it names; that is what makes
//   it repeat-safe. What it opens beyond that the page ties to the control: a
//   suggestion list, a picker. An untied layer that rose beside it came from
//   elsewhere -- a timer, a scroll -- and its answer is the Flow's answer to an
//   interruption, run only when the layer is there.
//
// **What this costs.** A layer a state setter's value does raise with no tie at
// all -- a confirm the page puts up on a typed or chosen value, drawn apart from
// the control and naming nothing -- cannot be told by any capture from one that
// rose on a timer in the same instant. It now reads as an interruption: its
// answer runs whenever it shows, and is passed over only when it does not. A
// step that does one of the person's acts is never passed over (Core's
// `interruption.ts`), so this never makes such an act optional. The opposite
// error stopped every saved Flow whose page remembered its answer.

import type { WebLlmPageEvidence } from "../../sanitize";
import { webAutomationResolvedActionEffect } from "../../../../actions/action-effect";
import { canonicalWebLlmTargetHandle } from "../../handle-spelling";
import type { WebNodeLayerAct } from "./act";
import { webLayersBeneathOthers } from "./beneath";
import { webLayerTiedToControl } from "./tied";

/** Of `fresh` -- layers on `after` that were not on `before`, the same page -- those `act` opened. */
export function webLayersOpenedBy(act: WebNodeLayerAct, before: WebLlmPageEvidence, after: WebLlmPageEvidence, fresh: readonly string[]): readonly string[] {
  if (fresh.length === 0) return fresh;
  const handle = canonicalWebLlmTargetHandle(act.handle);
  const was = handle === undefined ? undefined : before.elements.find((element) => element.target === handle);
  const now = handle === undefined ? undefined : after.elements.find((element) => element.target === handle);
  const control = now ?? was;
  const tied = control === undefined ? [] : fresh.filter((layer) => webLayerTiedToControl(after, control, layer));
  if (tied.length > 0) return tied;
  const expanded = now?.expanded === true && was?.expanded !== true;
  const commits = webAutomationResolvedActionEffect(act.actionType, act.parameters)?.effectClass === "commit";
  return commits || expanded ? webLayersBeneathOthers(fresh, after) : [];
}
