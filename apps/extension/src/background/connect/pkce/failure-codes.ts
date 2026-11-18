import { CONNECT_TOKEN_ERROR_CODES } from "@fluxiq/contracts/platform";

export const HOSTED_PKCE_FAILURE_CODES = Object.freeze([
  ...CONNECT_TOKEN_ERROR_CODES, "configuration_invalid", "selection_changed", "cancelled", "discovery_unavailable", "discovery_invalid",
  "unsupported_server", "client_incompatible", "binding_changed", "attempt_store_unavailable", "attempt_invalid", "attempt_conflict",
  "ownership_unavailable", "ownership_lost", "session_changed", "crypto_unavailable", "clock_invalid", "trust_transition_required",
  "credential_store_unavailable", "credential_conflict", "callback_refused", "server_error", "exchange_uncertain", "response_invalid",
  "credential_expired", "cleanup_required", "interrupted", "operation_failed"
] as const);

export type HostedPkceFailureCode = (typeof HOSTED_PKCE_FAILURE_CODES)[number];
