// Saving the connection settings without connecting.
//
// Until now the only way to store a changed address was Connect, which saved
// and then dialled, so correcting an address while FluxIQ was down produced a
// failure for an edit that had worked. This stores exactly the known fields,
// each only when it has the right type, and never touches the socket.
//
// Direct requests are stored on only when Core's recording-capture policy
// allows them and the request asked for them; under Core's default policy they
// stay off, as before Core owned the policy.

import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY, clampAutomationStudioRecordingCaptureSettings, type AutomationStudioRecordingCapturePolicy } from "fluxiq/automation-studio/nodes";
import type { FluxIQSettings } from "../../shared/protocol";

const TEXT_FIELDS = ["gatewayUrl", "coreApiUrl"] as const;
const SWITCH_FIELDS = ["autoReconnect", "captureMutations", "captureInputValues", "captureSnapshots"] as const;

/**
 * `current` with every well-typed known field of `requested` laid over it.
 * An address is trimmed and an empty one is ignored rather than stored, since
 * no connection can be made to it; an unknown or mistyped field is dropped.
 */
export function mergeSettings(
  current: FluxIQSettings,
  requested: unknown,
  policy: AutomationStudioRecordingCapturePolicy = AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY
): FluxIQSettings {
  const allowedRequests = (asked: unknown) => clampAutomationStudioRecordingCaptureSettings({ directRequests: asked === true }, policy).directRequests;
  const next: FluxIQSettings = { ...current, requestsEnabled: allowedRequests(current.requestsEnabled) };
  if (!requested || typeof requested !== "object" || Array.isArray(requested)) return next;
  const record = requested as Record<string, unknown>;
  if (typeof record.requestsEnabled === "boolean") next.requestsEnabled = allowedRequests(record.requestsEnabled);
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
