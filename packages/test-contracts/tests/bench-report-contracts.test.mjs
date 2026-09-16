import assert from "node:assert/strict";
import test from "node:test";
import {
  BENCH_TOLERANCE,
  ContractValidationError,
  assertBenchReport,
  benchExtractionRateMetrics,
  benchFlakeClasses,
  benchRateMetrics,
  benchTargets,
  compareBenchMetric,
  compareBenchReports,
  parseBenchReportJson,
  validateBenchReport,
} from "../dist/index.js";

const week2 = { harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null };
const rate = (count, total, workflows) => ({ count, total, workflows, rate: total === 0 ? null : count / total });
const spread = (samples, p50, p95) => ({ samples, p50, p95 });
/** The Flow lane's rates: three results (W05's workflow and its short-catalog variant, W26's no-context variant), three repeats each. */
const flowRates = (overrides = {}) => ({
  flowCreationSuccess: rate(3, 3, 3), initialExecutionSuccess: rate(2, 3, 3), deterministicReplaySuccess: rate(1, 3, 3),
  fuzzyRecovery: rate(0, 0, 0), falseFailure: rate(1, 9, 3), falseSuccess: rate(0, 9, 3),
  failureClassificationAccuracy: rate(0, 3, 1), harnessActivation: rate(0, 9, 3), ...overrides,
});
/** The recording lane's rates: one result, W05's workflow, which the recording lane runs beside the Flow lane. */
const recordingRates = (overrides = {}) => ({
  flowCreationSuccess: rate(0, 0, 0), initialExecutionSuccess: rate(1, 1, 1), deterministicReplaySuccess: rate(2, 2, 1),
  fuzzyRecovery: rate(0, 0, 0), falseFailure: rate(0, 3, 1), falseSuccess: rate(0, 0, 0),
  failureClassificationAccuracy: rate(0, 0, 0), harnessActivation: rate(0, 3, 1), ...overrides,
});
const measurements = () => ({
  actionLatencyMs: { "web.dom.click": spread(12, 80, 140), "web.dom.extract": spread(6, 30, 55), "web.dom.scroll": spread(2, 10, 15) },
  runDurationMs: spread(12, 1500, 2600), sanitizedPacketBytes: spread(18, 2048, 4096), rawSnapshotBytes: spread(9, 60000, 90000),
  truncationCount: 0, ...week2,
});
const metrics = (overrides = {}) => ({ ratesByLane: { recording: recordingRates(), flow: flowRates() }, ...measurements(), ...overrides });
// W05's workflow on both lanes, its short-catalog variant, and W26's negative no-context variant, each repeated three times.
const workflows = () => [
  { corpusRowId: "W05", scenarioId: "product-catalog", workflowId: "paginated-extraction", variantId: null, lane: "recording", runs: 3, passRate: 1, flakeClass: "stable-pass" },
  { corpusRowId: "W05", scenarioId: "product-catalog", workflowId: "paginated-extraction", variantId: null, lane: "flow", runs: 3, passRate: 1, flakeClass: "stable-pass" },
  { corpusRowId: "W05", scenarioId: "product-catalog", workflowId: "paginated-extraction", variantId: "short-catalog", lane: "flow", runs: 3, passRate: 2 / 3, flakeClass: "flaky" },
  { corpusRowId: "W26", scenarioId: "ambiguous-targets", workflowId: null, variantId: "no-context", lane: "flow", runs: 3, passRate: 0, flakeClass: "stable-fail" },
];
const report = (overrides = {}) => ({
  schemaVersion: "0.1", reportId: "bench-2026-09-11-a", generatedAt: "2026-09-11T12:00:00.000Z", corpusId: "fluxbench-week1",
  repeatCount: 3, target: "isolated", workflows: workflows(), metrics: metrics(),
  llm: { mode: "disabled", profileId: null, calls: 0 }, comparison: null, ...overrides,
});
const withFlowRates = (rates) => report({ metrics: metrics({ ratesByLane: { recording: recordingRates(), flow: rates } }) });
// An earlier bench of the same corpus: on the Flow lane one workflow worse at first execution, better at replay, more false failures; slower.
const baseline = () => report({
  reportId: "bench-2026-09-10-a",
  metrics: metrics({
    ratesByLane: { recording: recordingRates(), flow: flowRates({ initialExecutionSuccess: rate(1, 3, 3), deterministicReplaySuccess: rate(3, 3, 3), falseFailure: rate(5, 9, 3) }) },
    actionLatencyMs: { "web.dom.click": spread(12, 70, 100), "web.dom.extract": spread(6, 30, 50), "web.dom.type": spread(3, 20, 30) },
    runDurationMs: spread(12, 2000, 4000),
  }),
});
// The shape of the eight `smoke` benches on disk, written before lanes: no result states one, and one `rates` covers the report.
const smokeResults = () => [
  { corpusRowId: "W01", scenarioId: "basic-form", workflowId: null, variantId: null, runs: 3, passRate: 1, flakeClass: "stable-pass" },
  { corpusRowId: "W28", scenarioId: "iframe-checkout", workflowId: null, variantId: null, runs: 3, passRate: 1, flakeClass: "stable-pass" },
];
const smokeRates = (overrides = {}) => ({
  flowCreationSuccess: rate(0, 0, 0), initialExecutionSuccess: rate(1, 2, 2), deterministicReplaySuccess: rate(2, 4, 2),
  fuzzyRecovery: rate(0, 0, 0), falseFailure: rate(0, 2, 2), falseSuccess: rate(0, 0, 0),
  failureClassificationAccuracy: rate(0, 0, 0), harnessActivation: rate(0, 6, 2), ...overrides,
});
const legacy = (overrides = {}) => report({ reportId: "bench-mtxoim0b-8ca4952c", corpusId: "smoke", workflows: smokeResults(), metrics: { rates: smokeRates(), ...measurements() }, ...overrides });
// The same corpus benched now: every result states the recording lane, and the rates are that lane's.
const smoke = (overrides = {}) => report({ reportId: "bench-2026-09-13-smoke", corpusId: "smoke", workflows: smokeResults().map((result) => ({ ...result, lane: "recording" })), metrics: metrics({ ratesByLane: { recording: smokeRates(overrides) } }) });
const without = (value, key) => { const copy = { ...value }; delete copy[key]; return copy; };
const issuesOf = (value) => { const checked = validateBenchReport(value); return checked.valid ? [] : checked.issues.map((issue) => issue.path); };
const rejects = (value, label) => assert.equal(validateBenchReport(value).valid, false, label);

