// The result the background worker receives for an action: failed with the
// reason, or succeeded with what was found and what the page looked like.

import { captureSettings } from "../capture-settings";
import { captureSnapshot } from "../dom-snapshot";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  DomElementDescriptor,
  DomSnapshot,
  JsonValue
} from "../types";

export function actionFailure(action: BrowserActionCommand, error: unknown, startedAt = Date.now()): BrowserActionResult {
  const snapshot = captureSettings.snapshots ? captureSnapshot() : undefined;
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    message: error instanceof Error ? error.message : "Action failed.",
    url: location.href,
    title: document.title,
    ...(snapshot ? { snapshot } : {}),
    startedAt,
    finishedAt: Date.now()
  };
}

export function success(
  action: BrowserActionCommand,
  startedAt: number,
  message: string,
  element?: DomElementDescriptor,
  snapshot?: DomSnapshot,
  extracted?: JsonValue
): BrowserActionResult {
  const result: BrowserActionResult = {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "succeeded",
    message,
    url: location.href,
    title: document.title,
    startedAt,
    finishedAt: Date.now()
  };
  if (element) result.element = element;
  if (action.visualTarget) result.visualTarget = action.visualTarget;
  if (snapshot ?? captureSettings.snapshots) result.snapshot = snapshot ?? captureSnapshot();
  if (extracted !== undefined) result.extracted = extracted;
  return result;
}
