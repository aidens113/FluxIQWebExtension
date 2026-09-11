// Runs one browser action on this page: the verbs in `actions/`, handed the
// page-side capabilities this directory provides.

import { executeContentAction } from "../actions";
import { captureSnapshot } from "../dom-snapshot";
import { describeElement } from "../describe-element";
import type { BrowserActionCommand, BrowserActionResult } from "../types";
import { resolveTarget } from "./resolve-target";
import { waitForElement, waitForText } from "./waits";
import { extractElement } from "./extract";
import { scrollElementIntoView } from "./scroll-element-into-view";
import { setElementValue } from "./set-element-value";
import { dispatchInputEvents } from "./input-events";
import { actionFailure, success } from "./results";

export async function executeAction(action: BrowserActionCommand): Promise<BrowserActionResult> {
  return executeContentAction(action, {
    captureSnapshot,
    resolveTarget,
    describeElement,
    waitForElement,
    waitForText,
    extractElement,
    scrollElementIntoView,
    setElementValue,
    dispatchInputEvents,
    success,
    failure: actionFailure
  });
}
