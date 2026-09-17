import { DEFAULT_LLM_LAB_BUDGET, assertLlmExecutionProfile, type LlmExecutionProfile, type LlmTaskKind } from "@fluxiq-web-extension/test-contracts";
import { requireSafePersistentWorkspaceName, type FluxIQTargetMode } from "./target-config.js";

export type EvidenceMode = "none" | "failure" | "checkpoints" | "events";
export type TargetMode = FluxIQTargetMode;
/** The targets the bench's recording lane runs on. */
export type BenchTargetMode = Extract<TargetMode, "isolated" | "persistent-isolated">;
// `evidence` is absent unless `--evidence` is given, so a scenario manifest's `evidencePolicy` drives capture.
// A compare report is a bench id under `<runs>/bench/`, or a path to its `report.json` or bench directory.
export type LabCommand =
  // `instructionTaskId` and `dryRun` exist only with `llm.task` `create-flow`: the live instruction task to build from, and a provider-free check that the run would start.
  | { command: "run"; scenarioId: string; seed?: number; evidence?: EvidenceMode; workflowId?: string; variantId?: string; flowLane?: true; target?: TargetMode; workspace?: string; flowId?: string; freshLogin?: true; llm?: LlmExecutionProfile; instructionTaskId?: string; dryRun?: true }
  | { command: "matrix"; scenarioIds?: string[]; all: boolean; repeat: number; evidence?: EvidenceMode; target?: TargetMode; workspace?: string; flowId?: string; freshLogin?: true; llm?: LlmExecutionProfile }
  | { command: "bench"; resumeBenchId: string }
  | { command: "bench"; corpusId: string; repeat: number; evidence?: EvidenceMode; target?: BenchTargetMode; workspace?: string; shards?: number; jobs?: number }
  | { command: "auth"; operation: "status" | "clear" }
  | { command: "clone-cache"; operation: "status" | "refresh" | "clear" }
  | { command: "inspect"; runId: string }
  | { command: "compare"; baselineReport: string; candidateReport: string; sharedLoad: boolean }
  | { command: "compare"; halvesReport: string }
  | { command: "interactive"; scenarioId: string; seed?: number; target?: TargetMode; workspace?: string; freshLogin?: true };

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const COMPARE_USAGE = "Usage: lab compare <baseline-report> <candidate-report> [--sequential] | compare <report> --halves (a report is a bench id or a path to its report.json)";

