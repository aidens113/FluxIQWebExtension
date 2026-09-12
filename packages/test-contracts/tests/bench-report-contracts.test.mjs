import assert from "node:assert/strict";
import test from "node:test";
import {
  BENCH_TOLERANCE,
  ContractValidationError,
  assertBenchReport,
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
const rates = (overrides = {}) => ({
  flowCreationSuccess: rate(3, 3, 3), initialExecutionSuccess: rate(2, 3, 3), deterministicReplaySuccess: rate(1, 3, 3),
  fuzzyRecovery: rate(0, 0, 0), falseFailure: rate(1, 9, 3), falseSuccess: rate(0, 9, 3),
  failureClassificationAccuracy: rate(0, 3, 1), harnessActivation: rate(0, 9, 3), ...overrides,
});
const metrics = (overrides = {}) => ({
  rates: rates(),
  actionLatencyMs: { "web.dom.click": spread(12, 80, 140), "web.dom.extract": spread(6, 30, 55), "web.dom.scroll": spread(2, 10, 15) },
  runDurationMs: spread(9, 1500, 2600), sanitizedPacketBytes: spread(18, 2048, 4096), rawSnapshotBytes: spread(9, 60000, 90000),
  truncationCount: 0, ...week2, ...overrides,
});
// W05's workflow and its short-catalog variant, and W26's negative no-context variant, each repeated three times.
const workflows = () => [
  { corpusRowId: "W05", scenarioId: "product-catalog", workflowId: "paginated-extraction", variantId: null, runs: 3, passRate: 1, flakeClass: "stable-pass" },
  { corpusRowId: "W05", scenarioId: "product-catalog", workflowId: "paginated-extraction", variantId: "short-catalog", runs: 3, passRate: 2 / 3, flakeClass: "flaky" },
  { corpusRowId: "W26", scenarioId: "ambiguous-targets", workflowId: null, variantId: "no-context", runs: 3, passRate: 0, flakeClass: "stable-fail" },
];
const report = (overrides = {}) => ({
  schemaVersion: "0.1", reportId: "bench-2026-09-11-a", generatedAt: "2026-09-11T12:00:00.000Z", corpusId: "fluxbench-week1",
  repeatCount: 3, target: "isolated", workflows: workflows(), metrics: metrics(),
  llm: { mode: "disabled", profileId: null, calls: 0 }, comparison: null, ...overrides,
});
// An earlier bench of the same corpus: one workflow worse at first execution, better at replay, more false failures, slower.
const baseline = () => report({
  reportId: "bench-2026-09-10-a",
  metrics: metrics({
    rates: rates({ initialExecutionSuccess: rate(1, 3, 3), deterministicReplaySuccess: rate(3, 3, 3), falseFailure: rate(5, 9, 3) }),
    actionLatencyMs: { "web.dom.click": spread(12, 70, 100), "web.dom.extract": spread(6, 30, 50), "web.dom.type": spread(3, 20, 30) },
    runDurationMs: spread(9, 2000, 4000),
  }),
});
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
  const [stable, flaky] = workflows();
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
  const drift = (corpusRowId, variantId) => ({ corpusRowId, scenarioId: "identity-drift", workflowId: null, variantId, runs: 3, passRate: 1, flakeClass: "stable-pass" });
  assert.equal(validateBenchReport(report({ workflows: [...workflows(), drift("W20", "selector-only"), drift("W21", "text-only")] })).valid, true);
});

