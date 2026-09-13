import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseRunManifestJson, type RunManifest } from "@fluxiq-web-extension/test-contracts";
import { describeError } from "./describe-error.js";

/**
 * The cause a failed run recorded for itself: the summary of its last `error`
 * evidence event, with the test-rig category the runner attached to it.
 *
 * `runScenario` catches the error that ends a run, writes it to
 * `events.ndjson` as an `error` event, and then returns only a verdict and a
 * category -- the message is not on `RunScenarioResult`. So until this was
 * read here, a bench in which every run died on the same one-line error
 * published `failureCategory: unknown` and an empty Problems column, and the
 * message survived only in each run's event log.
 */
export type RecordedRunFailure = { message: string; category: string | undefined };

/**
 * What the bench reads from a finalized run bundle: `run.json`, the metrics
 * in `summary.json`, the sequences of the run's `final` and last `error`
 * evidence events, and the cause that last `error` event recorded. A missing
 * or invalid file leaves its part empty and adds a problem; reading never
 * throws for one.
 *
 * `problems` and `recordedFailure` are different things and stay apart:
 * a problem is a bundle file the bench could not read or verify, while
 * `recordedFailure` is what the run itself says went wrong.
 */
export type RunBundleReading = {
  manifest: RunManifest | undefined;
  metrics: Record<string, number>;
  finalSequence: number | undefined;
  errorSequence: number | undefined;
  recordedFailure: RecordedRunFailure | undefined;
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
  const closing = closingEvents(await read("events.ndjson"), problems);
  return { manifest, metrics, ...closing, problems };
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

/**
 * The `final` and last `error` events that close a run, and the cause the
 * `error` one carries. The category comes from the event's own
 * `details.failureCategory`, which is what `runScenario` wrote there, and is
 * reported as recorded rather than re-derived.
 */
function closingEvents(text: string | undefined, problems: string[]): Pick<RunBundleReading, "finalSequence" | "errorSequence" | "recordedFailure"> {
  let finalSequence: number | undefined;
  let errorSequence: number | undefined;
  let recordedFailure: RecordedRunFailure | undefined;
  for (const [index, line] of (text ?? "").split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      const event: unknown = JSON.parse(line);
      if (!isRecord(event) || typeof event.sequence !== "number" || !Number.isSafeInteger(event.sequence) || event.sequence < 0) continue;
      if (event.trigger === "final") finalSequence = event.sequence;
      else if (event.trigger === "error") {
        errorSequence = event.sequence;
        const message = typeof event.summary === "string" ? describeError(event.summary) : "";
        if (message !== "") recordedFailure = { message, category: recordedCategory(event.details) };
      }
    } catch (error) {
      problems.push(`events.ndjson line ${index + 1}: ${describeError(error)}`);
    }
  }
  return { finalSequence, errorSequence, recordedFailure };
}

const recordedCategory = (details: unknown): string | undefined =>
  isRecord(details) && typeof details.failureCategory === "string" && details.failureCategory !== "" ? details.failureCategory : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
