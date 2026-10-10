// Whether a repair target the model proposes is one it actually saw, and one
// the failed action could work on -- and, once it is, what that target means
// in this domain's own terms.
//
// The model never names a selector. It names opaque handles, one per
// repairable parameter the domain declared, and a handle only means anything
// against the packet the model was shown: `t3` is a name this domain
// minted for the third element it described, and is a key in a map nobody else
// holds. A handle that was invented, or that was trimmed out of the packet, or
// that names a control the failed verb cannot use, resolves to nothing at all.
// There is no path by which a string the model chose addresses the page.
//
// Being shown a control the verb can use is not the same as it being the
// control the failed action acted on, and until 2026-09-17 nothing asked the
// second question: every refusal task in that day's live repair campaign came
// back with a proposed target override on a page whose honest answer was that
// there is nothing to repair. `./equivalence.ts` is that question, and
// what the failed node addressed -- the recording, or the repair that
// superseded it -- is what Core now passes for it to be answered against.
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
//
// An accepted repair also says what it names, as a person would recognise it:
// the element's name exactly as the packet printed it, and one plain word for
// what it is. Core carries that only to its permission gate, so a repair that
// would lastingly act can ask "may it press Add to queue?" rather than ask about
// a control nobody can name. The gate withholds a name the model was never
// shown, so this adds nothing to what leaves the domain.

import type { WebAutomationElementFingerprint } from "../../../actions/types";
import { webElementIdentityShortfall } from "../../../element-fingerprint";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import { type WebLlmEvidenceElement } from "../elements";
import { present } from "../present";
import {
  elementFillsRepairableParameter,
  webFailedActionDefinitionId,
  webRepairableParameterFor,
  webRepairableParameters,
  WEB_REPAIRABLE_ELEMENT_PARAMETER
} from "../repairable-parameters";
import type { WebLlmPageEvidence } from "../sanitize";
import { webRepairEquivalenceRefusal } from "./equivalence";
import { webPacketElementFingerprint } from "./packet-fingerprint";
import type {
  AutomationStudioRuntimeTargetOverrideEvidenceValidation,
  AutomationStudioRuntimeTargetOverrideFailedAction,
  AutomationStudioRuntimeTargetOverrideTarget
} from "fluxiq/automation-studio";

/**
 * Match proposed handles and action semantics against the sanitized
 * packet already supplied to the LLM, and resolve them into this domain's own
 * target.
 *
 * `matched` is never returned, and that is deliberate rather than an
 * oversight. Core writes the target it is handed straight into the node's
 * parameters, so a target that stayed as the model wrote it would reach
 * execution as a bare handle map, which addresses nothing. Every accepted
 * repair therefore comes back as `resolved`, carrying the fingerprint of the
 * element the model's own handle named.
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

  const resolved = new Map<string, WebLlmEvidenceElement>();
  for (const [name, handle] of Object.entries(handles)) {
    const parameter = webRepairableParameterFor(definitionId, name)!;
    // Written the old way, `target.N`, it is still the `tN` the packet printed.
    const wanted = canonicalWebLlmTargetHandle(handle) ?? handle;
    const named = evidence.elements.filter((element) => element.target === wanted);
    // Only a packet altered after it was issued names one handle twice.
    if (named.length > 1) return { status: "ambiguous", reason: "handle_ambiguous" };
    // The handle has to stand on its own. Nothing is substituted for it: the
    // single compatible element used to be, and that made the domain the
    // author of a repair the model never proposed -- the search box for a
    // revenue field, the only link on a guard's page for a control that was
    // never there (live repair campaign, 2026-09-17). `no_compatible_element`
    // still separates "nothing here could do this at all" from a bad handle.
    const compatible = evidence.elements.some((element) => elementFillsRepairableParameter(element, parameter.role));
    if (named.length === 0) return { status: "absent", reason: compatible ? "handle_not_issued" : "no_compatible_element" };
    if (!elementFillsRepairableParameter(named[0]!, parameter.role)) return { status: "absent", reason: compatible ? "handle_incompatible" : "no_compatible_element" };
    // Shown it, and the verb can use it. Whether it is the control the failed
    // action acted on is a different question, and the one that was missing.
    const equivalence = webRepairEquivalenceRefusal({ elements: evidence.elements, named: named[0]!, role: parameter.role, recordedTarget: failedAction.recordedTarget });
    if (equivalence) return { status: equivalence === "target_indistinguishable" ? "ambiguous" : "absent", reason: equivalence };
    resolved.set(name, named[0]!);
  }
  const element = resolved.get(WEB_REPAIRABLE_ELEMENT_PARAMETER);
  // Core writes a resolved target into the node's `target`, and a DOM output
  // reads one flat element fingerprint from there. A resolution of anything
  // else would be saved where nothing reads it, so it is refused rather than
  // written. No declared action produces one; this keeps it that way if one is
  // ever declared before something reads it -- and such an action has nothing
  // this contract can re-point, which is what the refusal says.
  if (resolved.size !== 1 || !element) return { status: "absent", reason: "action_not_repairable" };
  const fingerprint = webPacketElementFingerprint(element, { selector: selectors?.get(element.target) });
  // The save-time guard (t425): a repair is saved onto the Flow by
  // `edit_action_target`, so a control it could find by one attribute alone is
  // refused here, as one that cannot be told apart. Core's closed vocabulary has
  // no closer word, and the model is told nothing about which signals it lacked.
  if (webElementIdentityShortfall(fingerprint)) return { status: "ambiguous", reason: "target_indistinguishable" };
  return present<Extract<AutomationStudioRuntimeTargetOverrideEvidenceValidation, { status: "resolved" }>>({
    status: "resolved",
    target: resolvedTarget(element, fingerprint),
    control: repairedControl(element)
  });
}

/**
 * What the repaired target names, in the words the permission request carries:
 * the name the packet printed for it, or its visible text where it has no
 * name, and one plain word for what it is. Absent when the element carries
 * neither, and the request then says "a control it cannot name here".
 */
