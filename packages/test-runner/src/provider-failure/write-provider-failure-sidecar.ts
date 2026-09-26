import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProviderFailureLog } from "./provider-failure-log.js";

/** The file's name. `.local.` is the word that says it is not evidence: nothing publishes it, nothing hashes it, and git ignores the tree it sits in. */
export const PROVIDER_FAILURE_SIDECAR_FILENAME = "provider-failures.local.json";

/** The one sentence the file carries about itself, so a reader who finds it knows what it is and what it is not. */
const SIDECAR_NOTE = "Local diagnostic. Not part of the evidence bundle: it is written after finalize, so it is absent from artifact-index.json and from the hash in bundle.complete.json, and the redaction attestation -- which scans the staging directory before the rename -- never saw it. Every string in it was redacted with the run's secrets AND its provider credential before it was written. Never commit it; test-runs/ is git-ignored.";

export type ProviderFailureSidecar = Readonly<{
  schemaVersion: "0.1";
  tier: "local";
  published: false;
  note: string;
  runId: string;
  failures: number;
  dropped: number;
  records: unknown;
}>;

/**
 * Writes the run's local provider-failure diagnostic beside `logs/`, and
 * returns where it went -- or writes nothing and returns `undefined` when the
 * run had no failed provider call.
 *
 * **It must be called only after `EvidenceBundle.finalize` has renamed the
 * staging directory**, and it enforces that rather than trusting it. The
 * bundle's artifact index is built by walking the staging directory
 * (`test-evidence/bundle.ts`, `buildArtifactIndex`), and it filters only
 * `artifact-index.json` and `bundle.complete.json` -- so any other file
 * present at that moment is indexed, hashed into `bundle.complete.json`, and
 * scanned by the redaction attestation. Writing into a staging directory would
 * therefore put this into the published bundle silently. The guard below makes
 * that a refusal instead of a leak.
 */
export async function writeProviderFailureSidecar(input: { runDirectory: string; runId: string; log: ProviderFailureLog }): Promise<string | undefined> {
  if (input.log.size === 0) return undefined;
  const directory = path.resolve(input.runDirectory);
  if (path.basename(directory).startsWith(".staging-")) {
    throw new Error("The provider-failure sidecar may not be written into an evidence bundle staging directory: the bundle would index and publish it");
  }
  const sidecar: ProviderFailureSidecar = {
    schemaVersion: "0.1",
    tier: "local",
    published: false,
    note: SIDECAR_NOTE,
    runId: input.runId,
    failures: input.log.size,
    dropped: input.log.dropped,
    records: input.log.entries(),
  };
  const target = path.join(directory, PROVIDER_FAILURE_SIDECAR_FILENAME);
  await writeFile(target, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
  return target;
}
