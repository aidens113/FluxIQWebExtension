import { HostedCredentialError } from "../failure";
import type { HostedCredentialCommit, HostedCredentialSnapshot } from "../model";
import { checkedResponse, type StoredCredential } from "../records";
import { idbRequest } from "../storage";
import type { CredentialContext } from "./context";
import { mutationIdentity, previousMutation, requireRevision } from "./mutation";
import { credentialSnapshot, mintCredentialIdentifier, readBindingRecord } from "./state";

export async function commitCredential(context: CredentialContext, input: HostedCredentialCommit): Promise<HostedCredentialSnapshot> {
  if (!input || !["new-trust", "rotation"].includes(input.kind)) throw new HostedCredentialError("credential_invalid");
  const { kind, expectedRevision, operationId } = input;
  const response = checkedResponse(input.response, context.now(), context.binding.gatewayUrl);
  const intended = await mutationIdentity(context, { operationId, expectedRevision, kind, payload: response });
  const row = await context.database.run("readwrite", async transaction => {
    const previous = await previousMutation(transaction, intended);
    const current = await readBindingRecord(context, transaction);
    if (!current) throw new HostedCredentialError("revision_conflict");
    if (previous) {
      requireRevision(current.revision, previous.revision!);
      if (!current.credential || current.credential.credential !== response.credential) throw new HostedCredentialError("record_invalid");
      return current;
    }
    requireRevision(current.revision, expectedRevision);
    const old = current.credential;
    if (kind === "rotation" && (!old || old.connectedClientId !== response.connectedClientId || old.userId !== response.user.userId || old.workspaceId !== response.workspace.workspaceId)) throw new HostedCredentialError("identity_mismatch");
    const lineageId = kind === "rotation" ? old!.lineageId : mintCredentialIdentifier(context);
    if (kind === "new-trust" && lineageId === old?.lineageId) throw new HostedCredentialError("crypto_unavailable");
    const credential: StoredCredential = { credential: response.credential, expiresAtMs: response.credentialExpiresAt, connectedClientId: response.connectedClientId, userId: response.user.userId, workspaceId: response.workspace.workspaceId, lineageId };
    const next = { ...current, revision: intended.revision!, credential };
    await idbRequest(transaction.objectStore("bindings").put(next));
    await idbRequest(transaction.objectStore("mutations").add(intended));
    return next;
  });
  return credentialSnapshot(context, row);
}
