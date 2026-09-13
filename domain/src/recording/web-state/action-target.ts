import type { ActionTarget } from "fluxiq/automation-studio";
import type { WebAutomationActionVisualTarget } from "../../actions/types";
import { isSensitiveElementDescriptor } from "../../sensitivity";
import { WEB_AUTOMATION_STATE_NAMESPACE } from "../state";
import { compactJsonObject } from "./compact-json-object";
import { elementStateId, stableAttribute, stableElementId } from "./element";
import { stateBounds } from "./geometry";
import type { WebAutomationElementIdentitySignal, WebAutomationElementStateInput } from "./types";
import { safeLayerId, WEB_AUTOMATION_SCREEN_FRAME_ID } from "./visual-frame";

// One recorded element, described as something an action can aim at. Two
// shapes, because two consumers ask different questions: Core's matcher wants
// the element's identity and text (`ActionTarget`), and the panel wants where
// it is on screen and which layer to highlight (`WebAutomationActionVisualTarget`).

/**
 * Every key of a contract type, written out, so a field cannot leave a
 * projection in silence.
 *
 * `-?` is deliberately not used: it would strip `undefined` from the value as
 * well as the modifier, and the point is that an optional field must be
 * *mentioned* while still being allowed to be absent. Mapping over
 * `keyof Required<T>` removes the modifier and leaves `T[K]` alone, so a
 * deleted field fails to compile, a renamed field fails to compile, a required
 * field may not be written `undefined`, and an optional one may.
 *
 * The same three lines are in `output-nodes/targets.ts`, and both are
 * `present<T>()` (`runtime/llm-evidence/present.ts`) expressed as a type
 * instead of imported as a function: that helper is not on its directory's
 * barrel, and reaching past a barrel into another directory's files is a
 * `structure-audit` failure. Promoting it to a barrel-exported home would
 * replace both.
 */
type ContractFields<T> = { [K in keyof Required<T>]: T[K] };

/**
 * Descriptor fields the target carries somewhere other than `metadata`.
 *
 * - `selector` and `bounds` are `ActionTarget`'s own top-level fields, and
 *   Core's `normalizeFingerprint` (`model/action-element-target.ts`) reads them
 *   there before it looks in the metadata.
 * - `name`, `text` and `value` feed `label`, the display string a person would
 *   call this control by. `visibleText` feeds it too and is *also* in the
 *   metadata, because Core reads `metadata.visibleText` as the fingerprint
 *   signal of that name.
 *
 * Nothing else may be left out. The metadata below is the descriptor minus
 * exactly this list, and every key of it must be written.
 */
type PromotedTargetField = "selector" | "bounds" | "name" | "text" | "value";

/** What the recording envelope's target carries under `metadata`. */
export type WebAutomationActionTargetMetadata = Omit<WebAutomationElementStateInput, PromotedTargetField>;

/** A type that is only satisfiable when the argument is `never`. */
type Nothing<T extends never> = T;

/**
 * Compile-time proof that every identity signal reaches the envelope's target:
 * promote one out of the metadata and this alias stops compiling.
 *
 * A type rather than a test, for the reason the extension's
 * `WiredIdentitySignals` is one. The tests beside this file prove the values
 * arrive; this proves the *contract* cannot quietly stop asking for them, which
 * is the half a green suite has now missed three times in three projections of
 * the same descriptor.
 */
export type RecordedIdentitySignals = Nothing<Exclude<WebAutomationElementIdentitySignal, keyof WebAutomationActionTargetMetadata>>;

