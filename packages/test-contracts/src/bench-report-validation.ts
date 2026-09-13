import { BENCH_REPORT_SCHEMA_VERSION, benchFlakeClasses, benchRateMetrics, benchTargets, compareBenchMetric, type BenchCorpusMetrics, type BenchReport } from "./bench-report.js";
import { evaluationLanes, type EvaluationLane } from "./evaluation.js";
import { validateLlmUsage } from "./evaluation-validation.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "./validation.js";
import { add, array, date, enumeration, finite, isObject, keys, object, parseJson, result, text, type JsonObject } from "./runtime-validation.js";

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CORPUS_ROW_ID = /^[A-Z]+[0-9]+$/u;
/** The runner's `--repeat` bound. */
const MAX_REPEAT = 100;
const EPSILON = 1e-9;
const week2Keys = ["harnessRecovery", "adaptationCost", "adaptationValidation", "adaptationPersistence", "adaptationReuse"] as const;
/** Optional: the eight benches on disk before these existed omit both, and an omission is an unmeasured count, not a zero one. */
const coverageKeys = ["notExecutedRuns", "actionsExecuted"] as const;
const distributionKeys = ["runDurationMs", "sanitizedPacketBytes", "rawSnapshotBytes"] as const;
/** What a set of counts is bounded by: how many workflow results, each run `repeatCount` times. */
type Population = { workflows: number; repeatCount: number };
/** Every result the report lists, the results on each lane, and whether its results state a lane at all. */
type ReportPopulation = Population & { byLane: ReadonlyMap<EvaluationLane, number>; laned: boolean };

export function validateBenchReport(input: unknown): ValidationResult<BenchReport> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, ["schemaVersion", "reportId", "generatedAt", "corpusId", "repeatCount", "target", "workflows", "metrics", "llm", "comparison"], "$", issues);
    if (value.schemaVersion !== BENCH_REPORT_SCHEMA_VERSION) add(issues, "$.schemaVersion", `must equal ${BENCH_REPORT_SCHEMA_VERSION}`);
    text(value, "reportId", "$", issues);
    date(value.generatedAt, "$.generatedAt", issues);
    if (!isKebabId(value.corpusId)) add(issues, "$.corpusId", "must be a kebab-case corpus id");
    finite(value.repeatCount, "$.repeatCount", issues, 1, MAX_REPEAT, true);
    enumeration(value.target, benchTargets, "$.target", issues);
    checkWorkflows(value.workflows, value.repeatCount, issues);
    const metricsValid = checkCorpusMetrics(value.metrics, reportPopulation(value.workflows, value.repeatCount), issues);
    nest(validateLlmUsage(value.llm), "$.llm", issues);
    if (value.comparison !== null) checkComparison(value.comparison, value, metricsValid, issues);
  }
  return result(input, issues);
}
export function assertBenchReport(input: unknown): asserts input is BenchReport { const checked = validateBenchReport(input); if (!checked.valid) throw new ContractValidationError("BenchReport", checked.issues); }
export function parseBenchReportJson(json: string): BenchReport {
  let input: unknown;
  try { input = parseJson(json, "BenchReport"); } catch (error) { throw new ContractValidationError("BenchReport", [{ path: "$", message: error instanceof Error ? error.message : String(error) }]); }
  assertBenchReport(input); return input;
}

/**
 * Each result once per scenario, workflow, variant, and lane; each corpus row
 * naming one scenario workflow; a lane stated on every result or, as a report
 * written before lanes did, on none.
 */