test("a bench report validates and round-trips through JSON", () => {
  assert.deepEqual([...benchTargets], ["isolated", "persistent-isolated", "existing", "clone"]);
  assert.deepEqual([...benchFlakeClasses], ["stable-pass", "stable-fail", "flaky"]);
  assert.equal(benchRateMetrics.length, 8);
  assert.deepEqual({ ...BENCH_TOLERANCE }, { rateWorkflows: 1, latencyP95Ratio: 0.25 });
  assert.equal(Object.isFrozen(BENCH_TOLERANCE), true);
  assert.doesNotThrow(() => assertBenchReport(report()));
  assert.deepEqual(parseBenchReportJson(JSON.stringify(report())), report());
});

test("per-workflow results keep runs, pass rate, and flake class consistent", () => {
  const [stable, , flaky] = workflows();
  const withFirst = (result) => report({ workflows: [result, ...workflows().slice(1)] });
  rejects(withFirst({ ...stable, passRate: 2 / 3 }), "flaky pass rate labelled stable-pass");
  rejects(withFirst({ ...stable, passRate: 0.5, flakeClass: "flaky" }), "half a run passed");
  rejects(withFirst({ ...stable, runs: 2 }), "runs differ from repeatCount");
  rejects(withFirst({ ...stable, corpusRowId: "w05" }), "lowercase row id");
  rejects(withFirst({ ...stable, flakeClass: "intermittent" }), "unknown flake class");
  rejects(withFirst({ ...stable, workflowId: "Paginated" }), "non-kebab workflow id");
  rejects(report({ workflows: [...workflows(), { ...flaky }] }), "duplicate workflow and variant");
  rejects(report({ workflows: [...workflows(), { ...stable, scenarioId: "data-table", workflowId: null }] }), "one row mapped to two workflows");
  rejects(report({ workflows: [] }), "no results");
  // W20-W23: several corpus rows are variants of one workflow.
  const drift = (corpusRowId, variantId) => ({ corpusRowId, scenarioId: "identity-drift", workflowId: null, variantId, lane: "flow", runs: 3, passRate: 1, flakeClass: "stable-pass" });
  assert.equal(validateBenchReport(report({ workflows: [...workflows(), drift("W20", "selector-only"), drift("W21", "text-only")] })).valid, true);
});

