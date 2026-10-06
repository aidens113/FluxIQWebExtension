// A created Flow's playback, written into the run's `steps/` beside the build's.
//
// Core's step log (`FLUXIQ_LLM_STEP_LOG_DIR`) records the build: every model
// exchange and tool call. The Flow's own run dispatches commands outside it, so
// those lived only in Core's command attempts under the run's `.fluxiq`, which an
// isolated run deletes, and a failed playback could not be read step by step
// (run-muqiho5c-e830ce01: twelve commands, none in `steps/`). After the run each
// attempt dispatched in the playback's window becomes one `NNNN-run-<actionType>`
// folder holding `call.json`, `result.json`, `page.txt` when the failure carried
// a page view, and `meta.json` last, numbered at its own time among Core's
// steps: a Core step that started after a playback step (the post-run check of
// its result) moves after it, folder and `meta.json` `step` both, so the folders
// read in time order (run-musp8nz1-dbd3905a: the check 0048 at 18:07:03 came
// before the playback 0049-0061 it checked, 18:06:34-18:07:01).
//
// A step the run skipped -- a sometimes-present popup or banner observed absent
// -- is the page's state, not a failure, so it is written as `skipped`: the host
// attempt that observed the absence becomes a skipped row, and a skip that
// dispatched nothing (its ready state was judged not shown) becomes its own
// `NNNN-run-skipped` folder, so every runtime step is listed. A step passed
// over because the page was elsewhere, the run routing to the node matching the
// page (Core t243, `state_routed`), is written the same way and says where the
// run went and which way: "routed to <node> (forward)". That is how a debug sees
// the runtime consulted the page rather than failed the step.
//
// Every step the runtime consulted the page for also says what it made of it
// (Core t250, the run detail's `stateRouting`): "the runtime consulted state:
// no_match" on a step that found no way on and failed, `effect_holds` or
// `routed` on one passed over, `guard_stopped` on one that would have looped.
// A consultation is matched to the skip of the same attempt, else to the host
// attempt dispatched inside its span, else written as its own
// `NNNN-run-state-consulted` folder (a gate that stopped before any dispatch).
//
// A list read (`web.dom.extract_list`) also says what it read: its summary's
// counts -- records, pages, items seen, empty records, whether a cap cut it,
// why paging stopped, what its conditions kept -- and how many rows it
// returned, as `result.read` and in the summary. Run `run-musp39u8-9ac026ab`'s
// read wrote `validation: null` and nothing else, so its counts were only in
// `flow-lane.json`. Counts and closed words only: no row, field value or field
// name is copied.
//
// What is copied is bounded: the command's parameters, the outcome's status,
// failure record and validation, never the page snapshot the result carries.
// A typed value the extension marked redacted is not copied; every declared
// redaction literal and every credential shape Core's step log screens for is
// replaced in every file.

import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { RUN_EXTRACTION_PAGINATION_STOP } from "@fluxiq-web-extension/test-contracts";
import { pathExists } from "./path-exists.js";
import { rewriteStepsIndex } from "./rewrite-steps-index.js";

export type PlaybackStepsInput = Readonly<{
  /** Core's `<.fluxiq>/artifacts/runtime/command-attempts`. */
  attemptsDirectory: string;
  /** The run's `lab-runs/<date>/<runId>/steps`. */
  stepsDirectory: string;
  /** The playback's window, epoch ms: an attempt dispatched outside it (a build's, a later replay's) is not this playback's. */
  since: number;
  until: number;
  /** The run's declared literals (`resolve-run-secrets.ts`): never written. */
  redactionLiterals: readonly string[];
  /**
   * The run's skipped steps, from the run detail's action attempts that carry
   * Core's `skipped` mark (`!FluxIQ` `executor/step-skip/absent-step.ts`): a
   * sometimes-present step whose target was observed absent, or a step the run
   * passed over by page state (`executor/state-routing/routed-attempt.ts`). Epoch ms, Core's
   * clock, the same one `dispatchedAt` is stamped with. Absent, every attempt
   * is written as the host reported it.
   */
  skippedSteps?: readonly PlaybackSkippedStep[];
  /**
   * The run's state routing consultations, from the run detail's action
   * attempts that carry Core's `stateRouting` (`flow-lane/state-routing-attempt.ts`):
   * routed steps and steps whose routing found no way on alike. Epoch ms, Core's clock.
   */
  stateRoutingSteps?: readonly PlaybackStateRoutingStep[];
}>;

