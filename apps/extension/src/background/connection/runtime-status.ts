// The state of the runtime command currently in flight, and the labels the
// panel shows for it. Holds status only; the caller decides what side effects
// a transition has.

import { WEB_AUTOMATION_INPUT_IDS } from "@fluxiq-web-extension/domain/client";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  DomElementDescriptor,
  RecordingEventPayload,
  RuntimeCommandStatus
} from "../../shared/protocol";
import { isSensitiveFieldSignature } from "../../shared/sensitive-field";
import { recordablePageAddress } from "./recordable-page-address";

export class RuntimeStatusTracker {
  private status: RuntimeCommandStatus = { state: "idle" };
  // The `tab` request of the last action started, kept apart from the status
  // because `finish` replaces the status before the confirmation is built.
  private startedTab: { commandId: string; tab: BrowserActionCommand["tab"] } | undefined;

  current(): RuntimeCommandStatus {
    return this.status;
  }

  // A result does not carry its command's tab operation, which decides the input
  // a tab confirmation names. Only the action this command started answers.
  tabRequestFor(commandId: string): BrowserActionCommand["tab"] {
    return this.startedTab?.commandId === commandId ? this.startedTab.tab : undefined;
  }

  start(status: Omit<RuntimeCommandStatus, "state">): RuntimeCommandStatus {
    this.status = {
      state: "running",
      startedAt: Date.now(),
      ...status
    };
    return this.status;
  }

  startAction(action: BrowserActionCommand): RuntimeCommandStatus {
    this.startedTab = { commandId: action.commandId, tab: action.tab };
    return this.start({
      commandId: action.commandId,
      actionType: action.actionType,
      label: runtimeActionLabel(action.actionType),
      target: runtimeActionTarget(action),
      startedAt: Date.now()
    });
  }

  finish(result: BrowserActionResult & { tabId?: number; frameId?: number }): RuntimeCommandStatus {
    const failed = result.status !== "succeeded";
    const label = runtimeActionLabel(result.actionType);
    this.status = {
      state: failed ? "failed" : "succeeded",
      commandId: result.commandId,
      actionType: result.actionType,
      label,
      target: runtimeResultTarget(result) ?? this.status.target,
      ...(result.tabId !== undefined ? { tabId: result.tabId } : {}),
      ...(result.frameId !== undefined ? { frameId: result.frameId } : {}),
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      ...(result.message ? { message: result.message } : {}),
      ...(failed && result.message ? { error: result.message } : {}),
      ...(result.url ? { url: result.url } : {})
    };
    return this.status;
  }
}

export function runtimeActionLabel(actionType: string): string {
  if (actionType === "web.browser.navigate") return "Navigate";
  if (actionType === "web.dom.click") return "Click";
  if (actionType === "web.dom.type") return "Type";
  if (actionType === "web.dom.clear") return "Clear";
  if (actionType === "web.dom.select") return "Select";
  if (actionType === "web.dom.keypress") return "Key press";
  if (actionType === "web.dom.scroll") return "Scroll";
  if (actionType === "web.dom.wait_for_selector") return "Wait for selector";
  if (actionType === "web.dom.wait_for_text") return "Wait for text";
  if (actionType === "web.dom.extract") return "Extract";
  if (actionType === "web.dom.capture_snapshot") return "Capture snapshot";
  if (actionType === "web.dom.check") return "Set checked";
  if (actionType === "web.dom.assert") return "Assert";
  if (actionType === "web.dom.extract_list") return "Extract list";
  if (actionType === "web.dom.upload") return "Upload files";
  if (actionType === "web.dom.dialog") return "Answer dialog";
  if (actionType === "web.browser.tab") return "Browser tab";
  if (actionType === "web.browser.download") return "Await download";
  return actionType;
}

export function runtimeResultTarget(result: BrowserActionResult): string | undefined {
  if (result.actionType === "web.browser.navigate") return result.url ?? result.title;
  return result.element?.name ?? result.element?.selector ?? result.element?.text;
}