/**
 * An unarmed row runs on the recording lane and on the Flow lane, so one
 * scenario, workflow and variant is two results. Before the lane was part of a
 * result's identity this report was rejected, and every week1 bench would have
 * died in its report after its last run.
 */
test("one result on two lanes is two results; the same result twice on one lane is still a duplicate", () => {
  const [onRecording, onFlow] = workflows();
  assert.deepEqual([onRecording.variantId, onFlow.variantId, onRecording.lane, onFlow.lane], [null, null, "recording", "flow"]);
  assert.deepEqual(issuesOf(report()), []);
  assert.deepEqual(issuesOf(report({ workflows: [...workflows(), { ...onFlow }] })), ["$.workflows[4]"]);
  assert.deepEqual(issuesOf(report({ workflows: workflows().map((result, index) => (index === 0 ? { ...result, lane: "replay" } : result)) })), ["$.workflows[0].lane", "$.metrics.ratesByLane.recording"]);
  // Results state their lane on every result or, as a report written before lanes did, on none.
  assert.deepEqual(issuesOf(report({ workflows: [without(onRecording, "lane"), ...workflows().slice(1)] })), ["$.workflows", "$.metrics.ratesByLane.recording"]);
});

test("rates are per lane and never combined: a lane with results has its own rates, a lane without results has none", () => {
  // A bench with no Flow-lane row -- smoke runs the recording lane alone -- states that lane only, and is valid.
  assert.deepEqual(issuesOf(smoke()), []);
  assert.equal(Object.hasOwn(smoke().metrics.ratesByLane, "flow"), false);
  assert.deepEqual(issuesOf(report({ metrics: metrics({ ratesByLane: { recording: recordingRates() } }) })), ["$.metrics.ratesByLane.flow"]);
  assert.deepEqual(issuesOf({ ...smoke(), metrics: metrics({ ratesByLane: { recording: smokeRates(), flow: flowRates() } }) }), ["$.metrics.ratesByLane.flow"]);
  // A combined set beside the per-lane rates, or instead of them.
  assert.deepEqual(issuesOf(report({ metrics: metrics({ rates: flowRates() }) })), ["$.metrics.rates"]);
  assert.deepEqual(issuesOf(report({ metrics: { rates: flowRates(), ...measurements() } })), ["$.metrics.rates", "$.metrics.ratesByLane"]);
  assert.deepEqual(issuesOf(report({ metrics: metrics({ ratesByLane: { recording: recordingRates(), flow: flowRates(), replay: flowRates() } }) })), ["$.metrics.ratesByLane.replay"]);
  // Each lane's rates are bounded by that lane's own results: the recording lane lists one.
  assert.deepEqual(issuesOf(report({ metrics: metrics({ ratesByLane: { recording: recordingRates({ falseFailure: rate(0, 3, 2) }), flow: flowRates() } }) })), ["$.metrics.ratesByLane.recording.falseFailure.workflows"]);
});

test("a report written before lanes still validates, and compares as the recording lane only when it lists no variant", () => {
  assert.deepEqual(issuesOf(legacy()), []);
  assert.deepEqual(issuesOf(legacy({ metrics: { rates: smokeRates(), ratesByLane: { recording: smokeRates() }, ...measurements() } })), ["$.metrics.ratesByLane"]);
  assert.deepEqual(issuesOf(legacy({ metrics: measurements() })), ["$.metrics.rates"]);
  // Every smoke bench on disk ran the recording lane alone, so its rates are that lane's, and a bench of today compares against them.
  const comparison = compareBenchReports(legacy(), smoke({ initialExecutionSuccess: rate(2, 2, 2) }));
  assert.deepEqual(comparison.metrics.filter(({ metric }) => metric.startsWith("rate:")).map(({ metric, outcome }) => [metric, outcome]), [
    ["rate:recording:initialExecutionSuccess", "equivalent"], // one workflow of two better: inside the one-workflow tolerance
    ["rate:recording:deterministicReplaySuccess", "equivalent"],
    ["rate:recording:falseFailure", "equivalent"],
    ["rate:recording:harnessActivation", "equivalent"],
  ]);
  // A report written before lanes that lists a variant ran the Flow lane too; its one set of rates combined both, and is no lane's.
  const combined = legacy({ workflows: [...smokeResults(), { corpusRowId: "W20", scenarioId: "identity-drift", workflowId: null, variantId: "selector-only", runs: 3, passRate: 1, flakeClass: "stable-pass" }] });
  assert.deepEqual(issuesOf(combined), []);
  assert.equal(compareBenchMetric("rate:recording:initialExecutionSuccess", 0.5, combined), undefined);
  assert.equal(compareBenchReports(combined, smoke()).metrics.some(({ metric }) => metric.startsWith("rate:")), false);
});

