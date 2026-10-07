import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { withoutProviderSecrets } from "../environment.js";
import type { ProcessSupervisor } from "../process-supervisor.js";
import { expectedServerAdapterIdentity, normalizeServerAdapterArtifact, screenServerAdapterIdentity } from "../run-scenario/browser-session/server-adapter-identity/index.js";
const artifactPath = (web: string) => path.join(web, ".server-runtime/client-gateway-server.mjs");
/** Native generation precedes cache-key collection; staged/reused bytes must match their receipt. */
export const serverAdapterBuild = Object.freeze({
  async prepare(options: { fluxiqRepositoryRoot: string; supervisor: ProcessSupervisor; logPath: string }): Promise<void> {
    await options.supervisor.run({ name: "gateway-server-build", command: process.execPath, args: [path.join(options.fluxiqRepositoryRoot, "apps/web/scripts/build-client-gateway-server.mjs")],
      cwd: options.fluxiqRepositoryRoot, env: withoutProviderSecrets(process.env), logPath: `${options.logPath}.gateway-server.log` }, 60_000);
    await expectedServerAdapterIdentity(options.fluxiqRepositoryRoot);
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