/** One attempt whose step could not run, and what the runtime made of the page: closed words, a Core code and a node id. */
export type PlaybackStateRoutingStep = Readonly<{ nodeId: string | null; startedAt: number; finishedAt: number; outcome: string; code?: string; toNodeId?: string }>;

/** One attempt the run skipped rather than ran, as the run detail records it; a state-routed one also names where the run went, and which way. */
export type PlaybackSkippedStep = Readonly<{ nodeId: string | null; startedAt: number; finishedAt: number; reason: string; code: string; toNodeId?: string; direction?: "forward" | "backward" }>;

/** The step numbers written, in order; how many attempts' files had anything replaced; how many steps were skipped, and of those how many the run passed over by page state. */
export type PlaybackStepsWritten = Readonly<{ steps: readonly number[]; redacted: number; skipped: number; stateRouted: number }>;

const REDACTED = "[redacted]";
/** The credential shapes Core's step log screens for (`!FluxIQ` `runtime/llm/step-log/screen.ts`), kept in step with it. */
const CREDENTIAL_SHAPES = /(?<![A-Za-z0-9_-])sk-(?:[A-Za-z0-9]+-)*[A-Za-z0-9]{20,}(?![A-Za-z0-9])|\b[Bb]earer\s+[A-Za-z0-9._~+/=-]{20,}/gu;
const STEP_FOLDER = /^(\d{4,})-/u;

type Json = Record<string, unknown>;
type StepFiles = { segment: string; valueWithheld: boolean; call: Json; result: Json; page: string | undefined; meta: Json };
const record = (value: unknown): Json | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Json : undefined;
const text = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;

/** Writes each playback attempt as a step folder, then rewrites `index.md`. Throws on a disk that refuses; the caller reports it. */
export async function writePlaybackSteps(input: PlaybackStepsInput): Promise<PlaybackStepsWritten> {
  const attempts: Json[] = [];
  if (await pathExists(input.attemptsDirectory)) {
    for (const entry of await readdir(input.attemptsDirectory, { withFileTypes: true })) {
      const file = path.join(input.attemptsDirectory, entry.name, "attempt.json");
      if (!entry.isDirectory() || !await pathExists(file)) continue;
      const attempt = record(record(JSON.parse(await readFile(file, "utf8")))?.attempt);
      const at = attempt?.dispatchedAt;
      if (attempt && typeof at === "number" && at >= input.since && at <= input.until) attempts.push(attempt);
    }
  }
  const inWindow = (step: { startedAt: number }) => step.startedAt >= input.since && step.startedAt <= input.until;
  const entries = playbackEntries(attempts, (input.skippedSteps ?? []).filter(inWindow), (input.stateRoutingSteps ?? []).filter(inWindow));
  const skipped = entries.filter(entry => entry.skip).length;
  const stateRouted = entries.filter(entry => entry.skip?.reason === "state_routed").length;
  if (entries.length === 0) return { steps: [], redacted: 0, skipped, stateRouted };
  await mkdir(input.stepsDirectory, { recursive: true });
  const numbers = await numberInTimeOrder(input.stepsDirectory, entries);
  const steps: number[] = [];
  let redacted = 0;
  for (const [index, entry] of entries.entries()) {
    const next = numbers[index]!;
    const ran = entry.attempt ? playbackStepFiles(entry.attempt, next, entry.skip) : entry.skip ? undispatchedSkipFiles(entry.skip, next) : undispatchedRoutingFiles(entry.routing!, next);
    const files = entry.routing ? withStateRouting(ran, entry.routing) : ran;
    const folder = path.join(input.stepsDirectory, `${String(next).padStart(4, "0")}-run-${files.segment}`);
    await mkdir(folder);
    let screenedAny = false;
    const put = async (name: string, content: string) => {
      const screened = screen(content, input.redactionLiterals);
      screenedAny ||= screened !== content;
      await writeFile(path.join(folder, name), screened, "utf8");
    };
    await put("call.json", json(files.call));
    await put("result.json", json(files.result));
    if (files.page !== undefined) await put("page.txt", files.page);
    const meta = json(files.meta);
    screenedAny ||= screen(meta, input.redactionLiterals) !== meta;
    await put("meta.json", json({ ...files.meta, ...(screenedAny || files.valueWithheld ? { redacted: true } : {}) }));
    if (screenedAny) redacted += 1;
    steps.push(next);
  }
  await rewriteStepsIndex(input.stepsDirectory);
  return { steps, redacted, skipped, stateRouted };
}

type Entry = { at: number; attempt?: Json; skip?: PlaybackSkippedStep; routing?: PlaybackStateRoutingStep };

