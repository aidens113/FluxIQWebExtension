import type { HostedCredentialAudience } from "../binding";

export type StoredCredential = { credential: string; expiresAtMs: number; connectedClientId: string; userId: string; workspaceId: string; lineageId: string };
export type BindingRecord = { schema: 1; key: string; binding: HostedCredentialAudience; installId: string; revision: number; credential: StoredCredential | null };
export type MutationKind = "new-trust" | "rotation" | "forget" | "queue-revocation";
export type MutationRecord = { schema: 1; key: string; bindingKey: string; operationId: string; kind: MutationKind; expectedRevision: number | null; payloadDigest: string; revision: number | null };
export type RevocationRecord = { schema: 1; key: string; bindingKey: string; revocationId: string; credential: string; createdAtMs: number };
