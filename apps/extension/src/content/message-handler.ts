// Everything the background worker can ask this frame to do. The message names
// and the reply shapes are a contract with `background/`: `fluxiq.ping` answers
// even from a superseded instance so the worker can tell a stale script from a
// missing one, and every other message is ignored unless this instance owns the
// window. Returning `true` keeps the message channel open for an async reply --
// returning `false` closes it, so the two are not interchangeable.
//
// A page of iframes runs one copy of this script per frame, so `executeAction`
// also carries who it is for -- see `isAddressedToThisFrame`.

import { CONTENT_SCRIPT_VERSION, isActiveContentInstance } from "./instance";
import { captureSettings } from "./capture-settings";
import { setRecordingState } from "./recorder";
import { actionFailure, captureSnapshotForResponse, executeAction } from "./action-runtime";
import { isTopFrame } from "./frame-geometry";
import type { BrowserActionCommand } from "./types";

/** The id the browser always gives a tab's main frame; every child frame has a positive one. */
const TOP_FRAME_ID = 0;

/**
 * Whether this frame is the one an `executeAction` was addressed to.
 *
 * `runtime/action-runner.ts` addresses a command at one frame through
 * `chrome.tabs.sendMessage`'s `frameId` option, which already delivers it
 * nowhere else. But that option is not the only way a command arrives:
 * `packages/test-runner` sends `executeAction` to a whole tab, and there every
 * frame receives it and Chrome keeps whichever `sendResponse` fires first --
 * so an action meant for the checkout iframe could be answered by the page
 * around it. The address therefore travels in the message too, and each frame
 * checks it.
 *
 * A content script cannot learn its own frame id -- no API tells it -- so the
 * check is the one thing a frame does know about itself: whether it is the top
 * one. That is enough to separate the two cases that exist. Frame 0 is the top
 * frame; every other id is some child, and which child is settled by the
 * delivery, not here.
 *
 * A message carrying no address at all is accepted, so a broadcast that means
 * "whoever you are" still works.
 */
function isAddressedToThisFrame(message: { frameId?: number; topFrameOnly?: boolean }): boolean {
  if (message.topFrameOnly === true) return isTopFrame();
  if (typeof message.frameId !== "number") return true;
  return message.frameId === TOP_FRAME_ID ? isTopFrame() : !isTopFrame();
}

export function installMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const typed = message as { type?: string; recording?: boolean; settings?: { captureMutations?: boolean; captureInputValues?: boolean; captureSnapshots?: boolean }; action?: BrowserActionCommand; commandId?: string; x?: number; y?: number; frameId?: number; topFrameOnly?: boolean };
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
      if (!isAddressedToThisFrame(typed)) return false;
      void executeAction(typed.action)
        .then(sendResponse)
        .catch((error: unknown) => sendResponse(actionFailure(typed.action as BrowserActionCommand, error)));
      return true;
    }
    return false;
  });
}
