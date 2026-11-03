import { hasFingerprintSignal } from "./fingerprint-signal";
import { isSensitiveKey } from "./sensitive-key";
import type { AutomationStudioElementTarget, AutomationStudioElementTargetFingerprint, AutomationStudioElementTargetValidationIssue, AutomationStudioElementTargetValidationResult } from "fluxiq/automation-studio";

export function validateWebElementTarget(target: AutomationStudioElementTarget, path = "target"): AutomationStudioElementTargetValidationResult {
  const issues: AutomationStudioElementTargetValidationIssue[] = [];
  if (target.kind !== "element") issue(issues, "error", "element_target.invalid_kind", "Element target kind must be element.", `${path}.kind`);
  if (!hasFingerprintSignal(target.fingerprint)) issue(issues, "error", "element_target.empty_fingerprint", "Element target fingerprint must include at least one identifying signal.", `${path}.fingerprint`);
  validateFingerprint(target.fingerprint, issues, `${path}.fingerprint`);
  for (const [index, candidate] of (target.candidates ?? []).entries()) {
    if (!candidate.candidateId?.trim()) issue(issues, "error", "element_target.candidate_missing_id", "Element target candidate must include a candidateId.", `${path}.candidates.${index}.candidateId`);
    validateFingerprint(candidate, issues, `${path}.candidates.${index}`);
  }
  const selected = target.selectedCandidate;
  if (selected) {
    if (!selected.candidateId.trim()) issue(issues, "error", "element_target.selection_missing_id", "Selected element candidate must include a candidateId.", `${path}.selectedCandidate.candidateId`);
    if (!Number.isFinite(selected.confidence) || selected.confidence < 0 || selected.confidence > 1) issue(issues, "error", "element_target.selection_invalid_confidence", "Selected element confidence must be between 0 and 1.", `${path}.selectedCandidate.confidence`);
  }
  if (target.source && !["recording", "runtime", "mapper", "operator", "inferred"].includes(target.source)) issue(issues, "error", "element_target.invalid_source", "Element target source is not recognized.", `${path}.source`);
  return { ok: issues.every((item) => item.severity !== "error"), issues };
}

function validateFingerprint(fingerprint: AutomationStudioElementTargetFingerprint, issues: AutomationStudioElementTargetValidationIssue[], path: string): void {
  for (const key of ["visibleText", "accessibleName", "label", "id", "testId", "automationId", "entityId", "entityKind", "tagName", "role", "selector", "xpath", "queryPath", "url", "drawing"] as const) {
    const value = fingerprint[key];
    if (value !== undefined && !value.trim()) issue(issues, "warning", "element_target.empty_signal", `Element target ${key} is empty and should be omitted.`, `${path}.${key}`);
  }
  if (fingerprint.bounds) {
    for (const key of ["x", "y", "width", "height"] as const) {
      if (!Number.isFinite(fingerprint.bounds[key])) issue(issues, "error", "element_target.invalid_bounds", "Element target bounds must be finite.", `${path}.bounds.${key}`);
    }
    if (fingerprint.bounds.width <= 0 || fingerprint.bounds.height <= 0) issue(issues, "error", "element_target.invalid_bounds", "Element target bounds width and height must be positive.", `${path}.bounds`);
  }
  if (fingerprint.statePath && typeof fingerprint.statePath !== "string") {
    if (!fingerprint.statePath.namespace.trim()) issue(issues, "error", "element_target.invalid_state_path", "Element target statePath namespace cannot be empty.", `${path}.statePath.namespace`);
    if (!fingerprint.statePath.path.trim()) issue(issues, "error", "element_target.invalid_state_path", "Element target statePath path cannot be empty.", `${path}.statePath.path`);
  }
  if (fingerprint.attributes && Object.keys(fingerprint.attributes).some(isSensitiveKey)) issue(issues, "error", "element_target.sensitive_attribute", "Element target attributes cannot include sensitive keys.", `${path}.attributes`);
  if (fingerprint.metadata && Object.keys(fingerprint.metadata).some(isSensitiveKey)) issue(issues, "error", "element_target.sensitive_metadata", "Element target metadata cannot include sensitive keys.", `${path}.metadata`);
}

function issue(issues: AutomationStudioElementTargetValidationIssue[], severity: "error" | "warning", code: string, message: string, path: string): void {
  issues.push({ severity, code, message, path });
}
