import { createHash } from "node:crypto";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";

export const SECRET_LEAK_ATTESTATION_DEFAULT_LIMITS = Object.freeze({
  maxFiles: 2_000, maxFileBytes: 1_048_576, maxTotalBytes: 16_777_216, maxDepth: 16, maxApprovedPaths: 32,
});
export type SecretLeakAttestationLimits = { maxFiles: number; maxFileBytes: number; maxTotalBytes: number; maxDepth: number; maxApprovedPaths: number };
const ABSOLUTE_LIMITS: Readonly<SecretLeakAttestationLimits> = Object.freeze({
  maxFiles: 10_000, maxFileBytes: 8_388_608, maxTotalBytes: 67_108_864, maxDepth: 32, maxApprovedPaths: 128,
});

export type SecretLeakFindingCategory =
  | "secret-literal" | "credential-field" | "credential-assignment" | "authorization-material"
  | "unreadable-text" | "oversize-text" | "unsafe-reparse" | "path-escape"
  | "file-limit" | "byte-limit" | "depth-limit";
export type SecretLeakFinding = { path: string; categories: SecretLeakFindingCategory[] };
export type SecretLeakAttestationReport = {
  status: "passed" | "failed"; scannedFiles: number; scannedBytes: number;
  skippedBinaryFiles: number; findingCount: number; findings: SecretLeakFinding[];
};
export type SecretLeakAttestationInput = {
  workspaceRoot: string; secretLiteral: string; approvedRelativePaths: readonly string[];
  limits?: Partial<SecretLeakAttestationLimits>;
};

const binaryExtensions = new Set([
  ".7z", ".avi", ".bin", ".bmp", ".br", ".db", ".dll", ".exe", ".gif", ".gz",
  ".ico", ".jpeg", ".jpg", ".mp3", ".mp4", ".pdf", ".png", ".sqlite", ".sqlite3",
  ".tar", ".webm", ".webp", ".woff", ".woff2", ".zip",
]);
const textExtensions = new Set([
  "", ".csv", ".env", ".html", ".ini", ".json", ".jsonl", ".log", ".md",
  ".ndjson", ".toml", ".txt", ".xml", ".yaml", ".yml",
]);
const credentialField = /["'](?:access[_-]?token|api[_-]?key|authorization|bearer|cookie|credential|password|pin|private[_-]?key|refresh[_-]?token|secret|session[_-]?key|token)["']\s*:/giu;
const credentialAssignment = /(?:^|\n)\s*[A-Z0-9_]*(?:API_KEY|ACCESS_TOKEN|AUTHORIZATION|BEARER|COOKIE|CREDENTIAL|PASSWORD|PIN|PRIVATE_KEY|REFRESH_TOKEN|SECRET)\s*=\s*\S+/giu;
const authorizationMaterial = /(?:^|\n)\s*(?:authorization|cookie|set-cookie)\s*:\s*\S+/giu;

export async function attestWorkspaceSecretAbsence(input: SecretLeakAttestationInput): Promise<SecretLeakAttestationReport> {
  validateInput(input);
  const limits = resolveLimits(input.limits);
  const root = path.resolve(input.workspaceRoot);
  const findings = new Map<string, Set<SecretLeakFindingCategory>>();
  let scannedFiles = 0; let scannedBytes = 0; let skippedBinaryFiles = 0; let visitedEntries = 0;

  const addFinding = (relativePath: string, category: SecretLeakFindingCategory): void => {
    const safePath = sanitizePath(relativePath, input.secretLiteral);
    const categories = findings.get(safePath) ?? new Set<SecretLeakFindingCategory>();
    categories.add(category); findings.set(safePath, categories);
  };

  let canonicalRoot: string;
  try {
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) { addFinding(".", "unsafe-reparse"); return report(); }
    canonicalRoot = await realpath(root);
    if (!samePath(root, canonicalRoot)) { addFinding(".", "unsafe-reparse"); return report(); }
  } catch {
    addFinding(".", "unreadable-text"); return report();
  }

  const approved = [...new Set(input.approvedRelativePaths)].sort();
  if (approved.length > limits.maxApprovedPaths) addFinding(".", "file-limit");
  for (const relative of approved.slice(0, limits.maxApprovedPaths)) {
    const normalized = normalizeApprovedPath(relative);
    if (normalized === undefined) { addFinding(".", "path-escape"); continue; }
    const absolute = path.resolve(canonicalRoot, ...normalized.split("/"));
    if (!isInside(canonicalRoot, absolute)) { addFinding(normalized, "path-escape"); continue; }
    await visit(absolute, normalized, 0);
  }
  return report();

  async function visit(absolute: string, relative: string, depth: number): Promise<void> {
    if (++visitedEntries > limits.maxFiles + limits.maxApprovedPaths + 2_000) { addFinding(relative, "file-limit"); return; }
    if (depth > limits.maxDepth) { addFinding(relative, "depth-limit"); return; }

    let metadata;
    try { metadata = await lstat(absolute); }
    catch { addFinding(relative, "unreadable-text"); return; }
    if (metadata.isSymbolicLink()) { addFinding(relative, "unsafe-reparse"); return; }

    try {
      const canonical = await realpath(absolute);
      if (!isInside(canonicalRoot, canonical)) { addFinding(relative, "path-escape"); return; }
    } catch { addFinding(relative, "unreadable-text"); return; }

    if (metadata.isDirectory()) {
      let entries;
      try { entries = await readdir(absolute, { withFileTypes: true }); }
      catch { addFinding(relative, "unreadable-text"); return; }
      entries.sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        const childRelative = joinRelative(relative, entry.name);
        if (entry.isSymbolicLink()) { addFinding(childRelative, "unsafe-reparse"); continue; }
        await visit(path.join(absolute, entry.name), childRelative, depth + 1);
      }
      return;
    }
    if (!metadata.isFile()) return;

    const extension = path.extname(absolute).toLowerCase();
    if (binaryExtensions.has(extension)) { skippedBinaryFiles += 1; return; }
    if (scannedFiles >= limits.maxFiles) { addFinding(relative, "file-limit"); return; }
    if (metadata.size > limits.maxFileBytes) {
      addFinding(relative, "oversize-text");
      return;
    }
    if (scannedBytes + metadata.size > limits.maxTotalBytes) { addFinding(relative, "byte-limit"); return; }

    let bytes: Buffer;
    try { bytes = await readFile(absolute); }
    catch { addFinding(relative, "unreadable-text"); return; }
    if (bytes.includes(0)) {
      if (textExtensions.has(extension)) addFinding(relative, "unreadable-text"); else skippedBinaryFiles += 1;
      return;
    }

    let contents: string;
    try { contents = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch {
      if (textExtensions.has(extension)) addFinding(relative, "unreadable-text"); else skippedBinaryFiles += 1;
      return;
    }

    scannedFiles += 1; scannedBytes += bytes.byteLength;
    for (const category of detectViolations(contents, input.secretLiteral)) addFinding(relative, category);
  }

  function report(): SecretLeakAttestationReport {
    const resultFindings = [...findings.entries()]
      .map(([findingPath, categories]) => ({ path: findingPath, categories: [...categories].sort() }))
      .sort((left, right) => left.path.localeCompare(right.path));
    return Object.freeze({
      status: resultFindings.length === 0 ? "passed" as const : "failed" as const,
      scannedFiles, scannedBytes, skippedBinaryFiles, findingCount: resultFindings.length, findings: resultFindings,
    });
  }
}