export function parseLabCommand(argv: string[]): LabCommand {
  const [command, ...args] = argv;
  if (command === "interactive") {
    rejectUnknownOptions(args, ["--seed", "--target", "--workspace", "--fresh-login"]);
    const scenarioId = positional(args, 0, "scenario ID");
    const target = targetOptions(args);
    if (target.flowId) throw new Error("interactive mode does not accept --flow");
    if (target.target === "clone") throw new Error("interactive mode does not support clone targets");
    return { command, scenarioId, ...optionalSeed(args), ...(target.target ? { target: target.target } : {}), ...(target.workspace ? { workspace: target.workspace } : {}), ...(target.freshLogin ? { freshLogin: true } : {}) };
  }
  if (command === "run") {
    rejectUnknownOptions(args, ["--seed", "--evidence", "--workflow", "--variant", "--target", "--workspace", "--flow", "--fresh-login", "--instruction-task", "--dry-run", ...llmOptionNames]);
    const { flowLane, rest: withoutFlow } = flowLaneOption(args);
    const { dryRun, rest } = dryRunOption(withoutFlow);
    const scenarioId = positional(rest, 0, "scenario ID");
    const llm = llmOptions(rest);
    const target = targetOptions(rest);
    if (flowLane && (target.target === "existing" || target.target === "clone")) throw new Error("--flow builds a Flow from the run's own recording; existing and clone targets run a pre-existing Flow");
    const variant = optionalVariant(rest);
    const creation = creationOptions(rest, llm, { flowLane, dryRun });
    // A created Flow is built for the task's variant and run on it, so the variant needs no recorded Flow lane.
    if (variant.variantId && !flowLane && !creation) throw new Error("--variant requires --flow: a variant is armed only before a Flow run");
    return { command, scenarioId, ...optionalSeed(rest), ...optionalEvidence(rest), ...optionalWorkflow(rest), ...variant, ...target, ...(flowLane ? { flowLane: true as const } : {}), ...(llm ? { llm } : {}), ...creation };
  }
  if (command === "matrix") {
    rejectUnknownOptions(args, ["--all", "--scenarios-json", "--repeat", "--evidence", "--target", "--workspace", "--flow", "--fresh-login", ...llmOptionNames]);
    const all = args.includes("--all");
    const json = option(args, "--scenarios-json");
    if (all === Boolean(json)) throw new Error("matrix requires exactly one of --all or --scenarios-json");
    const repeat = integerOption(args, "--repeat", 1);
    if (repeat < 1 || repeat > 100) throw new Error("--repeat must be between 1 and 100");
    let scenarioIds: string[] | undefined;
    if (json) {
      const parsed: unknown = JSON.parse(json);
      if (!Array.isArray(parsed) || !parsed.length || parsed.some(item => typeof item !== "string")) throw new Error("--scenarios-json must be a non-empty JSON string array");
      scenarioIds = parsed;
    }
    const llm = llmOptions(args);
    if (llm?.task === "create-flow") throw new Error("--llm-task create-flow builds one instruction task per run: use lab run <scenario> --instruction-task ID");
    if (llm && (all || scenarioIds?.length !== 1)) throw new Error("live LLM matrix mode requires exactly one explicit scenario");
    if (llm && repeat !== 1) throw new Error("live LLM matrix mode requires --repeat 1");
    return { command, all, repeat, ...optionalEvidence(args), ...targetOptions(args), ...(scenarioIds ? { scenarioIds } : {}), ...(llm ? { llm } : {}) };
  }
  if (command === "auth") {
    if (args.length !== 1 || (args[0] !== "status" && args[0] !== "clear")) throw new Error("Usage: lab auth status | auth clear");
    return { command, operation: args[0] };
  }
  if (command === "clone-cache") {
    if (args.length !== 1 || (args[0] !== "status" && args[0] !== "refresh" && args[0] !== "clear")) throw new Error("Usage: lab clone-cache status | clone-cache refresh | clone-cache clear");
    return { command, operation: args[0] };
  }
  if (command === "bench") {
    rejectUnknownOptions(args, ["--resume", "--corpus", "--repeat", "--evidence", "--target", "--workspace", "--shards", "--jobs"]);
    const resumeBenchId = option(args, "--resume");
    if (resumeBenchId !== undefined) {
      if (!/^bench-[a-z0-9]+-[0-9a-f]{8}$/u.test(resumeBenchId)) throw new Error("--resume requires a valid bench ID");
      if (args.length !== 2) throw new Error("--resume cannot be combined with corpus, repeat, target, workspace, evidence, shards, jobs, or positional options");
      return { command, resumeBenchId };
    }
    if (positionalValues(args).length) throw new Error("bench takes options only: lab bench --corpus ID [--repeat N] [--target isolated|persistent-isolated] [--workspace NAME] [--evidence MODE] [--shards N [--jobs N]] | lab bench --resume BENCH_ID");
    const corpusId = option(args, "--corpus");
    if (corpusId === undefined || !KEBAB_ID.test(corpusId)) throw new Error("bench requires --corpus with a lowercase kebab-case corpus ID");
    const repeat = integerOption(args, "--repeat", 1);
    if (repeat < 1 || repeat > 100) throw new Error("--repeat must be between 1 and 100");
    const shards = optionalIntegerOption(args, "--shards");
    const jobs = optionalIntegerOption(args, "--jobs");
    if (shards !== undefined && (shards < 2 || shards > 8)) throw new Error("--shards must be between 2 and 8");
    if (jobs !== undefined && shards === undefined) throw new Error("--jobs requires --shards");
    if (jobs !== undefined && (jobs < 1 || jobs > shards!)) throw new Error("--jobs must be between 1 and --shards");
    const { target, workspace } = targetOptions(args);
    if (target === "existing" || target === "clone") throw new Error("bench runs the recording lane: --target must be isolated or persistent-isolated");
    if (shards !== undefined && target === "persistent-isolated") throw new Error("--shards currently requires the isolated target");
    return { command, corpusId, repeat, ...optionalEvidence(args), ...(target ? { target } : {}), ...(workspace ? { workspace } : {}), ...(shards === undefined ? {} : { shards }), ...(jobs === undefined ? {} : { jobs }) };
  }
  if (command === "inspect") return { command, runId: positional(args, 0, "run ID") };
  if (command === "compare") {
    rejectUnknownOptions(args, ["--halves", "--sequential"]);
    if (args.filter(value => value === "--halves").length > 1) throw new Error("--halves may only be specified once");
    if (args.filter(value => value === "--sequential").length > 1) throw new Error("--sequential may only be specified once");
    const reports = args.filter(value => value !== "--halves" && value !== "--sequential");
    const [first, second] = reports;
    if (args.includes("--halves")) {
      if (reports.length !== 1 || first === undefined || args.includes("--sequential")) throw new Error(COMPARE_USAGE);
      return { command, halvesReport: first };
    }
    if (reports.length !== 2 || first === undefined || second === undefined) throw new Error(COMPARE_USAGE);
    return { command, baselineReport: first, candidateReport: second, sharedLoad: !args.includes("--sequential") };
  }
  throw new Error("Usage: lab interactive <scenario> [--target isolated|persistent-isolated|existing] [--workspace NAME] [--fresh-login] | run <scenario> [--workflow ID] [--target isolated|persistent-isolated|existing|clone] [--workspace NAME] [--flow ID] [--fresh-login] [--seed N] [--evidence MODE] | matrix (--all|--scenarios-json JSON) [--target isolated|persistent-isolated|existing|clone] [--workspace NAME] [--flow ID] [--fresh-login] [--repeat N] [--evidence MODE] | bench --corpus ID [--repeat N] [--target isolated|persistent-isolated] [--workspace NAME] [--evidence MODE] [--shards N [--jobs N]] | bench --resume BENCH_ID | auth status|clear | clone-cache status|refresh|clear | inspect <run-id> | compare <baseline-report> <candidate-report> [--sequential] | compare <report> --halves");
}