test("corpus rates are counts over totals within a workflow population", () => {
  for (const [label, override] of Object.entries({
    "count above total": { initialExecutionSuccess: { count: 4, total: 3, workflows: 3, rate: 4 / 3 } },
    "rate not count over total": { initialExecutionSuccess: { ...rate(2, 3, 3), rate: 0.5 } },
    "null rate with a total": { initialExecutionSuccess: { ...rate(2, 3, 3), rate: null } },
    "rate without a total": { fuzzyRecovery: { count: 0, total: 0, workflows: 0, rate: 0 } },
    "population beyond the lane's results": { falseFailure: rate(1, 12, 4) },
    "total beyond workflows times repeats": { falseFailure: rate(1, 10, 3) },
    "empty population with a total": { falseFailure: rate(1, 9, 0) },
    "population larger than its total": { failureClassificationAccuracy: rate(0, 1, 2) },
    "fractional count": { falseFailure: rate(1.5, 9, 3) },
  })) rejects(withFlowRates(flowRates(override)), label);
  rejects(withFlowRates(without(flowRates(), "harnessActivation")), "missing rate metric");
  rejects(withFlowRates({ ...flowRates(), speed: rate(1, 1, 1) }), "unknown rate metric");
});

test("distributions, evidence, and Week 2 fields are bounded", () => {
  for (const [label, override] of Object.entries({
    "p50 above p95": { runDurationMs: spread(9, 3000, 2600) },
    "percentiles without samples": { sanitizedPacketBytes: spread(0, 10, 10) },
    "samples without percentiles": { rawSnapshotBytes: spread(3, null, null) },
    "negative latency": { actionLatencyMs: { "web.dom.click": spread(1, -5, 5) } },
    "negative truncation": { truncationCount: -1 },
    "unknown metric": { successRate: 1 },
    "week 2 value": { adaptationCost: 0.02 },
  })) rejects(report({ metrics: metrics(override) }), label);
  for (const key of Object.keys(week2)) rejects(report({ metrics: without(metrics(), key) }), `missing ${key}`);
  assert.equal(validateBenchReport(report({ metrics: metrics({ actionLatencyMs: {}, sanitizedPacketBytes: spread(0, null, null) }) })).valid, true);
});

// 4 workflow results x 3 repeats = 12 evaluated runs; the latency distributions carry 12 + 6 + 2 = 20 samples, one per executed action.
const covered = (overrides = {}) => report({ metrics: metrics({ notExecutedRuns: 4, actionsExecuted: 20, ...overrides }) });

test("a bench report round-trips the execution-coverage counts, and states them consistently", () => {
  assert.doesNotThrow(() => assertBenchReport(covered()));
  const parsed = parseBenchReportJson(JSON.stringify(covered()));
  assert.deepEqual([parsed.metrics.notExecutedRuns, parsed.metrics.actionsExecuted], [4, 20]);
  assert.deepEqual(parsed, covered());
  // Every run may have executed nothing; more runs than the bench evaluated may not.
  assert.equal(validateBenchReport(covered({ notExecutedRuns: 12 })).valid, true);
  assert.deepEqual(issuesOf(covered({ notExecutedRuns: 13 })), ["$.metrics.notExecutedRuns"]);
  for (const [label, override] of Object.entries({
    "fractional runs": { notExecutedRuns: 1.5 },
    "negative runs": { notExecutedRuns: -1 },
    "negative actions": { actionsExecuted: -1 },
    // The action total and the latency samples count the same executed actions, so a report may not state both and disagree.
    "actions disagreeing with the latency samples": { actionsExecuted: 19 },
  })) rejects(covered(override), label);
});

