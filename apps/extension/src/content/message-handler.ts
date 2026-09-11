// Everything the background worker can ask this frame to do. The message names
// and the reply shapes are a contract with `background/`: `fluxiq.ping` answers
// even from a superseded instance so the worker can tell a stale script from a
// missing one, and every other message is ignored unless this instance owns the
// window. Returning `true` keeps the message channel open for an async reply --
// returning `false` closes it, so the two are not interchangeable.

import { CONTENT_SCRIPT_VERSION, isActiveContentInstance } from "./instance";
import { captureSettings } from "./capture-settings";
import { setRecordingState } from "./recorder";
import { actionFailure, captureSnapshotForResponse, executeAction } from "./action-runtime";
import { isTopFrame } from "./frame-geometry";
import type { BrowserActionCommand } from "./types";

export function installMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const typed = message as { type?: string; recording?: boolean; settings?: { captureMutations?: boolean; captureInputValues?: boolean; captureSnapshots?: boolean }; action?: BrowserActionCommand; commandId?: string; x?: number; y?: number; topFrameOnly?: boolean };
    if (typed.type === "fluxiq.ping") {
      sendResponse({ ok: true, active: isActiveContentInstance(), version: CONTENT_SCRIPT_VERSION });
      return false;
    }
    if (!isActiveContentInstance()) return false;
    if (typed.type === "recording") {
      captureSettings.mutations = typed.settings?.captureMutations ?? captureSettings.mutations;
      captureSettings.inputValues = typed.settings?.captureInputValues ?? captureSettings.inputValues;
      captureSettings.snapshots = typed.settings?.captureSnapshots ?? captureSettings.snapshots;
      setRecordingState(Boolean(typed.recording));
      sendResponse({ ok: true });
      return true;
    }
    if (typed.type === "captureSnapshot") {
      void captureSnapshotForResponse().then(sendResponse);
      return true;
    }
    if (typed.type === "executeAction" && typed.action) {
      if (typed.topFrameOnly === true && !isTopFrame()) return false;
      void executeAction(typed.action)
        .then(sendResponse)
        .catch((error: unknown) => sendResponse(actionFailure(typed.action as BrowserActionCommand, error)));
      return true;
    }
    return false;
  });
}
