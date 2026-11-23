import { readFile, realpath, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { webOfflineReadAnsweredResult, webOfflineReadControlReproduced } from "@fluxiq-web-extension/domain/node";
import { loadExtensionContentCode, openWebSnapshotPage } from "../../offline-snapshot-page/index.js";
import { assertRealisticScenarios } from "../../realistic-scenarios/index.js";
import { readRecordedReadSource } from "./source.js";
import { compareRecordedReadBoundaries } from "./boundaries.js";

/** Actual content-reader parity for one recorded operation; always separate from task acceptance. */
export async function runRecordedReadCommand(input: { repositoryRoot: string; scenarioId: string; inputFile: string; outputFile: string }) {
  assertRealisticScenarios([input.scenarioId], "Recorded read parity");
  const runRoot = path.join(input.repositoryRoot, "test-runs");
  for (const file of [input.inputFile, input.outputFile]) {
    const relative = path.relative(runRoot, path.resolve(file));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_read_run_scope_required");
  }
  if (path.resolve(input.inputFile) === path.resolve(input.outputFile)) throw new Error("recorded_read_input_must_be_preserved");
  await mkdir(path.dirname(input.outputFile), { recursive: true });
  const [allowed, actualParent, actualInput] = await Promise.all([realpath(runRoot), realpath(path.dirname(input.outputFile)), realpath(input.inputFile)]);
  const parentRelative = path.relative(allowed, actualParent);
  if (parentRelative.startsWith("..") || path.isAbsolute(parentRelative)) throw new Error("recorded_read_output_symlink_refused");
  const inputRelative = path.relative(allowed, actualInput);
  if (inputRelative.startsWith("..") || path.isAbsolute(inputRelative)) throw new Error("recorded_read_input_symlink_refused");
  let phase = "source";
  let source: Awaited<ReturnType<typeof readRecordedReadSource>> | undefined;
  let page: ReturnType<typeof openWebSnapshotPage> | undefined;
  let observedExternalCalls: number | null = null;
  let outcome: Record<string, unknown>;
  try {
    const configuration = JSON.parse(await readFile(input.inputFile, "utf8"));
    if (configuration.provenance !== "synthetic-fixture" || configuration.scenarioId !== input.scenarioId) throw new Error("recorded_read_fixture_provenance_required");
    source = await readRecordedReadSource({ ...configuration, repositoryRoot: input.repositoryRoot, scenarioId: input.scenarioId });
    if (!source.receipt.traceOpen) throw new Error("recorded_read_expected_open_source_changed");
    phase = "content_code";
    const content = await loadExtensionContentCode({ extensionDir: path.join(input.repositoryRoot, "apps", "extension") });
    // Lab browsers are visible (user rule); the sandbox still disables page scripts and network.
    page = openWebSnapshotPage({ content, channel: "chrome", headless: false });
    phase = "browser_read";
    const evaluation = await page.evaluate(source.snapshot, source.action);
    if (evaluation.status === "unavailable") outcome = { parityPassed: false, gaps: [evaluation.reason] };
    else {
      phase = "compare";
      observedExternalCalls = evaluation.observations.requestsLeaked;
      const answered = webOfflineReadAnsweredResult(evaluation.result, source.recordedResult);
      const nativeResultMatches = webOfflineReadControlReproduced(answered, source.recordedResult);
      const comparison = compareRecordedReadBoundaries({ actualPayload: answered.payload, originalPayload: source.recordedResult.payload, canonicalRead: source.canonicalRead, parameters: source.projectionParameters, recordedUrl: source.snapshot.url, ...(source.currentDerivedSchema === undefined ? {} : { currentDerivedSchema: source.currentDerivedSchema }) });
      const sandboxSafe = evaluation.observations.scriptsRan === 0 && evaluation.observations.requestsLeaked === 0;
      const gaps = [...(!nativeResultMatches ? ["native_gateway_result_changed"] : []), ...(!comparison.rawNativeRowsMatch ? ["original_native_rows_changed"] : []), ...(!comparison.modelProjectedRowsMatch ? ["canonical_model_projected_rows_changed"] : []), ...(comparison.projectionContextMatches === null ? ["projection_context_unavailable"] : comparison.projectionContextMatches ? [] : ["projection_context_changed"]), ...(!sandboxSafe ? ["snapshot_sandbox_breached"] : []), ...(comparison.rawComparison.currentSchema !== "valid" ? [`current_derived_schema_${comparison.rawComparison.currentSchema}`] : [])];
      outcome = { parityPassed: gaps.length === 0, rawNativeRowsMatch: comparison.rawNativeRowsMatch, modelProjectedRowsMatch: comparison.modelProjectedRowsMatch, projectionContextMatches: comparison.projectionContextMatches, nativeResultMatches, comparison, sandbox: evaluation.observations, gaps };
    }
  } catch (error) {
    outcome = { parityPassed: false, gaps: [error instanceof Error && /^recorded_read_[a-z_]+$/u.test(error.message) ? error.message : "recorded_read_unavailable"] };
  } finally { await page?.close(); }
  const report = { proof: "original_recorded_read_parity", scenarioId: input.scenarioId, traceOpen: true, sourceVerified: source !== undefined, fullAttemptAccepted: false, wholeTraceAdmitted: false, modelCalls: 0, providerCalls: 0, providerUsd: 0, externalCalls: observedExternalCalls, externalUsd: observedExternalCalls === 0 ? 0 : null, newDetectionProven: false, newlyRetainedFieldsProven: false, phase, source: source?.receipt ?? null, ...outcome, parityPassed: outcome.parityPassed === true };
  await writeFile(input.outputFile, JSON.stringify(report, null, 2), { flag: "wx" });
  return report;
}