/**
 * The playback's steps in time order: each host attempt, with the skip it
 * observed when there is one, and each skip that dispatched nothing. A skip
 * claims the first unclaimed attempt that did not succeed, was dispatched
 * inside the skipped attempt's own span, and failed with the code the skip
 * names -- the attempt the run's skip was decided on. A state routing
 * consultation joins the skip of the same attempt (same node and span), else
 * the first host attempt dispatched inside its span that no skip or other
 * consultation holds -- and whose failure code is the consultation's, unless
 * the readiness gate asked, which is decided before the dispatch -- else it is
 * a step of its own.
 */
function playbackEntries(attempts: readonly Json[], skips: readonly PlaybackSkippedStep[], routings: readonly PlaybackStateRoutingStep[]): Entry[] {
  const entries: Entry[] = attempts.map(attempt => ({ at: attempt.dispatchedAt as number, attempt }));
  entries.sort((a, b) => a.at - b.at);
  for (const skip of skips) {
    const claimed = entries.find(entry => entry.attempt && !entry.skip && entry.attempt.status !== "succeeded"
      && entry.at >= skip.startedAt && entry.at <= skip.finishedAt
      && text(record(record(entry.attempt.result)?.failure)?.code) === skip.code);
    if (claimed) claimed.skip = skip;
    else entries.push({ at: skip.startedAt, skip });
  }
  for (const routing of routings) {
    const sameAttempt = entries.find(entry => entry.skip && !entry.routing && entry.skip.nodeId === routing.nodeId && entry.skip.startedAt === routing.startedAt && entry.skip.finishedAt === routing.finishedAt);
    const gateAsked = routing.code === READY_STATE_NOT_SHOWN;
    const claimed = sameAttempt ?? entries.find(entry => entry.attempt && !entry.skip && !entry.routing
      && entry.at >= routing.startedAt && entry.at <= routing.finishedAt
      && (gateAsked || routing.code === undefined || text(record(record(entry.attempt.result)?.failure)?.code) === routing.code));
    if (claimed) claimed.routing = routing;
    else entries.push({ at: routing.startedAt, routing });
  }
  return entries.sort((a, b) => a.at - b.at);
}

/** The code Core gives a step whose readiness gate did not hold: routing is asked before anything is dispatched. */
const READY_STATE_NOT_SHOWN = "executor.ready_state.not_shown";

/** One attempt's files, before screening. */
function playbackStepFiles(attempt: Json, step: number, skip: PlaybackSkippedStep | undefined): StepFiles {
  const command = record(attempt.command) ?? {};
  const result = record(attempt.result) ?? {};
  const outcome = record(record(result.payload)?.result);
  const failure = record(result.failure);
  const validation = record(outcome?.validation);
  const actionType = text(command.actionType) ?? text(command.outputId) ?? "unknown-action";
  // A value the extension's own validation marked redacted is a sensitive field's: the parameter that typed it is not copied.
  const valueWithheld = validation?.redacted === true;
  const parameters = record(command.parameters) ?? {};
  const failed = attempt.status !== "succeeded";
  const startedAt = typeof attempt.dispatchedAt === "number" ? attempt.dispatchedAt : undefined;
  const finishedAt = typeof attempt.settledAt === "number" ? attempt.settledAt : undefined;
  const message = text(result.message) ?? text(attempt.message) ?? null;
  const code = text(failure?.code) ?? null;
  const failureRecord = failure ? { category: failure.category, code, retryable: failure.retryable, stage: failure.stage, expected: failure.expected, actual: failure.actual, effect: failure.effect } : null;
  const skipped = skip ? skipMark(skip) : undefined;
  const read = listRead(outcome);
  const said = failed ? `${code ?? "failed"}: ${message ?? "no message"}` : (message ?? "succeeded");
  return {
    segment: actionType.replace(/[^A-Za-z0-9._-]/gu, "_").slice(0, 120),
    valueWithheld,
    call: { attemptId: attempt.attemptId, commandId: attempt.commandId, actionType, outputId: command.outputId, parameters: valueWithheld && "text" in parameters ? { ...parameters, text: REDACTED } : parameters },
    // A skipped step's host record is what observed the absence: kept, as `observed`, and never as the step's failure.
    result: {
      status: skipped ? "skipped" : attempt.status, message,
      ...(skipped ? { skipped, failure: null, observed: failureRecord } : { failure: failureRecord }),
      validation: validation ? { status: validation.status, ...(valueWithheld ? { redacted: true } : { expected: validation.expected, actual: validation.actual }) } : null,
      url: outcome?.url ?? null, title: outcome?.title ?? null,
      ...(read ? { read } : {}),
    },
    page: text(record(record(result.metadata)?.failureEvidence)?.page),
    meta: {
      step, kind: "run", callId: attempt.attemptId, toolId: actionType,
      startedAt: startedAt === undefined ? null : new Date(startedAt).toISOString(),
      finishedAt: finishedAt === undefined ? null : new Date(finishedAt).toISOString(),
      ms: startedAt !== undefined && finishedAt !== undefined ? finishedAt - startedAt : null,
      ...(skipped
        ? { phase: "playback", status: "skipped", resultCode: code, failureCode: null, message, skipped, summary: skipSummary(skipped) }
        : { phase: "playback", status: failed ? "failed" : "ok", resultCode: code, failureCode: code, message, summary: read ? `${said} ${readSummary(read)}` : said }),
    },
  };
}

