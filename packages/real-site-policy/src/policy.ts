export const REAL_SITE_POLICY_SCHEMA_VERSION = "0.1" as const;

export const mandatoryDeniedActions = [
  "write", "submit", "upload", "download", "purchase", "send-message", "change-auth",
  "create", "update", "delete", "follow", "like", "vote", "comment",
] as const;
export const safeActions = ["navigate", "read", "scroll", "screenshot", "checkpoint"] as const;
export type SafeAction = (typeof safeActions)[number];
export type MandatoryDeniedAction = (typeof mandatoryDeniedActions)[number];

export type RealSiteProbePolicy = {
  schemaVersion: typeof REAL_SITE_POLICY_SCHEMA_VERSION;
  policyId: string;
  mode: "anonymous-read-only" | "synthetic-account";
  network: {
    allowlist: Array<{ origin: string; pathPrefixes: string[] }>;
    methods: Array<"GET" | "HEAD" | "OPTIONS">;
    blockUnlisted: true;
  };
  account: {
    synthetic: boolean;
    secretRefs: string[];
  };
  actions: {
    readOnly: true;
    allowed: SafeAction[];
    denied: MandatoryDeniedAction[];
  };
  rateLimits: {
    requestsPerMinute: number;
    actionsPerMinute: number;
    concurrentRequests: number;
    maxRunMinutes: number;
  };
  artifacts: {
    private: true;
    redactBeforeWrite: true;
    retentionDays: number;
  };
  operationalReview: {
    robotsReviewed: true;
    termsReviewed: true;
    authorizationReference: string;
    reviewer: string;
    approvedAt: string;
    expiresAt: string;
  };
};

export type PolicyIssue = { path: string; code: string; message: string };
export type PolicyDecision = { allowed: boolean; recommendation: "authorized" | "defer"; issues: PolicyIssue[] };

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const add = (issues: PolicyIssue[], path: string, code: string, message: string): void => { issues.push({ path, code, message }); };
const exactKeys = (value: RecordValue, allowed: readonly string[], path: string, issues: PolicyIssue[]) => {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) add(issues, `${path}.${key}`, "unknown-field", "unknown fields are forbidden");
};
const requireText = (value: RecordValue, key: string, path: string, issues: PolicyIssue[]) => {
  if (typeof value[key] !== "string" || value[key].trim().length === 0) add(issues, `${path}.${key}`, "required", "must be a non-empty string");
};
const requireObject = (value: unknown, path: string, issues: PolicyIssue[]): RecordValue | undefined => {
  if (!isRecord(value)) { add(issues, path, "type", "must be an object"); return undefined; }
  return value;
};

export function evaluateRealSitePolicy(input: unknown, now = new Date()): PolicyDecision {
  const issues: PolicyIssue[] = [];
  const policy = requireObject(input, "$", issues);
  if (!policy) return denied(issues);
  exactKeys(policy, ["schemaVersion", "policyId", "mode", "network", "account", "actions", "rateLimits", "artifacts", "operationalReview"], "$", issues);
  if (policy.schemaVersion !== REAL_SITE_POLICY_SCHEMA_VERSION) add(issues, "$.schemaVersion", "version", "must equal 0.1");
  requireText(policy, "policyId", "$", issues);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(String(policy.policyId))) add(issues, "$.policyId", "format", "must be kebab-case");
  if (!(["anonymous-read-only", "synthetic-account"] as unknown[]).includes(policy.mode)) add(issues, "$.mode", "mode", "unsupported probe mode");
  validateNetwork(policy.network, issues);
  validateAccount(policy.account, policy.mode, issues);
  validateActions(policy.actions, issues);
  validateRateLimits(policy.rateLimits, issues);
  validateArtifacts(policy.artifacts, issues);
  validateReview(policy.operationalReview, now, issues);
  return issues.length === 0 ? { allowed: true, recommendation: "authorized", issues } : denied(issues);
}

export function assertRealSitePolicyAuthorized(input: unknown, now = new Date()): asserts input is RealSiteProbePolicy {
  const decision = evaluateRealSitePolicy(input, now);
  if (!decision.allowed) throw new Error(`Real-site execution refused:\n${decision.issues.map(issue => `- ${issue.path} [${issue.code}]: ${issue.message}`).join("\n")}`);
}

function validateNetwork(input: unknown, issues: PolicyIssue[]): void {
  const value = requireObject(input, "$.network", issues); if (!value) return;
  exactKeys(value, ["allowlist", "methods", "blockUnlisted"], "$.network", issues);
  if (value.blockUnlisted !== true) add(issues, "$.network.blockUnlisted", "fail-closed", "must be true");
  if (!Array.isArray(value.methods) || value.methods.length === 0 || value.methods.some(method => !["GET", "HEAD", "OPTIONS"].includes(String(method)))) add(issues, "$.network.methods", "read-only", "only GET, HEAD, and OPTIONS are permitted");
  if (!Array.isArray(value.allowlist) || value.allowlist.length === 0) return add(issues, "$.network.allowlist", "allowlist", "at least one exact target is required");
  value.allowlist.forEach((entry, index) => {
    const path = `$.network.allowlist[${index}]`; const target = requireObject(entry, path, issues); if (!target) return;
    exactKeys(target, ["origin", "pathPrefixes"], path, issues);
    if (typeof target.origin !== "string") return add(issues, `${path}.origin`, "origin", "must be an exact HTTPS origin");
    try {
      const url = new URL(target.origin);
      if (url.protocol !== "https:" || url.origin !== target.origin || url.pathname !== "/" || url.search || url.hash || target.origin.includes("*")) add(issues, `${path}.origin`, "origin", "must be an exact HTTPS origin without path, query, fragment, credentials, or wildcards");
      if (url.username || url.password) add(issues, `${path}.origin`, "credentials", "embedded credentials are forbidden");
    } catch { add(issues, `${path}.origin`, "origin", "must be a valid exact HTTPS origin"); }
    if (!Array.isArray(target.pathPrefixes) || target.pathPrefixes.length === 0 || target.pathPrefixes.some(prefix => typeof prefix !== "string" || !prefix.startsWith("/") || prefix.includes("*") || prefix.includes("?") || prefix.includes("#") || prefix.includes(".."))) add(issues, `${path}.pathPrefixes`, "paths", "must contain explicit absolute path prefixes without wildcards, traversal, query, or fragments");
  });
}