function repairedControl(element: WebLlmEvidenceElement): { name: string; kind: string } | undefined {
  const name = element.name ?? element.text;
  return name && name.trim() ? { name, kind: plainControlKind(element) } : undefined;
}

/** One plain word for what the element is, as the person being asked would call it: the same words the exploration's press uses. */
function plainControlKind(element: WebLlmEvidenceElement): string {
  if (element.role && /^[a-z]+$/u.test(element.role)) return element.role;
  if (element.tag === "a") return "link";
  if ((element.tag === "input" && element.inputType === "checkbox") || element.role === "checkbox") return "checkbox";
  return /^[a-z]+$/u.test(element.tag) ? element.tag : "control";
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
 *
 * Its signals are the full fingerprint the builder makes of the packet element
 * (`./packet-fingerprint.ts`): the tag, role and input type, the words, the
 * label, the authored id, `name`, class tokens and test id, and the attributes
 * that describe the control. Not where it sat: the record the recording named
 * stays the node's (`output-nodes/targets/targets.ts` `withRecordedRecord`), so
 * no `context` is written, and the list position rides in `metadata` as it
 * always has.
 */
type WebResolvedRepairTarget = {
  /** The handle used, which is always the one the model named. */
  handles: Record<string, string>;
  /**
   * That the handle used is the model's own. The domain no longer has another
   * answer: it used to substitute the single compatible element for a handle it
   * never issued and record that as `inferred`, which made the domain the
   * author of a repair nobody proposed. The field stays, and stays required,
   * because a stored target is told from Core's own re-derivation of a node by
   * exactly this key (`output-nodes/targets.ts`).
   */
  handleResolution: "named";
  tagName: string;
  role?: string;
  implicitRole?: string;
  accessibleName?: string;
  label?: string;
  visibleText?: string;
  id?: string;
  name?: string;
  classNames?: string[];
  testId?: string;
  inputType?: string;
  href?: string;
  attributes?: Record<string, string>;
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

/**
 * Core refuses a resolved target whose serialization is longer than this
 * (`AUTOMATION_STUDIO_RUNTIME_TARGET_MAX_SERIALIZED_LENGTH`, 4,000), less room
 * for the handle map. A control with long words then keeps its words and drops
 * its describing attributes and class list first, which every other signal
 * outweighs (Core weighs class names at 5 against 24 for its words).
 */
const MAX_TARGET_LENGTH = 3_800;

function resolvedTarget(resolved: WebLlmEvidenceElement, fingerprint: WebAutomationElementFingerprint): AutomationStudioRuntimeTargetOverrideTarget {
  const metadata = present<WebRepairElementMetadata>({
    browserFrameId: resolved.frameId,
    inputType: resolved.inputType,
    controlType: resolved.controlType,
    formId: resolved.form,
    listIndex: resolved.item?.index,
    listTotal: resolved.item?.total
  });
  const target = present<WebResolvedRepairTarget>({
    handles: { [WEB_REPAIRABLE_ELEMENT_PARAMETER]: resolved.target },
    handleResolution: "named",
    tagName: resolved.tag,
    role: fingerprint.role,
    implicitRole: fingerprint.implicitRole,
    accessibleName: fingerprint.accessibleName,
    label: fingerprint.label,
    visibleText: fingerprint.visibleText,
    id: fingerprint.id,
    name: fingerprint.name,
    classNames: fingerprint.classNames,
    testId: fingerprint.testId,
    inputType: fingerprint.inputType,
    href: fingerprint.href,
    attributes: fingerprint.attributes,
    // The hint, and only where the caller still holds the binding that issued
    // the handle. The packet has not carried a selector since `.v2`, so a repair
    // resolved from a packet alone is fingerprint-only -- which is weaker, not
    // wrong: the name, the role and the tag are what Core scores highest.
    selector: fingerprint.selector,
    metadata: Object.keys(metadata).length ? metadata : undefined
  });
  if (JSON.stringify(target).length <= MAX_TARGET_LENGTH) return target;
  const { attributes: _attributes, classNames: _classNames, ...bounded } = target;
  return bounded;
}