/** What a list read said about itself: counts and closed words, never a row. */
type ListRead = { records: number; pages: number; itemsSeen: number | null; emptyRecords: number | null; truncated: boolean | null; stop: string | null; conditionsKept: number | null; rowsReturned: number | null };

const count = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const STOPS: readonly string[] = RUN_EXTRACTION_PAGINATION_STOP;

/**
 * The read's counts, from the action result's `extraction` summary beside its
 * `extracted` rows. Looked for at the two depths Core looks
 * (`service/summaries/extraction-summary.ts`): the client's payload as it is,
 * or wrapped by the domain's gateway dispatcher as `{ status, message, result }`.
 * A summary without its record and page counts is no read; a stop word this
 * package does not know is `unknown`, as the published contract has it.
 */
function listRead(outcome: Json | undefined): ListRead | undefined {
  const dispatched = record(outcome?.result) ?? outcome;
  const summary = record(dispatched?.extraction);
  const records = count(summary?.recordCount);
  const pages = count(summary?.pagesRead);
  if (!summary || records === null || pages === null) return undefined;
  const stop = typeof summary.paginationStop === "string" ? (STOPS.includes(summary.paginationStop) ? summary.paginationStop : "unknown") : null;
  return {
    records,
    pages,
    itemsSeen: count(summary.itemsSeen),
    emptyRecords: count(summary.emptyRecords),
    truncated: typeof summary.truncated === "boolean" ? summary.truncated : null,
    stop,
    conditionsKept: count(record(summary.conditions)?.kept),
    rowsReturned: Array.isArray(dispatched?.extracted) ? dispatched.extracted.length : null,
  };
}

const readSummary = (read: ListRead): string => {
  const detail = [read.itemsSeen === null ? undefined : `${read.itemsSeen} items seen`, read.stop === null ? undefined : `stopped on ${read.stop}`, read.truncated ? "cut short by a cap" : undefined].filter(Boolean).join(", ");
  return `${read.records} records over ${read.pages} pages${detail ? ` (${detail})` : ""}${read.rowsReturned === null ? "" : `; ${read.rowsReturned} rows returned`}`;
};

/** A skip with no host attempt: Core judged the step's ready state not shown and dispatched nothing. */
function undispatchedSkipFiles(skip: PlaybackSkippedStep, step: number): StepFiles {
  const skipped = skipMark(skip);
  const at = new Date(skip.startedAt).toISOString();
  return {
    segment: "skipped",
    valueWithheld: false,
    call: { nodeId: skip.nodeId, dispatched: false },
    result: { status: "skipped", skipped, failure: null },
    page: undefined,
    meta: {
      step, kind: "run", callId: null, toolId: "skipped", startedAt: at, finishedAt: new Date(skip.finishedAt).toISOString(), ms: skip.finishedAt - skip.startedAt,
      phase: "playback", status: "skipped", resultCode: skip.code, failureCode: null, message: null, skipped, summary: skipSummary(skipped),
    },
  };
}

/** A consultation with no host attempt and no skip: the step's readiness gate asked, and the run stopped before any dispatch. */
function undispatchedRoutingFiles(routing: PlaybackStateRoutingStep, step: number): StepFiles {
  const at = new Date(routing.startedAt).toISOString();
  const code = routing.code ?? null;
  return {
    segment: "state-consulted",
    valueWithheld: false,
    call: { nodeId: routing.nodeId, dispatched: false },
    result: { status: "failed", failure: null },
    page: undefined,
    meta: {
      step, kind: "run", callId: null, toolId: "state-consulted", startedAt: at, finishedAt: new Date(routing.finishedAt).toISOString(), ms: routing.finishedAt - routing.startedAt,
      phase: "playback", status: "failed", resultCode: code, failureCode: code, message: null, summary: `${code ?? "failed"}: nothing was dispatched${routing.nodeId ? ` at ${routing.nodeId}` : ""}`,
    },
  };
}

