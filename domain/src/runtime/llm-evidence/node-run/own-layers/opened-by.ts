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
// **An interruption answer owns no fresh layer.** It runs only when that
// interruption is there, so a card seen after it cannot make its own answer a
// required step. This holds whether the card came from that answer or from a
// timer in the same instant, and whether the page ties it to the control or
// not. The runtime already knows what the press answered; timing and the
// model's words cannot overrule that fact. A required opener keeps its layers.
// Core still requires every step that does one of the person's acts.
//
// **What the page shows next.** A layer tied to the acted control
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
// **A layer in another document is not the act's (t1062).** An act made inside a child frame
// opens what its own document makes of it; a layer that rose in another document -- the top page
// over an embedded booking widget -- was raised by that document's own script. Nor can it be tied
// to the control: a tie across two documents compares boxes in two coordinate spaces, and an id
// one document names is not another's. Company-website `run-mwxh0jy6-91aad522`: the site's newsletter offer
// opens on a timer a few seconds after the booking page loads, and it rose in the instant after
// the build pressed the widget's Next inside its iframe. Remembered as that press's own, the
// offer's close was saved as a required step, and once the site remembered the close (it never
// offers again) every later attempt stopped on it. The frame is the capture's own fact
// (`frameId`, the frame each element was captured in), never timing or the model's words. A
// widget that asks its parent page to open a layer reads as an interruption: its answer runs
// whenever the layer shows and is passed over only when it does not.
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
  if (act.answered) return [];
  const handle = canonicalWebLlmTargetHandle(act.handle);
  const was = handle === undefined ? undefined : before.elements.find((element) => element.target === handle);
  const now = handle === undefined ? undefined : after.elements.find((element) => element.target === handle);
  const control = now ?? was;
  // Only a layer in the control's own document can be what it opened (header, t1062): a tie drawn across two
  // documents is geometry in two coordinate spaces, and an id one document names is not another's.
  const ownDocument = control === undefined ? fresh : fresh.filter((layer) => frameOf(after.elements.find((element) => element.target === layer)) === frameOf(control));
  if (ownDocument.length === 0) return ownDocument;
  const tied = control === undefined ? [] : ownDocument.filter((layer) => webLayerTiedToControl(after, control, layer));
  if (tied.length > 0) return tied;
  const expanded = now?.expanded === true && was?.expanded !== true;
  const commits = webAutomationResolvedActionEffect(act.actionType, act.parameters)?.effectClass === "commit";
  return commits || expanded ? webLayersBeneathOthers(ownDocument, after) : [];
}

/** The frame an element was captured in: 0, the top document, unless the capture says a child frame. */
function frameOf(element: Pick<WebLlmPageEvidence["elements"][number], "frameId"> | undefined): number {
  return element?.frameId ?? 0;
}
