// The result an action gets when the tab gate refuses it: the tab it would run
// in, switch to, close or open is one of FluxIQ's own pages
// (`background/tab-gate/`). Said before anything reached the tab, so it is a
// refusal (`ACTION_REJECTED`), never a browser fault a retry might clear, and
// the model reads the gate's own words.

import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import { OwnPageRefusal } from "../../background/tab-gate";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { workerActionResult, workerBlockedFailure } from "../action-results";

/** `action` refused because its tab, or the address it would open, is FluxIQ's own page; `expected` says what the action asked for. */
export function ownPageRefusedResult(action: BrowserActionCommand, startedAt: number, expected: string, refusal: OwnPageRefusal = new OwnPageRefusal(undefined)): BrowserActionResult {
  const actual = refusal.message;
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: actual,
    validation: { status: "failed", expected, actual },
    failure: workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected, actual })
  });
}
