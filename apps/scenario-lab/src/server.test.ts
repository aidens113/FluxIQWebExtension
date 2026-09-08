import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { startScenarioLab, type RunningScenarioLab } from "./server.js";

const TOKEN = "fixture-run-token-1234";

async function withLab(run: (lab: RunningScenarioLab) => Promise<void>, seed = 12): Promise<void> {
  const lab = await startScenarioLab({ runToken: TOKEN, seed });
  try { await run(lab); } finally { await lab.close(); }
}

function authorized(init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, authorization: `Bearer ${TOKEN}` } };
}

test("health and control endpoints require the run token", async () => withLab(async lab => {
  assert.equal((await fetch(`${lab.origin}/__control/health`)).status, 401);
  const response = await fetch(`${lab.origin}/__control/health`, authorized());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ready", seed: 12, scenarios: [
    "basic-form", "dynamic-list", "navigation", "long-document", "iframe-checkout",
    "ambiguous-targets", "delayed-ui", "failure-surfaces", "reconnect", "sensitive-input",
    "llm-target-drift", "instruction-only-form",
  ] });
  const seeded = await fetch(`${lab.origin}/__control/seed`, authorized({
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seed: 88 }),
  }));
  assert.deepEqual(await seeded.json(), { status: "seeded", seed: 88 });
  const state = await jsonObject(await fetch(`${lab.origin}/__control/final-state?scenario=dynamic-list`, authorized())) as { state: { items: Array<{ label: string }> } };
  assert.equal(state.state.items[0]?.label, "Seed 88 item 1");
}));

test("basic form is directly usable and publishes final state", async () => withLab(async lab => {
  const page = await fetch(`${lab.origin}/scenarios/basic-form/`);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /data-testid="basic-form"/);
  assert.match(page.headers.get("content-security-policy") ?? "", /connect-src 'self'/);

  const submit = await fetch(`${lab.origin}/api/basic-form/submit`, authorized({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ada", plan: "team", notes: "deterministic" }),
  }));
  assert.equal(submit.status, 200);
  const final = await fetch(`${lab.origin}/__control/final-state?scenario=basic-form`, authorized());
  assert.deepEqual((await jsonObject(final)).state, {
    submitted: true,
    submissionCount: 1,
    values: { name: "Ada", plan: "team", notes: "deterministic" },
  });
}));

test("dynamic list identity, mutation, and reset are deterministic", async () => withLab(async lab => {
  const initialResponse = await fetch(`${lab.origin}/__control/final-state?scenario=dynamic-list`, authorized());
  const initial = await jsonObject(initialResponse) as { state: { items: Array<{ id: string; label: string }> } };
  assert.equal(initial.state.items[0]?.id, "item-1012");

  await fetch(`${lab.origin}/api/dynamic-list/add`, authorized({
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "Fourth" }),
  }));
  await fetch(`${lab.origin}/api/dynamic-list/reverse`, authorized({ method: "POST" }));
  const changed = await jsonObject(await fetch(`${lab.origin}/__control/final-state?scenario=dynamic-list`, authorized())) as typeof initial;
  assert.equal(changed.state.items[0]?.label, "Fourth");

  await fetch(`${lab.origin}/__control/reset`, authorized({ method: "POST" }));
  const reset = await jsonObject(await fetch(`${lab.origin}/__control/final-state?scenario=dynamic-list`, authorized()));
  assert.deepEqual(reset, initial);
}));

