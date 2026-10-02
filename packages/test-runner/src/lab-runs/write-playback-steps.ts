// A created Flow's playback, written into the run's `steps/` beside the build's.
//
// Core's step log (`FLUXIQ_LLM_STEP_LOG_DIR`) records the build: every model
// exchange and tool call. The Flow's own run dispatches commands outside it, so
// those lived only in Core's command attempts under the run's `.fluxiq`, which an
// isolated run deletes, and a failed playback could not be read step by step
// (run-muqiho5c-e830ce01: twelve commands, none in `steps/`). After the run each
// attempt dispatched in the playback's window becomes one `NNNN-run-<actionType>`
// folder holding `call.json`, `result.json`, `page.txt` when the failure carried
// a page view, and `meta.json` last, numbered after Core's own steps.
//
// A step the run skipped -- a sometimes-present popup or banner observed absent
// -- is the page's state, not a failure, so it is written as `skipped`: the host
// attempt that observed the absence becomes a skipped row, and a skip that
// dispatched nothing (its ready state was judged not shown) becomes its own
// `NNNN-run-skipped` folder, so every runtime step is listed.
//
// What is copied is bounded: the command's parameters, the outcome's status,
// failure record and validation, never the page snapshot the result carries.
// A typed value the extension marked redacted is not copied; every declared
// redaction literal and every credential shape Core's step log screens for is
// replaced in every file.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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
   * sometimes-present step whose target was observed absent. Epoch ms, Core's
   * clock, the same one `dispatchedAt` is stamped with. Absent, every attempt
   * is written as the host reported it.
   */
  skippedSteps?: readonly PlaybackSkippedStep[];
}>;

/** One attempt the run skipped rather than ran, as the run detail records it. */
export type PlaybackSkippedStep = Readonly<{ nodeId: string | null; startedAt: number; finishedAt: number; reason: string; code: string }>;

/** The step numbers written, in order, and how many attempts' files had anything replaced. */
export type PlaybackStepsWritten = Readonly<{ steps: readonly number[]; redacted: number }>;

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
  const entries = playbackEntries(attempts, (input.skippedSteps ?? []).filter(skip => skip.startedAt >= input.since && skip.startedAt <= input.until));
  if (entries.length === 0) return { steps: [], redacted: 0 };
  await mkdir(input.stepsDirectory, { recursive: true });
  let next = await highestStep(input.stepsDirectory);
  const steps: number[] = [];
  let redacted = 0;
  for (const entry of entries) {
    next += 1;
    const files = entry.attempt ? playbackStepFiles(entry.attempt, next, entry.skip) : undispatchedSkipFiles(entry.skip!, next);
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
  return { steps, redacted };
}

type Entry = { at: number; attempt?: Json; skip?: PlaybackSkippedStep };

/**
 * The playback's steps in time order: each host attempt, with the skip it
 * observed when there is one, and each skip that dispatched nothing. A skip
 * claims the first unclaimed attempt that did not succeed, was dispatched
 * inside the skipped attempt's own span, and failed with the code the skip
 * names -- the attempt the run's skip was decided on.
 */
function playbackEntries(attempts: readonly Json[], skips: readonly PlaybackSkippedStep[]): Entry[] {
  const entries: Entry[] = attempts.map(attempt => ({ at: attempt.dispatchedAt as number, attempt }));
  entries.sort((a, b) => a.at - b.at);
  for (const skip of skips) {
    const claimed = entries.find(entry => entry.attempt && !entry.skip && entry.attempt.status !== "succeeded"
      && entry.at >= skip.startedAt && entry.at <= skip.finishedAt
      && text(record(record(entry.attempt.result)?.failure)?.code) === skip.code);
    if (claimed) claimed.skip = skip;
    else entries.push({ at: skip.startedAt, skip });
  }
  return entries.sort((a, b) => a.at - b.at);
}

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
    },
    page: text(record(record(result.metadata)?.failureEvidence)?.page),
    meta: {
      step, kind: "run", callId: attempt.attemptId, toolId: actionType,
      startedAt: startedAt === undefined ? null : new Date(startedAt).toISOString(),
      finishedAt: finishedAt === undefined ? null : new Date(finishedAt).toISOString(),
      ms: startedAt !== undefined && finishedAt !== undefined ? finishedAt - startedAt : null,
      ...(skipped
        ? { phase: "playback", status: "skipped", resultCode: code, failureCode: null, message, skipped, summary: skipSummary(skipped) }
        : { phase: "playback", status: failed ? "failed" : "ok", resultCode: code, failureCode: code, message, summary: failed ? `${code ?? "failed"}: ${message ?? "no message"}` : (message ?? "succeeded") }),
    },
  };
}

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

const skipMark = (skip: PlaybackSkippedStep) => ({ reason: skip.reason, code: skip.code, nodeId: skip.nodeId });
const skipSummary = (skipped: ReturnType<typeof skipMark>) => `skipped (${skipped.reason}, ${skipped.code}): a sometimes-present step not on the page${skipped.nodeId ? ` at ${skipped.nodeId}` : ""}`;

function screen(content: string, literals: readonly string[]): string {
  let screened = content.replace(CREDENTIAL_SHAPES, REDACTED);
  // Both spellings: as given, and as JSON escapes it inside a written string.
  for (const literal of literals) if (literal.length > 0) for (const form of new Set([literal, JSON.stringify(literal).slice(1, -1)])) screened = screened.replaceAll(form, REDACTED);
  return screened;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

async function highestStep(directory: string): Promise<number> {
  let highest = 0;
  for (const entry of await readdir(directory)) {
    const number = STEP_FOLDER.exec(entry)?.[1];
    if (number !== undefined) highest = Math.max(highest, Number(number));
  }
  return highest;
}
