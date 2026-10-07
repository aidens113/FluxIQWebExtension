// Who the element behind a target handle is, written the way a recorded node
// carries it: `parameters.element`, in the recorded element fingerprint's own
// field names (`actions/types.ts` `WebAutomationElementFingerprint`).
//
// A created node needs this as much as a recorded one, and for a reason that
// is not obvious from the domain. Core normalizes an element target out of
// every dispatched node's parameters (`runtime/io-policy.ts`
// `prepareElementTargetAction`). With no `element` beside them it reads the
// parameters' own keys, and it reads `text` as the element's visible text. So a
// created `web.dom.type` node with only a selector reached the page claiming
// the words it was about to type as the input's identity, and the page's veto
// (`content/identity/veto.ts`) refused the right input for not showing them:
// "refused input[data-testid="instruction-name"] scoring 0.17 with nothing the
// recording named agreeing" (`run-mu4t20d1-93b60760`). With an `element`
// present Core never reads `text`, and the page scores the element the model
// was shown against the element it finds.
//
// What is copied is the fingerprint a runtime repair builds from the same
// packet element (`../target-override.ts`): the tag, the role, the name, the
// visible text, the form, the list position -- the frame rides on the node as
// `browserFrameId`, as it does for a recorded one. Nothing else. The packet
// already refuses to describe a secret control and carries no value; this adds
// three rules of its own on top, because an identity is carried further than
// the packet is:
//
// - a text control's or a select's text is its contents or its options, not
//   its identity, and is left out;
// - a name or text the packet withheld as shaped like a secret
//   (`../withheld.ts`) is not the element's, and is left out rather than
//   compared as though it were;
// - a control whose signature says it holds a secret carries no name or text
//   at all, should one ever reach here.
//
// The packet's `name` is written here as `accessibleName`. It is the
// extension's computed accessible name, falling back to the descriptor's
// `name` (`../elements.ts`), which `describe-element.ts` fills from the
// element's own aria-label, title or alt -- each of which the computed name
// reads too. So on a real page the two agree, and the page compares like with
// like.
//
// **The record the control sat in rides too, as `context.record`** -- the key
// a recorded node already carries, which the page's record gate reads
// (`apps/extension/src/content/identity/record.ts`). Until t193 a created node
// dropped it, and a control a page repeats in every card was replayed by its
// position and its label alone: the bigbox store chooser's four cards hold one
// identical "Set as my store" each, the draft's step named Millbrook's by
// `li:nth-of-type(3) > button`, and when a dry run met the chooser with
// Millbrook already chosen -- its card then holds "Your store" and no button --
// the step read the other stores' buttons as one ambiguous target
// (`run-munri5gr-94d7f8a0`, step 8, `core.replay.failed`). With the record, a
// card that is gone reads as gone, and another card's button is never pressed.
//
// The source is the packet's own `within`: the record's words, less its
// controls' (`../elements.ts` `recordWords`). The packet publishes them on
// exactly the elements a record tells apart -- the look-alikes, and the example
// of a control every row repeats (`../look-alikes.ts`) -- which are the
// elements the gate exists for. Like a name, they are carried only when the
// packet did not withhold them, because the page compares them whole. The
// packet no longer cuts any string (t200), so a whole name is every name. A
// record the page *keyed* (`data-id` and the like) publishes no words and so
// travels no record from here; its key lives in the binding's `records`, which
// only the call site (`target-packets.ts`) holds.
//
// **The words a person reads for the element ride beside the identity, never in
// it** (`webPlanElementWords`, U-B3-3). A control that lays its words out as
// separate blocks -- bigbox's size chip, "12 Double Rolls" over "$16.47" --
// has a captured text that runs them together, "12 Double Rolls$16.47", and the
// identity keeps that text whole because the page compares it. Named from the
// identity, the step result, the draft's `does` and the chat read the glued
// string the page view never printed (`run-mux6pndp-16feb842`, step 0038). The
// readable spelling is the packet's `readable`, taken only where it differs from
// the identity's own name by spacing alone, so it is never words the identity
// would not already carry: no name for a secret control, none that was withheld.

import type { WebAutomationElementContext, WebAutomationElementFingerprint } from "../../../actions/types";
import { isSensitiveFieldSignature } from "../../../sensitivity";
import type { WebLlmEvidenceElement } from "../elements";
import { webLlmReadableWords } from "../page-view";
import { present } from "../present";
import { isWithheldText } from "../withheld";

/** The recorded fingerprint fields a handle's element can honestly fill. */
export type WebPlanElementIdentity = Pick<WebAutomationElementFingerprint, "tagName" | "role" | "accessibleName" | "visibleText" | "selector" | "inputType"> & {
  context?: WebPlanElementContext | undefined;
};

type WebPlanElementContext = Pick<WebAutomationElementContext, "formId" | "listPosition" | "shadowHosts" | "record">;

/** Controls whose text is what they hold rather than what they are called. */
const CONTENT_TAGS: ReadonlySet<string> = new Set(["input", "textarea", "select"]);

/**
 * The identity of one packet element, addressed by the selector its handle was
 * bound to -- and, for an element inside open shadow roots, by the host chain
 * the binding kept beside that selector. The chain is the key a recorded node
 * already carries (`context.shadowHosts`), so a created node's click and its
 * wait are scoped to the widget's root exactly as a recorded one's are, rather
 * than finding the element only through the page-side search of every root
 * that a click falls back on and a wait does not.
 */
export function webPlanElementIdentity(element: WebLlmEvidenceElement, selector: string, shadowHosts?: readonly string[]): WebPlanElementIdentity {
  const secret = isSensitiveFieldSignature({ inputType: element.inputType, controlType: element.controlType });
  const context = present<WebPlanElementContext>({
    formId: whole(element.form),
    listPosition: element.item === undefined ? undefined : { index: element.item.index, total: element.item.total },
    shadowHosts: shadowHosts === undefined || shadowHosts.length === 0 ? undefined : [...shadowHosts],
    record: recordOf(element)
  });
  return present<WebPlanElementIdentity>({
    tagName: element.tag,
    role: element.role,
    accessibleName: secret ? undefined : whole(element.name),
    visibleText: secret || CONTENT_TAGS.has(element.tag) ? undefined : whole(element.text),
    selector,
    inputType: element.inputType,
    context: Object.keys(context).length > 0 ? context : undefined
  });
}

/**
 * The words a person reads for the element `identity` was made from: the
 * identity's own name -- its accessible name, else its visible text -- spelled
 * as the packet's readable words when the two differ by spacing alone; nothing
 * when the identity names it no way (a secret control, a withheld name).
 * Display only: never a field of the identity the page compares.
 */
export function webPlanElementWords(element: Pick<WebLlmEvidenceElement, "readable">, identity: WebPlanElementIdentity): string | undefined {
  const name = identity.accessibleName ?? identity.visibleText;
  return name === undefined || name.trim() === "" ? undefined : webLlmReadableWords(element, name);
}

/** The record the packet named the element's row or card by, when it named one whole. */
function recordOf(element: WebLlmEvidenceElement): WebPlanElementContext["record"] {
  const text = whole(element.within);
  return text === undefined ? undefined : { text };
}

/** A packet string that is the element's own, rather than the marker the secret screen put in its place. */
function whole(value: string | undefined): string | undefined {
  return value === undefined || isWithheldText(value) ? undefined : value;
}
