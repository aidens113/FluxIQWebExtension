import { HostedCredentialError } from "../failure";
import { mutationRecord, identifier, revision, type MutationKind, type MutationRecord } from "../records";
import { idbRequest } from "../storage";
import type { CredentialContext } from "./context";

export async function mutationIdentity(context: CredentialContext, input: { operationId: string; expectedRevision: number | null; kind: MutationKind; payload: unknown }): Promise<MutationRecord> {
  if (!identifier(input.operationId) || input.expectedRevision !== null && !revision(input.expectedRevision)) throw new HostedCredentialError("credential_invalid");
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new HostedCredentialError("crypto_unavailable");
    const payload = JSON.stringify([input.kind, input.expectedRevision, input.payload]);
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const payloadDigest = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
    return { schema: 1, key: JSON.stringify([context.key, input.operationId]), bindingKey: context.key, operationId: input.operationId, kind: input.kind, expectedRevision: input.expectedRevision, payloadDigest, revision: input.expectedRevision === null ? null : input.expectedRevision + 1 };
  } catch {
    throw new HostedCredentialError("crypto_unavailable");
  }
}

export async function previousMutation(transaction: IDBTransaction, intended: MutationRecord): Promise<MutationRecord | null> {
  const previous = mutationRecord(await idbRequest(transaction.objectStore("mutations").get(intended.key)), intended.key, intended.bindingKey, intended.operationId);
  if (previous && (previous.kind !== intended.kind || previous.expectedRevision !== intended.expectedRevision || previous.payloadDigest !== intended.payloadDigest || previous.revision !== intended.revision)) throw new HostedCredentialError("operation_conflict");
  return previous;
}

export function requireRevision(actual: number | undefined, expected: number): void {
  if (!Number.isSafeInteger(expected + 1) || actual !== expected) throw new HostedCredentialError("revision_conflict");
}
