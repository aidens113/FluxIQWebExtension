export type HostedCredentialTransportFailure = "selection_changed" | "trust_changed" | "hello_required" | "metadata_missing" | "metadata_invalid" | "crypto_unavailable" | "credential_changed" | "operation_failed";

/** Fixed private feedback; never wraps a token, ready frame, or callback exception. */
export class HostedCredentialTransportError extends Error {
  constructor(readonly code: HostedCredentialTransportFailure) {
    super("The selected hosted credential could not be used or stored.");
    this.name = "HostedCredentialTransportError";
  }
}
