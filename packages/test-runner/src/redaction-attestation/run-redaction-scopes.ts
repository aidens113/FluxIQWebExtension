import path from "node:path";
import type { RunRedactionScope } from "./attest-run-redaction.js";

/**
 * The two trees a Lab run can leave a declared literal in, as scan scopes.
 *
 * - `bundle`: the run's evidence bundle, read at its staging directory
 *   (`EvidenceBundle.stagingPath`), because the attestation runs before
 *   `finalize` renames it.
 * - `workspace`: the FluxIQ storage directory the run's Core wrote
 *   (`RunAllocation.storageDir`, `fluxiq-root/.fluxiq`), which holds the
 *   persisted recordings -- `recording.json`, `timeline.jsonl` and
 *   `snapshots/*.json` under `artifacts/automation-studio/projects/<project>/recordings/<recording>/`
 *   -- the Flow run traces, and Core's SQLite stores with their `-wal` and `-shm`
 *   files, which the scan searches byte for byte for each literal in UTF-8 and
 *   UTF-16 rather than skipping as binary. Absent when the run owns no FluxIQ
 *   workspace: the existing target, or a topology that never started.
 *
 * `workspaceWrittenSince` is for a workspace that outlives the run, the
 * `persistent-isolated` target's: the workspace scope then carries it as
 * `writtenSince`, and only what was written from that instant on is scanned. A
 * SQLite store is one file every run writes into, so a store this run wrote to
 * is scanned whole, rows an earlier run left included. An isolated workspace is
 * created by the run, so it is passed without one and scanned whole.
 *
 * Each scope is rooted at the directory's parent with the directory as its one
 * entry, because the scan accepts only named entries under its root.
 *
 * The browser profile is deliberately not a scope: the extension's storage there
 * is LevelDB, whose binary `.log` files the text scan cannot read and would fail
 * closed on every run.
 */
export function runRedactionScopes(input: { bundleStagingPath: string; workspaceStorageDir?: string | undefined; workspaceWrittenSince?: number | undefined }): RunRedactionScope[] {
  const scope = (name: string, directory: string, writtenSince?: number): RunRedactionScope => {
    const absolute = path.resolve(directory);
    return { name, root: path.dirname(absolute), paths: [path.basename(absolute)], ...(writtenSince === undefined ? {} : { writtenSince }) };
  };
  return [scope("bundle", input.bundleStagingPath), ...(input.workspaceStorageDir === undefined ? [] : [scope("workspace", input.workspaceStorageDir, input.workspaceWrittenSince)])];
}
