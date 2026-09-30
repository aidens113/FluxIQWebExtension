import path from "node:path";
import type { RunRedactionScope } from "./attest-run-redaction.js";

/**
 * The trees a Lab run can leave a declared literal in, as scan scopes.
 *
 * - `bundle`: the run's evidence bundle, read at its staging directory
 *   (`EvidenceBundle.stagingPath`), because the attestation runs before
 *   `finalize` renames it.
 * - `workspace`: the FluxIQ storage directory the run's Core wrote
 *   (`RunAllocation.storageDir`, `fluxiq-root/.fluxiq`), which holds the
 *   persisted recordings -- `recording.json`, `timeline.jsonl` and
 *   `snapshots/*.json` under `artifacts/automation-studio/projects/<project>/recordings/<recording>/`
 *   -- the Flow run traces, and Core's SQLite stores with their `-wal` and `-shm`
 *   files. The scan searches each store file byte for byte for each literal in
 *   UTF-8 and UTF-16 rather than skipping it as binary, and also reads every text
 *   and blob cell of the database the file belongs to, from a copy with its `-wal`
 *   and `-journal`, so a literal SQLite split across pages is found too. Absent
 *   when the run owns no FluxIQ workspace: the existing target, or a topology
 *   that never started.
 *
 * `workspaceWrittenSince` is for a workspace that outlives the run, the
 * `persistent-isolated` target's: the workspace scope then carries it as
 * `writtenSince`, and only what was written from that instant on is scanned. A
 * SQLite store is one file every run writes into, so a store this run wrote to
 * is scanned whole, rows an earlier run left included, and so is the database
 * behind a `-wal` or `-journal` this run wrote, even when the database file
 * itself was not written since. An isolated workspace is
 * created by the run, so it is passed without one and scanned whole.
 *
 * The bundle and workspace scopes are each rooted at the directory's parent with the directory as its one
 * entry, because the scan accepts only named entries under its root.
 *
 * - `extension-storage`: the browser profile's extension storage directories
 *   (`chromiumExtensionStorageDirs`), where the extension keeps its pairing
 *   session and queued recording events with their page data. They are LevelDB
 *   databases, so the scope is `store: "leveldb"`: their `.log`, `.ldb` and
 *   `MANIFEST-*` files are searched byte for byte for each literal in UTF-8 and
 *   UTF-16LE rather than failing closed as binary (`searchLevelDbFile`), which is
 *   best effort for a Snappy-compressed table. Rooted at the profile, with each
 *   directory as an entry relative to it. Absent when the run owns no profile or
 *   the browser wrote no extension storage; passed only for a profile the run's
 *   allocation owns, never a user's own. `writtenSince` bounds it as it bounds the
 *   workspace, for a `persistent-isolated` profile that outlives the run.
 */
export function runRedactionScopes(input: {
  bundleStagingPath: string;
  workspaceStorageDir?: string | undefined;
  workspaceWrittenSince?: number | undefined;
  extensionStorage?: { profileDir: string; dirs: readonly string[]; writtenSince?: number | undefined } | undefined;
}): RunRedactionScope[] {
  const scope = (name: string, directory: string, writtenSince?: number): RunRedactionScope => {
    const absolute = path.resolve(directory);
    return { name, root: path.dirname(absolute), paths: [path.basename(absolute)], ...(writtenSince === undefined ? {} : { writtenSince }) };
  };
  return [
    scope("bundle", input.bundleStagingPath),
    ...(input.workspaceStorageDir === undefined ? [] : [scope("workspace", input.workspaceStorageDir, input.workspaceWrittenSince)]),
    ...(input.extensionStorage === undefined || !input.extensionStorage.dirs.length ? [] : [extensionStorageScope(input.extensionStorage)]),
  ];
}

function extensionStorageScope(input: { profileDir: string; dirs: readonly string[]; writtenSince?: number | undefined }): RunRedactionScope {
  const root = path.resolve(input.profileDir);
  const paths = input.dirs.map(directory => {
    const relative = path.relative(root, path.resolve(directory));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("An extension storage directory must be inside its browser profile");
    return relative.split(path.sep).join("/");
  });
  return { name: "extension-storage", root, paths, store: "leveldb", ...(input.writtenSince === undefined ? {} : { writtenSince: input.writtenSince }) };
}
