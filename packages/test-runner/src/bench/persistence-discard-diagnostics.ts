import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BenchRunRecord, BenchRunsFile } from "./report-store.js";

export type PersistenceDiscardDiagnostics = { persistenceFailures: number; runsInspected: number; actionDiscardEntries: number; eventDiscardEntries: number; maxDiscardedActions: number; maxDiscardedEvents: number; entriesNamingRecording: number; entriesAfterFinalization: number; excludedByWindow: number; unreadableEventFiles: number };
const EMPTY = (): PersistenceDiscardDiagnostics => ({ persistenceFailures: 0, runsInspected: 0, actionDiscardEntries: 0, eventDiscardEntries: 0, maxDiscardedActions: 0, maxDiscardedEvents: 0, entriesNamingRecording: 0, entriesAfterFinalization: 0, excludedByWindow: 0, unreadableEventFiles: 0 });
const safeRunId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._-]{1,160}$/u.test(value);
const count = (value: unknown): number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

/** Reads only count-bearing discard fields; messages, payloads, page data and recording ids are ignored. */
export async function readPersistenceDiscardDiagnostics(benchDirectory: string, runsDirectory: string): Promise<PersistenceDiscardDiagnostics> {
  const output = EMPTY();
  const parsed = JSON.parse(await readFile(path.join(benchDirectory, "runs.json"), "utf8")) as Partial<BenchRunsFile>;
  const failures = Array.isArray(parsed.runs) ? parsed.runs.filter(run => run.status === "evaluated" && run.failureCategory === "recording.persistence") : [];
  output.persistenceFailures = failures.length;
  for (const run of failures) await readRun(run, runsDirectory, output);
  return output;
}

async function readRun(run: BenchRunRecord, runsDirectory: string, output: PersistenceDiscardDiagnostics): Promise<void> {
  if (!safeRunId(run.runId)) { output.unreadableEventFiles += 1; return; }
  const root = path.resolve(runsDirectory); const file = path.resolve(root, run.runId, "events.ndjson");
  if (!file.startsWith(root + path.sep)) { output.unreadableEventFiles += 1; return; }
  const text = await readFile(file, "utf8").catch(() => undefined);
  if (text === undefined) { output.unreadableEventFiles += 1; return; }
  output.runsInspected += 1;
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    let value: unknown; try { value = JSON.parse(line); } catch { continue; }
    const details = (value as { details?: unknown } | null)?.details;
    if (!details || typeof details !== "object") continue;
    const record = details as Record<string, unknown>;
    for (const item of Array.isArray(record.recordingDiscards) ? record.recordingDiscards : []) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const key = typeof entry.entryId === "string" && entry.entryId ? entry.entryId : JSON.stringify([entry.type, entry.recordingId, count(entry.discardedActions), count(entry.discardedEvents), entry.sinceFinalizedMs]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (entry.type === "recording.action_discarded") output.actionDiscardEntries += 1;
      if (entry.type === "recording.event_discarded") output.eventDiscardEntries += 1;
      output.maxDiscardedActions = Math.max(output.maxDiscardedActions, count(entry.discardedActions)); output.maxDiscardedEvents = Math.max(output.maxDiscardedEvents, count(entry.discardedEvents));
      if (typeof entry.recordingId === "string" && entry.recordingId.length > 0) output.entriesNamingRecording += 1;
      if (typeof entry.sinceFinalizedMs === "number" && Number.isFinite(entry.sinceFinalizedMs)) output.entriesAfterFinalization += 1;
    }
    const excluded = (record.recordingDiscardWindow as { excluded?: unknown } | null)?.excluded;
    if (excluded && typeof excluded === "object") output.excludedByWindow = Math.max(output.excludedByWindow, sumCounts(excluded));
  }
}

function sumCounts(value: unknown): number { if (typeof value === "number") return count(value); if (!value || typeof value !== "object") return 0; return Object.values(value as Record<string, unknown>).reduce<number>((sum, item) => sum + sumCounts(item), 0); }
