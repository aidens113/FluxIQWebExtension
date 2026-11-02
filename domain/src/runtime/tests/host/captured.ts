import assert from "node:assert/strict";
import type { AutomationStudioHostStateSnapshotRef } from "fluxiq/runtime/automation-host";
import type { WebAutomationHostRuntimeBoundary } from "../../host-runtime";

/** Require a real snapshot while retaining the host's original reference. */
export async function captured(
  boundary: WebAutomationHostRuntimeBoundary,
  input: Parameters<NonNullable<WebAutomationHostRuntimeBoundary["captureStateSnapshot"]>>[0]
): Promise<AutomationStudioHostStateSnapshotRef> {
  const outcome = await boundary.captureStateSnapshot!(input);
  assert.ok(!("kind" in outcome), "Expected a captured state reference");
  return outcome;
}
