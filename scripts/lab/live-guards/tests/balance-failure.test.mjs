// An empty balance is recognised from what a run actually recorded, and
// nothing else is mistaken for one.

import assert from "node:assert/strict";
import test from "node:test";
import { detectBalanceFailure } from "../index.mjs";
import { INSUFFICIENT_BALANCE, PRE_PROVIDER_VALIDATION } from "./recorded-failures.mjs";

test("the recorded DeepSeek 402 'Insufficient Balance' refusal is a balance failure", () => {
  assert.deepEqual(detectBalanceFailure(INSUFFICIENT_BALANCE), {
    at: "2026-09-30T17:22:52.266Z", provider: "deepseek", model: "deepseek-flash", httpStatus: 402, code: "flow_bootstrap.provider_http_error", evidence: "Insufficient Balance",
  });
});

test("the refusal is recognised by its text alone and by its status alone", () => {
  const record = INSUFFICIENT_BALANCE.records[0];
  const textOnly = { records: [{ ...record, provider: { ...record.provider, httpStatus: null } }] };
  assert.equal(detectBalanceFailure(textOnly)?.evidence, "Insufficient Balance");
  const statusOnly = { records: [{ ...record, core: { httpStatus: 400, body: "{}" } }] };
  assert.equal(detectBalanceFailure(statusOnly)?.evidence, "provider HTTP 402 (payment required)");
  const openAiQuota = { records: [{ provider: { httpStatus: 429, body: { error: { code: "insufficient_quota", message: "You exceeded your current quota" } } } }] };
  assert.equal(detectBalanceFailure(openAiQuota)?.httpStatus, 429);
});

test("other failures, a plain rate limit, and an empty or absent payload are not balance failures", () => {
  assert.equal(detectBalanceFailure(PRE_PROVIDER_VALIDATION), null);
  assert.equal(detectBalanceFailure({ records: [{ provider: { httpStatus: 429, body: "Rate limit reached, retry in 2s" } }] }), null);
  assert.equal(detectBalanceFailure({ records: [] }), null);
  assert.equal(detectBalanceFailure(null), null);
});
