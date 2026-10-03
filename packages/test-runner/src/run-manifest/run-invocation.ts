// The command that started a run, as its manifest records it.
//
// `entry.json` and `run.json` carried the task and never the command, so a
// debug could not say how a run had been started. The Lab hands the runner
// its own argv and the names of the FLUXIQ_ variables the person set
// (`scripts/lab/lab-invocation.mjs`); a run started without the Lab records
// the runner's own argv. Either way the record is screened here, where it is
// written: a variable's value is never read, and an argument that looks like a
// secret -- by its flag's name or by its own shape -- is replaced.

import { redactText } from "@fluxiq-web-extension/test-evidence";

/** The variable the Lab passes its record in; it must match `scripts/lab/lab-invocation.mjs`. */
export const LAB_INVOCATION_VARIABLE = "FLUXIQ_LAB_INVOCATION";
/** What stands in for an argument that was screened. */
export const SCREENED_ARGUMENT = "[screened]";

export type RunInvocation = {
  /** `run-lab` when the Lab's record was read; `test-runner` when the runner's own argv stands in. */
  via: "run-lab" | "test-runner";
  /** The Lab script, when the Lab started the run. */
  script?: string;
  /** Present when the Lab passed a record that could not be read. */
  labInvocation?: "unreadable";
  /** The arguments after the script, screened. */
  args: string[];
  /** The FLUXIQ_ variables that were set, by name only, sorted. */
  fluxiqEnvironment: string[];
};

const FLUXIQ_NAME = /^FLUXIQ_[A-Z0-9_]+$/u;
/** A flag whose name says its value is a credential. */
const SECRET_FLAG = /^--?[A-Za-z0-9-]*(?:token|secret|password|passwd|apikey|api-key|key|auth|authorization|bearer|cookie|credential)s?$/iu;
/** A value whose shape is a credential: a provider key, a bearer header, a JWT, a long hex run, or `name=value` naming one; `keyLikeRun` adds a long mixed-case run. */
const SECRET_SHAPES = [
  /\b(?:sk|pk|rk|ghp|gho|github_pat|xox[abpr])[-_][A-Za-z0-9_-]{8,}/u,
  /\bBearer\s+\S+/iu,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./u,
  /\b[0-9a-f]{32,}\b/iu,
  /(?:token|secret|password|passwd|api[_-]?key|auth(?:orization)?|cookie|credential)s?\s*[=:]/iu,
] as const;

/** How this run was started: the Lab's record when it passed one, else this process's argv. */
export function runInvocation(env: NodeJS.ProcessEnv = process.env, argv: readonly string[] = process.argv.slice(2)): RunInvocation {
  const passed = env[LAB_INVOCATION_VARIABLE];
  if (passed !== undefined) {
    const record = labRecord(passed);
    if (record !== "unreadable") return { via: "run-lab", script: record.script, args: screenArguments(record.args), fluxiqEnvironment: fluxiqNames(record.environment) };
  }
  return {
    via: "test-runner",
    ...(passed === undefined ? {} : { labInvocation: "unreadable" as const }),
    args: screenArguments(argv),
    fluxiqEnvironment: fluxiqNames(Object.keys(env)),
  };
}

/** The Lab's record, or `unreadable` when what was passed is not one: said in the manifest, never read as no record. */
function labRecord(text: string): { script: string; args: string[]; environment: unknown[] } | "unreadable" {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return "unreadable"; }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "unreadable";
  const { script, args, environment } = value as Record<string, unknown>;
  return {
    script: typeof script === "string" && /^[A-Za-z0-9_./-]{1,200}$/u.test(script) ? script : "scripts/lab/run-lab.mjs",
    args: Array.isArray(args) ? args.filter((arg): arg is string => typeof arg === "string") : [],
    environment: Array.isArray(environment) ? environment : [],
  };
}

function fluxiqNames(names: readonly unknown[]): string[] {
  return [...new Set(names.filter((name): name is string => typeof name === "string" && FLUXIQ_NAME.test(name) && name !== LAB_INVOCATION_VARIABLE))].sort();
}

/** Each argument as it may be written: a secret-named flag's value and any secret-shaped argument replaced. */
function screenArguments(args: readonly string[]): string[] {
  const screened: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    const equals = arg.indexOf("=");
    if (arg.startsWith("-") && equals > 0 && SECRET_FLAG.test(arg.slice(0, equals))) {
      screened.push(`${arg.slice(0, equals)}=${SCREENED_ARGUMENT}`);
      continue;
    }
    screened.push(secretShaped(arg) ? SCREENED_ARGUMENT : arg);
    // `--token value`: the next argument is the flag's value, whatever it looks like.
    if (SECRET_FLAG.test(arg) && index + 1 < args.length) {
      screened.push(SCREENED_ARGUMENT);
      index += 1;
    }
  }
  return screened;
}

function secretShaped(arg: string): boolean {
  return redactText(arg) !== arg || SECRET_SHAPES.some((shape) => shape.test(arg)) || keyLikeRun(arg);
}

/** A run of 32 or more key characters mixing upper case, lower case and digits: what a token looks like and a path segment or a kebab id does not. */
function keyLikeRun(arg: string): boolean {
  return (arg.match(/[A-Za-z0-9+_-]{32,}={0,2}/gu) ?? []).some((run) => /[A-Z]/u.test(run) && /[a-z]/u.test(run) && /[0-9]/u.test(run));
}
