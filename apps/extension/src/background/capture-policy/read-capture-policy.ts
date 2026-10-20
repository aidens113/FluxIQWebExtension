// Reading the recording-capture policy Core answers `get-recording-capture-policy`
// with. Core owns the policy (`fluxiq/automation-studio/nodes`); this only checks
// that what arrived has its shape, so a malformed answer is never mistaken for
// a policy and the caller keeps the one it had.

import type { AutomationStudioRecordingCapturePolicy, AutomationStudioRecordingCaptureSwitchPolicy } from "fluxiq/automation-studio/nodes";

/** The policy in `value`, or undefined when any part of it is missing or not a boolean. */
export function readCapturePolicy(value: unknown): AutomationStudioRecordingCapturePolicy | undefined {
  const record = recordOf(value);
  if (!record) return undefined;
  const captureInputValues = switchPolicy(record.captureInputValues);
  const captureSnapshots = switchPolicy(record.captureSnapshots);
  const captureMutations = switchPolicy(record.captureMutations);
  const directAllowed = recordOf(record.directRequests)?.allowed;
  if (!captureInputValues || !captureSnapshots || !captureMutations || typeof directAllowed !== "boolean") return undefined;
  return { captureInputValues, captureSnapshots, captureMutations, directRequests: { allowed: directAllowed } };
}

function switchPolicy(value: unknown): AutomationStudioRecordingCaptureSwitchPolicy | undefined {
  const record = recordOf(value);
  if (typeof record?.allowed !== "boolean" || typeof record.default !== "boolean") return undefined;
  return { allowed: record.allowed, default: record.default };
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
