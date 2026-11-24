import { readFile, realpath, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { JsonObject } from "fluxiq/core";
import { webOfflineReadAnsweredResult, webOfflineReadControlReproduced, webOfflineReadModelResult } from "@fluxiq-web-extension/domain/node";
import { loadCreatedFlowRequest } from "../../flow-lane/index.js";
import { resolveLabPaths } from "../../lab-instance/index.js";
import { loadExtensionContentCode, openWebSnapshotPage } from "../../offline-snapshot-page/index.js";
import { assertRealisticScenarios } from "../../realistic-scenarios/index.js";
import { compareRecordedReadBoundaries, readRecordedReadSource } from "../read-parity/index.js";
import { collectRecordedOracleAnswer, type RecordedOracleRead } from "./collect.js";
import { recordedOracleTaskProcess } from "./declarations.js";
import { declarationInRunTerms } from "./model-aliases.js";
import { discoverRecordedOracleRead } from "./discover.js";
import { judgeRecordedOracleTable } from "./oracle-table.js";
import { runRetainedRecordedRead } from "./retained-read.js";

type Input = { provenance: unknown; scenarioId: unknown; taskId: unknown; runDir: unknown; sourceRootDir: unknown; projectId: unknown; steps: unknown };

/**
 * P1-P3 acceptance over a campaign run's own recorded reads (t990), with no provider: each named read step admitted by
 * the recorded-read checks and its recorded command reproduced as the control; the same recorded page read again by
 * today's production reader from the model's own call, every safe field retained; the answers stored and joined by
 * Core's own row sink and result feed, whose data stage applies the task's processing declaration; and the answer
 * judged by the task's oracle. Reports hold counts, codes, field names and digests, never a recorded value.
 */
export async function runRecordedOracleCommand(input: { repositoryRoot: string; scenarioId: string; taskId: string; inputFile: string; outputFile: string }) {
  assertRealisticScenarios([input.scenarioId], "Recorded oracle");
  const runRoot = path.join(input.repositoryRoot, "test-runs");
  for (const file of [input.inputFile, input.outputFile]) {
    const relative = path.relative(runRoot, path.resolve(file));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_oracle_run_scope_required");
  }
  if (path.resolve(input.inputFile) === path.resolve(input.outputFile)) throw new Error("recorded_oracle_input_must_be_preserved");
  await mkdir(path.dirname(input.outputFile), { recursive: true });
  const [allowed, actualParent] = await Promise.all([realpath(runRoot), realpath(path.dirname(input.outputFile))]);
  const parentRelative = path.relative(allowed, actualParent);
  if (parentRelative.startsWith("..") || path.isAbsolute(parentRelative)) throw new Error("recorded_oracle_output_symlink_refused");
  let phase = "input";
  const reads: Record<string, unknown>[] = [];
  let outcome: Record<string, unknown> = {};
  let page: ReturnType<typeof openWebSnapshotPage> | undefined;
  let leaked = 0;
  try {
    const configuration = JSON.parse(await readFile(input.inputFile, "utf8")) as Input;
    if (configuration.provenance !== "synthetic-fixture" || configuration.scenarioId !== input.scenarioId || configuration.taskId !== input.taskId) throw new Error("recorded_oracle_fixture_provenance_required");
    const { runDir, sourceRootDir, projectId, steps } = configuration;
    if (typeof runDir !== "string" || typeof sourceRootDir !== "string" || typeof projectId !== "string" || !Array.isArray(steps) || !steps.length || !steps.every((step) => typeof step === "string")) throw new Error("recorded_oracle_input_invalid");
    const run = path.resolve(input.repositoryRoot, runDir);
    const root = path.resolve(input.repositoryRoot, sourceRootDir);
    phase = "task";
    const paths = resolveLabPaths(input.repositoryRoot);
    const task = await loadCreatedFlowRequest({ repositoryRoot: input.repositoryRoot, scenarioLabDist: paths.scenarioLabDist, scenarioId: input.scenarioId, taskId: input.taskId });
    const process = recordedOracleTaskProcess(input.taskId);
    const entry = JSON.parse(await readFile(path.join(run, "entry.json"), "utf8")) as Record<string, unknown>;
    const referenceTimeMs = typeof entry.startedAt === "string" ? Date.parse(entry.startedAt) : Number.NaN;
    if (!Number.isSafeInteger(referenceTimeMs) || typeof entry.runId !== "string") throw new Error("recorded_oracle_run_entry_unreadable");
    phase = "content_code";
    const content = await loadExtensionContentCode({ extensionDir: path.join(input.repositoryRoot, "apps", "extension") });
    // Lab browsers are visible (user rule); the sandbox still disables page scripts and network.
    page = openWebSnapshotPage({ content, channel: "chrome", headless: false });
    const answers: RecordedOracleRead[] = [];
    let origin: string | undefined;
    for (const step of steps as string[]) {
      phase = `read_${step}`;
      const identity = await discoverRecordedOracleRead({ runDir: run, sourceRootDir: root, projectId, step });
      const source = await readRecordedReadSource({ repositoryRoot: input.repositoryRoot, scenarioId: input.scenarioId, taskId: input.taskId, sourceRootDir: root, projectId, ...identity });
      origin ??= new URL(source.snapshot.url).origin;
      const control = await page.evaluate(source.snapshot, source.action);
      if (control.status === "unavailable") {
        reads.push({ step, callId: identity.callId, admitted: false, gap: control.reason });
        continue;
      }
      leaked += control.observations.requestsLeaked;
      const answered = webOfflineReadAnsweredResult(control.result, source.recordedResult);
      const nativeResultMatches = webOfflineReadControlReproduced(answered, source.recordedResult);
      const parity = compareRecordedReadBoundaries({ actualPayload: answered.payload, originalPayload: source.recordedResult.payload, canonicalRead: source.canonicalRead, parameters: source.projectionParameters, recordedUrl: source.snapshot.url, ...(source.currentDerivedSchema === undefined ? {} : { currentDerivedSchema: source.currentDerivedSchema }) });
      const retained = await runRetainedRecordedRead({ page, snapshot: source.snapshot, scope: { projectId, flowId: identity.flowId }, call: { callId: identity.callId, value: identity.callValue }, control: { action: source.action, result: control.result, observations: control.observations }, recordedResult: source.recordedResult });
      leaked += retained.observations.requestsLeaked;
      const shown = rowsOf(retained.execution);
      const canonical = Array.isArray(source.expectedRows) ? source.expectedRows as JsonObject[] : [];
      const requestedCellsUnchanged = sameCells(shown, canonical);
      // A saved Flow's pass showed only each kept row's label: the reproduced rows' labels and page address stand for
      // the model-visible comparison, and raw native equality is required exactly as for an explored read.
      const replayed = identity.canonicalKind === "replayed";
      const labelsMatch = replayed ? sameCells(rowsOf({ evidence: { read: webOfflineReadModelResult(answered.payload, source.projectionParameters) ?? null } }), canonical) : null;
      const addressMatches = answered.payload?.url === record(source.recordedResult.payload)?.url && record(source.recordedResult.payload)?.url === source.snapshot.url;
      const controlPassed = nativeResultMatches && parity.rawNativeRowsMatch && (replayed ? labelsMatch === true && addressMatches : parity.modelProjectedRowsMatch && parity.projectionContextMatches === true);
      const admitted = controlPassed && retained.execution !== null && retained.itemMatches === true && retained.dynamicContent === false;
      reads.push({
        step, callId: identity.callId, traceId: identity.traceId, commandSequence: identity.commandSequence, resultSequence: identity.resultSequence,
        primarySha256: identity.primarySha256, canonicalResultSha256: identity.canonicalResultSha256, place: placeOf(retained.execution),
        canonicalKind: identity.canonicalKind,
        control: { passed: controlPassed, nativeResultMatches, ...(replayed ? { canonicalLabelsMatch: labelsMatch, addressMatches } : {}), rawNativeRowsMatch: parity.rawNativeRowsMatch, modelProjectedRowsMatch: parity.modelProjectedRowsMatch, projectionContextMatches: parity.projectionContextMatches, rows: parity.rawComparison.expectedRecords, sandbox: control.observations },
        retained: { detection: retained.detection, namedKeys: retained.namedKeys, itemMatches: retained.itemMatches, dynamicContent: retained.dynamicContent, resultCode: retained.execution?.resultCode ?? null, rows: shown?.length ?? null, shownFields: shown?.[0] === undefined ? [] : Object.keys(shown[0]), requestedCellsUnchanged, schemaFields: schemaFieldsOf(retained.execution), commands: retained.commands, sandbox: retained.observations },
        admitted,
      });
      if (admitted) answers.push({ callId: identity.callId, value: identity.callValue, execution: retained.execution! });
    }
    phase = "data_stage";
    const declared = declarationInRunTerms(process, answers.map((answer) => answer.value));
    const collected = await collectRecordedOracleAnswer({ instructionText: task.task.instruction, process: declared.process, referenceTimeMs, reads: answers });
    const columns = collected.answer.columns.map((column) => column.id);
    phase = "oracle";
    const table = await judgeRecordedOracleTable({ repositoryRoot: input.repositoryRoot, scenarioLabDist: paths.scenarioLabDist, scenarioId: input.scenarioId, taskId: input.taskId, scenarioOrigin: origin ?? "http://127.0.0.1", runId: entry.runId, columns, rows: collected.answer.rows, collected: collected.collected?.rows ?? [] });
    phase = "done";
    outcome = {
      runId: entry.runId, referenceTimeMs, declaration: process, declarationRewritten: declared.rewritten, admittedReads: answers.length, namedReads: steps.length,
      dataStage: { readiness: collected.readiness, stored: collected.stored, collectedRows: collected.collected?.rows.length ?? 0, collectedSchemaFields: collected.collected?.schema.fields.map((field) => ({ id: field.id, ...(field.semanticType ? { semanticType: field.semanticType } : {}), ...(field.mark ? { mark: field.mark } : {}) })) ?? [], bound: collected.bound, account: accountCounts(collected.processing), answerColumns: columns, answerRows: collected.answer.rows.length },
      oracle: table,
      passed: table.verdict.passed && answers.length === steps.length,
    };
  } catch (error) {
    outcome = { passed: false, gap: error instanceof Error && /^recorded_(oracle|read)_[a-z0-9_]+$/u.test(error.message) ? error.message : "recorded_oracle_unavailable", ...(error instanceof Error && !/^recorded_(oracle|read)_/u.test(error.message) ? { errorName: error.name } : {}) };
  } finally { await page?.close(); }
  const report = { proof: "recorded_reads_oracle_table", scenarioId: input.scenarioId, taskId: input.taskId, phase, fullAttemptAccepted: false, wholeTraceAdmitted: false, modelCalls: 0, providerCalls: 0, providerUsd: 0, externalCalls: page === undefined ? null : leaked, reads, ...outcome, passed: outcome.passed === true, gap: typeof outcome.gap === "string" ? outcome.gap : null };
  await writeFile(input.outputFile, JSON.stringify(report, null, 2), { flag: "wx" });
  return report;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** Every canonical row's cells equal the same row's cells shown now, in order and count; extra shown cells aside. */
function sameCells(shown: readonly JsonObject[] | undefined, canonical: readonly JsonObject[]): boolean {
  return shown !== undefined && shown.length === canonical.length && canonical.every((row, index) => Object.keys(row).every((key) => isDeepStrictEqual(shown[index]![key], row[key])));
}

/** The rows a node run's answer holds where Core's row sink finds them. */
function rowsOf(execution: JsonObject | null): JsonObject[] | undefined {
  // A replayed step's rows are its `outputs.records`, which is where Core's row sink finds them too.
  const rows = record(record(execution?.evidence)?.read)?.extracted ?? record(execution?.outputs)?.records;
  return Array.isArray(rows) ? rows as JsonObject[] : undefined;
}

function placeOf(execution: JsonObject | null): string | null {
  const place = record(record(execution?.evidence)?.read)?.place;
  return typeof place === "string" ? place : null;
}

function schemaFieldsOf(execution: JsonObject | null): string[] {
  const fields = record(execution?.recordSchema)?.fields;
  return Array.isArray(fields) ? fields.flatMap((field) => typeof record(field)?.id === "string" ? [record(field)!.id as string] : []) : [];
}

/** The data stage's account in counts and its own condition words; the rows a filter left out are never named here. */
function accountCounts(processing: unknown): unknown {
  const value = record(processing);
  if (!value) return null;
  const filters = Array.isArray(value.filters) ? value.filters.map((filter) => {
    const entry = record(filter);
    return { condition: entry?.condition ?? null, leftOut: entry?.leftOut ?? null, leftOutOnlyByThis: Array.isArray(entry?.leftOutOnlyByThis) ? entry.leftOutOnlyByThis.length : null };
  }) : [];
  return { collected: value.collected ?? null, leftOut: value.leftOut ?? null, repeats: value.repeats ?? null, cut: value.cut ?? null, kept: value.kept ?? null, filters };
}