function checkWorkflows(input: unknown, repeatCount: unknown, issues: ValidationIssue[]): void {
  array(input, "$.workflows", issues, (entry, path, target) => checkWorkflowResult(entry, path, repeatCount, target));
  if (!Array.isArray(input)) return;
  if (input.length === 0) add(issues, "$.workflows", "must list at least one workflow result");
  const results = new Set<string>(); const rows = new Map<string, string>();
  input.forEach((entry, index) => {
    if (!isObject(entry)) return;
    // The lane is part of a result's identity: an unarmed workflow runs on both lanes and is one result on each.
    const identity = JSON.stringify([entry.scenarioId, entry.workflowId, entry.variantId, entry.lane ?? null]);
    if (results.has(identity)) add(issues, `$.workflows[${index}]`, "repeats another result's scenario, workflow, variant, and lane");
    results.add(identity);
    if (typeof entry.corpusRowId !== "string") return;
    const workflow = JSON.stringify([entry.scenarioId, entry.workflowId]); const known = rows.get(entry.corpusRowId);
    if (known === undefined) rows.set(entry.corpusRowId, workflow);
    else if (known !== workflow) add(issues, `$.workflows[${index}].corpusRowId`, "names a row already mapped to another scenario workflow");
  });
  const laned = input.filter((entry) => isObject(entry) && entry.lane !== undefined).length;
  if (laned > 0 && laned < input.length) add(issues, "$.workflows", "must state lane on every result, or on none as a report written before lanes did");
}
function checkWorkflowResult(input: unknown, path: string, repeatCount: unknown, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["corpusRowId", "scenarioId", "workflowId", "variantId", "lane", "runs", "passRate", "flakeClass"], path, issues);
  if (typeof value.corpusRowId !== "string" || !CORPUS_ROW_ID.test(value.corpusRowId)) add(issues, `${path}.corpusRowId`, "must be a corpus row id such as W05");
  if (!isKebabId(value.scenarioId)) add(issues, `${path}.scenarioId`, "must be a kebab-case scenario id");
  for (const key of ["workflowId", "variantId"] as const) if (value[key] !== null && !isKebabId(value[key])) add(issues, `${path}.${key}`, "must be null or a kebab-case id");
  if (value.lane !== undefined) enumeration(value.lane, evaluationLanes, `${path}.lane`, issues);
  finite(value.runs, `${path}.runs`, issues, 1, MAX_REPEAT, true);
  if (typeof repeatCount === "number" && value.runs !== repeatCount) add(issues, `${path}.runs`, "must equal the report's repeatCount");
  finite(value.passRate, `${path}.passRate`, issues, 0, 1);
  enumeration(value.flakeClass, benchFlakeClasses, `${path}.flakeClass`, issues);
  if (typeof value.runs !== "number" || typeof value.passRate !== "number") return;
  const passes = value.passRate * value.runs;
  if (Math.abs(passes - Math.round(passes)) > EPSILON) add(issues, `${path}.passRate`, "must be a whole number of passing runs over runs");
  const flakeClass = value.passRate === 1 ? "stable-pass" : value.passRate === 0 ? "stable-fail" : "flaky";
  if (value.flakeClass !== flakeClass) add(issues, `${path}.flakeClass`, `must be ${flakeClass} for passRate ${value.passRate}`);
}
function reportPopulation(workflows: unknown, repeatCount: unknown): ReportPopulation {
  const results = Array.isArray(workflows) ? workflows : [];
  const byLane = new Map<EvaluationLane, number>();
  for (const entry of results) if (isObject(entry) && isLane(entry.lane)) byLane.set(entry.lane, (byLane.get(entry.lane) ?? 0) + 1);
  return { workflows: results.length, repeatCount: typeof repeatCount === "number" ? repeatCount : 0, byLane, laned: results.some((entry) => isObject(entry) && entry.lane !== undefined) };
}

/** Returns whether the metrics are valid, so comparisons are only recomputed from sound values. */
function checkCorpusMetrics(input: unknown, population: ReportPopulation, issues: ValidationIssue[]): boolean {
  const before = issues.length; const path = "$.metrics"; const value = object(input, path, issues);
  if (value) {
    keys(value, ["ratesByLane", "rates", "actionLatencyMs", ...distributionKeys, "truncationCount", ...coverageKeys, ...week2Keys], path, issues);
    checkRates(value, path, population, issues);
    const latency = object(value.actionLatencyMs, `${path}.actionLatencyMs`, issues);
    if (latency) for (const [actionType, distribution] of Object.entries(latency)) { if (!actionType) add(issues, `${path}.actionLatencyMs`, "action types must be non-empty"); checkDistribution(distribution, `${path}.actionLatencyMs.${actionType}`, issues); }
    for (const key of distributionKeys) checkDistribution(value[key], `${path}.${key}`, issues);
    finite(value.truncationCount, `${path}.truncationCount`, issues, 0, Number.MAX_SAFE_INTEGER, true);
    checkExecutionCoverage(value, path, population, issues);
    for (const key of week2Keys) if (value[key] !== null) add(issues, `${path}.${key}`, "must be null until Week 2 defines it");
  }
  return issues.length === before;
}
/**
 * Rates are per lane and never combined in any report whose results state
 * their lane: `ratesByLane` holds exactly the lanes the report lists results
 * on, each set bounded by that lane's results alone, and a combined `rates` is
 * refused. A report written before lanes states one `rates` over all of its
 * results and no per-lane rates.
 */
