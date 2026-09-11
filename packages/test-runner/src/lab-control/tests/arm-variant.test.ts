import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { armScenarioVariant, type LabFetch } from "../arm-variant.js";

const variant = { id: "short-catalog", description: "One page", arm: { operation: "arm-short-catalog", payload: { pages: 1 } }, expected: {} };

function recordingFetch(status = 200): { fetchLab: LabFetch; calls: Array<{ url: string; method: string; headers: Record<string, string>; body: string }> } {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: string }> = [];
  return { calls, fetchLab: async (url, init) => { calls.push({ url, method: init.method, headers: init.headers, body: init.body }); return { ok: status >= 200 && status < 300, status }; } };
}

test("posts the arm operation and payload to the fixture's mutate endpoint with the run token", async () => {
  const { fetchLab, calls } = recordingFetch();
  await armScenarioVariant("http://127.0.0.1:4100/", "token-0123456789abcdef", "product-catalog", variant, fetchLab);
  assert.deepEqual(calls, [{
    url: "http://127.0.0.1:4100/api/product-catalog/arm-short-catalog",
    method: "POST",
    headers: { authorization: "Bearer token-0123456789abcdef", "content-type": "application/json" },
    body: JSON.stringify({ pages: 1 }),
  }]);
});

test("a variant without a payload posts an empty object", async () => {
  const { fetchLab, calls } = recordingFetch();
  await armScenarioVariant("http://127.0.0.1:4100", "token-0123456789abcdef", "auth-gate", { ...variant, arm: { operation: "expire" } }, fetchLab);
  assert.equal(calls[0]!.body, "{}");
});

test("a rejected arm or an operation that is not one path segment fails as a fixture error", async () => {
  await assert.rejects(armScenarioVariant("http://127.0.0.1:4100", "t", "auth-gate", variant, recordingFetch(404).fetchLab), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid");
  const { fetchLab, calls } = recordingFetch();
  await assert.rejects(armScenarioVariant("http://127.0.0.1:4100", "t", "auth-gate", { ...variant, arm: { operation: "../control/reset" } }, fetchLab), /single path segment/);
  assert.equal(calls.length, 0);
});
