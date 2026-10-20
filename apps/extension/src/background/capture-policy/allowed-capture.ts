// What Core's recording-capture policy allows, reduced to the booleans the
// panel needs to disable a switch Core forbids. Only `allowed` crosses to the
// panel: defaults are applied by Core's clamp here in the background.

import type { AutomationStudioRecordingCapturePolicy } from "fluxiq/automation-studio/nodes";
import type { ExtensionCaptureAllowed } from "../../shared/protocol";

export function allowedCapture(policy: AutomationStudioRecordingCapturePolicy): ExtensionCaptureAllowed {
  return {
    captureMutations: policy.captureMutations.allowed === true,
    captureInputValues: policy.captureInputValues.allowed === true,
    captureSnapshots: policy.captureSnapshots.allowed === true,
    directRequests: policy.directRequests.allowed === true
  };
}