// A succeeded runtime action is also a recorded action: this is the recording
// event it confirms, and the registered input that event maps to. An action that
// did not succeed confirms nothing. A `type` or `select` confirmation carries the
// value the field was left holding, as the recorder would have captured it from
// a user; a sensitive field never does. A `check` confirmation carries no value:
// the state it set is the descriptor's `checked`, which the content script
// withholds for a sensitive control. An `upload` confirmation carries none either:
// a file input's value is a local file name. A tab confirmation's input depends
// on the operation the command asked for, which the result does not carry, so
// the caller hands in the command's `tab` request; the confirmation carries the
// tab in the shape a recorded tab change has.
export function runtimeConfirmationForActionResult(result: BrowserActionResult, tab?: BrowserActionCommand["tab"]): {
  kind: RecordingEventPayload["kind"];
  inputId: string;
  inputValue?: string;
  key?: string;
  scroll?: { x: number; y: number };
  tab?: RecordingEventPayload["tab"];
} | undefined {
  if (result.status !== "succeeded") return undefined;
  if (result.actionType === "web.browser.navigate") return { kind: "browser.navigation", inputId: WEB_AUTOMATION_INPUT_IDS.navigationRequested };
  if (result.actionType === "web.dom.click") return { kind: "dom.click", inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked };
  if (result.actionType === "web.dom.type") return { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.textEntered, ...confirmedValue(result) };
  if (result.actionType === "web.dom.clear") return { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.fieldCleared, inputValue: "" };
  if (result.actionType === "web.dom.select") return { kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.optionSelected, ...confirmedValue(result) };
  if (result.actionType === "web.dom.check") return { kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.checkboxToggled };
  if (result.actionType === "web.dom.keypress") return { kind: "dom.keydown", inputId: WEB_AUTOMATION_INPUT_IDS.keyPressed };
  if (result.actionType === "web.dom.scroll") return { kind: "dom.scroll", inputId: WEB_AUTOMATION_INPUT_IDS.pageScrolled };
  if (result.actionType === "web.dom.upload") return { kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.filesChosen };
  if (result.actionType === "web.browser.tab") return tabConfirmation(tab, result);
  return undefined;
}

// A user's switch and close are the tab changes a recording holds, and the
// confirmation carries the tab as a recorded one does: a switch names the tab it
// left in front by the pathname of the result's URL, and a close carries no path.
// An open, or a tab result whose command request is unknown, confirms nothing
// rather than guess which input it was.
function tabConfirmation(
  tab: BrowserActionCommand["tab"],
  result: BrowserActionResult
): { kind: "browser.tab"; inputId: string; tab: NonNullable<RecordingEventPayload["tab"]> } | undefined {
  if (tab?.operation === "switch") {
    const urlPath = recordablePageAddress(result.url)?.path;
    return { kind: "browser.tab", inputId: WEB_AUTOMATION_INPUT_IDS.tabSwitched, tab: { operation: "switch", ...(urlPath !== undefined ? { urlPath } : {}) } };
  }
  if (tab?.operation === "close") return { kind: "browser.tab", inputId: WEB_AUTOMATION_INPUT_IDS.tabClosed, tab: { operation: "close" } };
  return undefined;
}

// The value is read from the result's element descriptor, which the content
// script fills from the field after the action ran and only while input-value
// capture is on -- so a recording that withholds input values withholds this
// one too.
function confirmedValue(result: BrowserActionResult): { inputValue?: string } {
  const element = result.element;
  if (!element || element.value === undefined || isSensitiveElementDescriptor(element)) return {};
  return { inputValue: element.value };
}

// The recorder's sensitivity rule, shared with the content script, read from
// the wire descriptor because the worker never sees the element.
function isSensitiveElementDescriptor(element: DomElementDescriptor): boolean {
  return isSensitiveFieldSignature({
    inputType: element.inputType,
    autocomplete: element.attributes?.autocomplete,
    dataSensitive: element.attributes?.["data-sensitive"]
  });
}

function runtimeActionTarget(action: BrowserActionCommand): string | undefined {
  return action.url ?? action.selector ?? action.text ?? action.value ?? action.key ?? action.visualTarget?.selector;
}
