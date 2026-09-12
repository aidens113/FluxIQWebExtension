import type { StateSnapshot, StateValue, StateValueType } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_SCHEMA_VERSION } from "../../constants";
import { WEB_AUTOMATION_STATE_NAMESPACE } from "../state";
import { isSensitiveElementDescriptor } from "../../sensitivity";
import { compactJsonObject } from "./compact-json-object";
import { isEnabled, stableElementId, type WebAutomationStateElement } from "./element";
import { boundsAnchor, stateBounds } from "./geometry";
import type { WebAutomationElementStateInput } from "./types";

// Writing into the `web` namespace of a state snapshot. Every value the
// projection produces goes through `putStateValue`, so the namespace header,
// the default confidence and the metadata shape are decided once here rather
// than at each of the two dozen call sites that write a path.
//
// Two different things are called "sensitive" in this file and they are not
// the same rule. `StateValue.sensitive` is Core's marking on a stored value --
// "handle this carefully" -- and it is set for any element that carries a
// value at all, because any typed value may be personal. `isSensitiveElement`
// below is the shared secret-bearing-control rule from
// `domain/src/sensitivity/`, and it decides something stronger: that the value
// must not be stored at all. The marking is a superset of the rule, so a
// control the rule protects is always marked too.

export function putStateValue(
  snapshot: StateSnapshot,
  path: string,
  type: StateValueType,
  value: unknown,
  observedAt: number,
  sourceId: string | undefined,
  input: Partial<StateValue> & { elementKind?: string; stableAcrossSessions?: boolean } = {}
): StateSnapshot {
  const namespace = snapshot.namespaces[WEB_AUTOMATION_STATE_NAMESPACE] ?? {
    schemaId: WEB_AUTOMATION_DOMAIN_ID,
    schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
    values: {},
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
  };
  const stateValue: StateValue = compactJsonObject({
    type,
    value,
    observedAt,
    sourceId,
    confidence: input.confidence ?? 0.95,
    volatility: input.volatility ?? "normal",
    comparable: input.comparable ?? true,
    sensitive: input.sensitive,
    presentation: input.presentation,
    metadata: compactJsonObject({
      elementKind: input.elementKind,
      stableAcrossSessions: input.stableAcrossSessions
    })
  }) as StateValue;
  return {
    ...snapshot,
    timestamp: observedAt,
    namespaces: {
      ...snapshot.namespaces,
      [WEB_AUTOMATION_STATE_NAMESPACE]: {
        ...namespace,
        values: {
          ...namespace.values,
          [path]: stateValue
        }
      }
    }
  };
}

// One element as a single `elements.<stateId>` JSON value. The whole element is
// one value rather than a value per field: consumers read the blob, and a path
// per field multiplies the snapshot by a dozen for information already in it.
export function addElementStateValues(
  state: StateSnapshot,
  { element, stateId }: WebAutomationStateElement,
  timestamp: number,
  sourceId: string | undefined
): StateSnapshot {
  const basePath = `elements.${stateId}`;
  const anchor = boundsAnchor(element.documentBounds ?? element.bounds);
  const secret = isSensitiveElementDescriptor(element);
  // A secret-bearing control's value is never its label either: a presentation
  // label is shown and stored like any other string.
  const elementLabel = element.name ?? element.visibleText ?? element.text ?? (secret ? undefined : element.value) ?? element.href ?? element.selector;
  const elementPresentation = anchor ? { group: "Elements", anchor, visualKind: "bounds" as const } : { group: "Elements" };
  return putStateValue(state, basePath, "json", elementStatePayload(element), timestamp, sourceId, {
    elementKind: "element",
    stableAcrossSessions: Boolean(stableElementId(element)),
    comparable: false,
    sensitive: element.value !== undefined || secret,
    presentation: {
      ...elementPresentation,
      label: elementLabel,
      visualKind: anchor ? "bounds" : "text",
      metadata: compactJsonObject({
        boundsKind: "document",
        renderKind: "direct-rendered",
        isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds))
      })
    }
  });
}

/**
 * One element as the JSON blob durable web state stores.
 *
 * `value` is dropped for a secret-bearing control. The extension already
 * withholds it at the reader, so in a healthy pipeline there is nothing here
 * to drop -- but this is the far side of a wire from that guard, web state is
 * persisted and replayed, and a regression upstream would write a card number
 * into a stored artefact nobody re-reads. The reducer next door took the same
 * second look for the same reason. Presence is unaffected: the element, its
 * identity and its attributes still land.
 */
export function elementStatePayload(element: WebAutomationElementStateInput): JsonObject {
  return compactJsonObject({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: element.visibleText,
    text: element.text,
    value: isSensitiveElementDescriptor(element) ? undefined : element.value,
    role: element.role,
    name: element.name,
    href: element.href,
    inputType: element.inputType,
    bounds: stateBounds(element.bounds) as JsonObject | undefined,
    documentBounds: stateBounds(element.documentBounds) as JsonObject | undefined,
    isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
    enabled: isEnabled(element),
    stableId: stableElementId(element),
    hasClickHandler: element.hasClickHandler,
    attributes: element.attributes as JsonObject | undefined
  });
}
