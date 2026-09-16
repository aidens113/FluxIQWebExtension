// Whether a repair target the model proposes is one it actually saw, and one
// the failed action could work on -- and, once it is, what that target means
// in this domain's own terms.
//
// The model never names a selector. It names opaque handles, one per
// repairable parameter the domain declared, and a handle only means anything
// against the packet the model was shown: `target.3` is a name this domain
// minted for the third element it described, and is a key in a map nobody else
// holds. A handle that was invented, or that was trimmed out of the packet, or
// that names a control the failed verb cannot use, resolves to the single
// compatible element or to nothing at all. There is no path by which a string
// the model chose addresses the page.
//
// What comes back is the domain's own resolution, which Core carries without
// reading: an element fingerprint. It is fingerprint-first on purpose. The
// name, the role and the tag are the identity, and the selector rides along as
// one signal among many -- Core's own matcher weights it 14 against 28 for a
// test id and 24 for an accessible name -- so a page that renumbers its DOM
// does not invalidate the repair.

import { type WebLlmEvidenceElement } from "./elements";
import { present } from "./present";
import {
  elementFillsRepairableParameter,
  webRepairableParameterFor,
  webRepairableParameters,
  WEB_REPAIRABLE_ELEMENT_PARAMETER
} from "./repairable-parameters";
import type { WebLlmPageEvidence } from "./sanitize";
import type {
  AutomationStudioRuntimeTargetOverrideEvidenceValidation,
  AutomationStudioRuntimeTargetOverrideFailedAction,
  AutomationStudioRuntimeTargetOverrideTarget
} from "fluxiq/automation-studio";

/**
 * Match proposed handles and action semantics against the bounded sanitized
 * packet already supplied to the LLM, and resolve them into this domain's own
 * target.
 *
 * `matched` is never returned, and that is deliberate rather than an
 * oversight. Core writes the target it is handed straight into the node's
 * parameters, so a target that stayed as the model wrote it would reach
 * execution as a bare handle map, which addresses nothing. Every accepted
 * repair therefore comes back as `resolved`, and whether the model's own
 * handles were the ones used is recorded inside the resolution as
 * `handleResolution` instead of being thrown away.
 */
export function validateWebRuntimeTargetOverrideEvidence(
  evidence: WebLlmPageEvidence,
  target: AutomationStudioRuntimeTargetOverrideTarget,
  failedAction: AutomationStudioRuntimeTargetOverrideFailedAction,
  selectors?: ReadonlyMap<string, string>
): AutomationStudioRuntimeTargetOverrideEvidenceValidation {
  const declared = webRepairableParameters(failedAction.definitionId);
  if (declared.length === 0) return { status: "absent" };
  const handles = proposedHandles(target);
  if (!handles) return { status: "absent" };
  // A parameter this action never offered is an invented one. Refusing the
  // whole repair rather than ignoring the extra key is the point: it means the
  // model was working from something other than what it was shown.
  if (Object.keys(handles).some((name) => !webRepairableParameterFor(failedAction.definitionId, name))) return { status: "absent" };
  if (declared.some((parameter) => parameter.required && handles[parameter.name] === undefined)) return { status: "absent" };

  const resolved = new Map<string, { element: WebLlmEvidenceElement; named: boolean }>();
  for (const [name, handle] of Object.entries(handles)) {
    const parameter = webRepairableParameterFor(failedAction.definitionId, name)!;
    const candidates = evidence.elements.filter((element) => elementFillsRepairableParameter(element, parameter.role));
    const named = evidence.elements.filter((element) => element.target === handle);
    if (named.length > 1) return { status: "ambiguous" };
    if (named.length === 1 && elementFillsRepairableParameter(named[0]!, parameter.role)) {
      resolved.set(name, { element: named[0]!, named: true });
      continue;
    }
    if (candidates.length === 0) return { status: "absent" };
    if (candidates.length > 1) return { status: "ambiguous" };
    resolved.set(name, { element: candidates[0]!, named: false });
  }
  return { status: "resolved", target: resolvedTarget(handles, resolved, selectors) };
}

/**
 * The handles the model proposed, or `undefined` when the target is not a
 * handle map at all. Core has already bounded this; the check is repeated
 * because the domain must not depend on the order the two run in.
 */
