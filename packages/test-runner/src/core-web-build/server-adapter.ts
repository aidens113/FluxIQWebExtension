import { createHash } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { withoutProviderSecrets } from "../environment.js";
import type { ProcessSupervisor } from "../process-supervisor.js";
import { RunnerFailure } from "../failure.js";
import { runBoundedBuildStep, type BuildStepBound } from "./build-step.js";
import { expectedServerAdapterIdentity, normalizeServerAdapterArtifact, screenServerAdapterIdentity } from "../run-scenario/browser-session/server-adapter-identity/index.js";
const artifactPath = (web: string) => path.join(web, ".server-runtime/client-gateway-server.mjs");
/**
 * The generator prints nothing until it finishes (esbuild runs with
 * `logLevel: "silent"`), so its quiet bound is in effect its whole limit: a
 * build takes seconds, but on a loaded machine it outlasted the fixed 60 s
 * that used to fail the whole run (`run-mv93ywox-9b5aa220`). Five silent minutes is a
 * hung generator, not a slow one.
 */
const GATEWAY_SERVER_BUILD_BOUND: BuildStepBound = Object.freeze({ quietMs: 5 * 60_000, ceilingMs: 15 * 60_000 });
type PrepareOptions = { fluxiqRepositoryRoot: string; supervisor: ProcessSupervisor; logPath: string };
/** Native generation precedes cache-key collection; staged/reused bytes must match their receipt. */
export const serverAdapterBuild = Object.freeze({
  /** The generator's bound, for its tests and its documentation. */
  bound: GATEWAY_SERVER_BUILD_BOUND,
  /**
   * Leaves Core's canonical gateway server artifact current: reused as it is
   * when its receipt names exactly the current source inventory, every
   * source's hash and the artifact's own digest (`expectedServerAdapterIdentity`,
   * the same check every copy and every run makes), and generated otherwise.
   * Regenerating a current artifact only rewrote the same bytes, and was the
   * step a busy machine could not finish in time.
   */
  async prepare(options: PrepareOptions, runStep: typeof runBoundedBuildStep = runBoundedBuildStep): Promise<"reused" | "generated"> {
    const logPath = `${options.logPath}.gateway-server.log`;
    if (await currentIdentity(options.fluxiqRepositoryRoot)) {
      await appendFile(logPath, "[reused] the receipt matches every current source and the artifact; the generator was not run\n", "utf8");
      return "reused";
    }
    await runStep(options.supervisor, { name: "gateway-server-build", command: process.execPath, args: [path.join(options.fluxiqRepositoryRoot, "apps/web/scripts/build-client-gateway-server.mjs")],
      cwd: options.fluxiqRepositoryRoot, env: withoutProviderSecrets(process.env), logPath }, GATEWAY_SERVER_BUILD_BOUND);
    await expectedServerAdapterIdentity(options.fluxiqRepositoryRoot);
    return "generated";
  },
  async validateCopy(root: string, webDirectory: string): Promise<void> {
    const intended = await expectedServerAdapterIdentity(root), copied = await expectedServerAdapterIdentity(root, artifactPath(webDirectory));
    if (JSON.stringify(intended) !== JSON.stringify(copied)) throw new Error("Copied native server adapter differs from intended canonical build.");
  },
  async hasArtifacts(webDirectory: string): Promise<boolean> {
    try {
      const artifact = artifactPath(webDirectory), receipt = JSON.parse(await readFile(`${artifact}.identity.json`, "utf8"));
      if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return false;
      const identity = screenServerAdapterIdentity(receipt.identity), hash = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
      if (!identity || !receipt.sources || typeof receipt.sources !== "object" || Array.isArray(receipt.sources)) return false;
      const sources = Object.fromEntries(Object.entries(receipt.sources).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
      if (Object.values(sources).some(value => typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))) return false;
      return hash(JSON.stringify(sources)) === identity.sourceInputsDigest && hash(normalizeServerAdapterArtifact(await readFile(artifact, "utf8"))) === identity.artifactDigest;
    } catch (error) {
      if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "") || error instanceof SyntaxError || /Server adapter identity|Malformed server/.test(error instanceof Error ? error.message : "")) return false;
      throw error;
    }
  }
});

/** Whether the canonical artifact is current; a stale or missing one is the generator's to replace, any other fault is raised. */
async function currentIdentity(root: string): Promise<boolean> {
  try {
    await expectedServerAdapterIdentity(root);
    return true;
  } catch (error) {
    if (error instanceof RunnerFailure && (error.details as { operationStage?: unknown } | undefined)?.operationStage === "server-adapter-identity") return false;
    throw error;
  }
}
