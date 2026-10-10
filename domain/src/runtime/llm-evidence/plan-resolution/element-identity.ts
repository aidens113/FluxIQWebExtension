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
//
// **Every stable fact the packet has about the element rides, not only its
// name** (t422). A created node's identity was the tag, role, name, text,
// selector and input type, and nothing else. R4a (`run-mv2pgqkj-f3552c70`)
// saved crossborder's quantity box as `{ tagName: "input", selector:
// "#fb1l6ufkg" }`: the box has no accessible name and, being an input, no text
// the identity keeps, and the page mints that id again on every load. Once the
// page set aside an id no element carries (t419), nothing was left to find the
// box by (`content/identity/score.ts` `hasIdentitySignal`), and both trials
// failed `web.target.not_found` on a box in plain view. The packet had what
// would have found it -- its label "Quantity" -- and this dropped it.
//
// So a created node's identity is now the fingerprint a recorded node's is
// (user, 2026-10-10: every element is found by its fingerprint, never by one
// attribute, so a changed id, class or text does not break a Flow while its
// other signals hold). It is built by the recorded path's own normalizer,
// `output-nodes/targets` `elementFingerprint`, from the packet element written
// as the descriptor the recorder captures, so the two paths read one
// vocabulary and cannot drift:
//
// - the tag, the role and the implied role, the input type;
// - the accessible name, the label, and for a control that is not a text
//   field or a select its visible text;
// - the id and the class tokens, each a signal of its own and not only inside
//   the selector -- the page sets aside an id no element carries any more
//   (`content/identity/score.ts`), so a per-load id costs nothing once gone;
// - the `name` attribute and a test id (`data-testid`, `data-test`,
//   `data-cy`), and under `attributes` only the identifying ones: those, a
//   `placeholder` and an `aria-label` -- never the packet's whole map, which
//   holds the element's state as well as its identity;
// - where it sat: its form, landmark, list and table position, shadow hosts
//   and record.
//
// All of it is read from the packet the domain keeps for each handle, which
// already holds every attribute the capture's descriptor carried
// (`../elements.ts` `publishedAttributes`); none of it is new in what the
// model is shown. The model names an element only by its handle.
//
// Never a value, a checked state, a selected option or a link target: those
// are contents. A secret control -- by its type, its `autocomplete` or
// `data-sensitive` -- carries no words and no attributes, only its kind,
// address and place.

import type { WebAutomationElementContext, WebAutomationElementFingerprint } from "../../../actions/types";
import { elementFingerprint } from "../../../output-nodes/targets";
import { isSensitiveFieldSignature } from "../../../sensitivity";
import { attributeRecord } from "../attributes";
import type { WebLlmEvidenceElement } from "../elements";
import { webLlmReadableWords } from "../page-view";
import { present } from "../present";
import { isWithheldText } from "../withheld";

/** The recorded fingerprint fields a handle's element can honestly fill. */
export type WebPlanElementIdentity = Pick<WebAutomationElementFingerprint,
  "tagName" | "role" | "implicitRole" | "accessibleName" | "label" | "visibleText" | "selector" | "inputType" | "id" | "classNames" | "name" | "testId" | "attributes"> & {
  context?: WebPlanElementContext | undefined;
};

type WebPlanElementContext = Pick<WebAutomationElementContext, "formId" | "landmark" | "listPosition" | "tablePosition" | "shadowHosts" | "record">;

/** Controls whose text is what they hold rather than what they are called. */
const CONTENT_TAGS: ReadonlySet<string> = new Set(["input", "textarea", "select"]);

