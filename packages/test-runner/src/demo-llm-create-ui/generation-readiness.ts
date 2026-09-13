// The provider-free gate in front of the one paid call. A GET on the live
// readiness endpoint has to return Core's exact certified contract -- not a
// superset, not an older version -- before any UI, session or generation seam
// is touched, so an incompatible panel costs nothing and reports why.

import type { Page } from "@playwright/test";
import { AUTOMATION_STUDIO_ENDPOINTS, AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS, parseAutomationStudioFlowBootstrapGenerationReadiness } from "fluxiq/automation-studio";
import type { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { hasExactEnvelope } from "./json-shapes.js";
import { fail } from "./runner-fail.js";

export type ProviderFreeGenerationReadiness = Readonly<{
  compatible: boolean;
  status: number;
  responseBytes: number;
  parsed: boolean;
  code: "readiness.ready" | "readiness.http-rejected" | "readiness.response-invalid" | "readiness.runtime-unavailable";
  supported: boolean;
  llmExecutionGrantsConfigured: boolean;
  providerResolverConfigured: boolean;
  nativeNodeRegistryConfigured: boolean;
}>;

export async function assertProviderFreeGenerationReadiness(page: Page, evidence: BrowserEvidenceRecorder): Promise<ProviderFreeGenerationReadiness> {
  const endpoint = new URL(`/api/programs/automation-studio/${AUTOMATION_STUDIO_ENDPOINTS.getFlowBootstrapGenerationReadiness}?domainId=web-automation`, page.url()).toString();
  const response = await evidence.step("panel", "generation-readiness-probe", "Verify provider-free Flow Bootstrap generation compatibility", () => page.request.get(endpoint, {
    failOnStatusCode: false,
    timeout: 10_000,
  }));
  const readiness = await readProviderFreeGenerationReadiness(response);
  if (!readiness.compatible) {
    await evidence.diagnostic("panel", "generation-readiness-rejected", readiness.code, {
      httpStatus: readiness.status,
      responseBytes: readiness.responseBytes,
      responseParsed: readiness.parsed,
      supported: readiness.supported,
      llmExecutionGrantsConfigured: readiness.llmExecutionGrantsConfigured,
      providerResolverConfigured: readiness.providerResolverConfigured,
      nativeNodeRegistryConfigured: readiness.nativeNodeRegistryConfigured,
    });
    fail("Running FluxIQ panel does not expose certified provider-free generation readiness");
  }
  return readiness;
}

export async function readProviderFreeGenerationReadiness(
  response: { ok(): boolean; status(): number; text(): Promise<string> }
): Promise<ProviderFreeGenerationReadiness> {
  const status = response.status();
  let body = "";
  try { body = await response.text(); } catch { /* incompatible without retaining error text */ }
  const responseBytes = Math.min(Buffer.byteLength(body, "utf8"), 1_000_000);
  if (!response.ok() || status < 200 || status > 299) return unreadiness(status, responseBytes, "readiness.http-rejected");
  if (!body || responseBytes > 4096) return unreadiness(status, responseBytes, "readiness.response-invalid");
  try {
    const root = JSON.parse(body) as unknown;
    const parsed = hasExactEnvelope(root, ["ok", "payload"])
      && root.ok === true
      && hasExactEnvelope(root.payload, ["readiness"])
      ? parseAutomationStudioFlowBootstrapGenerationReadiness(root.payload.readiness)
      : null;
    if (!parsed || !matchesExactJson(
      { ...parsed, supported: true, runtime: AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS.runtime },
      AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS
    )) return unreadiness(status, responseBytes, "readiness.response-invalid");
    const compatible = parsed.supported === true
      && parsed.runtime.llmExecutionGrantsConfigured === true
      && parsed.runtime.providerResolverConfigured === true
      && parsed.runtime.nativeNodeRegistryConfigured === true;
    return Object.freeze({
      compatible,
      status,
      responseBytes,
      parsed: true,
      code: compatible ? "readiness.ready" as const : "readiness.runtime-unavailable" as const,
      supported: parsed.supported,
      llmExecutionGrantsConfigured: parsed.runtime.llmExecutionGrantsConfigured,
      providerResolverConfigured: parsed.runtime.providerResolverConfigured,
      nativeNodeRegistryConfigured: parsed.runtime.nativeNodeRegistryConfigured,
    });
  } catch {
    return unreadiness(status, responseBytes, "readiness.response-invalid");
  }
}

function unreadiness(status: number, responseBytes: number, code: "readiness.http-rejected" | "readiness.response-invalid"): ProviderFreeGenerationReadiness {
  return Object.freeze({ compatible: false, status, responseBytes, parsed: false, code, supported: false, llmExecutionGrantsConfigured: false, providerResolverConfigured: false, nativeNodeRegistryConfigured: false });
}
function matchesExactJson(value: unknown, expected: unknown): boolean {
  if (value === expected) return true;
  if (Array.isArray(expected)) return Array.isArray(value)
    && value.length === expected.length
    && expected.every((item, index) => matchesExactJson(value[index], item));
  if (!expected || typeof expected !== "object" || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const expectedRecord = expected as Record<string, unknown>;
  const valueRecord = value as Record<string, unknown>;
  const keys = Object.keys(expectedRecord);
  return Object.keys(valueRecord).length === keys.length
    && keys.every(key => Object.prototype.hasOwnProperty.call(valueRecord, key) && matchesExactJson(valueRecord[key], expectedRecord[key]));
}