function proposedHandles(target: AutomationStudioRuntimeTargetOverrideTarget): Record<string, string> | undefined {
  const handles: unknown = target?.handles;
  if (!handles || typeof handles !== "object" || Array.isArray(handles)) return undefined;
  const entries = Object.entries(handles as Record<string, unknown>);
  if (entries.length === 0) return undefined;
  if (!entries.every(([name, handle]) => typeof handle === "string" && handle.length > 0 && name.length > 0)) return undefined;
  return Object.fromEntries(entries as Array<[string, string]>);
}

/**
 * The resolution Core carries and never reads.
 *
 * A one-parameter repair -- every DOM output today -- writes its fingerprint
 * flat, because that is the shape every other element target in this system
 * already has, and Core's element-target normalizer reads it with no new
 * branch. A repair with more than one parameter, which is what a list
 * extraction will be, writes `targets` instead: one fingerprint per parameter,
 * keyed by the same names the handles were. Exactly one of the two is filled,
 * which is why both are named on every build rather than conditionally added.
 */
type WebResolvedRepairTarget = {
  /** The handles actually used, which are the domain's own where it overrode the model. */
  handles: Record<string, string>;
  /** Whether the handles used are the ones the model named, or ones the domain inferred. */
  handleResolution: "named" | "inferred";
  /** The single element's fingerprint, flat. Present only for a one-parameter repair. */
  tagName?: string;
  role?: string;
  accessibleName?: string;
  visibleText?: string;
  selector?: string;
  metadata?: WebRepairElementMetadata;
  /** One fingerprint per parameter. Present only for a repair with more than one. */
  targets?: Record<string, WebRepairElementFingerprint>;
  /** What the model asked for, kept only where the domain did not use it. */
  proposedHandles?: Record<string, string>;
};

/**
 * One packet element as an element-target fingerprint. Identity first: the
 * accessible name, the visible text, the role and the tag are what survives a
 * page rewriting its markup, and Core's own matcher weights them accordingly.
 * The selector is one more signal rather than the identity.
 */
type WebRepairElementFingerprint = {
  tagName: string;
  role?: string;
  accessibleName?: string;
  visibleText?: string;
  /** A hint, not the identity, and absent where the binding is gone. Only valid inside `metadata.browserFrameId`'s frame. */
  selector?: string;
  metadata?: WebRepairElementMetadata;
};

/** What the page said about the element that is not a fingerprint signal Core scores. */
type WebRepairElementMetadata = {
  browserFrameId?: number;
  inputType?: string;
  controlType?: string;
  formId?: string;
  listIndex?: number;
  listTotal?: number;
};

function resolvedTarget(
  handles: Record<string, string>,
  resolved: Map<string, { element: WebLlmEvidenceElement; named: boolean }>,
  selectors: ReadonlyMap<string, string> | undefined
): AutomationStudioRuntimeTargetOverrideTarget {
  const handleResolution = [...resolved.values()].every((entry) => entry.named) ? "named" : "inferred";
  const single = resolved.size === 1 ? resolved.get(WEB_REPAIRABLE_ELEMENT_PARAMETER)?.element : undefined;
  const flat = single ? elementFingerprint(single, selectors) : undefined;
  return present<WebResolvedRepairTarget>({
    handles: Object.fromEntries([...resolved].map(([name, entry]) => [name, entry.element.target])),
    handleResolution,
    tagName: flat?.tagName,
    role: flat?.role,
    accessibleName: flat?.accessibleName,
    visibleText: flat?.visibleText,
    selector: flat?.selector,
    metadata: flat?.metadata,
    targets: flat ? undefined : Object.fromEntries([...resolved].map(([name, entry]) => [name, elementFingerprint(entry.element, selectors)])),
    proposedHandles: handleResolution === "inferred" ? handles : undefined
  });
}

function elementFingerprint(element: WebLlmEvidenceElement, selectors: ReadonlyMap<string, string> | undefined): WebRepairElementFingerprint {
  const metadata = present<WebRepairElementMetadata>({
    browserFrameId: element.frameId,
    inputType: element.inputType,
    controlType: element.controlType,
    formId: element.form,
    listIndex: element.item?.index,
    listTotal: element.item?.total
  });
  return present<WebRepairElementFingerprint>({
    tagName: element.tag,
    role: element.role,
    accessibleName: element.name,
    visibleText: element.text,
    // The hint, and only where the caller still holds the binding that issued
    // the handle. The packet has not carried a selector since `.v2`, so a repair
    // resolved from a packet alone is fingerprint-only -- which is weaker, not
    // wrong: the name, the role and the tag are what Core scores highest.
    selector: selectors?.get(element.target),
    metadata: Object.keys(metadata).length ? metadata : undefined
  });
}