function validateAccount(input: unknown, mode: unknown, issues: PolicyIssue[]): void {
  const value = requireObject(input, "$.account", issues); if (!value) return;
  exactKeys(value, ["synthetic", "secretRefs"], "$.account", issues);
  if (!Array.isArray(value.secretRefs) || value.secretRefs.some(ref => typeof ref !== "string" || !/^(vault|secret|env):\/\/[A-Za-z0-9_.\/-]+$/u.test(ref))) add(issues, "$.account.secretRefs", "secret-reference", "must contain external vault://, secret://, or env:// references, never secret values");
  if (mode === "anonymous-read-only" && (value.synthetic !== false || (Array.isArray(value.secretRefs) && value.secretRefs.length > 0))) add(issues, "$.account", "anonymous", "anonymous mode must not use an account or secrets");
  if (mode === "synthetic-account" && (value.synthetic !== true || !Array.isArray(value.secretRefs) || value.secretRefs.length === 0)) add(issues, "$.account", "synthetic", "synthetic-account mode requires synthetic=true and external secret references");
}

function validateActions(input: unknown, issues: PolicyIssue[]): void {
  const value = requireObject(input, "$.actions", issues); if (!value) return;
  exactKeys(value, ["readOnly", "allowed", "denied"], "$.actions", issues);
  if (value.readOnly !== true) add(issues, "$.actions.readOnly", "read-only", "must be true");
  if (!Array.isArray(value.allowed) || value.allowed.some(action => !(safeActions as readonly unknown[]).includes(action))) add(issues, "$.actions.allowed", "unsafe-action", "contains an action outside the read-only safe set");
  if (!Array.isArray(value.denied)) return add(issues, "$.actions.denied", "denylist", "mandatory denylist is required");
  for (const action of mandatoryDeniedActions) if (!value.denied.includes(action)) add(issues, "$.actions.denied", "denylist", `must explicitly deny ${action}`);
}

function validateRateLimits(input: unknown, issues: PolicyIssue[]): void {
  const value = requireObject(input, "$.rateLimits", issues); if (!value) return;
  exactKeys(value, ["requestsPerMinute", "actionsPerMinute", "concurrentRequests", "maxRunMinutes"], "$.rateLimits", issues);
  const limits = { requestsPerMinute: 60, actionsPerMinute: 20, concurrentRequests: 2, maxRunMinutes: 15 } as const;
  for (const [key, maximum] of Object.entries(limits)) if (!Number.isInteger(value[key]) || Number(value[key]) < 1 || Number(value[key]) > maximum) add(issues, `$.rateLimits.${key}`, "rate-limit", `must be an integer from 1 to ${maximum}`);
}

function validateArtifacts(input: unknown, issues: PolicyIssue[]): void {
  const value = requireObject(input, "$.artifacts", issues); if (!value) return;
  exactKeys(value, ["private", "redactBeforeWrite", "retentionDays"], "$.artifacts", issues);
  if (value.private !== true) add(issues, "$.artifacts.private", "privacy", "must be true");
  if (value.redactBeforeWrite !== true) add(issues, "$.artifacts.redactBeforeWrite", "redaction", "must be true");
  if (!Number.isInteger(value.retentionDays) || Number(value.retentionDays) < 1 || Number(value.retentionDays) > 7) add(issues, "$.artifacts.retentionDays", "retention", "must be 1-7 days");
}

function validateReview(input: unknown, now: Date, issues: PolicyIssue[]): void {
  const value = requireObject(input, "$.operationalReview", issues); if (!value) return;
  exactKeys(value, ["robotsReviewed", "termsReviewed", "authorizationReference", "reviewer", "approvedAt", "expiresAt"], "$.operationalReview", issues);
  if (value.robotsReviewed !== true) add(issues, "$.operationalReview.robotsReviewed", "robots-review", "must be acknowledged");
  if (value.termsReviewed !== true) add(issues, "$.operationalReview.termsReviewed", "terms-review", "must be acknowledged");
  requireText(value, "authorizationReference", "$.operationalReview", issues); requireText(value, "reviewer", "$.operationalReview", issues);
  const approved = timestamp(value.approvedAt); const expires = timestamp(value.expiresAt);
  if (approved === undefined) add(issues, "$.operationalReview.approvedAt", "timestamp", "must be a valid ISO timestamp");
  if (expires === undefined) add(issues, "$.operationalReview.expiresAt", "timestamp", "must be a valid ISO timestamp");
  if (approved !== undefined && approved > now.getTime()) add(issues, "$.operationalReview.approvedAt", "future-approval", "approval cannot be in the future");
  if (expires !== undefined && expires <= now.getTime()) add(issues, "$.operationalReview.expiresAt", "expired", "authorization has expired");
  if (approved !== undefined && expires !== undefined && expires - approved > 30 * 86_400_000) add(issues, "$.operationalReview.expiresAt", "approval-window", "authorization may not exceed 30 days");
}

const timestamp = (value: unknown): number | undefined => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : undefined;
const denied = (issues: PolicyIssue[]): PolicyDecision => ({ allowed: false, recommendation: "defer", issues });
