// What this domain states about the act behind a failure, where Core decides
// whether making it again would be a second act (t359, Core
// `executor/defensive/lasting-act.ts`).
//
// One statement, read on every path a web node runs on: a saved Flow's playback
// and a candidate trial through the runtime adapter (`./adapter.ts`), and a
// build's exploration and test replays through the outside-graph dispatch
// (`./llm-evidence/node-run/retries/dispatch.ts`, t361). Before t361 the last
// two marked every page-changing node as acting instead, so typing, choosing
// and navigating lost their retries after an ambiguous failure there and kept
// them in playback: two definitions of a lasting act.

import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionType } from "../actions/types";
import { webAutomationOutputNodeId } from "../output-nodes";
import { webPlanStepMustDeclare } from "./llm-evidence/plan-resolution/step-permission";

/** The fields of a failure record the statement reads and writes. */
type StatedRecord = Pick<AutomationStudioFailureRecord, "effect" | "stage" | "retryable">;

/**
 * The failure record with this domain's statement about the act behind it.
 *
 * **A committing act** -- a press, a key press, a dialog answer, or typing that
 * sends its form: the actions whose effect is the page's to decide, the same
 * set a Flow step must declare consequences for (`webPlanStepMustDeclare`) --
 * says on its record whether it happened:
 *
 *  - `effect: "unacted"` when the failure shows nothing was dispatched: the
 *    target was not resolved yet, the command was refused before dispatch, the
 *    page turned the press away as too fast or busy, or the client itself
 *    stated it (an actionability refusal: covered, hidden, disabled before the
 *    press; a send the browser refused before it reached the page, t361).
 *    Core makes it again, because nothing happened to repeat.
 *  - `effect: "ambiguous"` for everything else: the press was sent and only
 *    its answer is missing -- the verb threw after the gesture, the page
 *    changed under it, the acknowledgement timed out or the confirmation was
 *    not observed. Core does not press again; the step's outcome is uncertain
 *    unless the Flow's own state shows it landed.
 *
 * A Flow's web node carries none of this domain's definition metadata, so
 * without the statement every press looked to Core like a read and was
 * pressed again after a lost acknowledgement -- a second item in a cart, a
 * message sent twice. Which actions commit is this domain's fact; what to do
 * about an uncertain act is Core's, decided once.
 *
 * **Every other action** is stated nothing beyond a client-stated `unacted`,
 * and keeps the record's own `retryable`, wherever the failure was found.
 * Typing, choosing, ticking and navigating set a state rather than commit one:
 * a field whose read-back does not match (typed "3", reads "1"), a choice or a
 * tick whose verification failed, a navigation whose landing was not confirmed
 * are all made again under Core's first attempt and three retries (the user's
 * rule of 2026-10-07). Until t361 such a failure found at verification or
 * confirmation was set `retryable: false` here (t355), so lane A's quantity
 * field was never typed twice.
 *
 * Whether a non-committing act lasts anyway is not this domain's to say: a
 * step that declared a lasting consequence carries it on its node
 * (`declaredConsequences`), and Core holds that act back itself when its
 * effect is unknown (`automationStudioNodeActLasts`, gate 3 of
 * `automationStudioAssessAttemptFault`), with the same uncertain outcome a
 * press gets. A committing act is not set `retryable: false` either: its
 * `ambiguous` statement is what makes Core hold it back as uncertain rather
 * than as a plain refusal.
 *
 * `reported` is the client's own record as it arrived, which is where a
 * client-stated `unacted` is read from; `failure` is the record being stated
 * on, the same record when nothing rebuilt it.
 */
export function webLastingActStatement<T extends StatedRecord>(
  actionType: WebAutomationActionType,
  parameters: JsonObject,
  reported: Pick<AutomationStudioFailureRecord, "effect"> | undefined,
  failure: T
): T {
  const unacted = failure.effect === "unacted" || reported?.effect === "unacted" || failure.stage === "target_resolution" || failure.stage === "dispatch";
  if (webPlanStepMustDeclare(webAutomationOutputNodeId(actionType), parameters)) return { ...failure, effect: unacted ? "unacted" : "ambiguous" };
  return reported?.effect === "unacted" ? { ...failure, effect: "unacted" } : failure;
}