/**
 * The recorded element as the recording envelope's `target`.
 *
 * This is not a display shape. Core reads it: `normalizeAutomationStudioElementTarget`
 * builds an `AutomationStudioElementTarget` out of it and its
 * `normalizeFingerprint` reads `metadata.testId`, `metadata.accessibleName`,
 * `metadata.label`, `metadata.role`, `metadata.visibleText`, `metadata.id`,
 * `metadata.selector`, `metadata.xpath`, `metadata.classNames` and
 * `metadata.attributes` by those names. So a signal missing from the metadata
 * is a signal missing from the fingerprint Core stores against the timeline
 * entry -- which is what the hand-written literal this replaces was doing to
 * all five identity signals.
 *
 * **What a sensitive control does not carry.** The rule is
 * `isSensitiveElementDescriptor` from `domain/src/sensitivity/`, asked here and
 * not restated, and the line it draws is the line `elementStatePayload` next
 * door and the wire projection upstream both draw: **a control's contents never
 * cross; the author's description of it does.** So `visibleText`, `text`,
 * `value` and `accessibleName` are withheld, and `label`, `context`,
 * `attributes`, `testId` and the structural signals are kept. Without it the
 * `label` chain below ends at `element.value`, so a nameless password field
 * with no visible text put what was typed into it on the envelope of a
 * persisted, replayable recording.
 *
 * This is a second look, not the first: the extension redacts at capture and
 * again at `elementTarget()`. It is repeated for the reason `state-values.ts`
 * repeats it -- this is the far side of a wire from those guards, and what
 * crosses is persisted.
 */
export function webAutomationActionTargetFromElement(element: WebAutomationElementStateInput): ActionTarget {
  const secret = isSensitiveElementDescriptor(element);
  const visibleText = secret ? undefined : element.visibleText;
  const text = secret ? undefined : element.text;
  const value = secret ? undefined : element.value;
  return compactJsonObject({
    type: element.role ?? element.inputType ?? element.tagName,
    id: stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name"),
    label: element.name ?? visibleText ?? text ?? value,
    selector: element.selector,
    bounds: element.bounds,
    // Neither is this producer's to fill: a relative position belongs to a
    // click that carried one, and both `visualTarget` and `elementTarget` are
    // written by the callers that have them
    // (`client/gateway-mapping.ts`, and Core's own dispatch preparation).
    relativePosition: undefined,
    visualTarget: undefined,
    elementTarget: undefined,
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText,
      role: element.role,
      href: element.href,
      inputType: element.inputType,
      documentBounds: stateBounds(element.documentBounds),
      isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
      hasClickHandler: element.hasClickHandler,
      attributes: element.attributes,
      testId: element.testId,
      accessibleName: secret ? undefined : element.accessibleName,
      label: element.label,
      implicitRole: element.implicitRole,
      context: element.context
    } satisfies ContractFields<WebAutomationActionTargetMetadata>)
  } satisfies ContractFields<ActionTarget>) as ActionTarget;
}

// `stateId` is the key the element was filed under by the selection it came
// from. Pass it whenever the caller has one: rebuilt from the element alone
// the key loses the positional suffix that separates repeated controls, and
// the visual target would then point at a sibling's state path. Without a
// selection -- a single recorded element arriving from the gateway -- the base
// key is the best available answer and is what this has always produced.
export function webAutomationActionVisualTargetFromElement(
  element: WebAutomationElementStateInput,
  input: { confidence?: number; layerIndex?: number; stateId?: string } = {}
): WebAutomationActionVisualTarget | undefined {
  const stateId = input.stateId ?? elementStateId(element);
  const statePath = `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${stateId}`;
  const bounds = stateBounds(element.bounds);
  const documentBounds = stateBounds(element.documentBounds ?? element.bounds);
  const anchorBounds = documentBounds ?? bounds;
  const safeId = safeLayerId(stateId, input.layerIndex ?? 1);
  return compactJsonObject({
    namespace: WEB_AUTOMATION_STATE_NAMESPACE,
    statePath,
    selector: element.selector,
    frameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
    layerId: `element.${safeId}`,
    documentLayerId: `document.element.${safeId}`,
    bounds,
    documentBounds,
    anchor: anchorBounds ? { type: "bounds", bounds: anchorBounds } : undefined,
    confidence: input.confidence ?? (stableElementId(element) ? 0.98 : 0.88),
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText: element.visibleText,
      role: element.role,
      name: element.name,
      href: element.href,
      inputType: element.inputType,
      stableId: stableElementId(element),
      isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(bounds)
    })
  }) as WebAutomationActionVisualTarget;
}
