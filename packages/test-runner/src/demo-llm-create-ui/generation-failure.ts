// What a failed Flow bootstrap generation is allowed to keep. A provider or
// Core error response never leaves this function as text: it becomes a fixed
// set of bounded facts, and the reason code survives only if Core's own phase
// vocabulary lists it.
//
// The evidence-step allowlists are read from the domain rather than restated.
// While they were hand-kept copies they had already drifted from it, silently
// dropping whole classes of step; deriving them means a tool or result code
// added in the domain is admitted here with no edit.

import type { Response } from "@playwright/test";
import { AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES, parseAutomationStudioFlowBootstrapFailureDiagnostic, type AutomationStudioFlowBootstrapFailureStage, type AutomationStudioFlowBootstrapPhaseFailureCode } from "fluxiq/automation-studio";
import { WEB_LLM_EVIDENCE_RESULT_CODES, WEB_LLM_EVIDENCE_TOOL_IDS } from "@fluxiq-web-extension/domain/node";
import { hasExactEnvelope } from "./json-shapes.js";

export type SanitizedGenerationFailure = Readonly<{
  status: number;
  code: string;
  reasonCode: AutomationStudioFlowBootstrapPhaseFailureCode | null;
  responseBytes: number;
  parsed: boolean;
  providerCallKnown: boolean;
  providerCallCount: number;
  accountingKnown: boolean;
  accountingAvailable: boolean;
  evidenceLoop?: Readonly<{
    iterationCount: number;
    decisionCount: number;
    toolCallCount: number;
    evidenceBytes: number;
    steps?: ReadonlyArray<Readonly<{ toolId: string; effectApplied?: boolean; resultCode?: string }>>;
  }>;
  evidenceSteps?: ReadonlyArray<Readonly<{ toolId: string; effectApplied?: boolean; resultCode?: string }>>;
  estimatedInputTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}>;

export async function readSanitizedGenerationFailure(response: Pick<Response, "status" | "headers" | "text">): Promise<SanitizedGenerationFailure> {
  const status = response.status();
  let body = "";
  try { body = await response.text(); } catch { /* fail closed without response content */ }
  const responseBytes = Math.min(Buffer.byteLength(body, "utf8"), 1_000_000);
  if (!body || responseBytes > 4096) return sanitizedGenerationFailure(status, responseBytes, false);
  try {
    const root = JSON.parse(body) as unknown;
    if (!hasExactEnvelope(root, ["ok", "error", "payload"])) return sanitizedGenerationFailure(status, responseBytes, false);
    if (root.ok !== false || !hasExactEnvelope(root.payload, ["diagnostic"])) return sanitizedGenerationFailure(status, responseBytes, false);
    const diagnostic = parseAutomationStudioFlowBootstrapFailureDiagnostic(root.payload.diagnostic);
    const exactError = diagnostic?.code === "flow_bootstrap.unsupported_request_field"
      ? "Flow bootstrap generation request contains unsupported fields."
      : diagnostic ? `Flow Bootstrap generation failed (${diagnostic.code}).` : "";
    if (!diagnostic || root.error !== exactError) {
      return sanitizedGenerationFailure(status, responseBytes, false);
    }
    return Object.freeze({
      status,
      code: generationFailureCodeForStage(diagnostic.stage),
      reasonCode: allowlistedGenerationFailureReason(diagnostic.stage, diagnostic.code),
      responseBytes,
      parsed: true,
      providerCallKnown: true,
      providerCallCount: diagnostic.providerInvocation === "attempted" ? 1 : 0,
      accountingKnown: true,
      accountingAvailable: diagnostic.accounting !== undefined,
      ...(diagnostic.evidenceLoop ? { evidenceLoop: Object.freeze({ iterationCount: diagnostic.evidenceLoop.iterationCount, decisionCount: diagnostic.evidenceLoop.decisionCount, toolCallCount: diagnostic.evidenceLoop.toolCallCount, evidenceBytes: diagnostic.evidenceLoop.evidenceBytes }) } : {}),
      ...(diagnostic.evidenceLoop?.steps ? { evidenceSteps: sanitizeEvidenceSteps(diagnostic.evidenceLoop.steps) } : {}),
      ...(diagnostic.accounting ? {
        estimatedInputTokens: diagnostic.accounting.estimatedInputTokens,
        ...(diagnostic.accounting.inputTokens === undefined ? {} : { inputTokens: diagnostic.accounting.inputTokens }),
        ...(diagnostic.accounting.outputTokens === undefined ? {} : { outputTokens: diagnostic.accounting.outputTokens }),
        ...(diagnostic.accounting.totalTokens === undefined ? {} : { totalTokens: diagnostic.accounting.totalTokens }),
      } : {}),
    });
  } catch {
    return sanitizedGenerationFailure(status, responseBytes, false);
  }
}

