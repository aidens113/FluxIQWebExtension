import type { JsonObject } from "fluxiq/core";

/**
 * Shared web-panel output-node payloads. Keep the full fingerprint alongside
 * the executable CSS selector so nodes remain inspectable and replay can fall
 * back to alternate locators when a selector becomes stale.
 */
export function webAutomationOutputPayload(outputId: string, payload: JsonObject): JsonObject {
  const element = elementFingerprint(payload.element);
  const selector = stringValue(element?.selector);
  const target = element ? { element } : undefined;
  if (outputId === "web.browser.navigate") return compact({ url: stringValue(payload.url) });
  if (outputId === "web.dom.click" || outputId === "web.dom.clear") return compact({ selector, ...target });
  if (outputId === "web.dom.type") return compact({ selector, text: stringValue(payload.inputValue) ?? "", ...target });
  if (outputId === "web.dom.select") return compact({ selector, value: stringValue(payload.inputValue) ?? "", ...target });
  if (outputId === "web.dom.keypress") return compact({ selector, key: stringValue(payload.key) ?? "", ...target });
  if (outputId === "web.dom.scroll") {
    const scroll = objectValue(payload.scroll);
    return compact({ x: numberValue(scroll?.x), y: numberValue(scroll?.y) });
  }
  return {};
}

export function outputTargetFromPayload(payload: JsonObject): JsonObject | undefined {
  const element = elementFingerprint(payload.element);
  const selector = stringValue(payload.selector) ?? stringValue(element?.selector);
  return selector ? compact({ selector, ...(element ? { element } : {}) }) : undefined;
}

function elementFingerprint(value: unknown): JsonObject | undefined {
  const element = objectValue(value);
  if (!element) return undefined;
  return compact({
    selector: stringValue(element.selector), xpath: stringValue(element.xpath), id: stringValue(element.id),
    classNames: Array.isArray(element.classNames) ? element.classNames.filter((item): item is string => typeof item === "string") : undefined,
    visibleText: stringValue(element.visibleText), tagName: stringValue(element.tagName), text: stringValue(element.text),
    value: stringValue(element.value), role: stringValue(element.role), name: stringValue(element.name), href: stringValue(element.href),
    inputType: stringValue(element.inputType), attributes: objectValue(element.attributes)
  });
}

function compact(value: Record<string, unknown>): JsonObject { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject; }
function objectValue(value: unknown): JsonObject | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined; }
function stringValue(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function numberValue(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
