// How a replay call answers Core: the closed codes, and the answer with or
// without the page a step broke on.
//
// Shared by the replay (`./replay.ts`), which runs a step again, and the check
// (`./verify.ts`), which checks a step whose effect lasts without running it.
// Both answer in the same vocabulary and the same shape, so they are built in
// one place: a field dropped from one would be a packet Core reads differently
// depending on which of the two produced it.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { isWebAutomationExtractFieldKey, webAutomationExtractionSummaryValue } from "../../../actions/extraction";
import { captureEvidence, toolExecution, withCallStates, type WebLlmEvidenceToolExecution } from "../capture";
import { webLlmEvidenceKeyIsDenied } from "../denied-keys";
import { isJsonRecord } from "../untrusted-json";
import type { WebLlmNameAssumption } from "../name-assumption";
import { publishedWebLlmPage } from "../page-view";
import { present } from "../present";
import type { WebLlmSnapshotBinding } from "../sanitize";
import type { WebLlmToolRejectionReason } from "../tool-rejection";
import { screenedText } from "../withheld";
import type { WebNodeRun } from "./context";
import { WEB_NODE_REPLAY_READ_ROWS_NOTE, WEB_NODE_REPLAY_UNFILTERED_ROWS_NOTE } from "./rejected-rows";

/**
 * The closed vocabulary a replay answers in.
 *
 * Core's own, because Core reads the answer and knows none of this domain's
 * codes (`AS/runtime/llm/node-tools/replay.ts` holds the same eight). What
 * really happened, in this domain's words, goes in the evidence beside it.
 */
