// Recorded browser events, shaped into the client-gateway payloads the FluxIQ
// web-automation domain expects. The wire-visible field names live here.
//
// The element projection below is the narrowest point of the whole recording
// path: what it leaves out is absent from Core's timeline, from every Flow
// generated from that recording, and from the resolution the page performs on
// replay. It is written against `WireElementTarget` in `shared/protocol.ts` so
// the contract, not this file, decides which fields exist.

import {
  createWebAutomationRecordingEvent,
  isSensitiveElementDescriptor,
  webAutomationActionResultPayload,
  webAutomationActionVisualTargetFromElement,
  webAutomationInputIdForRecordedEvent
} from "@fluxiq-web-extension/domain/client";
import type { ClientGatewayRecordingEvent, DomElementDescriptor, JsonObject, RecordingEventPayload, WireElementTarget } from "../../shared/protocol";
import { present } from "../../shared/present";
import { compactObject } from "./value-readers";

// The registered web-automation input a recorded event maps to, or undefined
// when the event is passive evidence rather than an executable action.
export function recordedInputId(payload: RecordingEventPayload) {
  return webAutomationInputIdForRecordedEvent({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    ...(payload.element ? { element: elementTarget(payload.element) } : {}),
    ...(payload.visualTarget ? { visualTarget: payload.visualTarget as unknown as JsonObject } : {}),
    ...(payload.inputValue !== undefined ? { inputValue: payload.inputValue } : {}),
    ...(payload.key !== undefined ? { key: payload.key } : {}),
    ...(payload.scroll ? { scroll: payload.scroll } : {}),
    ...(payload.tab ? { tab: payload.tab as unknown as JsonObject } : {}),
    ...(payload.metadata ? { metadata: payload.metadata } : {})
  });
}

export function recordingEvidencePayload(payload: RecordingEventPayload): JsonObject {
  const visualTarget = visualTargetFromPayload(payload);
  return compactObject({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    timestamp: payload.eventTimestampMs,
    element: payload.element as unknown as JsonObject,
    visualTarget: visualTarget as unknown as JsonObject,
    snapshot: payload.snapshot as unknown as JsonObject,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll as unknown as JsonObject,
    mutation: payload.mutation as unknown as JsonObject,
    actionResult: payload.actionResult as unknown as JsonObject,
    tab: payload.tab as unknown as JsonObject,
    metadata: payload.metadata
  }) as JsonObject;
}

export function gatewayRecordingEventFromPayload(payload: RecordingEventPayload, tabId?: number, frameId?: number, recordingId?: string): ClientGatewayRecordingEvent {
  const inputId = recordedInputId(payload);
  const visualTarget = visualTargetFromPayload(payload);
  return createWebAutomationRecordingEvent({
    kind: payload.kind,
    sequence: payload.sequence,
    url: payload.url,
    title: payload.title,
    eventTimestampMs: payload.eventTimestampMs,
    element: payload.element ? elementTarget(payload.element) : undefined,
    visualTarget: visualTarget as unknown as JsonObject | undefined,
    snapshot: payload.snapshot as unknown as JsonObject,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll as unknown as JsonObject,
    mutation: payload.mutation as unknown as JsonObject,
    actionResult: payload.actionResult ? webAutomationActionResultPayload(payload.actionResult as never) : undefined,
    tab: payload.tab,
    metadata: inputId === undefined
      ? payload.metadata
      : { ...(payload.metadata ?? {}), inputId, ...(visualTarget ? { visualTarget: visualTarget as unknown as JsonObject } : {}) }
  }, {
    ...(recordingId !== undefined ? { recordingId } : {}),
    ...(tabId !== undefined ? { tabId } : {}),
    ...(frameId !== undefined ? { frameId } : {})
  });
}

/**
 * The recorded element, projected onto the wire.
 *
 * **Written through `present<WireElementTarget>` and not by hand.** This
 * function used to be a hand-maintained list of seventeen keys, and it silently
 * omitted all five of the identity signals Phase 1.3 had added to the
 * descriptor -- `testId`, `accessibleName`, `label`, `implicitRole` and
 * `context`. Nothing failed: a projection that forgets a field compiles, and
 * the harness measuring the resolver fed it a full descriptor while production
 * sent a nine-key one. `reports/L-replay.md` measured the gap live. `present`
 * closes it the way `shared/present.ts` closes it for the page-evidence
 * contract: every key of the contract type must be mentioned, so a deleted
 * field is a compile error and an absent value is still absent on the wire.
 *
 * **What a sensitive control does not send.** The rule is the one in
 * `domain/src/sensitivity/`, asked here as `isSensitiveElementDescriptor` --
 * the same question `elementStatePayload` and the LLM evidence sanitizer ask of
 * a serialized descriptor, never a second copy of it. The line it draws is the
 * line `describe-element.ts` already draws at capture: **a control's contents
 * never cross; the author's description of it does.** So `value`, `visibleText`
 * and `text` are withheld (a `contenteditable` marked sensitive puts what was
 * typed into its own text, and `describeElement` reads that text without asking
 * the rule), and so is `accessibleName`, whose specified derivation ends at a
 * push button's `value`, and so is `checked`, which for a checkbox or radio is
 * everything it holds. `label`, `context` (a landmark's name included),
 * `attributes` and the structural
 * signals are author-written and are kept: they cannot hold what a person
 * typed, and withholding them would cost every login form its identity while
 * protecting nothing.
 *
 * This is the second look, not the first. The recorder withholds all of it
 * already at `readElementValue` and `accessible-name.ts`. It is repeated here
 * for the reason `state-values.ts` repeats it: this is the far side of a wire
 * from that guard, what crosses is persisted and replayed, and a regression
 * upstream would write a secret into a stored artefact nobody re-reads.
 */
function elementTarget(element: DomElementDescriptor): JsonObject {
  const secret = isSensitiveElementDescriptor(element);
  return present<WireElementTarget>({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: secret ? undefined : element.visibleText,
    text: secret ? undefined : element.text,
    value: secret ? undefined : element.value,
    role: element.role,
    name: element.name,
    href: element.href,
    inputType: element.inputType,
    checked: secret ? undefined : element.checked,
    bounds: element.bounds,
    documentBounds: element.documentBounds,
    isVisibleOnViewport: element.isVisibleOnViewport,
    hasClickHandler: element.hasClickHandler,
    attributes: element.attributes,
    testId: element.testId,
    accessibleName: secret ? undefined : element.accessibleName,
    label: element.label,
    implicitRole: element.implicitRole,
    context: element.context
  }) as unknown as JsonObject;
}

function visualTargetFromPayload(payload: RecordingEventPayload) {
  return payload.visualTarget ?? (payload.element
    ? webAutomationActionVisualTargetFromElement(payload.element as never)
    : undefined);
}
