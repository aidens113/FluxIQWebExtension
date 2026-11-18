import { HostedCredentialError } from "../failure";
import type { HostedPendingRevocation } from "../model";
import { identifier, opaqueCredential, revocationRecord, type RevocationRecord } from "../records";
import { idbRequest } from "../storage";
import type { CredentialContext } from "./context";
import { mutationIdentity, previousMutation } from "./mutation";

export function pendingRevocation(context: CredentialContext, operationId: string, credential: string): RevocationRecord {
  return { schema: 1, key: JSON.stringify([context.key, operationId]), bindingKey: context.key, revocationId: operationId, credential, createdAtMs: context.now() };
}

function view(context: CredentialContext, value: unknown): HostedPendingRevocation {
  const record = revocationRecord(value, context.key);
  return Object.freeze({ binding: context.binding, revocationId: record.revocationId, credential: record.credential, createdAtMs: record.createdAtMs });
}

export async function queueCredentialRevocation(context: CredentialContext, input: { operationId: string; credential: string }): Promise<HostedPendingRevocation | null> {
  if (!input || !opaqueCredential(input.credential)) throw new HostedCredentialError("credential_invalid");
  const credential = input.credential;
  const operationId = input.operationId;
  const intended = await mutationIdentity(context, { operationId, expectedRevision: null, kind: "queue-revocation", payload: credential });
  return context.database.run("readwrite", async transaction => {
    const previous = await previousMutation(transaction, intended);
    if (previous) {
      const pending = await idbRequest(transaction.objectStore("revocations").get(intended.key));
      return pending === undefined ? null : view(context, pending);
    }
    const pending = pendingRevocation(context, operationId, credential);
    await idbRequest(transaction.objectStore("revocations").add(pending));
    await idbRequest(transaction.objectStore("mutations").add(intended));
    return view(context, pending);
  });
}

export async function listCredentialRevocations(context: CredentialContext): Promise<HostedPendingRevocation[]> {
  return context.database.run("readonly", async transaction => {
    const rows = await idbRequest(transaction.objectStore("revocations").index("bindingKey").getAll(context.key));
    return rows.map(row => view(context, row));
  });
}

export async function acknowledgeCredentialRevocation(context: CredentialContext, revocationId: string): Promise<void> {
  if (!identifier(revocationId)) throw new HostedCredentialError("credential_invalid");
  await context.database.run("readwrite", async transaction => {
    const key = JSON.stringify([context.key, revocationId]);
    const row = await idbRequest(transaction.objectStore("revocations").get(key));
    if (row !== undefined) revocationRecord(row, context.key);
    await idbRequest(transaction.objectStore("revocations").delete(key));
  });
}
