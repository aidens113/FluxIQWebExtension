import { bindingAudience, type HostedCredentialBinding } from "../binding";
import { HostedCredentialError } from "../failure";
import type { BindingRecord, MutationRecord, RevocationRecord, StoredCredential } from "./types";
import { exactObject, identifier, installationId, opaqueCredential, revision } from "./values";

function credential(value: unknown): value is StoredCredential {
  if (!exactObject(value, ["credential", "expiresAtMs", "connectedClientId", "userId", "workspaceId", "lineageId"])) return false;
  return opaqueCredential(value.credential) && Number.isSafeInteger(value.expiresAtMs) && (value.expiresAtMs as number) > 0 && [value.connectedClientId, value.userId, value.workspaceId].every(item => typeof item === "string" && item.length > 0 && item.length <= 128) && identifier(value.lineageId);
}

export function bindingRecord(value: unknown, key: string, binding: HostedCredentialBinding): BindingRecord | null {
  if (value === undefined) return null;
  if (!exactObject(value, ["schema", "key", "binding", "installId", "revision", "credential"]) || value.schema !== 1 || value.key !== key || !installationId(value.installId) || !revision(value.revision) || value.credential !== null && !credential(value.credential)) throw new HostedCredentialError("record_invalid");
  const expected = bindingAudience(binding);
  if (value.revision === 0 && value.credential !== null) throw new HostedCredentialError("record_invalid");
  if (!exactObject(value.binding, Object.keys(expected)) || !Object.entries(expected).every(([name, item]) => value.binding && (value.binding as Record<string, unknown>)[name] === item)) throw new HostedCredentialError("record_invalid");
  return value as BindingRecord;
}

export function mutationRecord(value: unknown, key: string, bindingKey: string, operationId: string): MutationRecord | null {
  if (value === undefined) return null;
  if (!exactObject(value, ["schema", "key", "bindingKey", "operationId", "kind", "expectedRevision", "payloadDigest", "revision"]) || value.schema !== 1 || value.key !== key || value.bindingKey !== bindingKey || value.operationId !== operationId || !["new-trust", "rotation", "forget", "queue-revocation"].includes(value.kind as string) || typeof value.payloadDigest !== "string" || !/^[a-f0-9]{64}$/u.test(value.payloadDigest) || value.expectedRevision !== null && !revision(value.expectedRevision) || value.revision !== null && !revision(value.revision)) throw new HostedCredentialError("record_invalid");
  if (value.kind === "queue-revocation" ? value.expectedRevision !== null || value.revision !== null : value.expectedRevision === null || value.revision !== (value.expectedRevision as number) + 1) throw new HostedCredentialError("record_invalid");
  return value as MutationRecord;
}

export function revocationRecord(value: unknown, bindingKey: string): RevocationRecord {
  if (!exactObject(value, ["schema", "key", "bindingKey", "revocationId", "credential", "createdAtMs"]) || value.schema !== 1 || value.bindingKey !== bindingKey || !identifier(value.revocationId) || value.key !== JSON.stringify([bindingKey, value.revocationId]) || !opaqueCredential(value.credential) || !revision(value.createdAtMs)) throw new HostedCredentialError("record_invalid");
  return value as RevocationRecord;
}
