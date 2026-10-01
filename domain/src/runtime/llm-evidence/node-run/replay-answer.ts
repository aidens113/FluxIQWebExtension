// How a replay call answers Core: the closed codes, and the answer with or
// without the page a step broke on.
//
// Shared by the replay (`./replay.ts`), which runs a step again, and the check
// (`./verify.ts`), which checks a step whose effect lasts without running it.
// Both answer in the same vocabulary and the same shape, so they are built in
// one place: a field dropped from one would be a packet Core reads differently
// depending on which of the two produced it.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { captureEvidence, toolExecution, withCallStates, type WebLlmEvidenceToolExecution } from "../capture";
import type { WebLlmNameAssumption } from "../name-assumption";
import { publishedWebLlmPage } from "../page-view";
import { present } from "../present";
import type { WebLlmSnapshotBinding } from "../sanitize";
import type { WebLlmToolRejectionReason } from "../tool-rejection";
import type { WebNodeRun } from "./context";

/**
 * The closed vocabulary a replay answers in.
 *
 * Core's own, because Core reads the answer and knows none of this domain's
 * codes (`AS/runtime/llm/node-tools/replay.ts` holds the same seven). What
 * really happened, in this domain's words, goes in the evidence beside it.
 */
export const WEB_NODE_REPLAY_RESULT_CODES = {
  replayed: "core.replay.replayed",
  /** Checked, not run: the step could run now (`./verify.ts`). */
  verified: "core.replay.verified",
  /** Checked, not run: the step's effect is already in place on the page it acted on (`./verify.ts`). */
  present: "core.replay.present",
  failed: "core.replay.failed",
  changed: "core.replay.changed",
  unreproducible: "core.replay.unreproducible",
  resetFailed: "core.replay.reset_failed"
} as const;

/**
 * What a check found wrong with the step's target, in this domain's words.
 * Closed, and never page text: it is the check that failed, not what the page
 * said.
 */
export type WebNodeVerifyFinding = "missing" | "hidden" | "disabled";

/**
 * What a replay says about itself, beside whatever page it carries.
 *
 * Named rather than written inline so both answers -- the bare one and the one
 * with the page -- are the same fields, and a field dropped from one is a
 * compile error rather than a packet the model quietly reasons without.
 */
type WebNodeReplayAnswer = { ok: boolean; code: string; said: string; found?: WebNodeVerifyFinding };

/**
 * What a replay answer says about itself beyond Core's replay code
 * (`../capture.ts`): which step of the library it was, and -- where the replay
 * refused for a reason this domain already has a word for -- which reason.
 *
 * Core's replay codes say what became of the draft, which is what Core asked.
 * They do not say why, and `core.replay.failed` covers a step that was not
 * permitted, a step whose handle no longer names anything, and a step the page
 * would not run. Each wants a different fix, and the reason is already
 * computed on the way past.
 */
export type WebNodeReplayFacts = {
  resultReason: WebLlmToolRejectionReason | undefined;
  nodeId: string | undefined;
  /**
   * Every name the step's resolution had to assume (`../name-assumption.ts`).
   *
   * A replay resolves the step's parameters again, so it guesses at the same
   * column the exploration guessed at -- by the same code, against the same
   * binding. It is said here too because a replay is the last thing that runs
   * before a draft may be proposed, and a reader of one answer should not have
   * to find another to learn that a column was assumed.
   */
  assumed: WebLlmNameAssumption[] | undefined;
};

/**
 * One replay's answer: the code Core reads, and one line of this domain's own.
 *
 * `ok` is whether the step passed; `acted` whether anything was done to the
 * page, which is what `effectApplied` tells Core. They differ only for a
 * checked step, which passed and did nothing.
 */
export function webNodeReplayAnswer(code: string, said: string, ok = false, about?: WebNodeReplayFacts, acted = ok): WebLlmEvidenceToolExecution {
  return toolExecution(present<WebNodeReplayAnswer>({ ok, code, said, found: undefined }) as unknown as JsonValue, acted, code, undefined, undefined, about);
}

/**
 * The page as it stands now, for an answer to carry. A page that cannot be
 * taken leaves the answer without one, exactly as the replay always did: a
 * verdict without its page is still a verdict, and the caller of a check whose
 * page is missing reads it as the less favourable answer (`./verify.ts`). A
 * cancelled run still throws.
 */
export async function webNodeReplayPage(run: WebNodeRun): Promise<WebLlmSnapshotBinding | undefined> {
  let page: WebLlmSnapshotBinding | undefined;
  try {
    page = run.restamp(await captureEvidence(run.gateway, run.sessionId, run.request, run.request.signal));
    run.shown(page);
  } catch (error) {
    if (run.request.signal?.aborted) throw error;
  }
  return page;
}

/**
 * An answer that did not pass, with the page it was given on, because that is
 * the page the correction has to be made from and the model has no free look
 * to spend on it.
 *
 * A page that could not be taken leaves the line alone: a verdict without its
 * page is still a verdict. A page that can be taken always goes with it, as the
 * compact view the model reads every page in (t223).
 */
export function webNodeReplayAnswerOnPage(
  run: WebNodeRun,
  page: WebLlmSnapshotBinding | undefined,
  answer: { code: string; said: string; acted: boolean; about?: WebNodeReplayFacts | undefined; found?: WebNodeVerifyFinding | undefined; ok?: boolean }
): WebLlmEvidenceToolExecution {
  const verdict: JsonObject = present<WebNodeReplayAnswer>({ ok: answer.ok ?? false, code: answer.code, said: answer.said, found: answer.found }) as unknown as JsonObject;
  if (page) {
    // The page, with what the replay made of this step written on the same
    // result: the one shape every other page has (`web-llm-page.v3`), and a
    // named spread of a typed value rather than a literal, so the fields are
    // still checked.
    const published: JsonObject = publishedWebLlmPage(page.evidence) as unknown as JsonObject;
    const value = { ...published, ...verdict } as unknown as JsonValue;
    return replayStates(toolExecution(value, false, answer.code, undefined, undefined, answer.about), page, answer.acted);
  }
  return replayStates(toolExecution(verdict as unknown as JsonValue, false, answer.code, undefined, undefined, answer.about), page, answer.acted);
}

/** The same, with the page taken now. */
export async function webNodeReplayAnswerWithPage(
  run: WebNodeRun,
  code: string,
  said: string,
  acted: boolean,
  about?: WebNodeReplayFacts,
  found?: WebNodeVerifyFinding
): Promise<WebLlmEvidenceToolExecution> {
  return webNodeReplayAnswerOnPage(run, await webNodeReplayPage(run), { code, said, acted, about, found });
}

/** Which of the four permission refusals this was, in this domain's own words. */
export function webNodeReplayPermissionReason(permission: { kind: "refused"; requestId: string | null; declined?: true } | { kind: "invalid" }): WebLlmToolRejectionReason {
  if (permission.kind === "invalid") return "consequences_unreadable";
  if (permission.requestId === null) return "nobody_to_ask";
  // A question the person already answered no is not in front of anybody (t195-w18).
  return permission.declined ? "consequences_declined" : "consequences_not_granted";
}

/**
 * The states a replay answer saw, from the one capture it took after the step:
 * the state it left, and the state it found as well when the step's command
 * never went out. A step whose command went out took no capture before it, so
 * what it found is not said.
 */
function replayStates(execution: WebLlmEvidenceToolExecution, page: WebLlmSnapshotBinding | undefined, acted: boolean): WebLlmEvidenceToolExecution {
  return withCallStates(execution, acted ? undefined : page, page);
}