test("a bench report written before the execution-coverage counts still loads, and its counts read as unmeasured rather than zero", () => {
  // The shape of the eight benches on disk: metrics with neither key present.
  const older = legacy();
  assert.deepEqual(Object.keys(older.metrics), [
    "rates", "actionLatencyMs", "runDurationMs", "sanitizedPacketBytes", "rawSnapshotBytes", "truncationCount",
    "harnessRecovery", "adaptationCost", "adaptationValidation", "adaptationPersistence", "adaptationReuse",
  ]);
  const parsed = parseBenchReportJson(JSON.stringify(older));
  assert.equal(parsed.metrics.notExecutedRuns, undefined);
  assert.equal(parsed.metrics.actionsExecuted, undefined);
  // Absent, not zero: a reader can tell "this bench did not measure it" from "FluxIQ executed nothing".
  assert.equal(Object.hasOwn(parsed.metrics, "notExecutedRuns"), false);
  assert.equal(Object.hasOwn(parsed.metrics, "actionsExecuted"), false);
  // And such a report is still a usable baseline for a report that does state them: the counts are not compared metrics.
  const stated = smoke();
  const comparison = compareBenchReports(older, { ...stated, metrics: { ...stated.metrics, notExecutedRuns: 2, actionsExecuted: 20 } });
  assert.equal(comparison.metrics.length > 0, true);
  assert.equal(comparison.metrics.some(({ metric }) => ["notExecutedRuns", "actionsExecuted"].some((count) => metric.endsWith(count))), false);
});

test("report identity, target, repeat count, and LLM usage are validated", () => {
  for (const [label, override] of Object.entries({
    "unknown target": { target: "production" },
    "no repeats": { repeatCount: 0 },
    "too many repeats": { repeatCount: 101 },
    "bad timestamp": { generatedAt: "yesterday" },
    "non-kebab corpus id": { corpusId: "FluxBench Week 1" },
    "empty report id": { reportId: "" },
    "wrong schema": { schemaVersion: "0.2" },
    "unknown property": { runs: [] },
  })) rejects(report(override), label);
  rejects(without(report(), "comparison"), "comparison omitted rather than null");
  assert.deepEqual(issuesOf(report({ llm: { mode: "disabled", profileId: null, calls: 1 } })), ["$.llm.calls"]);
});

test("compareBenchReports applies the plan's tolerance per lane, per metric and direction", () => {
  const candidate = report();
  const comparison = compareBenchReports(baseline(), candidate);
  assert.equal(comparison.baselineReportId, "bench-2026-09-10-a");
  assert.deepEqual(comparison.metrics.map(({ metric, outcome }) => [metric, outcome]), [
    ["rate:recording:initialExecutionSuccess", "equivalent"],
    ["rate:recording:deterministicReplaySuccess", "equivalent"],
    ["rate:recording:falseFailure", "equivalent"],
    ["rate:recording:harnessActivation", "equivalent"],
    ["rate:flow:flowCreationSuccess", "equivalent"],
    ["rate:flow:initialExecutionSuccess", "equivalent"], // one workflow better: inside the one-workflow tolerance
    ["rate:flow:deterministicReplaySuccess", "regressed"], // two workflows worse
    ["rate:flow:falseFailure", "improved"], // lower is better
    ["rate:flow:falseSuccess", "equivalent"],
    ["rate:flow:failureClassificationAccuracy", "equivalent"],
    ["rate:flow:harnessActivation", "equivalent"],
    ["action-latency-p95:web.dom.click", "regressed"], // 140 against 100: beyond 25%
    ["action-latency-p95:web.dom.extract", "equivalent"], // 55 against 50
    ["run-duration-p95", "improved"], // 2600 against 4000
  ]);
  const byMetric = Object.fromEntries(comparison.metrics.map((entry) => [entry.metric, entry]));
  assert.equal(byMetric["rate:flow:initialExecutionSuccess"].tolerance, 1 / 3);
  assert.equal(byMetric["rate:recording:initialExecutionSuccess"].tolerance, 1);
  assert.equal(byMetric["action-latency-p95:web.dom.click"].tolerance, 25);
  assert.equal(byMetric["action-latency-p95:web.dom.click"].candidate, 140);
  // No population, candidate-only, and baseline-only metrics are not compared.
  for (const metric of ["rate:flow:fuzzyRecovery", "rate:recording:flowCreationSuccess", "action-latency-p95:web.dom.scroll", "action-latency-p95:web.dom.type"]) assert.equal(byMetric[metric], undefined, metric);
  assert.doesNotThrow(() => assertBenchReport({ ...candidate, comparison }));
  assert.deepEqual(parseBenchReportJson(JSON.stringify({ ...candidate, comparison })).comparison, comparison);
});

