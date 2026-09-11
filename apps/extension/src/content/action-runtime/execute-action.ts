// Runs one browser action on this page: the verbs in `actions/`, handed the
// page-side capabilities this directory provides. Every capability is wired
// here and nowhere else, so a verb can only reach the page through something
// this file granted it.

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
import { checkActionability } from "./actionability";
import { keyboard } from "./keyboard";
import { setCheckedState } from "./checkable-state";
import { extractList } from "./list-extraction";
import { setInputFiles } from "./file-input";
import { dialogControl } from "./dialog-control";
import { evaluateAssertion } from "./assertion-evaluation";
import { waitForCondition } from "./wait-conditions";
import { actionFailure, actionNotImplemented, actionRejected, actionTimedOut, success } from "./results";

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
    checkActionability,
    keyboard,
    setCheckedState,
    extractList,
    setInputFiles,
    dialogControl,
    evaluateAssertion,
    waitForCondition,
    success,
    failure: actionFailure,
    rejected: actionRejected,
    timedOut: actionTimedOut,
    notImplemented: actionNotImplemented
  });
}
