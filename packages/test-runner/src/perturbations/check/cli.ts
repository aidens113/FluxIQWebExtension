// `node dist/perturbations/check/cli.js --kind drop-action-result|stop-service-worker [--evidence <dir>]`
//
// The headed, provider-free proof that a run perturbation fires at the right
// moment and is recorded (`run-perturbation-check.ts`). Provider credentials
// are removed from this process before anything it starts can inherit them.
// Prints one JSON line and exits 0 only when the fault was proven.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withoutProviderSecrets } from "../../environment.js";
import type { RunPerturbation } from "../run-perturbation.js";
import { runPerturbationCheck } from "./run-perturbation-check.js";

const scrubbed = withoutProviderSecrets(process.env);
for (const key of Object.keys(process.env)) if (!(key in scrubbed)) delete process.env[key];

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const fluxiqRepositoryRoot = path.resolve(repositoryRoot, "..", "!FluxIQ");
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1]! : fallback;
};

/** The fault on the check's act: its acknowledgement, or the worker when the confirm request reaches the site. */
const PERTURBATIONS: Record<string, RunPerturbation> = {
  "drop-action-result": { kind: "drop-action-result", afterCommittingActs: 1 },
  "stop-service-worker": { kind: "stop-service-worker", onSiteRequest: "/api/social-network-feed/confirm-request" },
};

const kind = option("--kind", "");
const perturbation = PERTURBATIONS[kind];
if (!perturbation) {
  process.stderr.write(`--kind must be one of: ${Object.keys(PERTURBATIONS).join(", ")}\n`);
  process.exitCode = 64;
} else {
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const evidenceRoot = option("--evidence", path.join(repositoryRoot, "test-runs", "perturbation-check"));
  const result = await runPerturbationCheck({ repositoryRoot, fluxiqRepositoryRoot, perturbation, evidenceDirectory: path.join(evidenceRoot, `${stamp}-${kind}`), log: line => process.stderr.write(`${line}\n`) });
  process.stdout.write(`${JSON.stringify({ kind, proven: result.proven, reasons: result.reasons, stage: result.stage, coreResult: result.coreResult, siteTookTheAct: result.siteTookTheAct, firedEvent: result.report?.firedEvent ?? null, firedAt: result.report?.firedAt ?? null, failure: result.failure?.split("\n")[0] ?? null, evidence: result.evidenceDirectory })}\n`);
  process.exitCode = result.proven ? 0 : 2;
}