export const WEB_NODE_REPLAY_RESULT_CODES = {
  replayed: "core.replay.replayed",
  /** Checked, not run: the step could run now (`./verify.ts`). */
  verified: "core.replay.verified",
  /** Checked, not run: the step's effect is already in place on the page it acted on (`./verify.ts`). */
  present: "core.replay.present",
  /** Run again, and its target is gone from the page it acted on: the site remembers the step (`./missing-target.ts`). */
  remembered: "core.replay.remembered",
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
 *
 * `notice` and `changed` are what an exploration press says of the page it
 * acted on (`./press-effect/`), said of a replayed one too (t174-w82): the
 * lines a page that refused the step answered with, and the lines a step that
 * ran changed. Core hands the whole answer to the judge of the build's test as
 * the step's `observed` (`AS/runtime/result-verification/build-test/observation.ts`);
 * on `run-murwd8le-79e735a8` that judge was told "the step ran again" of an
 * Add to cart the page answered "You have reached the purchase limit for this
 * item.".
 */
type WebNodeReplayAnswer = { ok: boolean; code: string; said: string; found?: WebNodeVerifyFinding; notice?: string[]; changed?: string[]; readRows?: JsonObject };

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
export function webNodeReplayAnswer(code: string, said: string, ok = false, about?: WebNodeReplayFacts, acted = ok, readRows?: JsonObject, changed?: string[]): WebLlmEvidenceToolExecution {
  return toolExecution(present<WebNodeReplayAnswer>({ ok, code, said, found: undefined, notice: undefined, changed, readRows }) as unknown as JsonValue, acted, code, undefined, undefined, about);
}

/**
 * The page as it stands now, for an answer to carry. A page that cannot be
 * taken leaves the answer without one, exactly as the replay always did: a
 * verdict without its page is still a verdict, and the caller of a check whose
 * page is missing reads it as the less favourable answer (`./verify.ts`). A
 * cancelled run still throws.
 */
export async function webNodeReplayPage(run: WebNodeRun, shown = true): Promise<WebLlmSnapshotBinding | undefined> {
  let page: WebLlmSnapshotBinding | undefined;
  try {
    page = run.restamp(await captureEvidence(run.gateway, run.sessionId, run.request, run.request.signal));
    // A look a replay only compares -- before and after a step that ran -- is
    // not shown: an answer that carries no page shows the model nothing.
    if (shown) run.shown(page);
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
  answer: { code: string; said: string; acted: boolean; about?: WebNodeReplayFacts | undefined; found?: WebNodeVerifyFinding | undefined; ok?: boolean; notice?: string[] | undefined }
): WebLlmEvidenceToolExecution {
  // An answer on a page did not replay a read, so it names no rows; the page it carries is what changed.
  const verdict: JsonObject = present<WebNodeReplayAnswer>({ ok: answer.ok ?? false, code: answer.code, said: answer.said, found: answer.found, notice: answer.notice, changed: undefined, readRows: undefined }) as unknown as JsonObject;
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

/**
 * What a replayed list read says it read, in one line, or nothing for a step
 * that is not one.
 *
 * A step that replayed used to say only "the step ran again", and for a read
 * that is the one line the judge of a build's test is given of it: Core sends
 * the replay's answer as the step's `observed`
 * (`AS/runtime/result-verification/build-test/observation.ts`). Run 15's judge
 * (`run-muqj2bgb-d048ec37`, steps 0033 and 0034) was told nothing more of a
 * read that kept ten rows from five pages and stopped on a disabled Next, so it
 * was unsure, then said the pagination never resolved and sent a working Flow
 * back. The line is the read's own account (`actions/extraction/summary.ts`):
 * counts, field keys and closed words, so nothing in it is page text. A
 * condition is named by the field its `where` entry tests, in the request's
 * order, or by its position where the request does not line up with the report.
 */
export function webNodeReplayReadSaid(payload: JsonValue | undefined, where: unknown): string | undefined {
  const summary = isJsonRecord(payload) ? webAutomationExtractionSummaryValue(payload.extraction) : undefined;
  if (!summary) return undefined;
  const conditions = summary.conditions;
  const rows = conditions?.unfiltered
    ? `answered with ${counted(summary.recordCount, "row")} its conditions rejected, as they kept none`
    : `kept ${counted(summary.recordCount, "row")}`;
  const stop = summary.paginationStop ? `, stopped on ${summary.paginationStop}` : "";
  const parts = [`the step ran again: ${rows} from ${counted(summary.pagesRead, "page")}${stop}${summary.truncated ? ", cut short" : ""}`];
  if (summary.itemsSeen !== undefined) parts.push(`${counted(summary.itemsSeen, "item")} seen`);
  if (conditions && conditions.rejected.length) {
    const named = conditionNames(where, conditions.rejected.length);
    const each = conditions.rejected.map((rejected, index) => {
      const name = named[index]!;
      const alone = conditions.alone?.[index];
      return alone === undefined ? `${name} ${rejected}` : `${name} ${rejected} (${alone})`;
    });
    parts.push(`per condition rejected${conditions.alone ? " (removed alone)" : ""}: ${each.join(", ")}`);
  }
  return parts.join("; ");
}

/** What a replayed read names of its rows: Core's member, `readRows` (see `webNodeReplayReadRows`). */
type WebNodeReplayReadRows = { rows?: JsonObject[] | undefined; leftOutOnlyByThis?: JsonObject[] | undefined; note?: string | undefined };

/** The rows one condition removed by itself. */
type WebNodeReplayLeftOut = { condition: string; rows: JsonObject[] };

/** A value that is an address rather than text: a URL, or a path from an origin. Core's label rule's own. */
const ADDRESS = /^(?:[a-z][a-z\d+.-]*:\/\/|\/)/iu;

/**
 * A key a JavaScript object orders before every other, whatever order it was
 * written in. The label is the first cell of a row record, so a tested column
 * with such a key would read as the label; its value is not sent.
 */
const INDEX_KEY = /^\d+$/u;

/**
 * The rows a replayed list read names beside its line, by label, or nothing for
 * a step that is not one.
 *
 * The line is counts only, and live run `run-muqk713g` (C3) showed counts are
 * not enough: its build-test judge was told "name 20 (5)" of a read that kept
 * 10 of the 13 earbuds asked for, and passed it; the three pairs missing were
 * rows the name condition removed by itself. So the answer also carries
 * `readRows`: `rows`, the rows the read returned, and `leftOutOnlyByThis`, per
 * condition that removed rows by itself, those rows, which the replay asks the
 * page for as a Flow's playback does (`output-nodes/extract-list/dispatch.ts`).
 * Core screens them and sends the judge their labels
 * (`AS/runtime/result-verification/build-test/read-rows.ts`, the member's name
 * is Core's), as it sends a playback's judge `leftOutOnlyByThis`.
 *
 * Each row is its label, as a one-column record `{ column: label }`: its first
 * column in the read's field order holding text that is not an address, else
 * its first value, the rule Core labels a playback's rows by
 * (`AS/runtime/service/summaries/extraction-summary.ts`). A column this domain
 * denies in evidence is never a label, and a label shaped like a secret is
 * written withheld (`../withheld.ts`). Every row is named: nothing caps a
 * list (user rule, 2026-09-30: no caps among qualifying rows), as nothing caps
 * the playback judge's `leftOutOnlyByThis`.
 *
 * **A left-out row also carries the value its condition tested** (t195-w34),
 * as a second cell after its label: `{ name: "Jonas Weber", mutualFriends:
 * "Aisha Khan and 4 other mutual friends" }`. Live run `run-murwcaj0-40e56557`
 * (cause R6): a regex meant to keep five or more mutual friends dropped Jonas
 * Weber, who has five, and the judge -- shown his name only -- called the five
 * left out "exactly the requests with fewer than five mutual friends". The
 * value is the row's own cell for the column the condition tested, which is
 * the condition's `field` in `ranWhere`, the `where` the page actually ran:
 * resolution rewrites a detection key the plan wrote (`div_x0531...`) into the
 * key the plan keeps that column under (`mutualFriends`,
 * `../plan-resolution/extraction/conditions.ts`), and the row is keyed by
 * the latter. A condition over a column the read does not keep tests a value
 * the row does not carry, so it sends none; so does a call that gives no
 * `ranWhere`, rather than guess a column from the words the plan wrote. The
 * cell is whole and screened as a label is; empty where the row had no value
 * (an `is: "present"` condition rejects exactly those); never from a denied
 * column; and left out where the tested column is the label's own, since the
 * label already is that value. Core reads the label from the first cell
 * either way, so a Core that predates the second cell still reads the row.
 *
 * **It says how to read them** (t194 w68, run `run-murwcmx2-a1c6edf7` C-E).
 * The answer also reaches the model that explores, as `core.run_flow`'s last
 * step, so the rows a condition removed by itself carry the same check an
 * explored read's `rejectedRowsNote` asks for (`./rejected-rows.ts`), as
 * `note`; a read whose conditions kept none says its rows are rows they
 * rejected. The note only adds a sentence: no row is left out for it. Core's
 * build-test judge is sent `rows` and `leftOutOnlyByThis` only and has its own
 * instruction (`AS/runtime/result-verification/build-test/read-rows.ts`).
 */
export function webNodeReplayReadRows(payload: JsonValue | undefined, where: unknown, ranWhere?: unknown): JsonObject | undefined {
  const summary = isJsonRecord(payload) ? webAutomationExtractionSummaryValue(payload.extraction) : undefined;
  if (!summary || !isJsonRecord(payload)) return undefined;
  const fields = summary.fieldNames;
  const rows = labelled(Array.isArray(payload.extracted) ? payload.extracted : [], fields);
  const samples = summary.rejectedSamples;
  const leads = summary.rejectedSamplesAlone;
  const named = conditionNames(where, samples?.length ?? 0);
  const tested = testedColumns(ranWhere, samples?.length ?? 0, fields);
  const leftOut = (samples ?? []).flatMap((sampled, index): JsonObject[] => {
    const alone = labelled(sampled.slice(0, leads?.[index] ?? 0), fields, tested[index]);
    return alone.length ? [present<WebNodeReplayLeftOut>({ condition: named[index]!, rows: alone }) as unknown as JsonObject] : [];
  });
  if (!rows.length && !leftOut.length) return undefined;
  const notes = [
    ...(summary.conditions?.unfiltered && rows.length ? [WEB_NODE_REPLAY_UNFILTERED_ROWS_NOTE] : []),
    ...(leftOut.length ? [WEB_NODE_REPLAY_READ_ROWS_NOTE] : [])
  ];
  return present<WebNodeReplayReadRows>({
    rows: rows.length ? rows : undefined,
    leftOutOnlyByThis: leftOut.length ? leftOut : undefined,
    note: notes.length ? notes.join(" ") : undefined
  }) as unknown as JsonObject;
}

/**
 * Each row's label, in order, with the value `tested` names after it where
 * there is one (see `webNodeReplayReadRows`); a row with no value to name it by
 * is left out, as Core leaves it out.
 */
function labelled(rows: readonly unknown[], fields: readonly string[], tested?: string): JsonObject[] {
  return rows.flatMap((row): JsonObject[] => {
    if (!isJsonRecord(row)) return [];
    const cells = fields.flatMap((key): Array<[string, string]> => {
      const value = row[key];
      return !webLlmEvidenceKeyIsDenied(key) && typeof value === "string" && value.trim() ? [[key, value.trim()]] : [];
    });
    const chosen = cells.find(([, value]) => /\p{L}/u.test(value) && !ADDRESS.test(value)) ?? cells[0];
    if (!chosen) return [];
    const label: JsonObject = { [chosen[0]]: screenedText(chosen[1]) };
    if (tested === undefined || tested === chosen[0]) return [label];
    const value = row[tested];
    return [{ ...label, [tested]: typeof value === "string" ? screenedText(value.trim()) : "" }];
  });
}

/**
 * Per condition, the column of the row it tested: its `field` in the `where`
 * the page ran, where that is one of the read's own columns and not one this
 * domain denies or that is all digits (`INDEX_KEY`). Nothing for a condition
 * that reads a value of its own, and nothing at all where `ranWhere` is not
 * one entry per condition.
 */
function testedColumns(ranWhere: unknown, count: number, fields: readonly string[]): Array<string | undefined> {
  const ran = Array.isArray(ranWhere) && ranWhere.length === count ? ranWhere : [];
  return Array.from({ length: count }, (_, index) => {
    const entry = ran[index];
    const field = isJsonRecord(entry) ? entry.field : undefined;
    return typeof field === "string" && fields.includes(field) && !webLlmEvidenceKeyIsDenied(field) && !INDEX_KEY.test(field) ? field : undefined;
  });
}

/**
 * Each condition's name: the field its `where` entry tests, in the request's
 * order, or its position where the request does not line up with the report.
 */
function conditionNames(where: unknown, count: number): string[] {
  const fields = Array.isArray(where) && where.length === count ? where.map((entry) => (isJsonRecord(entry) ? entry.field : undefined)) : [];
  return Array.from({ length: count }, (_, index) => {
    const field = fields[index];
    return isWebAutomationExtractFieldKey(field) ? field : `condition ${index + 1}`;
  });
}

/** A count with its noun, plural unless it is one. */
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
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