function sanitizedGenerationFailure(status: number, responseBytes: number, parsed: boolean): SanitizedGenerationFailure {
  return Object.freeze({
    status,
    code: Number.isInteger(status) && status >= 100 && status <= 599 ? `generation.http-${status}` : "generation.http-unknown",
    reasonCode: null,
    responseBytes,
    parsed,
    providerCallKnown: false,
    providerCallCount: 0,
    accountingKnown: false,
    accountingAvailable: false,
  });
}

const LOCAL_FLOW_BOOTSTRAP_FAILURE_REASON_CODES = Object.freeze({
  pre_provider_validation: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.pre_provider_validation),
  provider_resolution: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.provider_resolution),
  provider_request: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.provider_request),
  provider_output_validation: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.provider_output_validation),
  post_provider_validation: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.post_provider_validation),
  persistence: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.persistence),
});

function allowlistedGenerationFailureReason(stage: AutomationStudioFlowBootstrapFailureStage, code: string): AutomationStudioFlowBootstrapPhaseFailureCode | null {
  return LOCAL_FLOW_BOOTSTRAP_FAILURE_REASON_CODES[stage].has(code) ? code as AutomationStudioFlowBootstrapPhaseFailureCode : null;
}
function generationFailureCodeForStage(stage: AutomationStudioFlowBootstrapFailureStage): string {
  const codes: Readonly<Record<string, string>> = Object.freeze({
    pre_provider_validation: "generation.pre-provider-validation",
    provider_resolution: "generation.provider-resolution",
    provider_request: "generation.provider-request",
    provider_output_validation: "generation.provider-output-validation",
    post_provider_validation: "generation.post-provider-validation",
    persistence: "generation.persistence",
  });
  return codes[stage] ?? "generation.http-unknown";
}
// Sanitizer allowlists, read from the domain instead of restated: `WEB_LLM_EVIDENCE_TOOL_IDS` is what `getEvidenceTools()` offers and `WEB_LLM_EVIDENCE_RESULT_CODES` the two successes plus one per rejection reason, both exported from `domain/src/runtime/llm-evidence/vocabulary.ts`. A tool or code added there is admitted here with no edit; while these were hand-kept they had already lost `web.reveal_safe` and `web.action.rejected.no_progress`, silently dropping every step from those paths.
const WEB_EVIDENCE = Object.freeze({ toolIds: new Set<string>(WEB_LLM_EVIDENCE_TOOL_IDS), resultCodes: new Set<string>(WEB_LLM_EVIDENCE_RESULT_CODES) });
function sanitizeEvidenceSteps(steps: ReadonlyArray<{ toolId: string; effectApplied?: boolean; resultCode?: string }>): NonNullable<SanitizedGenerationFailure["evidenceSteps"]> {
  return Object.freeze(steps.flatMap(step => WEB_EVIDENCE.toolIds.has(step.toolId) && (step.resultCode === undefined || WEB_EVIDENCE.resultCodes.has(step.resultCode))
    ? [Object.freeze({ toolId: step.toolId, ...(step.effectApplied === undefined ? {} : { effectApplied: step.effectApplied }), ...(step.resultCode === undefined ? {} : { resultCode: step.resultCode }) })]
    : []));
}