test("corpus rates are counts over totals within a workflow population", () => {
  for (const [label, override] of Object.entries({
    "count above total": { initialExecutionSuccess: { count: 4, total: 3, workflows: 3, rate: 4 / 3 } },
    "rate not count over total": { initialExecutionSuccess: { ...rate(2, 3, 3), rate: 0.5 } },
    "null rate with a total": { initialExecutionSuccess: { ...rate(2, 3, 3), rate: null } },
    "rate without a total": { fuzzyRecovery: { count: 0, total: 0, workflows: 0, rate: 0 } },
    "population beyond the results": { falseFailure: rate(1, 12, 4) },
    "total beyond workflows times repeats": { falseFailure: rate(1, 10, 3) },
    "empty population with a total": { falseFailure: rate(1, 9, 0) },
    "population larger than its total": { failureClassificationAccuracy: rate(0, 1, 2) },
    "fractional count": { falseFailure: rate(1.5, 9, 3) },
  })) rejects(report({ metrics: metrics({ rates: rates(override) }) }), label);
  rejects(report({ metrics: metrics({ rates: without(rates(), "harnessActivation") }) }), "missing rate metric");
  rejects(report({ metrics: metrics({ rates: { ...rates(), speed: rate(1, 1, 1) } }) }), "unknown rate metric");
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

// 3 workflow results x 3 repeats = 9 evaluated runs; the latency distributions carry 12 + 6 + 2 = 20 samples, one per executed action.
const covered = (overrides = {}) => report({ metrics: metrics({ notExecutedRuns: 4, actionsExecuted: 20, ...overrides }) });

test("a bench report round-trips the execution-coverage counts, and states them consistently", () => {
  assert.doesNotThrow(() => assertBenchReport(covered()));
  const parsed = parseBenchReportJson(JSON.stringify(covered()));
  assert.deepEqual([parsed.metrics.notExecutedRuns, parsed.metrics.actionsExecuted], [4, 20]);
  assert.deepEqual(parsed, covered());
  // Every run may have executed nothing; more runs than the bench evaluated may not.
  assert.equal(validateBenchReport(covered({ notExecutedRuns: 9 })).valid, true);
  assert.deepEqual(issuesOf(covered({ notExecutedRuns: 10 })), ["$.metrics.notExecutedRuns"]);
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
  const older = report();
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
  const comparison = compareBenchReports(baseline(), covered({}));
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

test("compareBenchReports applies the plan's tolerance per metric and direction", () => {
  const candidate = report();
  const comparison = compareBenchReports(baseline(), candidate);
  assert.equal(comparison.baselineReportId, "bench-2026-09-10-a");
  assert.deepEqual(comparison.metrics.map(({ metric, outcome }) => [metric, outcome]), [
    ["rate:flowCreationSuccess", "equivalent"],
    ["rate:initialExecutionSuccess", "equivalent"], // one workflow better: inside the one-workflow tolerance
    ["rate:deterministicReplaySuccess", "regressed"], // two workflows worse
    ["rate:falseFailure", "improved"], // lower is better
    ["rate:falseSuccess", "equivalent"],
    ["rate:failureClassificationAccuracy", "equivalent"],
    ["rate:harnessActivation", "equivalent"],
    ["action-latency-p95:web.dom.click", "regressed"], // 140 against 100: beyond 25%
    ["action-latency-p95:web.dom.extract", "equivalent"], // 55 against 50
    ["run-duration-p95", "improved"], // 2600 against 4000
  ]);
  const byMetric = Object.fromEntries(comparison.metrics.map((entry) => [entry.metric, entry]));
  assert.equal(byMetric["rate:initialExecutionSuccess"].tolerance, 1 / 3);
  assert.equal(byMetric["action-latency-p95:web.dom.click"].tolerance, 25);
  assert.equal(byMetric["action-latency-p95:web.dom.click"].candidate, 140);
  // No population, candidate-only, and baseline-only metrics are not compared.
  for (const metric of ["rate:fuzzyRecovery", "action-latency-p95:web.dom.scroll", "action-latency-p95:web.dom.type"]) assert.equal(byMetric[metric], undefined, metric);
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
  assert.equal(outcome("rate:initialExecutionSuccess", 1), "equivalent"); // 2/3 against 3/3: one workflow of three
  assert.equal(outcome("rate:initialExecutionSuccess", 0), "improved"); // two workflows better
  for (const metric of ["rate:fuzzyRecovery", "rate:speed", "action-latency-p95:web.dom.type", "action-latency-p95:constructor", "latency"]) assert.equal(compareBenchMetric(metric, 1, candidate), undefined, metric);
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