test("compareBenchMetric holds the tolerance boundaries and refuses what the candidate did not measure", () => {
  const candidate = report();
  const outcome = (metric, base) => compareBenchMetric(metric, base, candidate)?.outcome;
  assert.equal(outcome("action-latency-p95:web.dom.click", 112), "equivalent"); // 140 is exactly 25% above 112
  assert.equal(outcome("action-latency-p95:web.dom.click", 111), "regressed");
  assert.equal(outcome("action-latency-p95:web.dom.click", 186), "equivalent");
  assert.equal(outcome("action-latency-p95:web.dom.click", 188), "improved");
  assert.equal(outcome("rate:flow:initialExecutionSuccess", 1), "equivalent"); // 2/3 against 3/3: one workflow of three
  assert.equal(outcome("rate:flow:initialExecutionSuccess", 0), "improved"); // two workflows better
  for (const metric of [
    "rate:flow:fuzzyRecovery", "rate:flow:speed", "rate:initialExecutionSuccess", "rate:replay:initialExecutionSuccess", "rate:flow:initialExecutionSuccess:extra",
    "action-latency-p95:web.dom.type", "action-latency-p95:constructor", "latency",
  ]) assert.equal(compareBenchMetric(metric, 1, candidate), undefined, metric);
  assert.throws(() => compareBenchReports({ ...baseline(), corpusId: "fluxbench-week2" }, candidate), /different corpora/u);
  assert.throws(() => compareBenchReports(candidate, candidate), /itself/u);
});

test("the validator rejects a comparison that contradicts its tolerance or this report", () => {
  const candidate = report();
  const comparison = compareBenchReports(baseline(), candidate);
  const withEntry = (index, change) => ({ ...candidate, comparison: { ...comparison, metrics: comparison.metrics.map((entry, at) => at === index ? { ...entry, ...change } : entry) } });
  const click = comparison.metrics.findIndex(({ metric }) => metric === "action-latency-p95:web.dom.click");
  assert.deepEqual(issuesOf(withEntry(click, { outcome: "equivalent" })), [`$.comparison.metrics[${click}].outcome`]);
  assert.deepEqual(issuesOf(withEntry(click, { candidate: 120 })), [`$.comparison.metrics[${click}].candidate`]);
  assert.deepEqual(issuesOf(withEntry(click, { tolerance: 40 })), [`$.comparison.metrics[${click}].tolerance`]);
  assert.deepEqual(issuesOf(withEntry(0, { metric: "rate:speed" })), ["$.comparison.metrics[0].metric"]);
  rejects({ ...candidate, comparison: { ...comparison, metrics: [...comparison.metrics, comparison.metrics[0]] } }, "duplicate metric");
  rejects({ ...candidate, comparison: { ...comparison, baselineReportId: candidate.reportId } }, "self comparison");
  rejects({ ...candidate, comparison: "none" }, "comparison not an object");
  rejects(withEntry(0, { note: "x" }), "unknown entry property");
  assert.throws(() => parseBenchReportJson("{"), ContractValidationError);
});

/** The Flow lane's extraction over two of its three results: six judged steps, three unjudged, 144 expected records. */
const extractionMetrics = (overrides = {}) => ({
  judgedSteps: 6, unjudgedSteps: 3,
  extractionRecordAccuracy: rate(140, 144, 2), extractionCountAccuracy: rate(5, 6, 2), extractionExactSuccess: rate(4, 6, 2),
  extractionFieldCompleteness: rate(17, 18, 2), paginationAccuracy: rate(6, 6, 2), extractionFalseSuccess: rate(1, 6, 2),
  extractionDurationMs: spread(9, 300, 900), extractionMsPerPage: spread(9, 100, 250), ...overrides,
});
const extracted = (byLane = { flow: extractionMetrics() }, overrides = {}) => report({ metrics: metrics({ extractionByLane: byLane }), ...overrides });
const extractionPath = (lane, member) => `$.metrics.extractionByLane.${lane}${member ? `.${member}` : ""}`;

