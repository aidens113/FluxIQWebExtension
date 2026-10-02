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
}>;

/** The step numbers written, in order, and how many attempts' files had anything replaced. */
export type PlaybackStepsWritten = Readonly<{ steps: readonly number[]; redacted: number }>;

const REDACTED = "[redacted]";
/** The credential shapes Core's step log screens for (`!FluxIQ` `runtime/llm/step-log/screen.ts`), kept in step with it. */
const CREDENTIAL_SHAPES = /(?<![A-Za-z0-9_-])sk-(?:[A-Za-z0-9]+-)*[A-Za-z0-9]{20,}(?![A-Za-z0-9])|\b[Bb]earer\s+[A-Za-z0-9._~+/=-]{20,}/gu;
const STEP_FOLDER = /^(\d{4,})-/u;

type Json = Record<string, unknown>;
const record = (value: unknown): Json | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Json : undefined;
const text = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;

/** Writes each playback attempt as a step folder, then rewrites `index.md`. Throws on a disk that refuses; the caller reports it. */
export async function writePlaybackSteps(input: PlaybackStepsInput): Promise<PlaybackStepsWritten> {
  if (!await pathExists(input.attemptsDirectory)) return { steps: [], redacted: 0 };
  const attempts: Json[] = [];
  for (const entry of await readdir(input.attemptsDirectory, { withFileTypes: true })) {
    const file = path.join(input.attemptsDirectory, entry.name, "attempt.json");
    if (!entry.isDirectory() || !await pathExists(file)) continue;
    const attempt = record(record(JSON.parse(await readFile(file, "utf8")))?.attempt);
    const at = attempt?.dispatchedAt;
    if (attempt && typeof at === "number" && at >= input.since && at <= input.until) attempts.push(attempt);
  }
  attempts.sort((a, b) => (a.dispatchedAt as number) - (b.dispatchedAt as number));
  await mkdir(input.stepsDirectory, { recursive: true });
  let next = await highestStep(input.stepsDirectory);
  const steps: number[] = [];
  let redacted = 0;
  for (const attempt of attempts) {
    next += 1;
    const files = playbackStepFiles(attempt, next);
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
  if (steps.length > 0) await rewriteStepsIndex(input.stepsDirectory);
  return { steps, redacted };
}

/** One attempt's files, before screening. */
function playbackStepFiles(attempt: Json, step: number) {
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
  return {
    segment: actionType.replace(/[^A-Za-z0-9._-]/gu, "_").slice(0, 120),
    valueWithheld,
    call: { attemptId: attempt.attemptId, commandId: attempt.commandId, actionType, outputId: command.outputId, parameters: valueWithheld && "text" in parameters ? { ...parameters, text: REDACTED } : parameters },
    result: {
      status: attempt.status, message,
      failure: failure ? { category: failure.category, code, retryable: failure.retryable, stage: failure.stage, expected: failure.expected, actual: failure.actual, effect: failure.effect } : null,
      validation: validation ? { status: validation.status, ...(valueWithheld ? { redacted: true } : { expected: validation.expected, actual: validation.actual }) } : null,
      url: outcome?.url ?? null, title: outcome?.title ?? null,
    },
    page: text(record(record(result.metadata)?.failureEvidence)?.page),
    meta: {
      step, kind: "run", callId: attempt.attemptId, toolId: actionType,
      startedAt: startedAt === undefined ? null : new Date(startedAt).toISOString(),
      finishedAt: finishedAt === undefined ? null : new Date(finishedAt).toISOString(),
      ms: startedAt !== undefined && finishedAt !== undefined ? finishedAt - startedAt : null,
      phase: "playback", status: failed ? "failed" : "ok", resultCode: code, failureCode: code, message,
      summary: failed ? `${code ?? "failed"}: ${message ?? "no message"}` : (message ?? "succeeded"),
    },
  };
}

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