function checkRates(value: JsonObject, path: string, population: ReportPopulation, issues: ValidationIssue[]): void {
  const { repeatCount } = population;
  if (!population.laned) {
    if (value.ratesByLane !== undefined) add(issues, `${path}.ratesByLane`, "must be absent: rates are per lane only in a report whose results state their lane");
    checkRateSet(value.rates, `${path}.rates`, { workflows: population.workflows, repeatCount }, issues);
    return;
  }
  if (value.rates !== undefined) add(issues, `${path}.rates`, "must be absent: a report whose results state their lane states its rates per lane, never combined");
  const byLane = object(value.ratesByLane, `${path}.ratesByLane`, issues);
  if (!byLane) return;
  keys(byLane, evaluationLanes, `${path}.ratesByLane`, issues);
  for (const lane of evaluationLanes) {
    const results = population.byLane.get(lane) ?? 0; const lanePath = `${path}.ratesByLane.${lane}`;
    if (byLane[lane] === undefined) { if (results > 0) add(issues, lanePath, `must be stated: the report lists ${results} result(s) on the ${lane} lane`); }
    else if (results === 0) add(issues, lanePath, `must be absent: the report lists no result on the ${lane} lane`);
    else checkRateSet(byLane[lane], lanePath, { workflows: results, repeatCount }, issues);
  }
}
function checkRateSet(input: unknown, path: string, population: Population, issues: ValidationIssue[]): void {
  const rates = object(input, path, issues); if (!rates) return;
  keys(rates, benchRateMetrics, path, issues);
  for (const metric of benchRateMetrics) checkRate(rates[metric], `${path}.${metric}`, population, issues);
}
/**
 * The execution-coverage counts, each optional.
 *
 * **Absence is accepted and means unmeasured**, so every bench report written
 * before these fields existed still validates and still compares; it is not
 * read as zero anywhere, because a zero would assert that FluxIQ executed
 * nothing, which is a measurement and not the absence of one.
 *
 * When stated: `notExecutedRuns` is a whole number of runs no larger than the
 * evaluated population (`workflows` results times `repeatCount` runs each),
 * and `actionsExecuted` must equal the samples the action-latency
 * distributions carry, since one sample is recorded per executed action and
 * the two counts would otherwise be free to disagree in the same file.
 */
