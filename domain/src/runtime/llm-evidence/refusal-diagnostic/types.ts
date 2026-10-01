import type { WebLlmToolRejectionCode, WebLlmToolRejectionReason } from "../tool-rejection";
import type { WebAutomationLayerKind } from "../../../page-evidence";

/** The call's own pre-action structural facts, with no page-owned strings. */
export type WebBuildRefusalDiagnostic = {
  schemaVersion: "web-build-refusal.v1";
  phase: "before_action";
  code: WebLlmToolRejectionCode;
  reason?: WebLlmToolRejectionReason;
  pageObserved: boolean;
  target?: string;
  targetObserved: boolean;
  coveringTargets: string[];
  coveringKinds: WebAutomationLayerKind[];
  coveringCount: number;
};
