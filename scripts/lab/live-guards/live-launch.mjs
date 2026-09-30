// Which Lab invocations the live-run guards apply to, and what they are called
// in the ledger.
//
// Every `--live-llm` run is guarded except `--dry-run`, which the runner
// defines as a provider-free check that the run would start: it spends
// nothing, so there is nothing for the guards to protect.

/**
 * @param {string[]} args the Lab arguments, as `run-lab.mjs` received them
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ instance: string, scenarioId: string, task: string } | null} null for a run that makes no provider call
 */
export function describeLiveLaunch(args, env) {
  if (!args.includes("--live-llm") || args.includes("--dry-run")) return null;
  const scenarioId = scenarioOf(args) ?? "unknown-scenario";
  const work = option(args, "--instruction-task") ?? option(args, "--llm-task") ?? "unknown-task";
  const workflow = option(args, "--workflow");
  const variant = option(args, "--variant");
  const task = [scenarioId, work, ...(workflow ? [`workflow=${workflow}`] : []), ...(variant ? [`variant=${variant}`] : [])].join("/");
  return { instance: env.FLUXIQ_LAB_INSTANCE?.trim() || "default", scenarioId, task };
}

/** `lab run <scenario>` names it second; a live `lab matrix` names exactly one in `--scenarios-json`. */
function scenarioOf(args) {
  if (args[0] === "run" && args[1] !== undefined && !args[1].startsWith("--")) return args[1];
  const json = option(args, "--scenarios-json");
  if (json === undefined) return null;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    // The runner refuses this argument itself; the ledger just cannot name it.
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  return Array.isArray(parsed) && typeof parsed[0] === "string" ? parsed.join(",") : null;
}

function option(args, name) {
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}
