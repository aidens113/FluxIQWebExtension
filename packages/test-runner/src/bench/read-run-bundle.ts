import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseRunManifestJson, type RunManifest } from "@fluxiq-web-extension/test-contracts";
import { describeError } from "./describe-error.js";

/**
 * What the bench reads from a finalized run bundle: `run.json`, the metrics
 * in `summary.json`, and the sequences of the run's `final` and last `error`
 * evidence events. A missing or invalid file leaves its part empty and adds
 * a problem; reading never throws for one.
 */
export type RunBundleReading = {
  manifest: RunManifest | undefined;
  metrics: Record<string, number>;
  finalSequence: number | undefined;
  errorSequence: number | undefined;
  problems: string[];
};

export async function readRunBundle(runPath: string): Promise<RunBundleReading> {
  const problems: string[] = [];
  const read = (name: string): Promise<string | undefined> => readFile(path.join(runPath, name), "utf8").catch((error: unknown) => { problems.push(`${name}: ${describeError(error)}`); return undefined; });
  const manifestText = await read("run.json");
  let manifest: RunManifest | undefined;
  if (manifestText !== undefined) {
    try { manifest = parseRunManifestJson(manifestText); } catch (error) { problems.push(`run.json: ${describeError(error)}`); }
  }
  const metrics = summaryMetrics(await read("summary.json"), problems);
  const sequences = closingSequences(await read("events.ndjson"), problems);
  return { manifest, metrics, ...sequences, problems };
}

function summaryMetrics(text: string | undefined, problems: string[]): Record<string, number> {
  if (text === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    const metrics = isRecord(parsed) && isRecord(parsed.metrics) ? parsed.metrics : {};
    return Object.fromEntries(Object.entries(metrics).filter((entry): entry is [string, number] => entry[0] !== "" && typeof entry[1] === "number" && Number.isFinite(entry[1])));
  } catch (error) {
    problems.push(`summary.json: ${describeError(error)}`);
    return {};
  }
}

function closingSequences(text: string | undefined, problems: string[]): { finalSequence: number | undefined; errorSequence: number | undefined } {
  let finalSequence: number | undefined;
  let errorSequence: number | undefined;
  for (const [index, line] of (text ?? "").split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      const event: unknown = JSON.parse(line);
      if (!isRecord(event) || typeof event.sequence !== "number" || !Number.isSafeInteger(event.sequence) || event.sequence < 0) continue;
      if (event.trigger === "final") finalSequence = event.sequence;
      else if (event.trigger === "error") errorSequence = event.sequence;
    } catch (error) {
      problems.push(`events.ndjson line ${index + 1}: ${describeError(error)}`);
    }
  }
  return { finalSequence, errorSequence };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
