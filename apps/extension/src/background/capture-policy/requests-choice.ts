// What a save does to the person's stored direct-requests choice. The stored
// value is theirs and is kept as they set it; Core's recording-capture policy
// is applied where settings are used (`effective-settings.ts`). A save changes
// the choice only when the policy Core gave allows direct requests, asked
// through Core's own clamp. Where the policy forbids them the switch is shown
// disabled and reads off, so the request it sends is ignored rather than
// overwriting the choice a later policy may allow again.

import { clampAutomationStudioRecordingCaptureSettings, type AutomationStudioRecordingCapturePolicy } from "fluxiq/automation-studio/nodes";

export function requestsChoice(stored: boolean, requested: unknown, policy: AutomationStudioRecordingCapturePolicy): boolean {
  if (typeof requested !== "boolean") return stored;
  const allowed = clampAutomationStudioRecordingCaptureSettings({ directRequests: true }, policy).directRequests;
  return allowed ? requested : stored;
}
