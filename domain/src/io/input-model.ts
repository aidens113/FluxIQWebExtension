import type { JsonObject } from "fluxiq/core";

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

export function webAutomationInputIdForRecordedEvent(payload: WebAutomationRecordedInputPayload): WebAutomationInputId | undefined {
  if (payload.kind === "browser.navigation") return payload.metadata?.transition === "typed" ? WEB_AUTOMATION_INPUT_IDS.navigationRequested : undefined;
  if (payload.kind === "dom.click") return WEB_AUTOMATION_INPUT_IDS.elementClicked;
  if (payload.kind === "dom.keydown") return WEB_AUTOMATION_INPUT_IDS.keyPressed;
  if (payload.kind === "dom.wheel") return WEB_AUTOMATION_INPUT_IDS.pageScrolled;
  if (payload.kind === "dom.input" || payload.kind === "dom.change") {
    if (payload.element?.tagName === "select") return WEB_AUTOMATION_INPUT_IDS.optionSelected;
    return payload.inputValue === "" ? WEB_AUTOMATION_INPUT_IDS.fieldCleared : WEB_AUTOMATION_INPUT_IDS.textEntered;
  }
  return undefined;
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
