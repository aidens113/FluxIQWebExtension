// Runs one browser action on this page: the verbs in `actions/`, handed the
// page-side capabilities this directory provides. Every capability is wired
// here and nowhere else, so a verb can only reach the page through something
// this file granted it.
//
// `extractionContinuation` is what the worker sent beside the action when it
// wants a paginated list read to survive a navigation; it changes only the list
// read the verbs are granted (`extraction-continuation.ts`).

import { executeContentAction } from "../actions";
import { captureSnapshot } from "../dom-snapshot";
import { describeElement } from "../describe-element";
import type { BrowserActionCommand, BrowserActionResult } from "../types";
import { resolveTarget } from "./resolve-target";
import { extractElement } from "./extract";
import { scrollElementIntoView } from "./scroll-element-into-view";
import { setElementValue } from "./set-element-value";
import { dispatchInputEvents } from "./input-events";
import { checkActionability } from "./actionability";
import { keyboard } from "./keyboard";
import { setCheckedState } from "./checkable-state";
import { detectStructure } from "../extraction";
import { setInputFiles } from "./file-input";
import { dialogControl } from "./dialog-control";
import { evaluateAssertion } from "./assertion-evaluation";
import { waitForCondition } from "./wait-conditions";
import { watchInPlaceEffect } from "./in-place-effect";
import { actionFailure, actionNotImplemented, actionRejected, actionTimedOut, success } from "./results";
import { listReadFor } from "./extraction-continuation";

export async function executeAction(action: BrowserActionCommand, extractionContinuation?: unknown): Promise<BrowserActionResult> {
  return executeContentAction(action, {
    captureSnapshot,
    resolveTarget,
    describeElement,
    extractElement,
    scrollElementIntoView,
    setElementValue,
    dispatchInputEvents,
    checkActionability,
    keyboard,
    setCheckedState,
    detectStructure,
    extractList: listReadFor(extractionContinuation),
    setInputFiles,
    dialogControl,
    evaluateAssertion,
    waitForCondition,
    watchInPlaceEffect,
    success,
    failure: actionFailure,
    rejected: actionRejected,
    timedOut: actionTimedOut,
    notImplemented: actionNotImplemented
  });
}
