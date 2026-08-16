import type { RecordingDomainEventDefinition, RecordingEventJsonSchema } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_EVENTS } from "../constants";
import { webAutomationObservationExtractor } from "./observations";
import { webAutomationStateReducer } from "./reducers";

const elementSchema: RecordingEventJsonSchema = {
  type: "object",
  properties: {
    selector: { type: "string", label: "Selector" },
    xpath: { type: "string", label: "XPath" },
    id: { type: "string", label: "Element ID" },
    classNames: { type: "array", label: "Class names" },
    visibleText: { type: "string", label: "Visible text" },
    tagName: { type: "string", label: "Tag name" },
    text: { type: "string", label: "Text" },
    value: { type: "string", label: "Value" },
    role: { type: "string", label: "ARIA role" },
    name: { type: "string", label: "Accessible name" },
    bounds: { type: "object", label: "Bounds" },
    documentBounds: { type: "object", label: "Document bounds" },
    isVisibleOnViewport: { type: "boolean", label: "Visible in viewport" },
    hasClickHandler: { type: "boolean", label: "Has click handler" },
    attributes: { type: "object", label: "Attributes" }
  }
};

const basePayloadSchema: RecordingEventJsonSchema = {
  type: "object",
  required: true,
  properties: {
    url: { type: "string", label: "URL" },
    title: { type: "string", label: "Title" },
    sequence: { type: "integer", label: "Sequence" },
    element: elementSchema,
    inputValue: { type: "string", label: "Input value" },
    key: { type: "string", label: "Key" },
    scroll: { type: "object", label: "Scroll position" },
    mutation: { type: "object", label: "DOM mutation summary" },
    snapshot: { type: "object", label: "Snapshot" },
    actionResult: { type: "object", label: "Action result" },
    recordingState: { type: "string", label: "Recording state" }
  }
};

function event(eventType: string, label: string, description: string): RecordingDomainEventDefinition {
  return {
    eventType,
    label,
    description,
    payloadSchema: basePayloadSchema,
    stateReducer: webAutomationStateReducer,
    observationExtractor: webAutomationObservationExtractor
  };
}

export const webAutomationRecordingEvents: RecordingDomainEventDefinition[] = [
  event(WEB_AUTOMATION_EVENTS.clientReady, "Client ready", "The web automation client became available in a page context."),
  event(WEB_AUTOMATION_EVENTS.tabStateChanged, "Tab state changed", "The active tab or tab metadata changed."),
  event(WEB_AUTOMATION_EVENTS.pageNavigated, "Page navigated", "The active web page navigated."),
  event(WEB_AUTOMATION_EVENTS.elementClicked, "Element clicked", "A user clicked a DOM element."),
  event(WEB_AUTOMATION_EVENTS.elementInputChanged, "Input changed", "A user changed text or input state."),
  event(WEB_AUTOMATION_EVENTS.elementChanged, "Element changed", "A DOM control changed value."),
  event(WEB_AUTOMATION_EVENTS.formSubmitted, "Form submitted", "A form was submitted."),
  event(WEB_AUTOMATION_EVENTS.elementFocused, "Element focused", "A DOM element received focus."),
  event(WEB_AUTOMATION_EVENTS.elementBlurred, "Element blurred", "A DOM element lost focus."),
  event(WEB_AUTOMATION_EVENTS.keyboardPressed, "Keyboard pressed", "A keyboard event was recorded."),
  event(WEB_AUTOMATION_EVENTS.mouseWheel, "Mouse wheel", "A user moved the mouse wheel or equivalent pointing-device wheel input."),
  event(WEB_AUTOMATION_EVENTS.scrollChanged, "Scroll changed", "The page or context scroll position changed."),
  event(WEB_AUTOMATION_EVENTS.domMutated, "DOM mutated", "A DOM mutation summary was recorded."),
  event(WEB_AUTOMATION_EVENTS.snapshotCaptured, "Snapshot captured", "A structured page snapshot was captured."),
  event(WEB_AUTOMATION_EVENTS.actionExecuted, "Action executed", "A requested automation action completed."),
  event(WEB_AUTOMATION_EVENTS.clientError, "Client error", "The client reported an error.")
];
