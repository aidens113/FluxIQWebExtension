import type { ActionTarget } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionVisualTarget } from "../../actions/types";
import { WEB_AUTOMATION_STATE_NAMESPACE } from "../state";
import { compactJsonObject } from "./compact-json-object";
import { elementStateId, stableAttribute, stableElementId } from "./element";
import { stateBounds } from "./geometry";
import type { WebAutomationElementStateInput } from "./types";
import { safeLayerId, WEB_AUTOMATION_SCREEN_FRAME_ID } from "./visual-frame";

// One recorded element, described as something an action can aim at. Two
// shapes, because two consumers ask different questions: Core's matcher wants
// the element's identity and text (`ActionTarget`), and the panel wants where
// it is on screen and which layer to highlight (`WebAutomationActionVisualTarget`).

export function webAutomationActionTargetFromElement(element: WebAutomationElementStateInput): ActionTarget {
  return compactJsonObject({
    type: element.role ?? element.inputType ?? element.tagName,
    id: stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name"),
    label: element.name ?? element.visibleText ?? element.text ?? element.value,
    selector: element.selector,
    bounds: element.bounds,
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText: element.visibleText,
      role: element.role,
      href: element.href,
      inputType: element.inputType,
      documentBounds: stateBounds(element.documentBounds),
      isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
      hasClickHandler: element.hasClickHandler,
      attributes: element.attributes as JsonObject | undefined
    })
  }) as ActionTarget;
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
