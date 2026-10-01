import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import { present } from "../present";
import { webLlmLayerKind } from "../layer-marks";
import type { WebAutomationLayerKind } from "../../../page-evidence";
import { WEB_LLM_TOOL_REJECTION_CODES, WEB_LLM_TOOL_REJECTION_REASONS } from "../tool-rejection";
import type { WebLlmToolRejectionCode, WebLlmToolRejectionReason } from "../tool-rejection";
import type { WebBuildRefusalDiagnostic } from "./types";

const FIELDS = new Set(["schemaVersion", "phase", "code", "reason", "pageObserved", "target", "targetObserved", "coveringTargets", "coveringKinds", "coveringCount"]);

/**
 * Screen the structural account again at a bundle boundary; code shape alone is
 * not a secret screen. Handles come back canonical: a pre-t223 record spelled
 * `target.N` is admitted and returned as `tN`.
 */
export function screenWebBuildRefusalDiagnostic(value: unknown): WebBuildRefusalDiagnostic | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !FIELDS.has(key))
    || record.schemaVersion !== "web-build-refusal.v1" || record.phase !== "before_action"
    || !(WEB_LLM_TOOL_REJECTION_CODES as readonly unknown[]).includes(record.code)
    || (record.reason !== undefined && !(WEB_LLM_TOOL_REJECTION_REASONS as readonly unknown[]).includes(record.reason))
    || typeof record.pageObserved !== "boolean" || typeof record.targetObserved !== "boolean"
    || (record.target !== undefined && canonicalWebLlmTargetHandle(record.target) === undefined)
    || !Array.isArray(record.coveringTargets) || !record.coveringTargets.every((item) => canonicalWebLlmTargetHandle(item) !== undefined)
    || !Array.isArray(record.coveringKinds) || !record.coveringKinds.every((item) => typeof item === "string" && webLlmLayerKind(item) === item)
    || record.coveringKinds.length > record.coveringTargets.length
    || !Number.isSafeInteger(record.coveringCount) || (record.coveringCount as number) < record.coveringTargets.length
    || (!record.pageObserved && (record.targetObserved || record.coveringCount !== 0))
    || (record.targetObserved && record.target === undefined)
    || (!record.targetObserved && record.coveringCount !== 0)) return undefined;
  return present<WebBuildRefusalDiagnostic>({
    schemaVersion: "web-build-refusal.v1", phase: "before_action", code: record.code as WebLlmToolRejectionCode,
    reason: record.reason as WebLlmToolRejectionReason | undefined,
    pageObserved: record.pageObserved,
    target: record.target === undefined ? undefined : canonicalWebLlmTargetHandle(record.target),
    targetObserved: record.targetObserved,
    coveringTargets: record.coveringTargets.map((item) => canonicalWebLlmTargetHandle(item) as string),
    coveringKinds: [...record.coveringKinds] as WebAutomationLayerKind[],
    coveringCount: record.coveringCount as number,
  });
}