export function expandMatrix(command: Extract<LabCommand, { command: "matrix" }>, allScenarioIds: string[]): Array<{ scenarioId: string; repeatIndex: number }> {
  const ids = command.all ? allScenarioIds : command.scenarioIds ?? [];
  return ids.flatMap(scenarioId => Array.from({ length: command.repeat }, (_, repeatIndex) => ({ scenarioId, repeatIndex })));
}

const llmOptionNames = [
  "--live-llm", "--llm-profile", "--llm-provider", "--llm-model", "--llm-task",
  "--llm-max-input-tokens", "--llm-max-output-tokens", "--llm-max-total-tokens",
  "--llm-max-calls", "--llm-max-run-tokens", "--llm-timeout-ms", "--llm-max-retries", "--llm-max-cost-usd",
] as const;

function llmOptions(args: string[]): LlmExecutionProfile | undefined {
  const enabled = args.includes("--live-llm");
  if (args.filter(value => value === "--live-llm").length > 1) throw new Error("--live-llm may only be specified once");
  const present = llmOptionNames.filter(name => name !== "--live-llm" && args.includes(name));
  if (!enabled) {
    if (present.length) throw new Error("LLM options require explicit --live-llm");
    return undefined;
  }
  const required = (name: string): string => option(args, name) ?? (() => { throw new Error(name + " is required with --live-llm"); })();
  const profileId = required("--llm-profile");
  const provider = required("--llm-provider");
  const model = required("--llm-model");
  const task = required("--llm-task");
  if (!["create-flow", "refine-recording", "edit-flow", "diagnose", "adapt"].includes(task)) throw new Error("--llm-task is invalid");
  const cost = option(args, "--llm-max-cost-usd");
  const maxEstimatedCostUsd = cost === undefined ? undefined : Number(cost);
  if (maxEstimatedCostUsd !== undefined && (!Number.isFinite(maxEstimatedCostUsd) || maxEstimatedCostUsd < 0)) throw new Error("--llm-max-cost-usd must be a non-negative number");
  // Absent unless typed: the run token budget then defaults where it is
  // enforced, so an unset option cannot be mistaken for a chosen number.
  const maxTotalTokensPerRun = optionalIntegerOption(args, "--llm-max-run-tokens");
  const profile: LlmExecutionProfile = {
    schemaVersion: "0.1",
    profileId,
    mode: "live",
    provider,
    model,
    task: task as LlmTaskKind,
    scenarioNetworkPolicy: "loopback-only",
    providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false,
    approvalMode: "manual",
    retainRawPrompts: false,
    retainRawResponses: false,
    maxConcurrentRuns: 1,
    budget: {
      maxInputTokens: integerOption(args, "--llm-max-input-tokens", DEFAULT_LLM_LAB_BUDGET.maxInputTokens),
      maxOutputTokens: integerOption(args, "--llm-max-output-tokens", DEFAULT_LLM_LAB_BUDGET.maxOutputTokens),
      maxTotalTokensPerRequest: integerOption(args, "--llm-max-total-tokens", DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest),
      maxCallsPerRun: integerOption(args, "--llm-max-calls", DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun),
      ...(maxTotalTokensPerRun === undefined ? {} : { maxTotalTokensPerRun }),
      timeoutMs: integerOption(args, "--llm-timeout-ms", DEFAULT_LLM_LAB_BUDGET.timeoutMs),
      maxRetries: integerOption(args, "--llm-max-retries", DEFAULT_LLM_LAB_BUDGET.maxRetries),
      maxEstimatedCostUsd: maxEstimatedCostUsd ?? DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd,
    },
  };
  assertLlmExecutionProfile(profile);
  return profile;
}
function option(args: string[], name: string): string | undefined { const indexes = args.flatMap((value, index) => value === name ? [index] : []); if (indexes.length > 1) throw new Error(`${name} may only be specified once`); const index = indexes[0]; return index === undefined ? undefined : args[index + 1] ?? (() => { throw new Error(`${name} requires a value`); })(); }
function integerOption(args: string[], name: string, fallback: number): number { const value = option(args, name); if (value === undefined) return fallback; const parsed = Number(value); if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be an integer`); return parsed; }
function optionalIntegerOption(args: string[], name: string): number | undefined { const value = option(args, name); if (value === undefined) return undefined; const parsed = Number(value); if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be an integer`); return parsed; }
function optionalSeed(args: string[]): { seed?: number } { const seed = option(args, "--seed"); if (seed === undefined) return {}; const parsed = Number(seed); if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 0xffffffff) throw new Error("--seed must be a uint32"); return { seed: parsed }; }
/**
 * `--flow` carries a value on the existing and clone targets, where it names
 * the persisted Flow to run, and carries none on the Flow lane, where the
 * Flow is built from the run's own recording. The two are told apart by what
 * follows: a Flow id never begins with `--`, so a `--flow` at the end of the
 * arguments or followed by another option is the lane flag. The lane flag is
 * removed from the arguments the value-taking options then read.
 */
