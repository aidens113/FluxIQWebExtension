import assert from "node:assert/strict";
import test from "node:test";
import { scenarioLabOriginProof, type HealthFetch } from "../frame-origin-proof.js";

const primary = "http://127.0.0.1:4100";
const health = { status: "ready", seed: 101, scenarios: ["basic-form", "iframe-checkout"] };

function fakeFetch(answers: Record<string, { ok: boolean; body?: unknown } | "throw">): HealthFetch & { urls: string[]; authorizations: string[] } {
  const urls: string[] = [];
  const authorizations: string[] = [];
  const fetchHealth = (async (url: string, init: { headers: Record<string, string> }) => {
    urls.push(url);
    authorizations.push(init.headers.authorization ?? "");
    const answer = answers[new URL(url).origin];
    if (!answer || answer === "throw") throw new Error("connection refused");
    return { ok: answer.ok, json: async () => answer.body };
  }) as unknown as HealthFetch & { urls: string[]; authorizations: string[] };
  fetchHealth.urls = urls;
  fetchHealth.authorizations = authorizations;
  return fetchHealth;
}

test("proves a loopback origin whose authenticated health matches the primary Lab server's", async () => {
  const fetchHealth = fakeFetch({ [primary]: { ok: true, body: health }, "http://127.0.0.1:53111": { ok: true, body: health } });
  const prove = scenarioLabOriginProof(primary, "run-token-0123456789", fetchHealth);
  assert.equal(await prove("http://127.0.0.1:53111"), true);
  assert.deepEqual(fetchHealth.urls, [`${primary}/__control/health`, "http://127.0.0.1:53111/__control/health"]);
  assert.deepEqual(fetchHealth.authorizations, ["Bearer run-token-0123456789", "Bearer run-token-0123456789"]);
});

test("rejects a different answer, a refusal, an unreachable port, and anything not plain-HTTP loopback", async () => {
  const fetchHealth = fakeFetch({
    [primary]: { ok: true, body: health },
    "http://127.0.0.1:53112": { ok: true, body: { ...health, seed: 7 } },
    "http://127.0.0.1:53113": { ok: false },
    "http://127.0.0.1:53114": "throw",
  });
  const prove = scenarioLabOriginProof(primary, "t", fetchHealth);
  for (const origin of ["http://127.0.0.1:53112", "http://127.0.0.1:53113", "http://127.0.0.1:53114"]) assert.equal(await prove(origin), false, origin);
  const before = fetchHealth.urls.length;
  for (const origin of ["http://example.test:53111", "https://127.0.0.1:53111", primary, "not a url"]) assert.equal(await prove(origin), false, origin);
  assert.equal(fetchHealth.urls.length, before);
});

test("a primary server that did not answer is asked again for the next candidate", async () => {
  const answers: Record<string, { ok: boolean; body?: unknown } | "throw"> = { [primary]: "throw", "http://localhost:53111": { ok: true, body: health } };
  const prove = scenarioLabOriginProof(primary, "t", fakeFetch(answers));
  assert.equal(await prove("http://localhost:53111"), false);
  answers[primary] = { ok: true, body: health };
  assert.equal(await prove("http://localhost:53111"), true);
});
