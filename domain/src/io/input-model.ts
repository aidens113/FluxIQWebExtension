import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_EVENTS, type WebAutomationEventType } from "../constants";
import { webAutomationActionDefinitions } from "../actions/schemas";
import type { WebAutomationActionType } from "../actions/types";
import { webAutomationOutputPayload } from "../output-nodes";

export const WEB_AUTOMATION_INPUT_IDS = {
  browserState: "web.browser.state",
  recordingEvidence: "web.recording.evidence",
  navigationRequested: "web.user.navigation_requested",
  elementClicked: "web.user.element_clicked",
  textEntered: "web.user.text_entered",
  fieldCleared: "web.user.field_cleared",
  optionSelected: "web.user.option_selected",
  keyPressed: "web.user.key_pressed",
  pageScrolled: "web.user.page_scrolled"
} as const;

export type WebAutomationInputId = typeof WEB_AUTOMATION_INPUT_IDS[keyof typeof WEB_AUTOMATION_INPUT_IDS];

export type WebAutomationRecordedInputPayload = {
  kind: string;
  url: string;
  title: string;
  sequence: number;
  element?: JsonObject;
  inputValue?: string;
  key?: string;
  scroll?: JsonObject;
  metadata?: JsonObject;
};

/** A recorded user action resolved to its registered input, its output, and that output's parameters. */
export type WebAutomationRecordedAction = {
  inputId: WebAutomationInputId;
  outputId: WebAutomationActionType;
  parameters: JsonObject;
};

/** Maps a client event kind on the wire to the recording-domain event type it is stored as. */
export function webAutomationEventTypeForClientKind(kind: string): WebAutomationEventType {
  if (kind === "content.ready") return WEB_AUTOMATION_EVENTS.clientReady;
  if (kind === "browser.tab") return WEB_AUTOMATION_EVENTS.tabStateChanged;
  if (kind === "browser.navigation") return WEB_AUTOMATION_EVENTS.pageNavigated;
  if (kind === "dom.click") return WEB_AUTOMATION_EVENTS.elementClicked;
  if (kind === "dom.input") return WEB_AUTOMATION_EVENTS.elementInputChanged;
  if (kind === "dom.change") return WEB_AUTOMATION_EVENTS.elementChanged;
  if (kind === "dom.submit") return WEB_AUTOMATION_EVENTS.formSubmitted;
  if (kind === "dom.focus") return WEB_AUTOMATION_EVENTS.elementFocused;
  if (kind === "dom.blur") return WEB_AUTOMATION_EVENTS.elementBlurred;
  if (kind === "dom.keydown") return WEB_AUTOMATION_EVENTS.keyboardPressed;
  if (kind === "dom.wheel") return WEB_AUTOMATION_EVENTS.mouseWheel;
  if (kind === "dom.scroll") return WEB_AUTOMATION_EVENTS.scrollChanged;
  if (kind === "dom.mutation") return WEB_AUTOMATION_EVENTS.domMutated;
  if (kind === "dom.snapshot") return WEB_AUTOMATION_EVENTS.snapshotCaptured;
  if (kind === "action.result") return WEB_AUTOMATION_EVENTS.actionExecuted;
  return WEB_AUTOMATION_EVENTS.clientError;
}

/**
 * The one recorded-event -> input -> output mapping. The live gateway path
 * (`webAutomationInputIdForRecordedEvent`) and the recording -> Subflow mapper
 * (`mapWebRecordingObservation`) both call it, so an event is executable on
 * one path exactly when it is on the other, with the same parameters,
 * including the element fingerprint and visual target replay falls back on.
 *
 * An event is executable only when the parameters of its output are complete:
 * an input that cannot map deterministically to a runnable output stays evidence.
 */
export function webAutomationRecordedAction(eventType: string, payload: JsonObject, metadata: JsonObject = {}): WebAutomationRecordedAction | undefined {
  const inputId = recordedActionInputId(eventType, payload, metadata);
  if (inputId === undefined) return undefined;
  const outputId = OUTPUT_FOR_ACTION_INPUT.get(inputId);
  if (outputId === undefined) return undefined;
  const parameters = webAutomationOutputPayload(outputId, payload);
  return hasExecutableParameters(outputId, parameters) ? { inputId, outputId, parameters } : undefined;
}

