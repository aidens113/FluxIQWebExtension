// The message the background worker sends a frame to judge its share of a fact
// check (plan B1), and the reply's shape. Both ends name it from here, so the
// string cannot drift between `runtime/fact-check-runner.ts` and
// `content/message-handler.ts`.
//
// The request rides as the wire sent it and is rebuilt by the page through the
// domain's reader; the reply is the domain's `WebAutomationFactCheckResult`.

import type { WebAutomationFactCheckRequest, WebAutomationFactCheckResult } from "@fluxiq-web-extension/domain/client";

export const FACT_CHECK_MESSAGE = "fluxiq.evaluateFacts";

export type FactCheckContentMessage = {
  type: typeof FACT_CHECK_MESSAGE;
  /** The frame the message is for, checked by the frame as `executeAction`'s address is. */
  frameId?: number | undefined;
  request: WebAutomationFactCheckRequest;
};

export type FactCheckContentResponse = WebAutomationFactCheckResult;
