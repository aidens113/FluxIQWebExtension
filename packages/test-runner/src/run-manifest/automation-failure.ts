import { isAutomationStudioAdaptiveFailureClass, parseAutomationStudioFailureRecord, type RunAutomationFailure } from "@fluxiq-web-extension/test-contracts";

const CODE = /^[A-Za-z0-9_.:-]{1,128}$/u;

/**
 * The automation failure a FluxIQ action result reports, in Core's failure
 * taxonomy; `null` when the action succeeded.
 *
 * A `failure` Core's parser accepts wins: it is the producer's own structured
 * record, category and code together. Otherwise the category is read from
 * `failureCategory`, `category`, or `error.category`, and a result naming none
 * is `timeout` when it timed out and `ambiguous_or_unknown` otherwise. Only
 * identifier-shaped codes are kept, so no free-text message reaches the
 * manifest.
 */
export function automationFailureFromActionResult(result: unknown): RunAutomationFailure | null {
  const value = asRecord(result);
  if (value?.status === "succeeded") return null;
  const reported = parseAutomationStudioFailureRecord(value?.failure);
  if (reported) return { category: reported.category, code: reported.code };
  const failure = asRecord(value?.failure);
  const error = asRecord(value?.error);
  const code = [failure?.code, value?.errorCode, value?.code, error?.code, value?.error].find(isCode);
  const category = [failure?.category, value?.failureCategory, value?.category, error?.category].find(isAutomationStudioAdaptiveFailureClass)
    ?? (value?.status === "timed_out" ? "timeout" : "ambiguous_or_unknown");
  return { category, ...(code !== undefined && code !== category ? { code } : {}) };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function isCode(value: unknown): value is string {
  return typeof value === "string" && CODE.test(value);
}
