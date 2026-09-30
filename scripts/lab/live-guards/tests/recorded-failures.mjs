// Provider failure payloads as runs recorded them in
// `provider-failures.local.json`, sanitised: request ids replaced, the
// request's size figures kept, nothing from any page.

/** run-muodi6zc-9fa1dad7, 2026-09-30: DeepSeek refused the first call for an empty balance. */
export const INSUFFICIENT_BALANCE = {
  schemaVersion: "0.1",
  tier: "local",
  published: false,
  runId: "run-muodi6zc-9fa1dad7",
  failures: 1,
  dropped: 0,
  records: [{
    at: "2026-09-30T17:22:52.266Z",
    route: "generate-flow-bootstrap-adaptation",
    request: { controlRequestBytes: 193, bounds: { provider: "deepseek", model: "deepseek-flash", maxInputTokens: 48000, maxOutputTokens: 8000, maxTotalTokensPerRequest: 56000, maxCallsPerRun: 64, maxTotalTokensPerRun: 3584000, timeoutMs: 25000 } },
    core: {
      httpStatus: 400,
      body: JSON.stringify({
        ok: false,
        error: "Flow Bootstrap generation failed (flow_bootstrap.provider_http_error).",
        payload: { diagnostic: {
          code: "flow_bootstrap.provider_http_error", stage: "provider_request", retryable: false, providerInvocation: "attempted", providerResponse: "received",
          accounting: {
            requestId: "llm.evidence_tool_decision.00000000-0000-0000-0000-000000000000", estimatedInputTokens: 9932, provider: "deepseek", model: "deepseek-flash", providerStatus: 402,
            providerRefusal: { status: 402, contentType: "application/json", bodyBytes: 162, error: { code: "invalid_request_error", type: "unknown_error", param: null, message: "Insufficient Balance (request_id: 00000000-0000-0000-0000-000000000000)" } },
          },
        } },
      }),
      bodyBytes: 1646,
      bodyTruncated: false,
    },
    provider: { code: "flow_bootstrap.provider_http_error", stage: "provider_request", httpStatus: 402, invocation: "attempted", response: "received", provider: "deepseek", model: "deepseek-flash", estimatedInputTokens: 9932, toolCallCount: null, toolIds: null, body: null, thrown: null },
  }],
};

/** run-muncqlr0-3348202b, 2026-09-30: refused before any provider call, which is not a balance failure. */
export const PRE_PROVIDER_VALIDATION = {
  schemaVersion: "0.1",
  runId: "run-muncqlr0-3348202b",
  failures: 1,
  dropped: 0,
  records: [{
    at: "2026-09-30T00:23:05.964Z",
    route: "generate-flow-bootstrap-adaptation",
    core: { httpStatus: 400, body: "{\"ok\":false,\"error\":\"Flow Bootstrap generation failed (flow_bootstrap.pre_provider_validation_failed).\",\"payload\":{\"diagnostic\":{\"code\":\"flow_bootstrap.pre_provider_validation_failed\",\"stage\":\"pre_provider_validation\",\"retryable\":false,\"providerInvocation\":\"not_attempted\",\"providerResponse\":\"not_received\"}}}", bodyBytes: 309, bodyTruncated: false },
    provider: { code: "flow_bootstrap.pre_provider_validation_failed", stage: "pre_provider_validation", httpStatus: null, invocation: "not_attempted", response: "not_received", provider: null, model: null, estimatedInputTokens: null, toolCallCount: null, toolIds: null, body: null, thrown: null },
  }],
};
