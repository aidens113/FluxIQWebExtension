import { samePkceAudience } from "../discovery";
import type { HostedPkceStoredAttempt } from "../model";

export function samePkceAttemptBase(left: HostedPkceStoredAttempt, right: HostedPkceStoredAttempt): boolean {
  return left.attemptId === right.attemptId && left.browserSessionId === right.browserSessionId && left.selectionId === right.selectionId
    && left.installId === right.installId && left.expectedCredentialRevision === right.expectedCredentialRevision
    && left.createdAtMs === right.createdAtMs && samePkceAudience(left.binding, right.binding);
}
