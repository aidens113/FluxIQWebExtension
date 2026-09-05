import type { CandidateComparison, RunEvaluation } from "@fluxiq-web-extension/test-contracts";

export const AGENT_TASK_SCHEMA_VERSION = "0.1" as const;

export type AgentRole =
  | "coordinator"
  | "scenario"
  | "diagnosis"
  | "core-repair"
  | "extension-repair"
  | "reviewer";

export type RepositoryName = "facility" | "core";

export type CommandSpec = {
  executable: string;
  args: string[];
  cwd: string;
};

export type TaskBudgets = {
  maxTurns: number;
  maxRuns: number;
  maxDurationMs: number;
  maxChangedFiles: number;
  maxChangedBytes: number;
  maxTokens?: number;
};

export type ProtectedInvariant = {
  id: string;
  definitionSha256: string;
  required: boolean;
};

export type AgentTaskPacket = {
  schemaVersion: typeof AGENT_TASK_SCHEMA_VERSION;
  taskId: string;
  createdAt: string;
  humanTrigger: { requestedBy: string; approvalReference: string };
  role: AgentRole;
  objective: string;
  scope: {
    repository: RepositoryName;
    repositoryRoot: string;
    allowedRoots: string[];
  };
  scenario: { id: string; seed: number; command: CommandSpec };
  baseline: { runId: string; artifactIndexSha256: string };
  failingInvariantIds: string[];
  protectedInvariants: ProtectedInvariant[];
  budgets: TaskBudgets;
  prohibitedActions: ProhibitedAction[];
  requiredChecks: CommandSpec[];
  responseContract: { schemaVersion: "0.1"; format: "json" };
};

export type ProhibitedAction =
  | "merge"
  | "publish"
  | "deploy"
  | "live-site-write"
  | "disable-test"
  | "weaken-expectation"
  | "edit-outside-scope";

export type CandidateEdit = {
  repository: RepositoryName;
  path: string;
  operation: "add" | "modify" | "delete";
  changedBytes: number;
};

export type CheckResult = {
  command: CommandSpec;
  status: "passed" | "failed" | "not-run";
  exitCode?: number;
  evidenceReferences: string[];
};

export type AgentTaskResponse = {
  schemaVersion: "0.1";
  taskId: string;
  status: "completed" | "blocked" | "rejected";
  summary: string;
  hypotheses: string[];
  changedFiles: CandidateEdit[];
  checks: CheckResult[];
  candidateRunIds: string[];
  evidenceReferences: string[];
  risks: string[];
  usage: {
    turns: number;
    runs: number;
    durationMs: number;
    tokens?: number;
  };
};

export type CandidateSubmission = {
  packet: AgentTaskPacket;
  response: AgentTaskResponse;
  observedEdits: CandidateEdit[];
  baselineEvaluation: RunEvaluation;
  candidateEvaluation: RunEvaluation;
  comparison: CandidateComparison;
  candidateInvariants: ProtectedInvariant[];
  auditVerified: boolean;
};

export type PolicyIssue = { code: string; message: string; path?: string };
export type PolicyResult = { accepted: boolean; issues: PolicyIssue[] };

export type ReviewGateResult = PolicyResult & {
  verdict: "approve-for-human-review" | "reject";
};
