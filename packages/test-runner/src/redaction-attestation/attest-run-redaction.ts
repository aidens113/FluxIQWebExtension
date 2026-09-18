import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { attestWorkspaceSecretAbsence, SECRET_LEAK_ATTESTATION_RUN_LIMITS, type SecretLeakFindingCategory } from "../secret-leak-attestation.js";

/**
 * One tree the attestation scans: each entry of `paths` is a named entry under
 * `root`, scanned in full. `name` labels the scope in the result, and is the
 * only part of the scope the result repeats.
 *
 * `writtenSince`, an epoch-millisecond instant, bounds a tree that outlives the
 * run to what was written from then on. A `persistent-isolated` workspace keeps
 * every run's recordings and traces: scanned whole, it would fail a clean run for
 * an earlier run's leak, and would grow until the scan's ceilings failed every
 * run closed. `writtenEntries` says what the bound keeps.
 */
export type RunRedactionScope = { name: string; root: string; paths: readonly string[]; writtenSince?: number };

/** A file in which the scan found something: its scope and its relative path, with every declared literal redacted out of the path. Never content. */
export type RunRedactionFinding = { scope: string; path: string; categories: SecretLeakFindingCategory[] };

/** How much of one scope the scan read. */
export type RunRedactionScopeSummary = { name: string; scannedFiles: number; scannedBytes: number; skippedBinaryFiles: number };

/**
 * What the Lab's redaction attestation observed for one run.
 *
 * - `not-applicable`: the scenario declares no sensitive literal, so nothing was
 *   scanned and nothing was verified.
 * - `passed`: every declared literal was scanned for in every scope, and no scope
 *   held one or left anything unread.
 * - `failed`: a scope held a declared literal, or the scan could not read all of
 *   what it was given (an unreadable, oversize, reparse-point or over-limit
 *   entry, or an `unscanned-store`: a SQLite store file or database it could not
 *   copy or read in full, one over a ceiling, or a `-wal` or `-journal` with no
 *   database beside it). The second is a failure too, because an attestation
 *   that could not look has not attested absence.
 *
 * `findings` are what fail the run, as `security.redaction`. `advisories` are the
 * scanner's credential-syntax categories (`credential-field`,
 * `credential-assignment`, `authorization-material`): they do not depend on the
 * fixture's literal, and a key spelled `"token":` in a persisted document is not
 * a leak of anything the scenario declared, so they are recorded for review and
 * do not fail the run.
 */
export type RunRedactionAttestation = {
  status: "not-applicable" | "passed" | "failed";
  literalCount: number;
  scopes: RunRedactionScopeSummary[];
  findingCount: number;
  findings: RunRedactionFinding[];
  advisories: RunRedactionFinding[];
};

export type RunRedactionAttestationInput = { literals: readonly string[]; scopes: readonly RunRedactionScope[] };

/**
 * The scanner's absolute ceilings. A run bundle carries copied process logs and
 * an isolated workspace carries every recording and run trace, so the defaults
 * sized for one demo result file would fail a healthy run closed on size alone.
 */
const RUN_LIMITS = SECRET_LEAK_ATTESTATION_RUN_LIMITS;

/**
 * How many entries one scan of a bounded scope is given: few enough that that
 * many entries at the largest ceiling any one of them can claim still fit the
 * total ceiling, and under the scanner's 32 approved paths. A SQLite store is
 * bounded by `maxStoreBytes`, not `maxFileBytes`, so the divisor is the larger
 * of the two; otherwise one chunk of stores could exceed the total and fail a
 * healthy run closed. So no scan's count or byte-search total trips on how much
 * the run wrote; a single entry over its own ceiling still fails closed. The
 * copies of the databases the scan reads cell by cell count against the same
 * total, and an entry that is a `-wal` or `-journal` also copies the database it
 * belongs to, which may not be an entry: those copies can still reach the total,
 * as an `unscanned-store` finding.
 */
const ENTRIES_PER_BOUNDED_SCAN = Math.floor(RUN_LIMITS.maxTotalBytes / Math.max(RUN_LIMITS.maxFileBytes, RUN_LIMITS.maxStoreBytes));

/**
 * How far before `writtenSince` a file's time still counts as written since: a
 * filesystem that stores times coarsely (FAT's two seconds is the coarsest in
 * use) can round a write made just after the run started to before it.
 */
const TIMESTAMP_SLACK_MS = 2_000;

const CREDENTIAL_SYNTAX: ReadonlySet<SecretLeakFindingCategory> = new Set<SecretLeakFindingCategory>(["credential-field", "credential-assignment", "authorization-material"]);

type FindingsByScope = Map<string, Map<string, Set<SecretLeakFindingCategory>>>;

/**
 * Scans each scope for each declared literal through
 * `attestWorkspaceSecretAbsence`, and merges what the scans found into one
 * result that holds no literal: the scanner redacts only the literal it was
 * scanning for from a finding's path, so a path spelling a second literal is
 * redacted again here against all of them.
 *
 * A scope with `writtenSince` is scanned as the entries `writtenEntries` finds,
 * `ENTRIES_PER_BOUNDED_SCAN` at a time, and its summary adds those scans up; one
 * with nothing written since scans nothing. Every other scope is one scan of its
 * `paths`.
 *
 * It runs before the scopes are cleaned and while nothing still writes to them,
 * which is the caller's responsibility. A scope with no entries, or a relative
 * root, is a caller defect and throws.
 */