test("target drift control oracle is exact across missing, renamed, restore, and global reset", async () => withLab(async lab => {
  const read = async () => (await jsonObject(await fetch(`${lab.origin}/__control/final-state?scenario=llm-target-drift`, authorized()))).state;
  assert.deepEqual(await read(), {
    seedMarker: "target-drift-seed-12", mode: "baseline", activationCount: 0, transitionCount: 0, lastOperation: "seeded",
    oracle: { recordedTargetTestId: "diagnosis-target", renderedTargetTestId: "diagnosis-target", targetPresent: true, expectedResult: "Ready" },
  });
  const missingResponse = await fetch(`${lab.origin}/api/llm-target-drift/set-mode`, authorized({
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "missing" }),
  }));
  assert.equal(missingResponse.status, 200);
  const missing = await read() as { activationCount: number; oracle: { targetPresent: boolean; expectedResult: string } };
  assert.deepEqual(missing, {
    seedMarker: "target-drift-seed-12", mode: "missing", activationCount: 0, transitionCount: 1, lastOperation: "missing",
    oracle: { recordedTargetTestId: "diagnosis-target", renderedTargetTestId: null, targetPresent: false, expectedResult: "Target missing: deterministic failure armed" },
  });
  await fetch(`${lab.origin}/api/llm-target-drift/activate`, authorized({ method: "POST" }));
  await fetch(`${lab.origin}/api/llm-target-drift/activate`, authorized({ method: "POST" }));
  assert.deepEqual(await read(), missing);
  await fetch(`${lab.origin}/api/llm-target-drift/set-mode`, authorized({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "renamed" }) }));
  assert.match(JSON.stringify(await read()), /"renderedTargetTestId":"diagnosis-target-v2"/);
  await fetch(`${lab.origin}/api/llm-target-drift/restore`, authorized({ method: "POST" }));
  assert.match(JSON.stringify(await read()), /"mode":"baseline"/);
  await fetch(`${lab.origin}/__control/reset`, authorized({ method: "POST" }));
  assert.match(JSON.stringify(await read()), /"transitionCount":0/);
}));
test("navigation exposes full, history, reload, and redirect fixtures", async () => withLab(async lab => {
  for (const path of ["start", "second", "history", "redirected"]) {
    const response = await fetch(`${lab.origin}/scenarios/navigation/${path}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), new RegExp(`Navigation: ${path}`));
  }
  const redirect = await fetch(`${lab.origin}/scenarios/navigation/redirect`, { redirect: "manual" });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), "/scenarios/navigation/redirected");
  await fetch(`${lab.origin}/api/navigation/visit`, authorized({
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: "second" }),
  }));
  const state = await jsonObject(await fetch(`${lab.origin}/__control/final-state?scenario=navigation`, authorized())) as { state: { visits: string[] } };
  assert.deepEqual(state.state.visits, ["second"]);
}));

test("all twelve scenario pages are directly renderable", async () => withLab(async lab => {
  const ids = ["basic-form", "dynamic-list", "navigation", "long-document", "iframe-checkout", "ambiguous-targets", "delayed-ui", "failure-surfaces", "reconnect", "sensitive-input", "llm-target-drift", "instruction-only-form"];
  for (const id of ids) {
    const suffix = id === "navigation" ? "start" : "";
    const response = await fetch(`${lab.origin}/scenarios/${id}/${suffix}`);
    assert.equal(response.status, 200, id);
    assert.match(response.headers.get("content-security-policy") ?? "", /connect-src 'self'/, id);
    assert.match(await response.text(), /<h1|<header/, id);
  }
}));

test("new scenario states mutate and reset deterministically", async () => withLab(async lab => {
  const mutations = [
    ["long-document", "reach", {}], ["iframe-checkout", "same", {}],
    ["ambiguous-targets", "choose", { id: "primary" }], ["delayed-ui", "reveal", {}],
    ["failure-surfaces", "attempt", { kind: "detached" }], ["reconnect", "disconnect", {}],
    ["sensitive-input", "submit", { synthetic: true, password: "SYNTHETIC_PASSWORD_DO_NOT_USE" }],
    ["llm-target-drift", "set-mode", { mode: "missing" }],
  ] as const;
  const before = await jsonObject(await fetch(`${lab.origin}/__control/final-state`, authorized()));
  for (const [id, operation, payload] of mutations) {
    const response = await fetch(`${lab.origin}/api/${id}/${operation}`, authorized({
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    }));
    assert.equal(response.status, 200, id);
  }
  const sensitive = await jsonObject(await fetch(`${lab.origin}/__control/final-state?scenario=sensitive-input`, authorized()));
  assert.equal(JSON.stringify(sensitive).includes("SYNTHETIC_PASSWORD_DO_NOT_USE"), false);
  assert.match(JSON.stringify(sensitive), /"passwordStored":false/);
  await fetch(`${lab.origin}/__control/reset`, authorized({ method: "POST" }));
  const after = await jsonObject(await fetch(`${lab.origin}/__control/final-state`, authorized()));
  assert.deepEqual(after, before);
}));

test("iframe fixture exposes same-origin and distinct loopback-origin frames", async () => withLab(async lab => {
  const main = await (await fetch(`${lab.origin}/scenarios/iframe-checkout/`)).text();
  const mainResponse = await fetch(`${lab.origin}/scenarios/iframe-checkout/`);
  assert.match(mainResponse.headers.get("content-security-policy") ?? "", /frame-src 'self' http:\/\/127\.0\.0\.1:\*/);
  assert.match(main, /src="\/scenarios\/iframe-checkout\/same-frame"/);
  assert.match(main, new RegExp(`src="${lab.frameOrigin}/scenarios/iframe-checkout/cross-frame"`));
  const cross = await fetch(`${lab.frameOrigin}/scenarios/iframe-checkout/cross-frame`);
  assert.equal(cross.status, 200);
  assert.equal(cross.headers.get("cross-origin-resource-policy"), "same-site");
  assert.match(cross.headers.get("content-security-policy") ?? "", /frame-ancestors http:\/\/127\.0\.0\.1:\*/);
  assert.match(await cross.text(), /Cross-origin frame/);
}));

test("a foreign Host header is rejected", async () => withLab(async lab => {
  assert.equal(await requestStatus(lab.origin, "example.com"), 421);
}));

test("parallel labs do not share state", async () => {
  const first = await startScenarioLab({ runToken: TOKEN, seed: 4 });
  const second = await startScenarioLab({ runToken: "fixture-run-token-5678", seed: 4 });
  try {
    await fetch(`${first.origin}/api/dynamic-list/add`, authorized({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "Only first" }) }));
    const secondState = await jsonObject(await fetch(`${second.origin}/__control/final-state?scenario=dynamic-list`, { headers: { authorization: "Bearer fixture-run-token-5678" } })) as { state: { items: unknown[] } };
    assert.equal(secondState.state.items.length, 3);
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});

async function jsonObject(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

function requestStatus(origin: string, hostHeader: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const outgoing = request(origin, { headers: { host: hostHeader } }, response => {
      response.resume();
      response.once("end", () => resolve(response.statusCode));
    });
    outgoing.once("error", reject);
    outgoing.end();
  });
}
