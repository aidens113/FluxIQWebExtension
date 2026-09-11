import { DEFAULT_LLM_LAB_BUDGET, assertLlmExecutionProfile, type LlmExecutionProfile, type LlmTaskKind } from "@fluxiq-web-extension/test-contracts";
import { requireSafePersistentWorkspaceName, type FluxIQTargetMode } from "./target-config.js";

export type EvidenceMode = "none" | "failure" | "checkpoints" | "events";
export type TargetMode = FluxIQTargetMode;
/** The targets the bench's recording lane runs on. */
export type BenchTargetMode = Extract<TargetMode, "isolated" | "persistent-isolated">;
// `evidence` is absent unless `--evidence` is given, so a scenario manifest's `evidencePolicy` drives capture.
// A compare report is a bench id under `<runs>/bench/`, or a path to its `report.json` or bench directory.
export type LabCommand =
  | { command: "run"; scenarioId: string; seed?: number; evidence?: EvidenceMode; workflowId?: string; target?: TargetMode; workspace?: string; flowId?: string; freshLogin?: true; llm?: LlmExecutionProfile }
  | { command: "matrix"; scenarioIds?: string[]; all: boolean; repeat: number; evidence?: EvidenceMode; target?: TargetMode; workspace?: string; flowId?: string; freshLogin?: true; llm?: LlmExecutionProfile }
  | { command: "bench"; corpusId: string; repeat: number; evidence?: EvidenceMode; target?: BenchTargetMode; workspace?: string }
  | { command: "auth"; operation: "status" | "clear" }
  | { command: "clone-cache"; operation: "status" | "refresh" | "clear" }
  | { command: "inspect"; runId: string }
  | { command: "compare"; baselineReport: string; candidateReport: string }
  | { command: "compare"; halvesReport: string }
  | { command: "interactive"; scenarioId: string; seed?: number; target?: TargetMode; workspace?: string; freshLogin?: true };

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const COMPARE_USAGE = "Usage: lab compare <baseline-report> <candidate-report> | compare <report> --halves (a report is a bench id or a path to its report.json)";

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
    rejectUnknownOptions(args, ["--seed", "--evidence", "--workflow", "--target", "--workspace", "--flow", "--fresh-login", ...llmOptionNames]);
    const scenarioId = positional(args, 0, "scenario ID");
    const llm = llmOptions(args);
    return { command, scenarioId, ...optionalSeed(args), ...optionalEvidence(args), ...optionalWorkflow(args), ...targetOptions(args), ...(llm ? { llm } : {}) };
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
    rejectUnknownOptions(args, ["--corpus", "--repeat", "--evidence", "--target", "--workspace"]);
    if (positionalValues(args).length) throw new Error("bench takes options only: lab bench --corpus ID [--repeat N] [--target isolated|persistent-isolated] [--workspace NAME] [--evidence MODE]");
    const corpusId = option(args, "--corpus");
    if (corpusId === undefined || !KEBAB_ID.test(corpusId)) throw new Error("bench requires --corpus with a lowercase kebab-case corpus ID");
    const repeat = integerOption(args, "--repeat", 1);
    if (repeat < 1 || repeat > 100) throw new Error("--repeat must be between 1 and 100");
    const { target, workspace } = targetOptions(args);
    if (target === "existing" || target === "clone") throw new Error("bench runs the recording lane: --target must be isolated or persistent-isolated");
    return { command, corpusId, repeat, ...optionalEvidence(args), ...(target ? { target } : {}), ...(workspace ? { workspace } : {}) };
  }
  if (command === "inspect") return { command, runId: positional(args, 0, "run ID") };
  if (command === "compare") {
    rejectUnknownOptions(args, ["--halves"]);
    if (args.filter(value => value === "--halves").length > 1) throw new Error("--halves may only be specified once");
    const reports = args.filter(value => value !== "--halves");
    const [first, second] = reports;
    if (args.includes("--halves")) {
      if (reports.length !== 1 || first === undefined) throw new Error(COMPARE_USAGE);
      return { command, halvesReport: first };
    }
    if (reports.length !== 2 || first === undefined || second === undefined) throw new Error(COMPARE_USAGE);
    return { command, baselineReport: first, candidateReport: second };
  }
  throw new Error("Usage: lab interactive <scenario> [--target isolated|persistent-isolated|existing] [--workspace NAME] [--fresh-login] | run <scenario> [--workflow ID] [--target isolated|persistent-isolated|existing|clone] [--workspace NAME] [--flow ID] [--fresh-login] [--seed N] [--evidence MODE] | matrix (--all|--scenarios-json JSON) [--target isolated|persistent-isolated|existing|clone] [--workspace NAME] [--flow ID] [--fresh-login] [--repeat N] [--evidence MODE] | bench --corpus ID [--repeat N] [--target isolated|persistent-isolated] [--workspace NAME] [--evidence MODE] | auth status|clear | clone-cache status|refresh|clear | inspect <run-id> | compare <baseline-report> <candidate-report> | compare <report> --halves");
}

export function expandMatrix(command: Extract<LabCommand, { command: "matrix" }>, allScenarioIds: string[]): Array<{ scenarioId: string; repeatIndex: number }> {
  const ids = command.all ? allScenarioIds : command.scenarioIds ?? [];
  return ids.flatMap(scenarioId => Array.from({ length: command.repeat }, (_, repeatIndex) => ({ scenarioId, repeatIndex })));
}

const llmOptionNames = [
  "--live-llm", "--llm-profile", "--llm-provider", "--llm-model", "--llm-task",
  "--llm-max-input-tokens", "--llm-max-output-tokens", "--llm-max-total-tokens",
  "--llm-max-calls", "--llm-timeout-ms", "--llm-max-retries", "--llm-max-cost-usd",
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
function optionalSeed(args: string[]): { seed?: number } { const seed = option(args, "--seed"); if (seed === undefined) return {}; const parsed = Number(seed); if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 0xffffffff) throw new Error("--seed must be a uint32"); return { seed: parsed }; }
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