test("an extraction block validates and round-trips; a report without one is valid and reads as unmeasured", () => {
  assert.deepEqual([...benchExtractionRateMetrics], ["extractionRecordAccuracy", "extractionCountAccuracy", "extractionExactSuccess", "extractionFieldCompleteness", "paginationAccuracy", "extractionFalseSuccess"]);
  assert.deepEqual(issuesOf(extracted()), []);
  assert.deepEqual(parseBenchReportJson(JSON.stringify(extracted())), extracted());
  assert.equal(extracted().schemaVersion, "0.1"); // the block is optional, so the schema version stays 0.1
  // 144 expected records exceed the lane's 3 results times 3 repeats: records are not runs, so that bound does not apply.
  assert.equal(extracted().metrics.extractionByLane.flow.extractionRecordAccuracy.total > 9, true);
  // Both lanes, each bounded by its own results: the recording lane lists one.
  const recording = extractionMetrics({ extractionRecordAccuracy: rate(24, 24, 1), extractionCountAccuracy: rate(1, 1, 1), extractionExactSuccess: rate(1, 1, 1), extractionFieldCompleteness: rate(3, 3, 1), paginationAccuracy: rate(1, 1, 1), extractionFalseSuccess: rate(0, 1, 1) });
  assert.deepEqual(issuesOf(extracted({ recording, flow: extractionMetrics() })), []);
  assert.deepEqual(issuesOf(extracted({ recording: extractionMetrics(), flow: extractionMetrics() })), benchExtractionRateMetrics.map((metric) => extractionPath("recording", `${metric}.workflows`)));
  // Absent: every report written before extraction was measured, laned or not.
  for (const older of [report(), legacy(), smoke(), covered()]) assert.equal(Object.hasOwn(parseBenchReportJson(JSON.stringify(older)).metrics, "extractionByLane"), false, older.reportId);
  assert.deepEqual(issuesOf(extracted({})), []); // an empty block measured nothing on either lane
});

test("extraction rates are counts over totals: matched records never outnumber expected ones", () => {
  assert.deepEqual(issuesOf(extracted({ flow: extractionMetrics({ extractionRecordAccuracy: rate(145, 144, 2) }) })), [extractionPath("flow", "extractionRecordAccuracy.count")]);
  for (const [label, override] of Object.entries({
    "rate not count over total": { extractionCountAccuracy: { ...rate(5, 6, 2), rate: 0.5 } }, "null rate with a total": { paginationAccuracy: { ...rate(6, 6, 2), rate: null } },
    "rate without a total": { extractionFalseSuccess: { count: 0, total: 0, workflows: 0, rate: 0 } }, "population beyond the lane's results": { extractionExactSuccess: rate(4, 6, 4) },
    "empty population with a total": { extractionFieldCompleteness: rate(17, 18, 0) }, "fractional count": { extractionRecordAccuracy: rate(140.5, 144, 2) },
    "negative judged steps": { judgedSteps: -1 }, "fractional unjudged steps": { unjudgedSteps: 0.5 },
    "p50 above p95": { extractionMsPerPage: spread(9, 300, 250) }, "percentiles without samples": { extractionDurationMs: spread(0, 1, 1) },
    "unknown rate": { extractionSpeed: rate(1, 1, 1) }, "a planted field value": { sampleValue: "4242424242424242" }, "a field name": { fieldNames: ["price"] },
    "missing rate": { extractionFalseSuccess: undefined }, "missing distribution": { extractionMsPerPage: undefined },
  })) rejects(extracted({ flow: extractionMetrics(override) }), label);
  rejects(extracted("flow"), "block as a string"); rejects(extracted({ flow: [] }), "lane as a list");
});

test("extraction is per lane: refused on a lane without results, and in a report whose results state no lane", () => {
  assert.deepEqual(issuesOf({ ...smoke(), metrics: { ...smoke().metrics, extractionByLane: { flow: extractionMetrics() } } }), [extractionPath("flow")]);
  assert.deepEqual(issuesOf(extracted({ replay: extractionMetrics() })), [extractionPath("replay")]);
  const older = legacy();
  assert.deepEqual(issuesOf({ ...older, metrics: { ...older.metrics, extractionByLane: { recording: extractionMetrics({ judgedSteps: 0 }) } } }), ["$.metrics.extractionByLane"]);
});

