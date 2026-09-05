import { createHash, randomUUID } from "node:crypto";
import type { AgentTaskPacket, CheckResult, CommandSpec, PolicyIssue, PolicyResult, ProhibitedAction, ProtectedInvariant, TaskBudgets } from "./types.js";
import { ROLE_POLICIES } from "./roles.js";
import { isPathAtOrWithinRoot } from "./path-policy.js";

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export type CreateTaskInput = Omit<AgentTaskPacket, "schemaVersion" | "taskId" | "createdAt" | "prohibitedActions" | "responseContract"> & {
  taskId?: string;
  createdAt?: string;
  additionalProhibitedActions?: ProhibitedAction[];
};

export function createTaskPacket(input: CreateTaskInput): AgentTaskPacket {
  const mandatory = ROLE_POLICIES[input.role].mandatoryProhibitions;
  return {
    schemaVersion: "0.1",
    taskId: input.taskId ?? `task-${randomUUID()}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    humanTrigger: input.humanTrigger,
    role: input.role,
    objective: input.objective,
    scope: input.scope,
    scenario: input.scenario,
    baseline: input.baseline,
    failingInvariantIds: [...input.failingInvariantIds],
    protectedInvariants: [...input.protectedInvariants],
    budgets: input.budgets,
    prohibitedActions: [...new Set([...mandatory, ...(input.additionalProhibitedActions ?? [])])],
    requiredChecks: [...input.requiredChecks],
    responseContract: { schemaVersion: "0.1", format: "json" },
  };
}

function validateCommand(command: CommandSpec, label: string, issues: PolicyIssue[]): void {
  if (!command.executable.trim() || command.executable.includes("\0") || /[\r\n]/.test(command.executable)) issues.push({ code: "command.executable", message: `${label} has an invalid executable` });
  if (!command.cwd.trim()) issues.push({ code: "command.cwd", message: `${label} must declare cwd` });
  for (const argument of command.args) if (argument.includes("\0") || /[\r\n]/.test(argument)) issues.push({ code: "command.argument", message: `${label} contains an invalid argument` });
}

function validateBudgets(budgets: TaskBudgets, issues: PolicyIssue[]): void {
  for (const [name, value] of Object.entries(budgets)) if (!Number.isSafeInteger(value) || value <= 0) issues.push({ code: "budget.invalid", message: `${name} must be a positive safe integer` });
}

function validateInvariants(invariants: readonly ProtectedInvariant[], issues: PolicyIssue[]): void {
  const ids = new Set<string>();
  for (const invariant of invariants) {
    if (!SAFE_ID.test(invariant.id)) issues.push({ code: "invariant.id", message: `Invalid invariant id: ${invariant.id}` });
    if (ids.has(invariant.id)) issues.push({ code: "invariant.duplicate", message: `Duplicate invariant id: ${invariant.id}` });
    if (!SHA256.test(invariant.definitionSha256)) issues.push({ code: "invariant.hash", message: `Invalid invariant hash: ${invariant.id}` });
    ids.add(invariant.id);
  }
}

export function validateTaskPacket(packet: AgentTaskPacket): PolicyResult {
  const issues: PolicyIssue[] = [];
  if (packet.schemaVersion !== "0.1") issues.push({ code: "schema.version", message: "Unsupported task schema" });
  if (!SAFE_ID.test(packet.taskId)) issues.push({ code: "task.id", message: "Invalid task id" });
  if (!packet.objective.trim()) issues.push({ code: "task.objective", message: "Objective is required" });
  if (!packet.humanTrigger.requestedBy.trim() || !packet.humanTrigger.approvalReference.trim()) issues.push({ code: "task.human-trigger", message: "A named human trigger and approval reference are required" });
  if (!Number.isSafeInteger(packet.scenario.seed) || packet.scenario.seed < 0 || packet.scenario.seed > 0xffff_ffff) issues.push({ code: "scenario.seed", message: "Scenario seed must be uint32" });
  if (!SHA256.test(packet.baseline.artifactIndexSha256)) issues.push({ code: "baseline.hash", message: "Baseline artifact index hash must be SHA-256" });
  if (packet.scope.allowedRoots.length === 0 && ROLE_POLICIES[packet.role].writable) issues.push({ code: "scope.empty", message: "Writable tasks require at least one allowed root" });
  const roleRepository = ROLE_POLICIES[packet.role].repository;
  if (roleRepository && roleRepository !== packet.scope.repository) issues.push({ code: "role.repository", message: `${packet.role} tasks must target the ${roleRepository} repository` });
  for (const root of packet.scope.allowedRoots) if (!isPathAtOrWithinRoot(root, packet.scope.repositoryRoot)) issues.push({ code: "scope.root", message: `Allowed root is not under repository root: ${root}` });
  for (const prohibition of ROLE_POLICIES[packet.role].mandatoryProhibitions) if (!packet.prohibitedActions.includes(prohibition)) issues.push({ code: "prohibition.missing", message: `Missing mandatory prohibition: ${prohibition}` });
  validateCommand(packet.scenario.command, "scenario command", issues);
  packet.requiredChecks.forEach((command, index) => validateCommand(command, `required check ${index}`, issues));
  validateBudgets(packet.budgets, issues);
  validateInvariants(packet.protectedInvariants, issues);
  const knownInvariants = new Set(packet.protectedInvariants.map(({ id }) => id));
  for (const id of packet.failingInvariantIds) if (!knownInvariants.has(id)) issues.push({ code: "invariant.unknown-failure", message: `Failing invariant is not protected: ${id}` });
  return { accepted: issues.length === 0, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateTaskResponse(packet: AgentTaskPacket, value: unknown): PolicyResult {
  const issues: PolicyIssue[] = [];
  if (!isRecord(value)) return { accepted: false, issues: [{ code: "response.type", message: "Response must be a JSON object" }] };
  if (value.schemaVersion !== "0.1" || value.taskId !== packet.taskId) issues.push({ code: "response.identity", message: "Response schema or task identity does not match" });
  if (typeof value.summary !== "string" || !value.summary.trim()) issues.push({ code: "response.summary", message: "Response summary is required" });
  if (!isRecord(value.usage)) issues.push({ code: "usage.missing", message: "Response must report budget usage" });
  const usage = isRecord(value.usage) ? value.usage : {};
  const usageLimits: Array<[string, number, number]> = [
    ["turns", typeof usage.turns === "number" ? usage.turns : Number.NaN, packet.budgets.maxTurns],
    ["runs", typeof usage.runs === "number" ? usage.runs : Number.NaN, packet.budgets.maxRuns],
    ["durationMs", typeof usage.durationMs === "number" ? usage.durationMs : Number.NaN, packet.budgets.maxDurationMs],
  ];
  if (packet.budgets.maxTokens !== undefined) usageLimits.push(["tokens", typeof usage.tokens === "number" ? usage.tokens : Number.NaN, packet.budgets.maxTokens]);
  for (const [name, used, limit] of usageLimits) {
    if (!Number.isSafeInteger(used) || used < 0) issues.push({ code: "usage.invalid", message: `${name} usage must be a non-negative safe integer` });
    else if (used > limit) issues.push({ code: "budget.exceeded", message: `${name} budget exceeded` });
  }
  const candidateRunIds = Array.isArray(value.candidateRunIds) ? value.candidateRunIds : [];
  if (!Array.isArray(value.candidateRunIds)) issues.push({ code: "response.candidate-runs", message: "candidateRunIds must be an array" });
  if (candidateRunIds.length > packet.budgets.maxRuns) issues.push({ code: "budget.run-results", message: "Candidate run result count exceeds maxRuns" });
  if (!Array.isArray(value.changedFiles)) issues.push({ code: "response.changed-files", message: "changedFiles must be an array" });
  for (const key of ["hypotheses", "evidenceReferences", "risks"] as const) if (!Array.isArray(value[key]) || !(value[key] as unknown[]).every((entry) => typeof entry === "string")) issues.push({ code: `response.${key}`, message: `${key} must be a string array` });
  if (!["completed", "blocked", "rejected"].includes(String(value.status))) issues.push({ code: "response.status", message: "Response status is invalid" });
  const required = new Set(packet.requiredChecks.map(commandIdentity));
  const checks = Array.isArray(value.checks) ? value.checks.filter((check): check is CheckResult => isRecord(check) && isRecord(check.command) && typeof check.command.executable === "string" && Array.isArray(check.command.args) && typeof check.command.cwd === "string") : [];
  if (!Array.isArray(value.checks)) issues.push({ code: "response.checks", message: "checks must be an array" });
  const observed = new Map(checks.map((check) => [commandIdentity(check.command), check]));
  for (const identity of required) if (!observed.has(identity)) issues.push({ code: "check.missing", message: `Required check missing: ${identity}` });
  if (value.status === "completed") for (const identity of required) if (observed.get(identity)?.status !== "passed") issues.push({ code: "check.not-passed", message: `Required check did not pass: ${identity}` });
  return { accepted: issues.length === 0, issues };
}

export function commandIdentity(command: CommandSpec): string {
  return createHash("sha256").update(JSON.stringify([command.cwd, command.executable, command.args])).digest("hex");
}

export function renderTaskMarkdown(packet: AgentTaskPacket): string {
  const command = (value: CommandSpec) => JSON.stringify([value.executable, ...value.args]);
  return `# Bounded agent task ${packet.taskId}\n\nRole: ${packet.role}\nHuman approval: ${packet.humanTrigger.requestedBy} (${packet.humanTrigger.approvalReference})\n\n## Objective\n\n${packet.objective}\n\n## Scope\n\nRepository: ${packet.scope.repository}\nAllowed roots:\n${packet.scope.allowedRoots.map((root) => `- ${root}`).join("\n")}\n\n## Reproduction\n\nScenario ${packet.scenario.id}, seed ${packet.scenario.seed}\nCommand argv: ${command(packet.scenario.command)}\nBaseline: ${packet.baseline.runId}\nFailing invariants: ${packet.failingInvariantIds.join(", ")}\n\n## Prohibited\n\n${packet.prohibitedActions.map((item) => `- ${item}`).join("\n")}\n\n## Required checks\n\n${packet.requiredChecks.map((item) => `- ${command(item)} (cwd: ${item.cwd})`).join("\n")}\n\nReturn JSON conforming to response schema ${packet.responseContract.schemaVersion}.\n`;
}
