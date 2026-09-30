import { writeFile } from "node:fs/promises";
import path from "node:path";
import { assertNoSensitiveText } from "@fluxiq-web-extension/test-evidence";
import type { ExtensionStartTrace } from "./extension-start-trace.js";

/** The file's name. `.local.` says it is not evidence: nothing publishes it, nothing hashes it, and git ignores the tree it sits in. */
export const EXTENSION_START_SIDECAR_FILENAME = "extension-start.local.json";

const SIDECAR_NOTE = "Local diagnostic of the extension start: Chrome's target lifecycle for the extension, its service worker's console, the control page's console, and the Lab's own steps, in milliseconds from launch. Not part of the evidence bundle: it is written after finalize, so it is absent from artifact-index.json and from the hash in bundle.complete.json. Every string was screened for the run's secrets, token patterns, pairing codes and URLs beyond their origin before it was kept. Never commit it; test-runs/ is git-ignored.";

/**
 * Writes the run's extension-start trace beside `logs/` and returns where it
 * went. Like the provider-failure sidecar it must run only after
 * `EvidenceBundle.finalize` has renamed the staging directory, and refuses a
 * staging directory rather than leak into the published bundle. The finished
 * file is asserted clean with the run's secrets; one that is not is replaced by
 * a stub that says so, never written as it was.
 */
export async function writeExtensionStartSidecar(input: { runDirectory: string; runId: string; trace: ExtensionStartTrace; secrets: readonly string[] }): Promise<string> {
  const directory = path.resolve(input.runDirectory);
  if (path.basename(directory).startsWith(".staging-")) {
    throw new Error("The extension-start sidecar may not be written into an evidence bundle staging directory: the bundle would index and publish it");
  }
  const base = { schemaVersion: "0.1", tier: "local", published: false, note: SIDECAR_NOTE, runId: input.runId, startedAt: new Date(input.trace.startedAt).toISOString() };
  let body = `${JSON.stringify({ ...base, dropped: input.trace.dropped, entries: input.trace.entries() }, null, 2)}\n`;
  try {
    assertNoSensitiveText(body, input.secrets.filter(secret => secret.length > 0));
  } catch {
    body = `${JSON.stringify({ ...base, withheld: "redaction_failed", entries: [] }, null, 2)}\n`;
  }
  const target = path.join(directory, EXTENSION_START_SIDECAR_FILENAME);
  await writeFile(target, body, "utf8");
  return target;
}