/** A step's files with what the runtime made of the page added to its result and meta, and said in its summary. */
function withStateRouting(files: StepFiles, routing: PlaybackStateRoutingStep): StepFiles {
  const stateRouting = { outcome: routing.outcome, ...(routing.code === undefined ? {} : { code: routing.code }), ...(routing.toNodeId === undefined ? {} : { toNodeId: routing.toNodeId }) };
  const said = `the runtime consulted state: ${routing.outcome}${routing.toNodeId ? ` (kept returning to ${routing.toNodeId})` : ""}`;
  const summary = text(files.meta.summary);
  return { ...files, result: { ...files.result, stateRouting }, meta: { ...files.meta, stateRouting, summary: summary ? `${summary}; ${said}` : said } };
}

/** The skip as a step file records it: a state-routed one with its destination and direction, a sometimes-present one without. */
const skipMark = (skip: PlaybackSkippedStep): SkipMark => skip.reason === "state_routed" && skip.toNodeId !== undefined && skip.direction !== undefined
  ? { reason: skip.reason, code: skip.code, nodeId: skip.nodeId, toNodeId: skip.toNodeId, direction: skip.direction }
  : { reason: skip.reason, code: skip.code, nodeId: skip.nodeId };
type SkipMark = { reason: string; code: string; nodeId: string | null; toNodeId?: string; direction?: "forward" | "backward" };
const skipSummary = (skipped: SkipMark) => skipped.toNodeId !== undefined
  ? `skipped (${skipped.reason}, ${skipped.code}): routed to ${skipped.toNodeId} (${skipped.direction}), the page already elsewhere${skipped.nodeId ? ` than ${skipped.nodeId}` : ""}`
  : `skipped (${skipped.reason}, ${skipped.code}): a sometimes-present step not on the page${skipped.nodeId ? ` at ${skipped.nodeId}` : ""}`;

function screen(content: string, literals: readonly string[]): string {
  let screened = content.replace(CREDENTIAL_SHAPES, REDACTED);
  // Both spellings: as given, and as JSON escapes it inside a written string.
  for (const literal of literals) if (literal.length > 0) for (const form of new Set([literal, JSON.stringify(literal).slice(1, -1)])) screened = screened.replaceAll(form, REDACTED);
  return screened;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/**
 * The number each entry is written at, its steps in time order among the
 * folders already there: each takes the place of the first existing folder
 * that started after it, and that folder and every one after it move up. A
 * folder whose meta gives no start time stays where it is. Core has stopped
 * when this runs, so nothing else is numbering the folders.
 */
async function numberInTimeOrder(directory: string, entries: readonly Entry[]): Promise<number[]> {
  const existing: { name: string; number: number; at: number | undefined }[] = [];
  for (const name of await readdir(directory)) {
    const number = STEP_FOLDER.exec(name)?.[1];
    if (number === undefined) continue;
    const started = text((await readJson(path.join(directory, name, "meta.json")))?.startedAt);
    const at = started === undefined ? undefined : Date.parse(started);
    existing.push({ name, number: Number(number), at: at !== undefined && Number.isFinite(at) ? at : undefined });
  }
  existing.sort((a, b) => a.number - b.number);
  const numbers: number[] = [];
  const moves: { name: string; from: number; to: number }[] = [];
  let current = 0;
  let next = 0;
  for (const folder of existing) {
    while (next < entries.length && folder.at !== undefined && entries[next]!.at < folder.at) numbers.push(current += 1), next += 1;
    const to = Math.max(folder.number, current + 1);
    if (to !== folder.number) moves.push({ name: folder.name, from: folder.number, to });
    current = to;
  }
  while (next < entries.length) numbers.push(current += 1), next += 1;
  // Highest first, so a folder never moves onto a number one still holds.
  for (const move of moves.reverse()) {
    const moved = `${String(move.to).padStart(4, "0")}${move.name.slice(move.name.indexOf("-"))}`;
    await rename(path.join(directory, move.name), path.join(directory, moved));
    const meta = await readJson(path.join(directory, moved, "meta.json"));
    if (meta && typeof meta.step === "number") await writeFile(path.join(directory, moved, "meta.json"), json({ ...meta, step: move.to }), "utf8");
  }
  return numbers;
}

async function readJson(file: string): Promise<Json | undefined> {
  try { return record(JSON.parse(await readFile(file, "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT" || error instanceof SyntaxError) return undefined; throw error; }
}
