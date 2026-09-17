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
// - a name or text the packet cut at its bound is not the element's, and is
//   left out rather than compared as though it were;
// - a control whose signature says it holds a secret carries no name or text
//   at all, should one ever reach here.
//
// The packet's `name` is written here as `accessibleName`. It is the
// extension's computed accessible name, falling back to the descriptor's
// `name` (`../elements.ts`), which `describe-element.ts` fills from the
// element's own aria-label, title or alt -- each of which the computed name
// reads too. So on a real page the two agree, and the page compares like with
// like.

import type { WebAutomationElementContext, WebAutomationElementFingerprint } from "../../../actions/types";
import { isSensitiveFieldSignature } from "../../../sensitivity";
import type { WebLlmEvidenceElement } from "../elements";
import { WEB_LLM_EVIDENCE_BOUNDS } from "../limits";
import { present } from "../present";

/** The recorded fingerprint fields a handle's element can honestly fill. */
export type WebPlanElementIdentity = Pick<WebAutomationElementFingerprint, "tagName" | "role" | "accessibleName" | "visibleText" | "selector" | "inputType"> & {
  context?: WebPlanElementContext | undefined;
};

type WebPlanElementContext = Pick<WebAutomationElementContext, "formId" | "listPosition">;

/** Controls whose text is what they hold rather than what they are called. */
const CONTENT_TAGS: ReadonlySet<string> = new Set(["input", "textarea", "select"]);

/** The identity of one packet element, addressed by the selector its handle was bound to. */
export function webPlanElementIdentity(element: WebLlmEvidenceElement, selector: string): WebPlanElementIdentity {
  const secret = isSensitiveFieldSignature({ inputType: element.inputType, controlType: element.controlType });
  const context = present<WebPlanElementContext>({
    formId: uncut(element.form, WEB_LLM_EVIDENCE_BOUNDS.placement),
    listPosition: element.item === undefined ? undefined : { index: element.item.index, total: element.item.total }
  });
  return present<WebPlanElementIdentity>({
    tagName: element.tag,
    role: element.role,
    accessibleName: secret ? undefined : uncut(element.name, WEB_LLM_EVIDENCE_BOUNDS.text),
    visibleText: secret || CONTENT_TAGS.has(element.tag) ? undefined : uncut(element.text, WEB_LLM_EVIDENCE_BOUNDS.text),
    selector,
    inputType: element.inputType,
    context: Object.keys(context).length > 0 ? context : undefined
  });
}

/** A packet string the bound did not reach, which is the only kind that is the element's whole value. */
function uncut(value: string | undefined, bound: number): string | undefined {
  return value !== undefined && value.length < bound ? value : undefined;
}
