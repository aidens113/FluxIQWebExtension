// Saving the connection settings without connecting.
//
// Until now the only way to store a changed address was Connect, which saved
// and then dialled, so correcting an address while FluxIQ was down produced a
// failure for an edit that had worked. This stores exactly the known fields,
// each only when it has the right type, and never touches the socket.

import type { FluxIQSettings } from "../../shared/protocol";

const TEXT_FIELDS = ["gatewayUrl", "coreApiUrl"] as const;
const SWITCH_FIELDS = ["autoReconnect", "captureMutations", "captureInputValues", "captureSnapshots"] as const;

/**
 * `current` with every well-typed known field of `requested` laid over it.
 * An address is trimmed and an empty one is ignored rather than stored, since
 * no connection can be made to it; an unknown or mistyped field is dropped.
 */
export function mergeSettings(current: FluxIQSettings, requested: unknown): FluxIQSettings {
  const next: FluxIQSettings = { ...current };
  if (!requested || typeof requested !== "object" || Array.isArray(requested)) return next;
  const record = requested as Record<string, unknown>;
  for (const field of TEXT_FIELDS) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) next[field] = value.trim();
  }
  for (const field of SWITCH_FIELDS) {
    const value = record[field];
    if (typeof value === "boolean") next[field] = value;
  }
  return next;
}
