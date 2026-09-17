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
//
// An action with nothing to re-point is refused in Core's own word for it,
// `action_not_repairable`, so the model and the run record are told plainly.
// A list extraction is one: its repair used to be accepted, saved where the
// extract node never reads, and "applied" to no effect.
//
// Every other refusal names its case too, from Core's closed vocabulary, so a
// refused repair says whether the model invented a parameter, named a handle it
// was never shown, or pointed at something the verb cannot use -- which a bare
// `absent` said in one word for all three (`run-mu4rpka7-845d919a`).
//
// Which action failed is read from the output it dispatches wherever Core
// names one (`webFailedActionDefinitionId`), because a recorded action is
// Core's generic `builtin.policy.action` whatever its verb.

import { type WebLlmEvidenceElement } from "./elements";
import { present } from "./present";
import {
  elementFillsRepairableParameter,
  webFailedActionDefinitionId,
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
  const definitionId = webFailedActionDefinitionId(failedAction);
  const declared = definitionId === undefined ? [] : webRepairableParameters(definitionId);
  // Judged before the target is read: whatever the model named, this action
  // offers nothing to put it in.
  if (definitionId === undefined || declared.length === 0) return { status: "absent", reason: "action_not_repairable" };
  const handles = proposedHandles(target);
  if (!handles) return { status: "absent", reason: "target_malformed" };
  // A parameter this action never offered is an invented one. Refusing the
  // whole repair rather than ignoring the extra key is the point: it means the
  // model was working from something other than what it was shown.
  if (Object.keys(handles).some((name) => !webRepairableParameterFor(definitionId, name))) return { status: "absent", reason: "parameter_not_offered" };
  if (declared.some((parameter) => parameter.required && handles[parameter.name] === undefined)) return { status: "absent", reason: "parameter_missing" };

  const resolved = new Map<string, { element: WebLlmEvidenceElement; named: boolean }>();
  for (const [name, handle] of Object.entries(handles)) {
    const parameter = webRepairableParameterFor(definitionId, name)!;
    const candidates = evidence.elements.filter((element) => elementFillsRepairableParameter(element, parameter.role));
    const named = evidence.elements.filter((element) => element.target === handle);
    // Only a packet altered after it was issued names one handle twice.
    if (named.length > 1) return { status: "ambiguous", reason: "handle_ambiguous" };
    if (named.length === 1 && elementFillsRepairableParameter(named[0]!, parameter.role)) {
      resolved.set(name, { element: named[0]!, named: true });
      continue;
    }
    // The handle did not stand: it was never issued, or it names something
    // this verb cannot use. The one compatible element stands in for it; with
    // none there is nothing to repair to, and with several the domain will not
    // choose -- and says which way the handle failed.
    if (candidates.length === 0) return { status: "absent", reason: "no_compatible_element" };
    if (candidates.length > 1) return { status: "ambiguous", reason: named.length === 1 ? "handle_incompatible" : "handle_not_issued" };
    resolved.set(name, { element: candidates[0]!, named: false });
  }
  const element = resolved.get(WEB_REPAIRABLE_ELEMENT_PARAMETER);
  // Core writes a resolved target into the node's `target`, and a DOM output
  // reads one flat element fingerprint from there. A resolution of anything
  // else would be saved where nothing reads it, so it is refused rather than
  // written. No declared action produces one; this keeps it that way if one is
  // ever declared before something reads it -- and such an action has nothing
  // this contract can re-point, which is what the refusal says.
  if (resolved.size !== 1 || !element) return { status: "absent", reason: "action_not_repairable" };
  return { status: "resolved", target: resolvedTarget(handles, element, selectors) };
}

/**
 * The handles the model proposed, or `undefined` when the target is not a
 * handle map at all. Core has already bounded this; the check is repeated
 * because the domain must not depend on the order the two run in. An empty map
 * is a map: what is wrong with it is that it names no parameter, which the
 * required-parameter check says.
 */
function proposedHandles(target: AutomationStudioRuntimeTargetOverrideTarget): Record<string, string> | undefined {
  const handles: unknown = target?.handles;
  if (!handles || typeof handles !== "object" || Array.isArray(handles)) return undefined;
  const entries = Object.entries(handles as Record<string, unknown>);
  if (!entries.every(([name, handle]) => typeof handle === "string" && handle.length > 0 && name.length > 0)) return undefined;
  return Object.fromEntries(entries as Array<[string, string]>);
}

/**
 * The resolution Core carries and never reads.
 *
 * The fingerprint is written flat, because that is the shape every other
 * element target in this system already has: Core's element-target normalizer
 * and the DOM outputs read it with no new branch. There is no keyed form. One
 * existed for a list extraction and nothing read it.
 */
type WebResolvedRepairTarget = {
  /** The handle actually used, which is the domain's own where it overrode the model. */
  handles: Record<string, string>;
  /** Whether the handle used is the one the model named, or one the domain inferred. */
  handleResolution: "named" | "inferred";
  tagName: string;
  role?: string;
  accessibleName?: string;
  visibleText?: string;
  selector?: string;
  metadata?: WebRepairElementMetadata;
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
  resolved: { element: WebLlmEvidenceElement; named: boolean },
  selectors: ReadonlyMap<string, string> | undefined
): AutomationStudioRuntimeTargetOverrideTarget {
  const handleResolution = resolved.named ? "named" : "inferred";
  const fingerprint = elementFingerprint(resolved.element, selectors);
  return present<WebResolvedRepairTarget>({
    handles: { [WEB_REPAIRABLE_ELEMENT_PARAMETER]: resolved.element.target },
    handleResolution,
    tagName: fingerprint.tagName,
    role: fingerprint.role,
    accessibleName: fingerprint.accessibleName,
    visibleText: fingerprint.visibleText,
    selector: fingerprint.selector,
    metadata: fingerprint.metadata,
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
