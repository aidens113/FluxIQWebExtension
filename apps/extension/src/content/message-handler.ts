// Everything the background worker can ask this frame to do. The message names
// and the reply shapes are a contract with `background/`: `fluxiq.ping` answers
// even from a superseded instance so the worker can tell a stale script from a
// missing one, and every other message is ignored unless this instance owns the
// window. Returning `true` keeps the message channel open for an async reply --
// returning `false` closes it, so the two are not interchangeable.
//
// A page of iframes runs one copy of this script per frame, so `executeAction`
// also carries who it is for -- see `isAddressedToThisFrame`.
//
// `extraction.propose` is the one message that answers about page structure
// rather than acting: it infers the extraction a picked element proposes, for
// the picker to show and for the content harness to prove inference on a real
// page. Its reply holds selectors, labels and counts, never a page value
// (decision D3).

import { CONTENT_SCRIPT_VERSION, isActiveContentInstance } from "./instance";
import { captureSettings } from "./capture-settings";
import { setRecordingState } from "./recorder";
import { actionFailure, captureSnapshotForResponse, executeAction } from "./action-runtime";
import { inferListFromElement } from "./extraction";
import { isTopFrame } from "./frame-geometry";
import { EXTRACTION_PROPOSE_MESSAGE, type ExtractionProposeResponse } from "../shared/extraction-messages";
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
    const typed = message as { type?: string; recording?: boolean; settings?: { captureMutations?: boolean; captureInputValues?: boolean; captureSnapshots?: boolean }; action?: BrowserActionCommand; commandId?: string; selector?: string; x?: number; y?: number; frameId?: number; topFrameOnly?: boolean };
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
    if (typed.type === EXTRACTION_PROPOSE_MESSAGE) {
      if (!isAddressedToThisFrame(typed)) return false;
      // Inference is synchronous, so the channel closes with the reply already
      // sent, as `fluxiq.ping` does.
      sendResponse(proposeExtraction(typed.selector));
      return false;
    }
    return false;
  });
}

/**
 * The extraction the picked element proposes, or why none was made. Reading
 * page structure is all this does: the reply carries selectors, labels built
 * from structure, counts and coverage, and no value read from the page (D3).
 */
function proposeExtraction(selector: string | undefined): ExtractionProposeResponse {
  const picked = pickedElement(selector);
  if (!picked) return { ok: false, refused: "target_not_found" };
  const proposal = inferListFromElement(picked);
  return proposal ? { ok: true, proposal } : { ok: false, refused: "no_repeating_run" };
}

/** The element the selector names here, or `null` when this frame has none or the browser cannot parse it. */
function pickedElement(selector: string | undefined): Element | null {
  if (typeof selector !== "string" || selector.trim() === "") return null;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}
