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
  if (outputId === "web.dom.wait_for_selector") return compact({ selector, ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.wait_for_text") return compact({ text: stringValue(payload.inputValue) ?? stringValue(payload.title) });
  if (outputId === "web.dom.extract") return compact({ selector, ...(hasTarget ? target : {}) });
  if (outputId === "web.dom.capture_snapshot") return {};
  return {};
}
