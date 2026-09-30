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

import type { JsonObject } from "fluxiq/core";
import type { WebLlmPageEvidence } from "../sanitize";
import { isJsonRecord } from "../untrusted-json";

/**
 * What `handle` names, from the look before acting or else from the resolved
 * parameters' `element` identity; `step` with no name when neither says.
 */
export function webObservedControl(evidence: WebLlmPageEvidence, handle: string | undefined, resolved: JsonObject): { name: string | undefined; kind: string } {
  if (handle === undefined) return { name: undefined, kind: "step" };
  const element = evidence.elements.find((candidate) => candidate.target === handle);
  if (element) return { name: element.name ?? element.text, kind: controlKind(element.role, element.tag) };
  const identity = isJsonRecord(resolved.element) ? resolved.element : undefined;
  if (identity === undefined || typeof identity.tagName !== "string") return { name: undefined, kind: "step" };
  const name = typeof identity.accessibleName === "string" ? identity.accessibleName : typeof identity.visibleText === "string" ? identity.visibleText : undefined;
  return { name, kind: controlKind(typeof identity.role === "string" ? identity.role : undefined, identity.tagName) };
}

/** One plain word for what a control is. */
function controlKind(role: string | undefined, tag: string): string {
  if (role && /^[a-z]+$/u.test(role)) return role;
  if (tag === "a") return "link";
  return /^[a-z]+$/u.test(tag) ? tag : "control";
}
