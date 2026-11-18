/**
 * A page-free refusal of work this document will not do or did not finish.
 * `before-dispatch` means nothing was started. `interrupted` means the work was
 * under way when the document was revoked, so it may already have acted: the
 * caller must treat it as a retryable step outcome, never as terminal and never
 * as proof that a lasting act did not happen.
 */
export function contentRevokedRefusal(phase: "before-dispatch" | "interrupted") {
  return { ok: false as const, errorCode: "content.revoked" as const, phase };
}
