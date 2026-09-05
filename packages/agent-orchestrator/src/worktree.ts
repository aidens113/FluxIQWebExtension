import path from "node:path";
import type { CommandSpec, PolicyIssue, PolicyResult } from "./types.js";

export type WorktreeSafetyAttestation = {
  symlinksResolved: true;
  reparsePointsAbsent: true;
  verifiedBy: string;
  verifiedAt: string;
};

export type WorktreePlanRequest = {
  schemaVersion: "0.1";
  taskId: string;
  repositoryRoot: string;
  mainWorkspaceRoot: string;
  disposableBaseRoot: string;
  worktreeRoot: string;
  branch: string;
  startPoint: string;
  pathSafety: WorktreeSafetyAttestation;
};

export type WorktreePlan = {
  schemaVersion: "0.1";
  taskId: string;
  repositoryRoot: string;
  worktreeRoot: string;
  branch: string;
  create: CommandSpec;
  inspect: CommandSpec;
  remove: CommandSpec;
};

function pathApi(value: string): typeof path.win32 | typeof path.posix {
  return /^[A-Za-z]:[\\/]/.test(value) || value.includes("\\") ? path.win32 : path.posix;
}

function normalized(value: string): string {
  const api = pathApi(value);
  const resolved = api.resolve(value);
  return api === path.win32 ? resolved.toLowerCase() : resolved;
}

function absolute(value: string): boolean {
  return pathApi(value).isAbsolute(value);
}

function atOrWithin(candidate: string, root: string): boolean {
  const api = pathApi(root);
  if (pathApi(candidate) !== api) return false;
  const relative = api.relative(normalized(root), normalized(candidate));
  return relative === "" || (!relative.startsWith("..") && !api.isAbsolute(relative));
}

function overlaps(left: string, right: string): boolean {
  return atOrWithin(left, right) || atOrWithin(right, left);
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,254}$/u;

function safeGitRef(value: string): boolean {
  return SAFE_REF.test(value) && !value.includes("..") && !value.includes("//") && !value.includes("@{") && !value.endsWith("/") && value.split("/").every((segment) => segment.length > 0 && !segment.startsWith(".") && !segment.endsWith(".") && !segment.endsWith(".lock"));
}

export function validateWorktreePlanRequest(request: WorktreePlanRequest): PolicyResult {
  const issues: PolicyIssue[] = [];
  if (request.schemaVersion !== "0.1") issues.push({ code: "worktree.schema", message: "Unsupported worktree plan schema" });
  for (const [name, value] of Object.entries({ repositoryRoot: request.repositoryRoot, mainWorkspaceRoot: request.mainWorkspaceRoot, disposableBaseRoot: request.disposableBaseRoot, worktreeRoot: request.worktreeRoot })) {
    if (typeof value !== "string" || !absolute(value)) issues.push({ code: "worktree.absolute", message: `${name} must be an absolute path`, ...(typeof value === "string" ? { path: value } : {}) });
  }
  if (absolute(request.worktreeRoot) && absolute(request.disposableBaseRoot) && !atOrWithin(request.worktreeRoot, request.disposableBaseRoot)) issues.push({ code: "worktree.disposable-root", message: "worktreeRoot must be inside disposableBaseRoot", path: request.worktreeRoot });
  if (absolute(request.disposableBaseRoot) && absolute(request.repositoryRoot) && overlaps(request.disposableBaseRoot, request.repositoryRoot)) issues.push({ code: "worktree.repository-overlap", message: "Disposable root must not overlap the repository root", path: request.disposableBaseRoot });
  if (absolute(request.disposableBaseRoot) && absolute(request.mainWorkspaceRoot) && overlaps(request.disposableBaseRoot, request.mainWorkspaceRoot)) issues.push({ code: "worktree.workspace-overlap", message: "Disposable root must not overlap the main workspace", path: request.disposableBaseRoot });
  if (!request.pathSafety || request.pathSafety.symlinksResolved !== true || request.pathSafety.reparsePointsAbsent !== true || !request.pathSafety.verifiedBy?.trim() || !Number.isFinite(Date.parse(request.pathSafety.verifiedAt))) issues.push({ code: "worktree.path-attestation", message: "A current explicit symlink/reparse-point safety attestation is required" });
  if (!safeGitRef(request.branch)) issues.push({ code: "worktree.branch", message: "Branch is not a safe Git reference" });
  if (!safeGitRef(request.startPoint)) issues.push({ code: "worktree.start-point", message: "Start point is not a safe Git reference" });
  if (!request.taskId.trim()) issues.push({ code: "worktree.task", message: "taskId is required" });
  return { accepted: issues.length === 0, issues };
}

export function createWorktreePlan(request: WorktreePlanRequest): WorktreePlan {
  const validation = validateWorktreePlanRequest(request);
  if (!validation.accepted) throw new Error(`Invalid worktree plan: ${validation.issues.map(({ code }) => code).join(", ")}`);
  return {
    schemaVersion: "0.1",
    taskId: request.taskId,
    repositoryRoot: request.repositoryRoot,
    worktreeRoot: request.worktreeRoot,
    branch: request.branch,
    create: { executable: "git", args: ["-C", request.repositoryRoot, "worktree", "add", "-b", request.branch, request.worktreeRoot, request.startPoint], cwd: request.mainWorkspaceRoot },
    inspect: { executable: "git", args: ["-C", request.worktreeRoot, "status", "--short"], cwd: request.worktreeRoot },
    remove: { executable: "git", args: ["-C", request.repositoryRoot, "worktree", "remove", request.worktreeRoot], cwd: request.mainWorkspaceRoot },
  };
}
