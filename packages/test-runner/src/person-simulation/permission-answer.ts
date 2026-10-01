// The Lab's person at a permission ask: FluxIQ reached an act with a lasting
// consequence the work was not permitted (place an order, delete, send), and
// asked. The person allows it where the task says its act is, and refuses it
// anywhere else, by the same judgement the lane scores the build with
// (`flow-lane/creation/permission-point.ts`), so the two cannot disagree.
//
// What is recorded is identifiers, Core's closed class names, counts and the
// Lab's own sentences, and the control's name only as Core already put it in
// the ask: nothing a page showed beyond that.

import { judgeCreatedFlowPermissionStop, type CreatedFlowPermissionStop, type LiveInstructionTask } from "../flow-lane/index.js";
import { answerPermissionAsk, type PendingPersonAsk, type PermissionAskAnswer, type PersonAnswerVia, type PersonAskControl, type PersonAskScope, type PersonChatAnswerer } from "./asks.js";
import type { PersonHandOffStage } from "./hand-off-record.js";

/**
 * How the person plays permission asks in this run: the task's declared
 * permission point, or `undefined` for a task that declares none, in which
 * case every permission ask is refused. A simulation given no play leaves
 * permission asks alone.
 */
export type PermissionPlay = Readonly<{ point: LiveInstructionTask["permissionPoint"] | undefined }>;

export type PendingPermissionAsk = Extract<PendingPersonAsk, { kind: "permission" }>;

/** What the person did at one permission ask. */
export type PersonPermissionAnswer = Readonly<{
  askId: string;
  stage: PersonHandOffStage;
  /** The classes the work was not permitted, as Core named them. */
  missing: readonly string[];
  /** The control as Core named it in the ask, or `null` when Core named none. */
  control: string | null;
  verdict: CreatedFlowPermissionStop["verdict"];
  /** Why the ask was not at the task's point; `null` when it was. */
  reason: Extract<CreatedFlowPermissionStop, { verdict: "elsewhere" }>["reason"] | null;
  /** What the person answered; `null` when they left it (a task that says to ask first) or the answer did not reach Core. */
  answer: PermissionAskAnswer | null;
  /** Where it was answered, when it was: in the extension's chat, or through Core's `answer-ask`. */
  via?: PersonAnswerVia;
  /** From the ask being raised to the person's answer, to a tenth of a second. */
  secondsWaited: number;
  /** The Lab's own reason for anything but a grant at the point, bounded; never page text. */
  note: string | null;
}>;

export type PermissionAnswerInput = {
  control: PersonAskControl;
  scope: PersonAskScope;
  play: PermissionPlay;
  now: () => number;
  /** Answers an ask on the extension's chat thread in the chat itself; absent, every ask is answered through Core. */
  answerInChat?: PersonChatAnswerer | undefined;
};

/**
 * Answers one permission ask as the person would: `grant` at the task's
 * declared point, `deny` anywhere else or when no point is declared.
 *
 * Only a control Core named as the task's is allowed. An ask whose control
 * Core left unnamed is refused: the person cannot tell it is the task's act,
 * and overnight builds asked to move money on unnamed controls on bigbox's
 * cart and home pages (`run-munzbfbj-2fb8947d`, `run-muo2fscr-7055485a`),
 * where allowing it would have let a money act through at the wrong place.
 *
 * A task that says to ask first (`askFirst`) has the build's stop as its only
 * right ending, so the person reads the question and leaves it: Core's own
 * timeout refuses it, exactly as before the Lab answered anything.
 */
export async function answerPermissionAskAsPerson(input: PermissionAnswerInput, ask: PendingPermissionAsk): Promise<PersonPermissionAnswer> {
  const stop = judgeCreatedFlowPermissionStop(input.play.point ? { permissionPoint: input.play.point } : {}, { missing: ask.missing, controlName: ask.controlName });
  const judged = { askId: ask.askId, stage: ask.stage, missing: ask.missing, control: ask.controlName, verdict: stop.verdict, reason: stop.verdict === "elsewhere" ? stop.reason : null };
  if (input.play.point?.askFirst) {
    return Object.freeze({ ...judged, answer: null, secondsWaited: waited(input.now, ask), note: "the task says to ask before this act, so the person leaves the question for Core to time out" });
  }
  const matched = stop.verdict === "at_declared_point" && stop.control === "matched";
  const decided: PermissionAskAnswer = matched ? "grant" : "deny";
  let answer: PermissionAskAnswer | null = decided;
  let note: string | null = matched
    ? null
    : stop.verdict === "at_declared_point"
      ? "Core named no control, so the person cannot tell it is the task's act and refuses it"
      : `not the task's permission point (${judged.reason})`;
  let via: PersonAnswerVia = "core";
  try {
    if (input.answerInChat && await input.answerInChat(ask, { kind: decided })) via = "chat";
    else await answerPermissionAsk(input.control, input.scope, ask.askId, decided);
  } catch (error) {
    answer = null;
    note = [note, `the answer did not reach Core: ${(error instanceof Error ? error.message : String(error)).split("\n", 1)[0]!.slice(0, 160)}`].filter((part) => part !== null).join("; ");
  }
  return Object.freeze({ ...judged, answer, ...(answer === null ? {} : { via }), secondsWaited: waited(input.now, ask), note });
}

function waited(now: () => number, ask: PendingPermissionAsk): number {
  return Math.max(0, Math.round((now() - ask.createdAt) / 100) / 10);
}
