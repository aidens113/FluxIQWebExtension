import { bindingAudience } from "../binding";
import { HostedCredentialError } from "../failure";
import type { HostedCredentialSnapshot } from "../model";
import { bindingRecord, identifier, installationId, type BindingRecord } from "../records";
import { idbRequest } from "../storage";
import type { CredentialContext } from "./context";

export async function readBindingRecord(context: CredentialContext, transaction: IDBTransaction): Promise<BindingRecord | null> {
  return bindingRecord(await idbRequest(transaction.objectStore("bindings").get(context.key)), context.key, context.binding);
}

export function mintCredentialIdentifier(context: CredentialContext): string {
  try {
    const value = context.mint();
    if (!identifier(value)) throw new HostedCredentialError("crypto_unavailable");
    return value;
  } catch {
    throw new HostedCredentialError("crypto_unavailable");
  }
}

export function emptyBindingRecord(context: CredentialContext): BindingRecord {
  const installId = `extension-${mintCredentialIdentifier(context)}`;
  if (!installationId(installId)) throw new HostedCredentialError("crypto_unavailable");
  return { schema: 1, key: context.key, binding: bindingAudience(context.binding), installId, revision: 0, credential: null };
}

export function credentialSnapshot(context: CredentialContext, row: BindingRecord): HostedCredentialSnapshot {
  if (!row.credential) throw new HostedCredentialError("record_invalid");
  if (row.credential.expiresAtMs <= context.now()) throw new HostedCredentialError("credential_expired");
  const credential = row.credential;
  const lineageKey = JSON.stringify([context.key, row.installId, credential.userId, credential.workspaceId, credential.connectedClientId, credential.lineageId]);
  return Object.freeze({ binding: context.binding, installId: row.installId, revision: row.revision, ...credential, lineageKey });
}
