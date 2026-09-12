import type { JsonObject } from "fluxiq/core";
import { compact, elementFingerprint, numberValue, objectValue, stringValue } from "./targets";

/**
 * Shared output-node payload normalization. Keep the full fingerprint
 * alongside executable selectors so replay can fall back when selectors drift.
 */
export function webAutomationOutputPayload(outputId: string, payload: JsonObject): JsonObject {
  const element = elementFingerprint(payload.element);
  const selector = stringValue(element?.selector);
  const visualTarget = objectValue(payload.visualTarget);
  const target = compact({ ...(element ? { element } : {}), ...(visualTarget ? { visualTarget } : {}) });
  const hasTarget = Object.keys(target).length > 0;
  if (outputId === "web.browser.navigate") return compact({ url: stringValue(payload.url) });
  if (outputId === "web.dom.click" || outputId === "web.dom.clear") return compact({ selector, ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.type") return compact({ selector, text: stringValue(payload.inputValue) ?? "", ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.select") return compact({ selector, value: stringValue(payload.inputValue) ?? "", ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.keypress") return compact({ selector, key: stringValue(payload.key) ?? "", ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.scroll") {
    const scroll = objectValue(payload.scroll);
    return compact({ x: numberValue(scroll?.x), y: numberValue(scroll?.y) });
  }
  if (outputId === "web.dom.check") {
    const checked = recordedCheckedState(payload);
    return compact({ selector, checked, ...(hasTarget ? target : {}) });
  }
  if (outputId === "web.dom.wait_for_selector") return compact({ selector, ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.wait_for_text") return compact({ text: stringValue(payload.inputValue) ?? stringValue(payload.title) });
  if (outputId === "web.dom.extract") return compact({ selector, ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.capture_snapshot") return {};
  // The remaining Week 1 outputs — assert, extract_list, upload, dialog, tab
  // and download — are dispatch-only: no recorded user event maps to one, so
  // there is no recorded payload to normalize into their parameters.
  return {};
}

/**
 * The state a recorded toggle left the control in, for `web.dom.check`.
 *
 * A radio's `change` can only mean "now selected", so it needs no recorded
 * state. A checkbox's toggles either way, and the value the recorder reports
 * is the control's `value` attribute ("on" by default), not its checked state,
 * so the state has to come from the descriptor's own `checked` field or from a
 * captured `aria-checked`. When neither is present the field is absent, and
 * `hasExecutableParameters` keeps the event as evidence rather than replaying
 * a guess that could invert the user's action.
 */
function recordedCheckedState(payload: JsonObject): boolean | undefined {
  const element = objectValue(payload.element);
  if (!element) return undefined;
  if (typeof element.checked === "boolean") return element.checked;
  const ariaChecked = stringValue(objectValue(element.attributes)?.["aria-checked"]);
  if (ariaChecked === "true") return true;
  if (ariaChecked === "false") return false;
  return isRadioElement(element) ? true : undefined;
}

function isRadioElement(element: JsonObject): boolean {
  return stringValue(element.inputType)?.toLowerCase() === "radio" || stringValue(element.role)?.toLowerCase() === "radio";
}
