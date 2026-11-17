import type { HostedPkceAttemptBase, HostedPkceStoredAttempt } from "../model";
import { copyPkceAudience } from "../audience";

export function pkceAttemptBase(record: HostedPkceStoredAttempt): HostedPkceAttemptBase {
  return { version: 1, attemptId: record.attemptId, browserSessionId: record.browserSessionId, selectionId: record.selectionId, binding: copyPkceAudience(record.binding), installId: record.installId, expectedCredentialRevision: record.expectedCredentialRevision, createdAtMs: record.createdAtMs };
}