test("extraction comparisons hold accuracy within one record and success rates within one workflow", () => {
  const candidate = extracted();
  const outcome = (metric, base) => compareBenchMetric(metric, base, candidate)?.outcome;
  // Record accuracy: 140 of 144. One record either way is equivalent; two is not.
  assert.equal(compareBenchMetric("extraction:flow:extractionRecordAccuracy", 141 / 144, candidate).tolerance, 1 / 144);
  assert.deepEqual([141, 139, 142, 138].map((matched) => outcome("extraction:flow:extractionRecordAccuracy", matched / 144)), ["equivalent", "equivalent", "regressed", "improved"]);
  // Exact success: 4 of 6 steps over 2 workflows, so one workflow is half the rate; one step of six is inside it.
  assert.equal(compareBenchMetric("extraction:flow:extractionExactSuccess", 1, candidate).tolerance, BENCH_TOLERANCE.rateWorkflows / 2);
  assert.deepEqual([5 / 6, 0].map((base) => outcome("extraction:flow:extractionExactSuccess", base)), ["equivalent", "improved"]);
  // False success is lower-better, within one workflow.
  assert.deepEqual([0, 5 / 6].map((base) => outcome("extraction:flow:extractionFalseSuccess", base)), ["equivalent", "improved"]);
  assert.equal(compareBenchMetric("extraction:flow:extractionFalseSuccess", 1, extracted({ flow: extractionMetrics({ extractionFalseSuccess: rate(6, 6, 2) }) })).outcome, "equivalent");
  assert.equal(compareBenchMetric("extraction:flow:extractionFalseSuccess", 0, extracted({ flow: extractionMetrics({ extractionFalseSuccess: rate(6, 6, 2) }) })).outcome, "regressed");
  // Not measured: another lane, a distribution, an empty population, an unknown name, and a report without the block.
  for (const metric of [
    "extraction:recording:extractionRecordAccuracy", "extraction:replay:extractionRecordAccuracy", "extraction:flow:extractionDurationMs",
    "extraction:flow:extractionSpeed", "extraction:flow:constructor", "extraction:flow:extractionRecordAccuracy:extra", "extraction:extractionRecordAccuracy",
  ]) assert.equal(compareBenchMetric(metric, 1, candidate), undefined, metric);
  assert.equal(compareBenchMetric("extraction:flow:paginationAccuracy", 1, extracted({ flow: extractionMetrics({ paginationAccuracy: rate(0, 0, 0) }) })), undefined);
  assert.equal(compareBenchMetric("extraction:flow:extractionRecordAccuracy", 1, report()), undefined);
});

test("compareBenchReports lists each lane's extraction rates after the Metrics-table rates, and the validator holds their tolerance", () => {
  const base = report({
    reportId: "bench-2026-09-10-x",
    metrics: metrics({ extractionByLane: { flow: extractionMetrics({ extractionCountAccuracy: rate(3, 6, 2), paginationAccuracy: rate(4, 6, 2), extractionFalseSuccess: rate(5, 6, 2), extractionExactSuccess: rate(1, 6, 2) }) } }),
  });
  const candidate = extracted();
  const comparison = compareBenchReports(base, candidate);
  const ids = comparison.metrics.map(({ metric }) => metric);
  assert.deepEqual(comparison.metrics.filter(({ metric }) => metric.startsWith("extraction:")).map(({ metric, outcome }) => [metric, outcome]), [
    ["extraction:flow:extractionRecordAccuracy", "equivalent"],
    ["extraction:flow:extractionCountAccuracy", "improved"], // 5 of 6 against 3 of 6: two steps beyond one
    ["extraction:flow:extractionExactSuccess", "equivalent"], // 4 of 6 against 1 of 6: inside one workflow of two
    ["extraction:flow:extractionFieldCompleteness", "equivalent"],
    ["extraction:flow:paginationAccuracy", "improved"],
    ["extraction:flow:extractionFalseSuccess", "improved"], // lower is better
  ]);
  const firstExtraction = ids.findIndex((id) => id.startsWith("extraction:"));
  assert.equal(ids.slice(0, firstExtraction).every((id) => id.startsWith("rate:")), true);
  assert.equal(ids.slice(firstExtraction + 6).some((id) => id.startsWith("rate:") || id.startsWith("extraction:")), false);
  assert.doesNotThrow(() => assertBenchReport({ ...candidate, comparison }));
  assert.deepEqual(parseBenchReportJson(JSON.stringify({ ...candidate, comparison })).comparison, comparison);
  // A baseline without the block compares no extraction metric: it did not measure extraction.
  assert.equal(compareBenchReports(report({ reportId: "bench-2026-09-10-a" }), candidate).metrics.some(({ metric }) => metric.startsWith("extraction:")), false);
  // An entry judged under the wrong tolerance -- exact success under one step of six instead of one workflow of two -- is refused.
  const exact = ids.indexOf("extraction:flow:extractionExactSuccess");
  const tampered = { ...comparison, metrics: comparison.metrics.map((entry, at) => (at === exact ? { ...entry, tolerance: 1 / 6, outcome: "improved" } : entry)) };
  assert.deepEqual(issuesOf({ ...candidate, comparison: tampered }), [`$.comparison.metrics[${exact}].tolerance`, `$.comparison.metrics[${exact}].outcome`]);
});