/** The attributes an identity keeps: the ones that say which control this is, and none that say what state it is in. */
const IDENTITY_ATTRIBUTES: readonly string[] = ["name", "placeholder", "aria-label", "data-testid", "data-test", "data-cy"];

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
  const byName = attributeRecord(element.attributes ?? []);
  const secret = isSensitiveFieldSignature({
    inputType: element.inputType,
    controlType: element.controlType,
    autocomplete: byName.autocomplete,
    dataSensitive: byName["data-sensitive"]
  });
  // The packet element, written as the descriptor the recorder captures, and read by the recorded path's normalizer.
  const descriptor = present<WebPlanElementIdentity>({
    tagName: element.tag,
    selector,
    role: element.role,
    implicitRole: element.implicitRole,
    inputType: element.inputType,
    accessibleName: secret ? undefined : whole(element.name),
    label: secret ? undefined : whole(element.label),
    visibleText: secret || CONTENT_TAGS.has(element.tag) ? undefined : whole(element.text),
    id: secret ? undefined : filled(byName.id),
    classNames: secret ? undefined : classTokens(byName.class),
    name: secret ? undefined : filled(byName.name),
    testId: undefined,
    attributes: secret ? undefined : identityAttributes(byName),
    context: contextOf(element, shadowHosts)
  });
  const fingerprint = elementFingerprint(descriptor) ?? {};
  return present<WebPlanElementIdentity>({
    tagName: fingerprint.tagName,
    role: fingerprint.role,
    implicitRole: fingerprint.implicitRole,
    accessibleName: fingerprint.accessibleName,
    label: fingerprint.label,
    visibleText: fingerprint.visibleText,
    selector: fingerprint.selector,
    inputType: fingerprint.inputType,
    id: fingerprint.id,
    classNames: fingerprint.classNames,
    name: fingerprint.name,
    testId: fingerprint.testId,
    attributes: fingerprint.attributes,
    context: fingerprint.context
  });
}

/**
 * The identity one handle keeps when a newer view of its page shows its control
 * again (t356, C1): what the views agree on, so a control's own act never
 * becomes its identity.
 *
 * Lane A round 4 (`run-muyrpbnk-fef374e7`): exploration pressed the store
 * coupon's "Get coupons", the page relabelled it "Collected", and the newer view
 * replaced the page's handles, so the candidate script's `target: t925` was bound
 * to "Collected". On the trial's freshly reset page the button read "Get coupons"
 * again and the step failed `web.target.not_found` (0032). A Flow runs on the
 * page as it is before its steps act, and exploration acts on what it looks at,
 * so the words a later view shows may be the act's, not the control's.
 *
 * So a handle whose newer view is the same control -- same tag, role, selector
 * and shadow hosts -- keeps only the fields both views agree on: its tag, role,
 * selector and every attribute that stayed the same, never the label the act
 * put there. The label is dropped rather than kept as first shown, because the
 * same handle also serves exploration on the page as it now is: a second press
 * of the "Collected" control carrying "Get coupons" would be refused by the
 * page's identity veto for contradicting it
 * (`apps/extension/src/content/identity/veto.ts`), while an identity that names
 * no label asks nothing the page contradicts, on the reset page or this one.
 * Once a field is dropped it stays dropped. A newer view whose handle names
 * another element (tag, role or address changed) replaces it whole.
 */
export function webPlanElementIdentityAcrossViews(earlier: WebPlanElementIdentity, newer: WebPlanElementIdentity): WebPlanElementIdentity {
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  if (!same(earlier.tagName, newer.tagName) || !same(earlier.role, newer.role) || !same(earlier.selector, newer.selector)
    || !same(earlier.context?.shadowHosts, newer.context?.shadowHosts)) return newer;
  const agreed = <T>(a: T, b: T): T | undefined => (same(a, b) ? a : undefined);
  const context = present<WebPlanElementContext>({
    formId: agreed(earlier.context?.formId, newer.context?.formId),
    landmark: agreed(earlier.context?.landmark, newer.context?.landmark),
    listPosition: agreed(earlier.context?.listPosition, newer.context?.listPosition),
    tablePosition: agreed(earlier.context?.tablePosition, newer.context?.tablePosition),
    shadowHosts: newer.context?.shadowHosts,
    record: agreed(earlier.context?.record, newer.context?.record)
  });
  return present<WebPlanElementIdentity>({
    tagName: newer.tagName,
    role: newer.role,
    implicitRole: agreed(earlier.implicitRole, newer.implicitRole),
    accessibleName: agreed(earlier.accessibleName, newer.accessibleName),
    label: agreed(earlier.label, newer.label),
    visibleText: agreed(earlier.visibleText, newer.visibleText),
    selector: newer.selector,
    inputType: agreed(earlier.inputType, newer.inputType),
    id: agreed(earlier.id, newer.id),
    // A class an act toggles (`active`, `selected`) is the act's; the tokens both views carry are the control's.
    classNames: agreedTokens(earlier.classNames, newer.classNames),
    name: agreed(earlier.name, newer.name),
    testId: agreed(earlier.testId, newer.testId),
    attributes: agreedAttributes(earlier.attributes, newer.attributes),
    context: Object.keys(context).length > 0 ? context : undefined
  });
}