export async function attestRunRedaction(input: RunRedactionAttestationInput): Promise<RunRedactionAttestation> {
  const literals = [...new Set(input.literals)];
  if (!literals.length) return Object.freeze({ status: "not-applicable", literalCount: 0, scopes: [], findingCount: 0, findings: [], advisories: [] });
  if (!input.scopes.length) throw new Error("A redaction attestation needs at least one scope to scan");
  const failing: FindingsByScope = new Map();
  const advisory: FindingsByScope = new Map();
  const scopes: RunRedactionScopeSummary[] = [];
  for (const scope of input.scopes) {
    const summary: RunRedactionScopeSummary = { name: scope.name, scannedFiles: 0, scannedBytes: 0, skippedBinaryFiles: 0 };
    const scans = scope.writtenSince === undefined ? [scope.paths] : chunks(await writtenEntries(scope.root, scope.paths, scope.writtenSince), ENTRIES_PER_BOUNDED_SCAN);
    for (const literal of literals) {
      const read = { scannedFiles: 0, scannedBytes: 0, skippedBinaryFiles: 0 };
      for (const paths of scans) {
        const report = await attestWorkspaceSecretAbsence({ workspaceRoot: scope.root, secretLiteral: literal, approvedRelativePaths: paths, limits: RUN_LIMITS });
        read.scannedFiles += report.scannedFiles;
        read.scannedBytes += report.scannedBytes;
        read.skippedBinaryFiles += report.skippedBinaryFiles;
        for (const finding of report.findings) {
          const safePath = redactLiterals(finding.path, literals);
          for (const category of finding.categories) record(CREDENTIAL_SYNTAX.has(category) ? advisory : failing, scope.name, safePath, category);
        }
      }
      summary.scannedFiles = Math.max(summary.scannedFiles, read.scannedFiles);
      summary.scannedBytes = Math.max(summary.scannedBytes, read.scannedBytes);
      summary.skippedBinaryFiles = Math.max(summary.skippedBinaryFiles, read.skippedBinaryFiles);
    }
    scopes.push(summary);
  }
  const findings = flatten(failing);
  return Object.freeze({ status: findings.length ? "failed" : "passed", literalCount: literals.length, scopes, findingCount: findings.length, findings, advisories: flatten(advisory) });
}

/**
 * The entries of a bounded scope the scan is given, found by a walk that reads
 * metadata only and follows no link:
 *
 * - every file whose modification or creation time is at or after `since`, less
 *   `TIMESTAMP_SLACK_MS`. A write moves the modification time, and a copy that
 *   keeps it (Windows `CopyFile` does) still gives the new file a new creation
 *   time. The change time is not read: allocating a persistent run re-applies an
 *   inheritable ACL to the workspace's directories (`allocatePersistentRun`),
 *   which can move the change time of every file beneath and lose the bound.
 * - every entry the walk cannot judge, whatever its age: a link, an entry it
 *   cannot stat, a directory it cannot list. The scan fails closed on each
 *   (`unsafe-reparse`, `unreadable-text`), so what this run wrote behind one is
 *   never passed over silently.
 *
 * Directories themselves are not entries: what a directory holds is judged file
 * by file. The bound assumes nothing sets a file's times back, which Core does not.
 */
async function writtenEntries(root: string, paths: readonly string[], since: number): Promise<string[]> {
  if (!path.isAbsolute(root)) throw new Error("A bounded redaction scope needs an absolute root");
  const entries: string[] = [];
  const visit = async (relative: string): Promise<void> => {
    const absolute = path.join(root, ...relative.split("/"));
    let metadata;
    try { metadata = await lstat(absolute); }
    catch { entries.push(relative); return; }
    if (metadata.isSymbolicLink()) { entries.push(relative); return; }
    if (metadata.isDirectory()) {
      let names: string[];
      try { names = await readdir(absolute); }
      catch { entries.push(relative); return; }
      for (const name of names.sort()) await visit(`${relative}/${name}`);
      return;
    }
    if (metadata.isFile() && Math.max(metadata.mtimeMs, metadata.birthtimeMs) >= since - TIMESTAMP_SLACK_MS) entries.push(relative);
  };
  for (const entry of paths) await visit(entry);
  return entries;
}

function chunks(values: readonly string[], size: number): string[][] {
  const result: string[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function record(target: FindingsByScope, scope: string, findingPath: string, category: SecretLeakFindingCategory): void {
  const byPath = target.get(scope) ?? new Map<string, Set<SecretLeakFindingCategory>>();
  const categories = byPath.get(findingPath) ?? new Set<SecretLeakFindingCategory>();
  categories.add(category);
  byPath.set(findingPath, categories);
  target.set(scope, byPath);
}

function flatten(source: FindingsByScope): RunRedactionFinding[] {
  return [...source]
    .flatMap(([scope, byPath]) => [...byPath].map(([findingPath, categories]) => ({ scope, path: findingPath, categories: [...categories].sort() })))
    .sort((left, right) => left.scope.localeCompare(right.scope) || left.path.localeCompare(right.path));
}

function redactLiterals(value: string, literals: readonly string[]): string {
  return literals.reduce((text, literal) => text.replace(new RegExp(literal.replace(/[.*+?^$(){}|[\]\\]/gu, "\\$&"), "giu"), "[redacted]"), value);
}
