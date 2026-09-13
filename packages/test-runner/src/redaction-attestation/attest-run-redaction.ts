import { attestWorkspaceSecretAbsence, type SecretLeakAttestationLimits, type SecretLeakFindingCategory } from "../secret-leak-attestation.js";

/**
 * One tree the attestation scans: each entry of `paths` is a named entry under
 * `root`, scanned in full. `name` labels the scope in the result, and is the
 * only part of the scope the result repeats.
 */
export type RunRedactionScope = { name: string; root: string; paths: readonly string[] };

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
 *   entry). The second is a failure too, because an attestation that could not
 *   look has not attested absence.
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
const RUN_LIMITS: Partial<SecretLeakAttestationLimits> = Object.freeze({ maxFiles: 10_000, maxFileBytes: 8_388_608, maxTotalBytes: 67_108_864, maxDepth: 32 });

const CREDENTIAL_SYNTAX: ReadonlySet<SecretLeakFindingCategory> = new Set<SecretLeakFindingCategory>(["credential-field", "credential-assignment", "authorization-material"]);

type FindingsByScope = Map<string, Map<string, Set<SecretLeakFindingCategory>>>;

/**
 * Scans each scope for each declared literal through
 * `attestWorkspaceSecretAbsence`, and merges what the scans found into one
 * result that holds no literal: the scanner redacts only the literal it was
 * scanning for from a finding's path, so a path spelling a second literal is
 * redacted again here against all of them.
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
    for (const literal of literals) {
      const report = await attestWorkspaceSecretAbsence({ workspaceRoot: scope.root, secretLiteral: literal, approvedRelativePaths: scope.paths, limits: RUN_LIMITS });
      summary.scannedFiles = Math.max(summary.scannedFiles, report.scannedFiles);
      summary.scannedBytes = Math.max(summary.scannedBytes, report.scannedBytes);
      summary.skippedBinaryFiles = Math.max(summary.skippedBinaryFiles, report.skippedBinaryFiles);
      for (const finding of report.findings) {
        const safePath = redactLiterals(finding.path, literals);
        for (const category of finding.categories) record(CREDENTIAL_SYNTAX.has(category) ? advisory : failing, scope.name, safePath, category);
      }
    }
    scopes.push(summary);
  }
  const findings = flatten(failing);
  return Object.freeze({ status: findings.length ? "failed" : "passed", literalCount: literals.length, scopes, findingCount: findings.length, findings, advisories: flatten(advisory) });
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