function checkExecutionCoverage(value: JsonObject, path: string, population: Population, issues: ValidationIssue[]): void {
  if (value.notExecutedRuns !== undefined) finite(value.notExecutedRuns, `${path}.notExecutedRuns`, issues, 0, population.workflows * population.repeatCount, true);
  if (value.actionsExecuted === undefined) return;
  finite(value.actionsExecuted, `${path}.actionsExecuted`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  const latency = value.actionLatencyMs;
  if (typeof value.actionsExecuted !== "number" || !isObject(latency)) return;
  const samples = Object.values(latency).reduce<number>((sum, distribution) => sum + (isObject(distribution) && typeof distribution.samples === "number" ? distribution.samples : 0), 0);
  if (samples !== value.actionsExecuted) add(issues, `${path}.actionsExecuted`, `must equal the ${samples} sample(s) its action-latency distributions carry: both count the actions FluxIQ executed`);
}
function checkRate(input: unknown, path: string, population: Population, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["count", "total", "workflows", "rate"], path, issues);
  for (const key of ["count", "total", "workflows"] as const) finite(value[key], `${path}.${key}`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  const { count, total, workflows, rate } = value;
  if (typeof count !== "number" || typeof total !== "number" || typeof workflows !== "number") return;
  if (count > total) add(issues, `${path}.count`, "must not exceed total");
  if (workflows > population.workflows) add(issues, `${path}.workflows`, "must not exceed the workflow results it counts over");
  if (workflows > total) add(issues, `${path}.workflows`, "must not exceed total: each workflow in the population adds at least one unit");
  if (total > 0 && workflows === 0) add(issues, `${path}.workflows`, "must be positive when total is");
  if (total > workflows * population.repeatCount) add(issues, `${path}.total`, "must not exceed workflows times repeatCount");
  if (total === 0) { if (rate !== null) add(issues, `${path}.rate`, "must be null when total is 0"); }
  else if (typeof rate !== "number" || Math.abs(rate - count / total) > EPSILON) add(issues, `${path}.rate`, "must equal count / total");
}
function checkDistribution(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["samples", "p50", "p95"], path, issues);
  finite(value.samples, `${path}.samples`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  if (value.samples === 0) { if (value.p50 !== null || value.p95 !== null) add(issues, path, "p50 and p95 must be null without samples"); return; }
  finite(value.p50, `${path}.p50`, issues); finite(value.p95, `${path}.p95`, issues);
  if (typeof value.p50 === "number" && typeof value.p95 === "number" && value.p50 > value.p95) add(issues, `${path}.p95`, "must not be below p50");
}

/** Every entry must be what `compareBenchMetric` yields for its baseline against this report. */
function checkComparison(input: unknown, report: JsonObject, metricsValid: boolean, issues: ValidationIssue[]): void {
  const path = "$.comparison";
  if (!isObject(input)) { add(issues, path, "must be null or an object"); return; }
  keys(input, ["baselineReportId", "metrics"], path, issues);
  text(input, "baselineReportId", path, issues);
  if (input.baselineReportId === report.reportId) add(issues, `${path}.baselineReportId`, "must differ from reportId");
  const seen = new Set<string>();
  const candidate = { metrics: report.metrics as BenchCorpusMetrics, workflows: (Array.isArray(report.workflows) ? report.workflows : []) as BenchReport["workflows"] };
  array(input.metrics, `${path}.metrics`, issues, (entry, entryPath, target) => {
    const compared = object(entry, entryPath, target); if (!compared) return;
    keys(compared, ["metric", "baseline", "candidate", "tolerance", "outcome"], entryPath, target);
    text(compared, "metric", entryPath, target);
    for (const key of ["baseline", "candidate", "tolerance"] as const) finite(compared[key], `${entryPath}.${key}`, target);
    enumeration(compared.outcome, ["improved", "regressed", "equivalent"], `${entryPath}.outcome`, target);
    if (typeof compared.metric !== "string") return;
    if (seen.has(compared.metric)) add(target, `${entryPath}.metric`, "must be unique");
    seen.add(compared.metric);
    if (!metricsValid || typeof compared.baseline !== "number") return;
    const expected = compareBenchMetric(compared.metric, compared.baseline, candidate);
    if (!expected) { add(target, `${entryPath}.metric`, "names no metric this report measured"); return; }
    if (!near(compared.candidate, expected.candidate)) add(target, `${entryPath}.candidate`, "must equal this report's value");
    if (!near(compared.tolerance, expected.tolerance)) add(target, `${entryPath}.tolerance`, "must be the plan's tolerance for this metric");
    if (compared.outcome !== expected.outcome) add(target, `${entryPath}.outcome`, `must be ${expected.outcome} under the applied tolerance`);
  });
}

/** Adds a nested contract's issues, re-rooted from `$` at `path`. */
function nest(checked: ValidationResult<unknown>, path: string, issues: ValidationIssue[]): void {
  if (!checked.valid) for (const issue of checked.issues) issues.push({ path: path + issue.path.slice(1), message: issue.message });
}
const near = (actual: unknown, expected: number): boolean => typeof actual === "number" && Math.abs(actual - expected) <= EPSILON * Math.max(1, Math.abs(expected));
const isKebabId = (input: unknown): boolean => typeof input === "string" && KEBAB_ID.test(input);
const isLane = (input: unknown): input is EvaluationLane => typeof input === "string" && (evaluationLanes as readonly string[]).includes(input);
