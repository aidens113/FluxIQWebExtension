import { BUILD_IDENTITY_MESSAGE, currentBuildIdentity } from "../shared/build-identity";
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
//
// The picker's own messages -- start a pick, cancel it, preview it, record it
// -- are routed to `content/picker/` and answered by the **top frame only**.
// The overlay belongs to the page the user is looking at, and the worker
// addresses frame 0 to reach it; a child frame that receives one anyway stays
// silent rather than putting a second overlay up inside itself, which the
// worker reads as the page refusing.
//
// `fluxiq.pageChallenge` is top frame only too: it is asked about the page a
// navigation or a click landed on, which is the top document, and answers with
// one closed word from `challenge-evidence.ts` -- and, for a robot check, a
// second saying whether it clears by itself -- never with the page's text. A
// document still being parsed answers once it has been.
//
// `fluxiq.evaluateFacts` judges a batch of claims about this document and
// answers at once, from one synchronous pass with no wait (`./facts/`): a
// fact check reads the page as it stands. It is addressed as `executeAction`
// is, because the worker sends each frame only that frame's claims.
//
// The activity overlay's message (`content/activity-overlay/`) is top frame
// only for the same reason: there is one status for the page the person is
// watching. It is a display, so it is answered at once and changes nothing
// the page or the automation can see.

import { CONTENT_SCRIPT_VERSION, isActiveContentInstance } from "./instance";
import { captureSettings } from "./capture-settings";
import { setRecordingState } from "./recorder";
import { actionFailure, captureSnapshotForResponse, challengeIn, executeAction, robotCheckIn } from "./action-runtime";
import { inferListFromElement } from "./extraction";
import { isTopFrame } from "./frame-geometry";
import { extractionContentMessage, handleExtractionMessage } from "./picker";
import { activityContentMessage, showActivityOverlay } from "./activity-overlay";
import { domFactPage, evaluateFactBatch } from "./facts";
import { webAutomationFactCheckRequestValue } from "@fluxiq-web-extension/domain/client";
import { FACT_CHECK_MESSAGE, type FactCheckContentResponse } from "../shared/fact-check-message";
import { EXTRACTION_PROPOSE_MESSAGE, type ExtractionProposeResponse } from "../shared/extraction-messages";
import { PAGE_CHALLENGE_MESSAGE, type PageChallengeResponse } from "../shared/page-challenge-message";
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
    const typed = message as { type?: string; recording?: boolean; settings?: { captureMutations?: boolean; captureInputValues?: boolean; captureSnapshots?: boolean }; action?: BrowserActionCommand; extraction?: unknown; commandId?: string; selector?: string; x?: number; y?: number; frameId?: number; topFrameOnly?: boolean; includeHidden?: unknown; request?: unknown };
    if (typed.type === "fluxiq.ping") {
      sendResponse({ ok: true, active: isActiveContentInstance(), version: CONTENT_SCRIPT_VERSION });
      return false;
    }
    if (!isActiveContentInstance()) return false;
    if (typed.type === BUILD_IDENTITY_MESSAGE) {
      if (!isTopFrame()) return false;
      sendResponse(currentBuildIdentity());
      return false;
    }
    if (typed.type === "recording") {
      captureSettings.mutations = typed.settings?.captureMutations ?? captureSettings.mutations;
      captureSettings.inputValues = typed.settings?.captureInputValues ?? captureSettings.inputValues;
      captureSettings.snapshots = typed.settings?.captureSnapshots ?? captureSettings.snapshots;
      setRecordingState(Boolean(typed.recording));
      sendResponse({ ok: true });
      return true;
    }
    if (typed.type === "captureSnapshot") {
      // The frame merge of a search's look asks every frame for its hidden elements too.
      void captureSnapshotForResponse(typed.includeHidden === true ? { includeHidden: true } : {}).then(sendResponse);
      return true;
    }
    if (typed.type === "executeAction" && typed.action) {
      if (!isAddressedToThisFrame(typed)) return false;
      // `extraction` rides beside the action when the worker carries a
      // paginated list read across documents (`action-runtime/extraction-continuation.ts`).
      void executeAction(typed.action, typed.extraction)
        .then(sendResponse)
        .catch((error: unknown) => sendResponse(actionFailure(typed.action as BrowserActionCommand, error)));
      return true;
    }
    if (typed.type === FACT_CHECK_MESSAGE) {
      if (!isAddressedToThisFrame(typed)) return false;
      // Synchronous, so the channel closes with the reply already sent. A
      // request with no query list is answered with none, which the worker
      // reads as every claim unknown.
      const reading = webAutomationFactCheckRequestValue(typed.request);
      const reply: FactCheckContentResponse = reading ? evaluateFactBatch(reading, domFactPage()) : { answers: [] };
      sendResponse(reply);
      return false;
    }
    if (typed.type === PAGE_CHALLENGE_MESSAGE) {
      if (!isTopFrame()) return false;
      // The read is synchronous. A document still being parsed -- a click's
      // landing is asked about the moment it commits -- is read once it has
      // been, so an empty body is not taken for a page with no check on it.
      if (document.readyState !== "loading") {
        sendResponse(pageChallenge());
        return false;
      }
      document.addEventListener("DOMContentLoaded", () => sendResponse(pageChallenge()), { once: true });
      return true;
    }
    const extraction = extractionContentMessage(typed);
    if (extraction) {
      if (!isTopFrame()) return false;
      return handleExtractionMessage(extraction, sendResponse) === "open";
    }
    const activity = activityContentMessage(typed);
    if (activity) {
      if (!isTopFrame()) return false;
      showActivityOverlay(activity);
      sendResponse({ ok: true });
      return false;
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

/** What this page, as a whole, asks for that only a person can give, and who clears a robot check on it. */
function pageChallenge(): PageChallengeResponse {
  const body = document.body;
  if (!body) return { challenge: null };
  const robotCheck = robotCheckIn(body, "page");
  if (robotCheck) return { challenge: "captcha", robotCheck };
  const challenge = challengeIn(body, "page");
  return { challenge: challenge === "credential" ? challenge : null };
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
