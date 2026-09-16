import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_EVENTS, type WebAutomationEventType } from "../constants";
import { webAutomationExtractListRequestValue, webAutomationRecordedExtraction } from "../actions/extraction";
import { webAutomationActionDefinitions } from "../actions/schemas";
import type { WebAutomationActionType } from "../actions/types";
import { webAutomationOutputPayload, webAutomationSecretBindingPath, webAutomationUploadBindingPath } from "../output-nodes";

export const WEB_AUTOMATION_INPUT_IDS = {
  browserState: "web.browser.state",
  recordingEvidence: "web.recording.evidence",
  navigationRequested: "web.user.navigation_requested",
  elementClicked: "web.user.element_clicked",
  textEntered: "web.user.text_entered",
  fieldCleared: "web.user.field_cleared",
  optionSelected: "web.user.option_selected",
  checkboxToggled: "web.user.checkbox_toggled",
  keyPressed: "web.user.key_pressed",
  pageScrolled: "web.user.page_scrolled",
  filesChosen: "web.user.files_chosen",
  tabSwitched: "web.user.tab_switched",
  tabClosed: "web.user.tab_closed",
  // One input, for the one form of extraction the product can define: a list,
  // which saves a dataset.
  //
  // The single-value form had its own input -- an input maps to exactly one
  // output, and the two forms run different verbs -- and nothing could ever
  // produce it. The worker refuses to start a `value` pick and refuses one that
  // arrives anyway (`background/extraction/control.ts`), `confirm.ts` refuses a
  // `value` definition on the run path, and the picker's recorded event attaches
  // no element for one. A registered action input that no event can reach
  // advertises a trigger that never fires, which is the mirror of an unmapped
  // input becoming executable, so it is not registered.
  //
  // The domain still *reads* a value definition
  // (`actions/extraction/recorded-definition.ts`) and `web.dom.extract` remains
  // an output a Flow may author; a recorded one stays passive evidence. When the
  // picker can record a single value, this is one id and one row again.
  dataExtractionDefined: "web.user.data_extraction_defined"
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
  /** A recorded tab switch or close, as `client/gateway-mapping.ts` `WebAutomationRecordedTab` puts it on the wire. */
  tab?: JsonObject;
  /** A recorded extraction definition, as `actions/extraction/recorded-definition.ts` rebuilds it. */
  extraction?: JsonObject;
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
  if (kind === "data.extract") return WEB_AUTOMATION_EVENTS.dataExtractionDefined;
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
  [WEB_AUTOMATION_INPUT_IDS.checkboxToggled, "Checkbox toggled", "web.dom.check"],
  [WEB_AUTOMATION_INPUT_IDS.keyPressed, "Key pressed", "web.dom.keypress"],
  [WEB_AUTOMATION_INPUT_IDS.pageScrolled, "Page scrolled", "web.dom.scroll"],
  [WEB_AUTOMATION_INPUT_IDS.filesChosen, "Files chosen", "web.dom.upload"],
  [WEB_AUTOMATION_INPUT_IDS.tabSwitched, "Tab switched", "web.browser.tab"],
  [WEB_AUTOMATION_INPUT_IDS.tabClosed, "Tab closed", "web.browser.tab"],
  [WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined, "Data extraction defined", "web.dom.extract_list"]
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
      return isSelectValueChangeKeyPress(payload) ? undefined : WEB_AUTOMATION_INPUT_IDS.keyPressed;
    // The recorder emits `dom.scroll` for wheel and window scrolling alike;
    // `dom.wheel` is never emitted, so its event type maps to no input.
    case WEB_AUTOMATION_EVENTS.scrollChanged:
      return WEB_AUTOMATION_INPUT_IDS.pageScrolled;
    case WEB_AUTOMATION_EVENTS.tabStateChanged:
      return recordedTabInputId(payload);
    // An extraction the user defined with the picker. A definition the reader
    // refuses is not one: it stays evidence rather than becoming an extraction
    // that reads something other than what was picked. A single-value
    // definition stays evidence too -- no input is registered for it, because
    // nothing can produce one (`WEB_AUTOMATION_INPUT_IDS`).
    case WEB_AUTOMATION_EVENTS.dataExtractionDefined: {
      const definition = webAutomationRecordedExtraction(payload.extraction);
      return definition?.form === "list" ? WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined : undefined;
    }
    case WEB_AUTOMATION_EVENTS.elementInputChanged:
    case WEB_AUTOMATION_EVENTS.elementChanged: {
      const element = objectValue(payload.element);
      // A file input holds files, not text. Its recorded value is the user's
      // local file name, so as text entry it replayed that name into a control
      // with no text, and a cancelled choice cleared one. It replays as an
      // upload asking for the files at run time, or stays evidence; it never
      // reaches the text branches below. An input left holding no files -- a
      // value recorded as `""`, or `hasValue: false` from the recorder, which
      // withholds a file input's value -- is a cancelled or emptied choice. No
      // upload reproduces it, and the runner would fill one, so it stays evidence.
      if (stringValue(element?.inputType)?.toLowerCase() === "file") return payload.inputValue === "" || element?.hasValue === false ? undefined : WEB_AUTOMATION_INPUT_IDS.filesChosen;
      if (stringValue(element?.tagName)?.toLowerCase() === "select") return WEB_AUTOMATION_INPUT_IDS.optionSelected;
      // A checkbox or radio is set, not typed into: its recorded value is the
      // control's `value` attribute ("on"), so replaying it as text entry
      // would type "on" into a control that has no text.
      if (isCheckableElement(element)) return WEB_AUTOMATION_INPUT_IDS.checkboxToggled;
      return payload.inputValue === "" ? WEB_AUTOMATION_INPUT_IDS.fieldCleared : WEB_AUTOMATION_INPUT_IDS.textEntered;
    }
    default:
      return undefined;
  }
}

