import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseRunEvaluationJson, parseRunManifestJson, type RunEvaluation, type RunManifest } from "@fluxiq-web-extension/test-contracts";
import { parseBenchReceiptJson, type BenchReceipt } from "./bench-receipt.js";
import { describeError } from "./describe-error.js";

/**
 * The cause a failed run recorded for itself: the summary of the `error`
 * evidence event written under the runner's failure category, with the
 * test-rig category that event carries.
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
 * evidence events, and the cause the run recorded under its failure category.
 * A missing or invalid file leaves its part empty and adds a problem; reading
 * never throws for one.
 *
 * `problems` and `recordedFailure` are different things and stay apart:
 * a problem is a bundle file the bench could not read or verify, while
 * `recordedFailure` is what the run itself says went wrong.
 */
export type RunBundleReading = {
  manifest: RunManifest | undefined;
  evaluation: RunEvaluation | undefined;
  benchReceipt: BenchReceipt | undefined;
  metrics: Record<string, number>;
  finalSequence: number | undefined;
  errorSequence: number | undefined;
  recordedFailure: RecordedRunFailure | undefined;
  problems: string[];
};

/**
 * Reads the bundle at `runPath`. `failureCategory` is the category the runner
 * returned, and it chooses which `error` event is the run's cause: the last one
 * written under that category. A run can write several. Lab Stage 2's W18
 * Flow-lane run failed its extraction check, which set the category, and then
 * its redaction scan, which wrote the last event; the bench paired the first
 * failure's category with the second's message and hid the extraction failure.
 * The last matching event rather than the first, because `runScenario` replaces
 * its message when a later failure supersedes the first, and writes that
 * failure's event under the category it then returns. With no category, the
 * last `error` event is the cause.
 */
export async function readRunBundle(runPath: string, failureCategory?: string): Promise<RunBundleReading> {
  const problems: string[] = [];
  const read = (name: string): Promise<string | undefined> => readFile(path.join(runPath, name), "utf8").catch((error: unknown) => { problems.push(`${name}: ${describeError(error)}`); return undefined; });
  const readOptional = (name: string): Promise<string | undefined> => readFile(path.join(runPath, name), "utf8").catch(() => undefined);
  const manifestText = await read("run.json");
  let manifest: RunManifest | undefined;
  if (manifestText !== undefined) {
    try { manifest = parseRunManifestJson(manifestText); } catch (error) { problems.push(`run.json: ${describeError(error)}`); }
  }
  const metrics = summaryMetrics(await read("summary.json"), problems);
  // These campaign artifacts are absent from historical and non-bench bundles.
  // Reconciliation requires them explicitly; the legacy reader does not call
  // their absence a bundle problem.
  const evaluation = parsedFile(await readOptional("evaluation.json"), "evaluation.json", parseRunEvaluationJson, problems);
  const benchReceipt = parsedFile(await readOptional("bench-receipt.json"), "bench-receipt.json", parseBenchReceiptJson, problems);
  const closing = closingEvents(await read("events.ndjson"), problems, failureCategory);
  return { manifest, evaluation, benchReceipt, metrics, ...closing, problems };
}

function parsedFile<T>(text: string | undefined, name: string, parse: (value: string) => T, problems: string[]): T | undefined {
  if (text === undefined) return undefined;
  try { return parse(text); } catch (error) { problems.push(`${name}: ${describeError(error)}`); return undefined; }
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
 * The `final` and last `error` events that close a run, and the cause: the
 * last `error` event written under `failureCategory`, or the last `error` event
 * when there is no category to match. The category comes from the event's own
 * `details.failureCategory`, which is what `runScenario` wrote there, and is
 * reported as recorded rather than re-derived. A category no event records
 * leaves no cause, since another category's message would be the wrong one, and
 * is a problem: the runner writes an event under every category it returns.
 */
function closingEvents(text: string | undefined, problems: string[], failureCategory: string | undefined): Pick<RunBundleReading, "finalSequence" | "errorSequence" | "recordedFailure"> {
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
        const category = recordedCategory(event.details);
        if (message !== "" && (failureCategory === undefined || category === failureCategory)) recordedFailure = { message, category };
      }
    } catch (error) {
      problems.push(`events.ndjson line ${index + 1}: ${describeError(error)}`);
    }
  }
  if (text !== undefined && failureCategory !== undefined && recordedFailure === undefined) problems.push(`events.ndjson: no error event records the run's failure category ${failureCategory}`);
  return { finalSequence, errorSequence, recordedFailure };
}

const recordedCategory = (details: unknown): string | undefined =>
  isRecord(details) && typeof details.failureCategory === "string" && details.failureCategory !== "" ? details.failureCategory : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