/** The registered action input a recorded client event maps to, or undefined when it is passive evidence. */
export function webAutomationInputIdForRecordedEvent(payload: WebAutomationRecordedInputPayload): WebAutomationInputId | undefined {
  return webAutomationRecordedAction(webAutomationEventTypeForClientKind(payload.kind), payload, payload.metadata)?.inputId;
}

export const stateInputDefinitions = [
  { id: WEB_AUTOMATION_INPUT_IDS.browserState, title: "Browser state", description: "Current browser, tab, and compact DOM state available for policy conditions.", role: "state" as const },
  { id: WEB_AUTOMATION_INPUT_IDS.recordingEvidence, title: "Web recording evidence", description: "Passive browser observations that may inform recordings but never execute a policy.", role: "event" as const }
];

export const actionInputDefinitions = [
  [WEB_AUTOMATION_INPUT_IDS.navigationRequested, "Navigation requested", "web.browser.navigate"],
  [WEB_AUTOMATION_INPUT_IDS.elementClicked, "Element clicked", "web.dom.click"],
  [WEB_AUTOMATION_INPUT_IDS.textEntered, "Text entered", "web.dom.type"],
  [WEB_AUTOMATION_INPUT_IDS.fieldCleared, "Field cleared", "web.dom.clear"],
  [WEB_AUTOMATION_INPUT_IDS.optionSelected, "Option selected", "web.dom.select"],
  [WEB_AUTOMATION_INPUT_IDS.keyPressed, "Key pressed", "web.dom.keypress"],
  [WEB_AUTOMATION_INPUT_IDS.pageScrolled, "Page scrolled", "web.dom.scroll"]
] as const;

const OUTPUT_FOR_ACTION_INPUT = new Map<WebAutomationInputId, WebAutomationActionType>(
  actionInputDefinitions.map(([inputId, , outputId]): [WebAutomationInputId, WebAutomationActionType] => [inputId, outputId])
);

/** A navigation that only records where the recording began is not a user action. */
const RECORDING_START_REASON = "recording_start";

function recordedActionInputId(eventType: string, payload: JsonObject, metadata: JsonObject): WebAutomationInputId | undefined {
  switch (eventType) {
    case WEB_AUTOMATION_EVENTS.pageNavigated:
      return metadata.transition === "typed" && metadata.reason !== RECORDING_START_REASON
        ? WEB_AUTOMATION_INPUT_IDS.navigationRequested
        : undefined;
    case WEB_AUTOMATION_EVENTS.elementClicked:
      return WEB_AUTOMATION_INPUT_IDS.elementClicked;
    case WEB_AUTOMATION_EVENTS.keyboardPressed:
      return WEB_AUTOMATION_INPUT_IDS.keyPressed;
    // The recorder emits `dom.scroll` for wheel and window scrolling alike;
    // `dom.wheel` is never emitted, so its event type maps to no input.
    case WEB_AUTOMATION_EVENTS.scrollChanged:
      return WEB_AUTOMATION_INPUT_IDS.pageScrolled;
    // Checkbox and radio changes still map to text entry; Phase 1.2 adds web.dom.check.
    case WEB_AUTOMATION_EVENTS.elementInputChanged:
    case WEB_AUTOMATION_EVENTS.elementChanged:
      if (objectValue(payload.element)?.tagName === "select") return WEB_AUTOMATION_INPUT_IDS.optionSelected;
      return payload.inputValue === "" ? WEB_AUTOMATION_INPUT_IDS.fieldCleared : WEB_AUTOMATION_INPUT_IDS.textEntered;
    default:
      return undefined;
  }
}

/**
 * Complete when every parameter the schema of the output requires is a
 * non-empty string. Key press and scroll declare no required parameter but do
 * nothing without the recorded key or a scroll coordinate.
 */
function hasExecutableParameters(outputId: WebAutomationActionType, parameters: JsonObject): boolean {
  const schema = webAutomationActionDefinitions.find((definition) => definition.actionType === outputId)?.parameterSchema;
  const required = Array.isArray(schema?.required) ? schema.required.filter((key): key is string => typeof key === "string") : [];
  if (!required.every((key) => isNonEmptyString(parameters[key]))) return false;
  if (outputId === "web.dom.keypress") return isNonEmptyString(parameters.key);
  if (outputId === "web.dom.scroll") return typeof parameters.x === "number" || typeof parameters.y === "number";
  return true;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
