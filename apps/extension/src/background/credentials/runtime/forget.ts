import { HostedCredentialError } from "../failure";
import type { HostedInstallationIdentity } from "../model";
import { idbRequest } from "../storage";
import type { CredentialContext } from "./context";
import { mutationIdentity, previousMutation, requireRevision } from "./mutation";
import { readBindingRecord } from "./state";
import { pendingRevocation } from "./revocations";

export async function forgetCredential(context: CredentialContext, input: { expectedRevision: number; operationId: string }): Promise<HostedInstallationIdentity> {
  if (!input) throw new HostedCredentialError("credential_invalid");
  const expectedRevision = input.expectedRevision;
  const operationId = input.operationId;
  const intended = await mutationIdentity(context, { operationId, expectedRevision, kind: "forget", payload: null });
  return context.database.run("readwrite", async transaction => {
    const previous = await previousMutation(transaction, intended);
    const current = await readBindingRecord(context, transaction);
    if (!current) throw new HostedCredentialError("revision_conflict");
    if (previous) {
      requireRevision(current.revision, previous.revision!);
      if (current.credential) throw new HostedCredentialError("record_invalid");
      return { installId: current.installId, revision: current.revision };
    }
    requireRevision(current.revision, expectedRevision);
    if (current.credential) await idbRequest(transaction.objectStore("revocations").add(pendingRevocation(context, operationId, current.credential.credential)));
    const next = { ...current, revision: intended.revision!, credential: null };
    await idbRequest(transaction.objectStore("bindings").put(next));
    await idbRequest(transaction.objectStore("mutations").add(intended));
    return { installId: next.installId, revision: next.revision };
  });
}