function detectViolations(contents: string, secret: string): SecretLeakFindingCategory[] {
  const categories = new Set<SecretLeakFindingCategory>();
  if (contents.includes(secret)) categories.add("secret-literal");
  if (credentialField.test(contents)) categories.add("credential-field");
  credentialField.lastIndex = 0;
  if (credentialAssignment.test(contents)) categories.add("credential-assignment");
  credentialAssignment.lastIndex = 0;
  if (authorizationMaterial.test(contents)) categories.add("authorization-material");
  authorizationMaterial.lastIndex = 0;
  return [...categories];
}
function validateInput(input: SecretLeakAttestationInput): void {
  if (!path.isAbsolute(input.workspaceRoot)) throw new Error("Secret attestation requires an absolute workspace root");
  if (typeof input.secretLiteral !== "string" || input.secretLiteral.length < 8 || input.secretLiteral.length > 16_384) throw new Error("Secret attestation requires one bounded in-memory secret");
  if (!Array.isArray(input.approvedRelativePaths) || input.approvedRelativePaths.length === 0) throw new Error("Secret attestation requires approved relative paths");
}
function resolveLimits(overrides: SecretLeakAttestationInput["limits"]): SecretLeakAttestationLimits {
  const limits = { ...SECRET_LEAK_ATTESTATION_DEFAULT_LIMITS, ...overrides };
  for (const key of Object.keys(SECRET_LEAK_ATTESTATION_DEFAULT_LIMITS) as Array<keyof SecretLeakAttestationLimits>) {
    const value = limits[key];
    if (!Number.isSafeInteger(value) || value < 1 || value > ABSOLUTE_LIMITS[key]) throw new Error("Secret attestation limits are invalid");
  }
  if (limits.maxTotalBytes < limits.maxFileBytes) throw new Error("Secret attestation total bytes must cover one file");
  return limits;
}
function normalizeApprovedPath(value: string): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || value.includes("\\") || value.includes("\0") || path.isAbsolute(value)) return undefined;
  const parts = value.split("/");
  if (parts.some(part => !part || part === "." || part === "..")) return undefined;
  return parts.join("/");
}
function joinRelative(parent: string, child: string): string { return parent ? parent + "/" + child : child; }
function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
function samePath(left: string, right: string): boolean {
  const normalize = (value: string): string => process.platform === "win32" ? value.toLowerCase() : value;
  return normalize(path.normalize(left)) === normalize(path.normalize(right));
}
function sanitizePath(relativePath: string, secret: string): string {
  const escaped = secret.replace(/[.*+?^$(){}|[\]\\]/gu, "\\$&");
  const redacted = relativePath.replace(new RegExp(escaped, "giu"), "[redacted]").replace(/[\u0000-\u001f\u007f]/gu, "?");
  if (redacted.length <= 240) return redacted;
  return "[long-path-sha256:" + createHash("sha256").update(redacted).digest("hex") + "]";
}