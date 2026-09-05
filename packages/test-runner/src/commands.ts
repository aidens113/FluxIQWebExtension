import { requireSafePersistentWorkspaceName, type FluxIQTargetMode } from "./target-config.js";

export type EvidenceMode = "none" | "failure" | "checkpoints" | "events";
export type TargetMode = FluxIQTargetMode;
export type LabCommand =
  | { command: "run"; scenarioId: string; seed?: number; evidence: EvidenceMode; target?: TargetMode; workspace?: string; flowId?: string; freshLogin?: true }
  | { command: "matrix"; scenarioIds?: string[]; all: boolean; repeat: number; evidence: EvidenceMode; target?: TargetMode; workspace?: string; flowId?: string; freshLogin?: true }
  | { command: "auth"; operation: "status" | "clear" }
  | { command: "clone-cache"; operation: "status" | "refresh" | "clear" }
  | { command: "inspect"; runId: string }
  | { command: "compare"; baselineRunId: string; candidateRunId: string };

export function parseLabCommand(argv: string[]): LabCommand {
  const [command, ...args] = argv;
  if (command === "run") {
    rejectUnknownOptions(args, ["--seed", "--evidence", "--target", "--workspace", "--flow", "--fresh-login"]);
    const scenarioId = positional(args, 0, "scenario ID");
    return { command, scenarioId, ...optionalSeed(args), evidence: evidenceMode(args), ...targetOptions(args) };
  }
  if (command === "matrix") {
    rejectUnknownOptions(args, ["--all", "--scenarios-json", "--repeat", "--evidence", "--target", "--workspace", "--flow", "--fresh-login"]);
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
    return { command, all, repeat, evidence: evidenceMode(args), ...targetOptions(args), ...(scenarioIds ? { scenarioIds } : {}) };
  }
  if (command === "auth") {
    if (args.length !== 1 || (args[0] !== "status" && args[0] !== "clear")) throw new Error("Usage: lab auth status | auth clear");
    return { command, operation: args[0] };
  }
  if (command === "clone-cache") {
    if (args.length !== 1 || (args[0] !== "status" && args[0] !== "refresh" && args[0] !== "clear")) throw new Error("Usage: lab clone-cache status | clone-cache refresh | clone-cache clear");
    return { command, operation: args[0] };
  }
  if (command === "inspect") return { command, runId: positional(args, 0, "run ID") };
  if (command === "compare") return { command, baselineRunId: positional(args, 0, "baseline run ID"), candidateRunId: positional(args, 1, "candidate run ID") };
  throw new Error("Usage: lab run <scenario> [--target isolated|persistent-isolated|existing|clone] [--workspace NAME] [--flow ID] [--fresh-login] [--seed N] [--evidence MODE] | matrix (--all|--scenarios-json JSON) [--target isolated|persistent-isolated|existing|clone] [--workspace NAME] [--flow ID] [--fresh-login] [--repeat N] [--evidence MODE] | auth status|clear | clone-cache status|refresh|clear | inspect <run-id> | compare <baseline> <candidate>");
}

export function expandMatrix(command: Extract<LabCommand, { command: "matrix" }>, allScenarioIds: string[]): Array<{ scenarioId: string; repeatIndex: number }> {
  const ids = command.all ? allScenarioIds : command.scenarioIds ?? [];
  return ids.flatMap(scenarioId => Array.from({ length: command.repeat }, (_, repeatIndex) => ({ scenarioId, repeatIndex })));
}

function option(args: string[], name: string): string | undefined { const indexes = args.flatMap((value, index) => value === name ? [index] : []); if (indexes.length > 1) throw new Error(`${name} may only be specified once`); const index = indexes[0]; return index === undefined ? undefined : args[index + 1] ?? (() => { throw new Error(`${name} requires a value`); })(); }
function integerOption(args: string[], name: string, fallback: number): number { const value = option(args, name); if (value === undefined) return fallback; const parsed = Number(value); if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be an integer`); return parsed; }
function optionalSeed(args: string[]): { seed?: number } { const seed = option(args, "--seed"); if (seed === undefined) return {}; const parsed = Number(seed); if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 0xffffffff) throw new Error("--seed must be a uint32"); return { seed: parsed }; }
function evidenceMode(args: string[]): EvidenceMode { const value = option(args, "--evidence") ?? "failure"; if (!["none", "failure", "checkpoints", "events"].includes(value)) throw new Error("--evidence must be none, failure, checkpoints, or events"); return value as EvidenceMode; }
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
function positional(args: string[], index: number, label: string): string { const values = args.filter((value, offset) => offset === 0 || !args[offset - 1]?.startsWith("--")).filter(value => !value.startsWith("--")); const value = values[index]; if (!value) throw new Error(`${label} is required`); return value; }
