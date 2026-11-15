export type HostedCredentialFailure = "binding_invalid" | "credential_invalid" | "credential_expired" | "record_invalid" | "revision_conflict" | "operation_conflict" | "identity_mismatch" | "storage_unavailable" | "repository_closed" | "crypto_unavailable";

/** Background-private fixed feedback; never retains a storage/parser error or credential. */
export class HostedCredentialError extends Error {
  constructor(readonly code: HostedCredentialFailure) {
    super("The bound credential request could not be completed.");
    this.name = "HostedCredentialError";
  }
}