/** The class tokens two views of one control both carry; nothing when they share none. */
function agreedTokens(left: string[] | undefined, right: string[] | undefined): string[] | undefined {
  if (left === undefined || right === undefined) return undefined;
  const kept = left.filter((token) => right.includes(token));
  return kept.length > 0 ? kept : undefined;
}

/** The identifying attributes two views of one control both gave the same value; nothing when they agree on none. */
function agreedAttributes(left: Record<string, string> | undefined, right: Record<string, string> | undefined): Record<string, string> | undefined {
  if (left === undefined || right === undefined) return undefined;
  const kept = Object.fromEntries(Object.entries(left).filter(([key, value]) => right[key] === value));
  return Object.keys(kept).length > 0 ? kept : undefined;
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

/**
 * Where the element sat, in the recorded context's field names: its form, its
 * landmark, its list and table position, the shadow hosts its handle's binding
 * kept, and its record. Nothing when the packet placed it nowhere.
 */
function contextOf(element: WebLlmEvidenceElement, shadowHosts: readonly string[] | undefined): WebPlanElementContext | undefined {
  const context = present<WebPlanElementContext>({
    formId: whole(element.form),
    landmark: element.landmark,
    listPosition: element.item === undefined ? undefined : { index: element.item.index, total: element.item.total },
    tablePosition: element.cell === undefined ? undefined : present<NonNullable<WebPlanElementContext["tablePosition"]>>({ row: element.cell.row, column: element.cell.column, columnHeader: whole(element.cell.header) }),
    shadowHosts: shadowHosts === undefined || shadowHosts.length === 0 ? undefined : [...shadowHosts],
    record: recordOf(element)
  });
  return Object.keys(context).length > 0 ? context : undefined;
}

/** The class attribute's tokens, each whole; nothing for a class the packet withheld or left blank. */
function classTokens(value: string | undefined): string[] | undefined {
  const tokens = filled(value)?.split(/\s+/u).filter((token) => token !== "");
  return tokens !== undefined && tokens.length > 0 ? tokens : undefined;
}

/** A packet string that is the element's own and says something. */
function filled(value: string | undefined): string | undefined {
  const own = whole(value);
  return own === undefined || own.trim() === "" ? undefined : own;
}

/** The record the packet named the element's row or card by, when it named one whole. */
function recordOf(element: WebLlmEvidenceElement): WebPlanElementContext["record"] {
  const text = whole(element.within);
  return text === undefined ? undefined : { text };
}

/**
 * The identifying attributes the packet published whole, under the names the
 * page wrote them in; nothing when it published none. A blank value names
 * nothing and is left out.
 */
function identityAttributes(byName: Record<string, string>): Record<string, string> | undefined {
  const kept: Record<string, string> = {};
  for (const key of IDENTITY_ATTRIBUTES) {
    const value = filled(byName[key]);
    if (value !== undefined) kept[key] = value;
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/** A packet string that is the element's own, rather than the marker the secret screen put in its place. */
function whole(value: string | undefined): string | undefined {
  return value === undefined || isWithheldText(value) ? undefined : value;
}
