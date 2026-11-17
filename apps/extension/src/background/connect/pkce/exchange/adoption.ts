import type { ConnectTokenResponse } from "@fluxiq/contracts/platform";
import type { BoundHostedCredentials, HostedCredentialSnapshot } from "../../../credentials";
import { copyPkceAudience } from "../audience";
import { finishPkceAttempt, pkceAttemptView } from "../attempt";
import { pkceFailureCode, type HostedPkceContext } from "../context";
import { samePkceAudience } from "../discovery";
import { HostedPkceFailure } from "../failure";
import type { HostedPkceOwnerOutcome, HostedPkceStoredAttempt } from "../model";
import { cleanupPkceProof } from "./cleanup";
import { requirePkceExchange } from "./current";

function checkedSnapshot(snapshot: HostedCredentialSnapshot, record: HostedPkceStoredAttempt, response: ConnectTokenResponse): void {
  if (snapshot.installId !== record.installId || snapshot.revision !== record.expectedCredentialRevision + 1 || !samePkceAudience(snapshot.binding, record.binding)
    || snapshot.credential !== response.credential || snapshot.connectedClientId !== response.connectedClientId || snapshot.userId !== response.user.userId
    || snapshot.workspaceId !== response.workspace.workspaceId || snapshot.expiresAtMs !== response.credentialExpiresAt || !snapshot.lineageId) throw new HostedPkceFailure("credential_conflict");
}

export async function adoptPkceToken(context: HostedPkceContext, bound: BoundHostedCredentials, record: HostedPkceStoredAttempt, response: ConnectTokenResponse): Promise<HostedPkceOwnerOutcome> {
  let adopted: HostedCredentialSnapshot | undefined;
  try {
    if (response.gatewayUrl !== record.binding.gatewayUrl || !Number.isSafeInteger(response.credentialExpiresAt)) throw new HostedPkceFailure("response_invalid");
    if (response.credentialExpiresAt <= context.clock()) throw new HostedPkceFailure("credential_expired");
    await requirePkceExchange(context, record);
    const committed = await bound.commit({ kind: "new-trust", operationId: `${record.attemptId}.adopt`, expectedRevision: record.expectedCredentialRevision, response });
    checkedSnapshot(committed, record, response);
    adopted = committed;
    await requirePkceExchange(context, record);
    const terminal = await finishPkceAttempt(context, record, "adopted");
    context.owner(record);
    if (terminal.phase !== "adopted") throw new HostedPkceFailure(terminal.failureCode ?? "attempt_conflict");
    const current = await bound.read();
    context.owner(record);
    if (!current || current.revision !== adopted.revision || current.credential !== response.credential) throw new HostedPkceFailure("credential_conflict");
    checkedSnapshot(current, record, response);
    return Object.freeze({ ...terminal, adopted: Object.freeze({ binding: copyPkceAudience(adopted.binding), installId: adopted.installId, revision: adopted.revision, lineageId: adopted.lineageId, connectedClientId: adopted.connectedClientId, userId: adopted.userId, workspaceId: adopted.workspaceId }) });
  } catch (error) {
    const cleaned = await cleanupPkceProof(bound, record, response, adopted);
    const code = cleaned.journalled ? pkceFailureCode(error, "credential_store_unavailable") : cleaned.failureCode;
    const outcome = code === "cancelled" ? "cancelled" : "failed";
    try { await finishPkceAttempt(context, record, outcome, code, true); }
    catch { return Object.freeze({ ...pkceAttemptView(record), phase: outcome, failureCode: "cleanup_required" }); }
    return Object.freeze({ ...pkceAttemptView(record), phase: outcome, failureCode: code });
  }
}