function isCheckableElement(element: JsonObject | undefined): boolean {
  const inputType = stringValue(element?.inputType)?.toLowerCase();
  if (inputType === "checkbox" || inputType === "radio") return true;
  const role = stringValue(element?.role)?.toLowerCase();
  return role === "checkbox" || role === "radio" || role === "switch";
}

/**
 * The keys whose only effect on a closed `<select>` is to change its value,
 * which the recorder already reports as a `change` event of its own.
 * Recording the keystroke as well would replay a key press the user's
 * selection has already accounted for — found by `w1-runner-asserts`, where
 * a keyboard selection on `basic-form` recorded one `web.keyboard.pressed`.
 * Any single character is typeahead; Enter, Escape and Tab do something the
 * value change does not, so they stay key presses.
 */
const SELECT_VALUE_CHANGE_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);

function isSelectValueChangeKeyPress(payload: JsonObject): boolean {
  const element = objectValue(payload.element);
  if (stringValue(element?.tagName)?.toLowerCase() !== "select") return false;
  const key = stringValue(payload.key);
  if (key === undefined) return false;
  return SELECT_VALUE_CHANGE_KEYS.has(key) || [...key].length === 1;
}

/**
 * Complete when every parameter the schema of the output requires is a
 * non-empty string, or a request for a value supplied at run time. Key press
 * and scroll declare no required parameter but do nothing without the recorded
 * key or a scroll coordinate.
 *
 * The request is what `output-nodes/payloads.ts` writes in place of a value the
 * recorder withheld from a sensitive control. Refusing it here dropped the step
 * from the Flow without a word, so a replay failed at the final state with
 * nothing naming the missing value. Accepted, the node reaches Core, which
 * either answers it from the run's inputs or fails the node naming the path.
 */
function hasExecutableParameters(outputId: WebAutomationActionType, parameters: JsonObject): boolean {
  const schema = webAutomationActionDefinitions.find((definition) => definition.actionType === outputId)?.parameterSchema;
  const required = Array.isArray(schema?.required) ? schema.required.filter((key): key is string => typeof key === "string") : [];
  if (!required.every((key) => isExecutableRequiredParameter(key, parameters[key]))) return false;
  if (outputId === "web.dom.keypress") return isNonEmptyString(parameters.key);
  if (outputId === "web.dom.scroll") return typeof parameters.x === "number" || typeof parameters.y === "number";
  // A check whose state is unknown would have to guess between checking and
  // unchecking. The recorder reports a checkbox's `checked`, which
  // `recordedCheckedState` (`payloads.ts`) reads; a sensitive control withholds
  // it, so that toggle stays evidence.
  if (outputId === "web.dom.check") return typeof parameters.checked === "boolean";
  return true;
}

/**
 * A required parameter is present as a non-empty string or a secret request,
 * with two structured exceptions a recording can produce:
 *
 * - `upload` only as the upload request `payloads.ts` writes for a file choice.
 *   A recording never holds a file, so any other value in it would be files
 *   the recording invented, and a secret request is not a file list.
 * - `tab` as a close, or as a switch naming its tab by path. A switch naming
 *   nothing would go to whichever tab happened to be in front.
 * - `extractList` exactly when the request reader reads it. The reader is the
 *   one that decides what the page will be asked to do, so a request it would
 *   refuse at dispatch must not become a node here either: the node would reach
 *   Core, dispatch, and be refused with the Flow already built around it.
 */
function isExecutableRequiredParameter(key: string, value: unknown): boolean {
  if (key === "upload") return webAutomationUploadBindingPath(value) !== undefined;
  if (key === "extractList") return webAutomationExtractListRequestValue(value) !== undefined;
  if (key === "tab") {
    const tab = objectValue(value);
    return tab?.operation === "close" || (tab?.operation === "switch" && isNonEmptyString(tab.urlPath));
  }
  return isNonEmptyString(value) || webAutomationSecretBindingPath(value) !== undefined;
}

/**
 * A tab switch or close the user made. Only an entry carrying `tab` is one: the
 * recording-start marker is stored under the same event type with no `tab`,
 * and must stay evidence.
 */
function recordedTabInputId(payload: JsonObject): WebAutomationInputId | undefined {
  const operation = objectValue(payload.tab)?.operation;
  if (operation === "switch") return WEB_AUTOMATION_INPUT_IDS.tabSwitched;
  if (operation === "close") return WEB_AUTOMATION_INPUT_IDS.tabClosed;
  return undefined;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
