import path from "node:path";
import type { AgentTaskPacket, CandidateEdit, PolicyIssue, PolicyResult } from "./types.js";
import { ROLE_POLICIES } from "./roles.js";

function flavor(value: string): typeof path.win32 | typeof path.posix {
  return /^[A-Za-z]:[\\/]/.test(value) || value.includes("\\") ? path.win32 : path.posix;
}

function canonical(value: string): string {
  const implementation = flavor(value);
  const resolved = implementation.resolve(value);
  return implementation === path.win32 ? resolved.toLowerCase() : resolved;
}

export function isPathWithinRoot(candidate: string, root: string): boolean {
  const implementation = flavor(root);
  if (flavor(candidate) !== implementation) return false;
  const normalizedCandidate = canonical(candidate);
  const normalizedRoot = canonical(root);
  const relative = implementation.relative(normalizedRoot, normalizedCandidate);
  return relative !== "" && !relative.startsWith("..") && !implementation.isAbsolute(relative);
}

export function isPathAtOrWithinRoot(candidate: string, root: string): boolean {
  return canonical(candidate) === canonical(root) || isPathWithinRoot(candidate, root);
}

export function validateCandidateEdits(packet: AgentTaskPacket, edits: readonly CandidateEdit[]): PolicyResult {
  const issues: PolicyIssue[] = [];
  const role = ROLE_POLICIES[packet.role];
  if (!role.writable && edits.length > 0) issues.push({ code: "role.read-only", message: `${packet.role} tasks may not edit files` });
  if (role.repository && role.repository !== packet.scope.repository) issues.push({ code: "role.repository", message: `${packet.role} tasks must target the ${role.repository} repository` });
  if (edits.length > packet.budgets.maxChangedFiles) issues.push({ code: "budget.changed-files", message: "Changed file budget exceeded" });
  const changedBytes = edits.reduce((total, edit) => total + edit.changedBytes, 0);
  if (changedBytes > packet.budgets.maxChangedBytes) issues.push({ code: "budget.changed-bytes", message: "Changed byte budget exceeded" });
  for (const edit of edits) {
    if (edit.repository !== packet.scope.repository) issues.push({ code: "scope.repository", message: `Edit targets ${edit.repository}, expected ${packet.scope.repository}`, path: edit.path });
    if (!isPathWithinRoot(edit.path, packet.scope.repositoryRoot)) issues.push({ code: "scope.repository-root", message: "Edit is outside the repository root", path: edit.path });
    if (!packet.scope.allowedRoots.some((root) => isPathWithinRoot(edit.path, root))) issues.push({ code: "scope.allowed-root", message: "Edit is outside every exact allowed root", path: edit.path });
    if (!Number.isSafeInteger(edit.changedBytes) || edit.changedBytes < 0) issues.push({ code: "edit.changed-bytes", message: "changedBytes must be a non-negative safe integer", path: edit.path });
  }
  return { accepted: issues.length === 0, issues };
}
