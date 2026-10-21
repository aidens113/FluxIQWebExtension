// The message the extension's background sends a tab to run one DOM action
// (`apps/extension/src/runtime/action-runner.ts`), answered by the content
// script's message handler (`apps/extension/src/content/message-handler.ts`).
// It lives in the domain, beside the gateway result the answer becomes
// (`./browser-result-mapping.ts`), so the offline snapshot page
// (`packages/test-runner/src/offline-snapshot-page/`) hands a recorded action
// to the content code exactly as the background hands it to a tab. Moved here
// from the extension's `shared/execute-action-message.ts` (t749).
//
// The address travels in the body as well as in `chrome.tabs.sendMessage`'s
// `frameId` option: the body is what lets the receiving frame confirm it is the
// addressee, since a sender without that option (the test runner, the offline
// page) reaches every frame. An action that names no frame is meant for the top
// frame, and `topFrameOnly` says so.

import type { WebAutomationActionCommand } from "../actions/types";

/** The id the browser always gives a tab's main frame; every child frame has a positive one. */
const TOP_FRAME_ID = 0;

export type ExecuteActionMessage = {
  type: "executeAction";
  action: WebAutomationActionCommand;
  frameId: number;
  topFrameOnly: boolean;
};

/** The `executeAction` message for `action`, sent to `frameId`, or to the top frame alone when no frame was chosen. */
export function executeActionMessage(action: WebAutomationActionCommand, frameId: number | undefined): ExecuteActionMessage {
  return { type: "executeAction", action, frameId: frameId ?? TOP_FRAME_ID, topFrameOnly: frameId === undefined };
}
