// The hover verb: point at an element without pressing it, and judge it by what it showed (t903, F5).
//
// Some menus open only while a pointer rests on their control. On
// `run-mwbkuxqt-c57f42cb` the account menu of the crossborder shop's header was
// one -- a stylesheet `:hover` rule -- and six presses left it closed, because a
// press is no hover and synthetic events never set `:hover`. A person points at
// the control and reads the menu; so does this verb.
//
// It is held to what a click is held to before it acts: the target is resolved,
// and a hidden, covered or disabled one is refused before anything is dispatched
// (`checkActionability`). A robot check the hover brings up is the person's, as
// one a press brings up is (`watchRobotCheck`). Then the pointer comes to rest:
// the enter, over and move events a mouse makes, for menus a script opens
// (`../action-runtime/hover-state/gesture.ts`), and the hover state for menus a
// stylesheet opens (`../action-runtime/hover-state/emulation.ts`), which lasts
// until the pointer leaves or the next action that acts begins.
//
// A hover is judged by what appeared: the elements rendered after it that were
// not before, watched for a short window so a menu a script opens after a delay
// counts (`../action-runtime/hover-state/appeared.ts`). Nothing new is a failed
// validation, which the result reports as `output_not_observed`: the hover did
// not show anything, and a model reading that knows to look elsewhere.

import { WEB_AUTOMATION_CHECK_WAIT_MS, webAutomationBaseTimeoutMs } from "@fluxiq-web-extension/domain/client";
import type { ActionabilityReport, ActionResultEvidence } from "../action-runtime";
import { portableActionability } from "../action-runtime/actionability/index";
import { dispatchHoverGesture, hoverState, newlyRendered, renderedElements } from "../action-runtime/hover-state";
import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

/** How long a hover is watched for what it opens. Shortened, never lengthened, by the command's own timeout. */
const APPEAR_WINDOW_MS = 800;

/** How long a robot check the hover brings up is watched for before the result. As a press's (`./click.ts`). */
const CHECK_WINDOW_MS = 500;

/** Kept back from the command's own timeout, so a result still reaches Core in time. */
const REPLY_MARGIN_MS = 1_000;

export async function hoverAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const { element, resolution } = deps.resolveTarget(action);
  const report: ActionabilityReport = deps.checkActionability(element);
  const evidence = (): ActionResultEvidence => ({ actionability: portableActionability(report), element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution });
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target a pointer can rest on", report.detail, { ...evidence(), blockedAt: report.point, target: element, refusedBeforeDispatch: true });
  }

  const doc = element.ownerDocument;
  const before = renderedElements(doc);
  const check = deps.watchRobotCheck(element);
  let copied: number;
  try {
    dispatchHoverGesture(element, report.point);
    copied = hoverState.point(element);
    const sighting = await check.settle(within(action, CHECK_WINDOW_MS), robotCheckWaitMs(action, startedAt));
    if (sighting && sighting.outcome !== "cleared") return deps.needsPerson(action, startedAt, sighting, evidence());
  } finally {
    check.stop();
  }

  const appeared = await newlyRendered(doc, before, within(action, APPEAR_WINDOW_MS));
  const expected = "the hover shows something that was not shown before it";
  const rules = copied === 0 ? "" : `; ${copied} hover ${copied === 1 ? "rule" : "rules"} of the page's stylesheets applied to the hovered element`;
  if (appeared.length === 0) {
    return deps.success(action, startedAt, "Element hovered; nothing new was shown.", { status: "failed", expected, actual: `${report.detail}; nothing that was not shown before the hover was shown within ${within(action, APPEAR_WINDOW_MS)} ms${rules}` }, evidence());
  }
  return deps.success(action, startedAt, "Element hovered.", { status: "passed", expected, actual: `${report.detail}; the hover showed ${appeared.length} ${appeared.length === 1 ? "element" : "elements"} not shown before${rules}` }, evidence());
}

function within(action: BrowserActionCommand, windowMs: number): number {
  const timeoutMs = webAutomationBaseTimeoutMs(action);
  return timeoutMs === undefined ? windowMs : Math.min(Math.floor(timeoutMs), windowMs);
}

function robotCheckWaitMs(action: BrowserActionCommand, startedAt: number): number {
  const timeoutMs = action.timeoutMs;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return WEB_AUTOMATION_CHECK_WAIT_MS;
  return Math.max(0, Math.min(WEB_AUTOMATION_CHECK_WAIT_MS, timeoutMs - (Date.now() - startedAt) - REPLY_MARGIN_MS));
}
