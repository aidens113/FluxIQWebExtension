export type FluxNodeHostProofCommand = { command: "fluxnode-host"; scenarioId: string; taskId: string; hosts: number; attempts: number; scriptedModel: true; lifecycleOnly?: true };

/** This proof has no live-provider mode and always proves several continuations. */
export function parseFluxNodeHostProofCommand(args: readonly string[]): FluxNodeHostProofCommand {
  const values = new Map<string, string>();
  let scripted = false;
  let lifecycleOnly = false;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]!;
    if (flag === "--lifecycle-only") {
      if (lifecycleOnly) throw new Error("--lifecycle-only may only be given once.");
      lifecycleOnly = true;
      continue;
    }
    if (flag === "--scripted-model") {
      if (scripted) throw new Error("--scripted-model may only be given once.");
      scripted = true;
      continue;
    }
    if (!["--scenario", "--task", "--hosts", "--attempts"].includes(flag)) throw new Error(`Unknown fluxnode-host option: ${flag}`);
    if (values.has(flag)) throw new Error(`${flag} may only be given once.`);
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value.`);
    values.set(flag, value);
  }
  if (!scripted) throw new Error("fluxnode-host requires --scripted-model; it never uses real provider keys.");
  const scenarioId = values.get("--scenario");
  const taskId = values.get("--task");
  if (!scenarioId || !taskId) throw new Error("fluxnode-host requires --scenario and --task.");
  const hosts = Number(values.get("--hosts") ?? "2");
  const attempts = Number(values.get("--attempts") ?? "4");
  if (!Number.isSafeInteger(hosts) || hosts < 2) throw new Error("fluxnode-host needs at least two hosts to prove isolation.");
  if (!Number.isSafeInteger(attempts) || attempts < 4) throw new Error("fluxnode-host needs exploration followed by at least three continuations.");
  return { command: "fluxnode-host", scenarioId, taskId, hosts, attempts, scriptedModel: true, ...(lifecycleOnly ? { lifecycleOnly: true } : {}) };
}