function flowLaneOption(args: string[]): { flowLane: boolean; rest: string[] } {
  const index = args.indexOf("--flow");
  if (index === -1) return { flowLane: false, rest: args };
  if (args.filter(value => value === "--flow").length > 1) throw new Error("--flow may only be specified once");
  const next = args[index + 1];
  if (next !== undefined && !next.startsWith("--")) return { flowLane: false, rest: args };
  return { flowLane: true, rest: [...args.slice(0, index), ...args.slice(index + 1)] };
}
/**
 * `--dry-run` takes no value, so it is removed from the arguments before a
 * positional is read, as the lane flag is, or a scenario id after it would be
 * read as its value.
 */
function dryRunOption(args: string[]): { dryRun: boolean; rest: string[] } {
  const count = args.filter(value => value === "--dry-run").length;
  if (count > 1) throw new Error("--dry-run may only be specified once");
  return { dryRun: count === 1, rest: args.filter(value => value !== "--dry-run") };
}
/**
 * The created-Flow lane's options, `undefined` when the run is not one. They
 * belong to `--llm-task create-flow` alone, and that task builds its Flow from
 * an instruction task rather than from the run's recording, so the lane flag
 * is refused with it.
 */
function creationOptions(args: string[], llm: LlmExecutionProfile | undefined, flags: { flowLane: boolean; dryRun: boolean }): { instructionTaskId?: string; dryRun?: true } | undefined {
  const taskId = option(args, "--instruction-task");
  if (llm?.task !== "create-flow") {
    if (taskId !== undefined || flags.dryRun) throw new Error("--instruction-task and --dry-run require --live-llm --llm-task create-flow");
    return undefined;
  }
  if (flags.flowLane) throw new Error("--llm-task create-flow builds its Flow from an instruction task, not from the run's recording: drop --flow");
  if (taskId !== undefined && !KEBAB_ID.test(taskId)) throw new Error("--instruction-task must be a lowercase kebab-case task ID");
  return { ...(taskId === undefined ? {} : { instructionTaskId: taskId }), ...(flags.dryRun ? { dryRun: true as const } : {}) };
}
/** The variant of the resolved workflow the Flow lane arms before its run. */
function optionalVariant(args: string[]): { variantId?: string } { const value = option(args, "--variant"); if (value === undefined) return {}; if (!KEBAB_ID.test(value)) throw new Error("--variant must be a lowercase kebab-case variant ID"); return { variantId: value }; }
/** A `workflows[]` entry of the scenario; without the flag the manifest's primary workflow runs. */
function optionalWorkflow(args: string[]): { workflowId?: string } { const value = option(args, "--workflow"); if (value === undefined) return {}; if (!KEBAB_ID.test(value)) throw new Error("--workflow must be a lowercase kebab-case workflow ID"); return { workflowId: value }; }
/** Absent unless `--evidence` is given, so the scenario manifest's `evidencePolicy` drives capture. */
function optionalEvidence(args: string[]): { evidence?: EvidenceMode } { const value = option(args, "--evidence"); if (value === undefined) return {}; if (!["none", "failure", "checkpoints", "events"].includes(value)) throw new Error("--evidence must be none, failure, checkpoints, or events"); return { evidence: value as EvidenceMode }; }
function targetOptions(args: string[]): { target?: TargetMode; workspace?: string; flowId?: string; freshLogin?: true } {
  const target = option(args, "--target");
  if (target !== undefined && target !== "isolated" && target !== "persistent-isolated" && target !== "existing" && target !== "clone") throw new Error("--target must be isolated, persistent-isolated, existing, or clone");
  const workspaceValue = option(args, "--workspace");
  const workspace = workspaceValue === undefined ? undefined : requireSafePersistentWorkspaceName(workspaceValue, "--workspace");
  const flowId = option(args, "--flow");
  if (flowId !== undefined && !flowId.trim()) throw new Error("--flow must not be empty");
  const freshLogin = args.includes("--fresh-login");
  if (args.filter(value => value === "--fresh-login").length > 1) throw new Error("--fresh-login may only be specified once");
  if (target && target !== "persistent-isolated" && workspace) throw new Error("--workspace requires --target persistent-isolated");
  if (target === "persistent-isolated" && !workspace) throw new Error("--workspace is required with --target persistent-isolated");
  if (target === "persistent-isolated" && (flowId || freshLogin)) throw new Error("persistent-isolated target cannot use --flow or --fresh-login");
  return { ...(target ? { target } : {}), ...(workspace ? { workspace } : {}), ...(flowId ? { flowId: flowId.trim() } : {}), ...(freshLogin ? { freshLogin: true as const } : {}) };
}
function rejectUnknownOptions(args: string[], allowed: string[]) { for (const value of args) if (value.startsWith("--") && !allowed.includes(value)) throw new Error(`Unknown option: ${value}`); }
function positional(args: string[], index: number, label: string): string { const value = positionalValues(args)[index]; if (!value) throw new Error(`${label} is required`); return value; }
/** Arguments that are neither an option nor the value following one. */
function positionalValues(args: string[]): string[] { return args.filter((value, offset) => offset === 0 || !args[offset - 1]?.startsWith("--")).filter(value => !value.startsWith("--")); }
