// Whether a run's provider failures say the account is out of money.
//
// Read from the run's `provider-failures.local.json`. The shape that ended the
// overnight loop on 2026-09-30 (run-muodi6zc-9fa1dad7 and about 520 like it):
// `records[].provider.httpStatus` 402, and Core's body carrying DeepSeek's
// refusal, `"message":"Insufficient Balance (request_id: ...)"`. Other
// providers say it with other words -- OpenAI answers 429
// `insufficient_quota`, "You exceeded your current quota"; Anthropic 400
// "credit balance is too low" -- so the text is matched as well as the status.
// Core classifies an empty balance itself, as `llm.provider_balance_exhausted`
// (step-log meta.error.code) or `flow_bootstrap.provider_balance_exhausted`
// (build failure code); its safe message does not match the text, so the
// code is matched too.
// A plain 429 rate limit is not a balance failure: it clears by itself.

const CORE_BALANCE_CODES = new Set(["llm.provider_balance_exhausted", "flow_bootstrap.provider_balance_exhausted"]);
const BALANCE_TEXT = /insufficient[\s_-]*(?:balance|quota|credits?|funds)|exceeded your current quota|credit balance is too low|out of credits/iu;

/**
 * @param {unknown} payload the parsed `provider-failures.local.json`
 * @returns {{ at: string | null, provider: string | null, model: string | null, httpStatus: number | null, code: string | null, evidence: string } | null}
 */
export function detectBalanceFailure(payload) {
  const records = Array.isArray(payload?.records) ? payload.records : [];
  for (const record of records) {
    const provider = record?.provider ?? {};
    const status = typeof provider.httpStatus === "number" ? provider.httpStatus : null;
    const text = [record?.core?.body, provider.body, provider.thrown].map(textOf).join("\n");
    const match = BALANCE_TEXT.exec(text);
    const coreCode = typeof provider.code === "string" && CORE_BALANCE_CODES.has(provider.code) ? provider.code : null;
    if (status !== 402 && match === null && coreCode === null) continue;
    return {
      at: typeof record.at === "string" ? record.at : null,
      provider: typeof provider.provider === "string" ? provider.provider : null,
      model: typeof provider.model === "string" ? provider.model : null,
      httpStatus: status,
      code: typeof provider.code === "string" ? provider.code : null,
      evidence: coreCode !== null ? `Core code ${coreCode}` : match === null ? `provider HTTP ${status} (payment required)` : match[0],
    };
  }
  return null;
}

function textOf(value) {
  if (typeof value === "string") return value;
  return value === null || value === undefined ? "" : JSON.stringify(value);
}
