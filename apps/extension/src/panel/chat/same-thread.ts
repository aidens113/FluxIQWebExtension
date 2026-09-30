import type { ChatTarget } from "./target";

/**
 * True when `a` and `b` show the same thread of Core's: both the latest chat,
 * the same automation (under any name), or the same question's subject.
 */
export function sameThread(a: ChatTarget, b: ChatTarget): boolean {
  if (a.kind === "latest" || b.kind === "latest") return a.kind === b.kind;
  if (a.kind === "automation" && b.kind === "automation") return a.flowId === b.flowId;
  if (a.kind === "question" && b.kind === "question") return a.subjectKind === b.subjectKind && a.subjectId === b.subjectId;
  return false;
}
