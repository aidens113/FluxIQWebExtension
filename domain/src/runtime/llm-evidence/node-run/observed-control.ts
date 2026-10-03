// The control a node call acts on, named as the person being asked about it
// would name it: the words the model was shown, and one plain word for its kind.
//
// Its own file because it reads two sources. The look the call takes before it
// acts names the control when it describes it. A look describes forty controls,
// so a control the model was shown can lie past the end of that look -- live, a
// notice that appeared above the results sidebar pushed the "Voltbay" brand
// filter out of it (`run-muohbi3e-e5847e5a`) -- and then the control is named as
// the packet its handle came from named it: the identity the resolution carries
// (`../plan-resolution/element-identity.ts`).
//
// **The words are the ones the control's view line prints** (`webLlmElementWords`,
// `../page-view/element/words.ts`), not a reading of its own. Until t174-w82 this
// read `name ?? text`, and a field the page labels only by the text beside it
// -- crossborder's quantity field, printed `t965 field "Quantity" ="3"` -- has
// neither: its words are its `label`. The type's result then named no control,
// the draft's step said nothing, and two judges refuted the Flow over "a bare
// input" (`run-murwd8le-79e735a8`, steps 0023-0024, 0046, 0071).
//
// **Such a field's label also goes into the node's element identity**
// (`webLabelledIdentity`), so the node the Flow keeps names it. As `label`, the
// fingerprint field the page scores a label by, and never as `accessibleName`:
// the page computes a candidate's accessible name from the label the page
// *associates* with it (`apps/extension/src/content/identity/accessible-name.ts`)
// and its `label` from the nearby text as well (`.../identity/label.ts`, the
// same reader the capture's `label` came from). Recorded as `accessibleName`,
// "Quantity" would be scored against a candidate with no accessible name --
// Core counts a missing text signal against the match
// (`fingerprinting/element-fingerprint.ts`, "candidate is missing text") -- and
// the page's veto would refuse the very field the step was made on.

import type { JsonObject } from "fluxiq/core";
import { isSensitiveFieldSignature } from "../../../sensitivity";
import type { WebLlmEvidenceElement } from "../elements";
import { webLlmElementWords } from "../page-view";
import type { WebLlmPageEvidence } from "../sanitize";
import { isJsonRecord } from "../untrusted-json";
import { isWithheldText } from "../withheld";

/**
 * What `handle` names, from the look before acting or else from the resolved
 * parameters' `element` identity; `step` with no name when neither says.
 */
export function webObservedControl(evidence: WebLlmPageEvidence, handle: string | undefined, resolved: JsonObject): { name: string | undefined; kind: string } {
  if (handle === undefined) return { name: undefined, kind: "step" };
  const element = evidence.elements.find((candidate) => candidate.target === handle);
  if (element) return { name: webLlmElementWords(element), kind: controlKind(element.role, element.tag) };
  const identity = isJsonRecord(resolved.element) ? resolved.element : undefined;
  if (identity === undefined || typeof identity.tagName !== "string") return { name: undefined, kind: "step" };
  const name = [identity.accessibleName, identity.visibleText, identity.label].find((words): words is string => typeof words === "string");
  return { name, kind: controlKind(typeof identity.role === "string" ? identity.role : undefined, identity.tagName) };
}

/**
 * The resolved parameters, with the label of the control `handle` names written
 * into their `element` identity when that identity names it no other way -- no
 * accessible name, no visible text, no label -- and the look before acting shows
 * the control a whole label of its own. Anything else is returned as it was:
 * a control the page already names keeps the identity it had, and a control
 * whose signature says it holds a secret is never named, as
 * `../plan-resolution/element-identity.ts` never names it.
 */
export function webLabelledIdentity(resolved: JsonObject, evidence: WebLlmPageEvidence | undefined, handle: string | undefined): JsonObject {
  const identity = isJsonRecord(resolved.element) ? resolved.element : undefined;
  if (identity === undefined || evidence === undefined || handle === undefined) return resolved;
  if (["accessibleName", "visibleText", "label"].some((key) => identity[key] !== undefined)) return resolved;
  const element = evidence.elements.find((candidate) => candidate.target === handle);
  const label = element === undefined ? undefined : wholeLabel(element);
  return label === undefined ? resolved : { ...resolved, element: { ...identity, label } };
}

/** The packet's label for a control, when it is the control's own: not withheld, and not on a control that holds a secret. */
function wholeLabel(element: WebLlmEvidenceElement): string | undefined {
  if (isSensitiveFieldSignature({ inputType: element.inputType, controlType: element.controlType })) return undefined;
  return element.label === undefined || isWithheldText(element.label) || element.label.trim() === "" ? undefined : element.label;
}

/** One plain word for what a control is. */
function controlKind(role: string | undefined, tag: string): string {
  if (role && /^[a-z]+$/u.test(role)) return role;
  if (tag === "a") return "link";
  return /^[a-z]+$/u.test(tag) ? tag : "control";
}
