import type { AutomationStudioElementTargetFingerprint } from "fluxiq/automation-studio";

export function hasFingerprintSignal(fingerprint: AutomationStudioElementTargetFingerprint): boolean {
  return Boolean(fingerprint.visibleText || fingerprint.accessibleName || fingerprint.label || fingerprint.id || fingerprint.testId || fingerprint.automationId || fingerprint.entityId || fingerprint.statePath || fingerprint.selector || fingerprint.xpath || fingerprint.queryPath || fingerprint.bounds);
}
