// The settings the recorder actually uses: the person's, with Core's
// recording-capture policy applied by Core's own clamp. A switch the policy
// forbids is off whatever the person chose; direct requests are on only when
// the policy allows them and the person turned them on. The person's stored
// preference is left as it is, so a policy that relaxes later restores it.

import { clampAutomationStudioRecordingCaptureSettings, type AutomationStudioRecordingCapturePolicy } from "fluxiq/automation-studio/nodes";
import type { FluxIQSettings } from "../../shared/protocol";

export function effectiveSettings(settings: FluxIQSettings, policy: AutomationStudioRecordingCapturePolicy): FluxIQSettings {
  const clamped = clampAutomationStudioRecordingCaptureSettings({
    captureInputValues: settings.captureInputValues,
    captureSnapshots: settings.captureSnapshots,
    captureMutations: settings.captureMutations,
    directRequests: settings.requestsEnabled
  }, policy);
  return {
    ...settings,
    captureInputValues: clamped.captureInputValues,
    captureSnapshots: clamped.captureSnapshots,
    captureMutations: clamped.captureMutations,
    requestsEnabled: clamped.directRequests
  };
}
