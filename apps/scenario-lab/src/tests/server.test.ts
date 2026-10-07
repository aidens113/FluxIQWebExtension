import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import test from "node:test";
import { startScenarioLab, type RunningScenarioLab } from "../server.js";
import { getScenario } from "../registry.js";
import { isDeepStrictEqual } from "node:util";
import { scenarioIds } from "../types.js";

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
  const health = await response.json() as Record<string, unknown>;
  assert.deepEqual({ status: health.status, seed: health.seed, scenarios: health.scenarios }, { status: "ready", seed: 12, scenarios: [...scenarioIds] });
  assert.equal(typeof health.provenance, "object");
  const seeded = await fetch(`${lab.origin}/__control/seed`, authorized({
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seed: 88 }),
  }));
  const packet = await seeded.json() as Record<string, unknown>;
  assert.deepEqual({ status: packet.status, seed: packet.seed }, { status: "seeded", seed: 88 });
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
  assert.deepEqual(reset.state, initial.state);
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

test("every scenario page is directly renderable", async () => withLab(async lab => {
  for (const id of scenarioIds) {
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
  const data = (packet: Record<string, unknown>) => ({ seed: packet.seed, scenarios: (packet.scenarios as Array<Record<string, unknown>>).map(item => ({ scenarioId: item.scenarioId, seed: item.seed, state: item.state, variant: item.variant })) });
  assert.equal(isDeepStrictEqual(data(after), data(before)), true);
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

test("actual HTTP failed reset/reseed leaves previous owner packets unchanged", async () => withLab(async lab => {
  const read = async () => (await fetch(`${lab.origin}/__control/final-state`, authorized())).json();
  const before = await read(), scenario = getScenario("dynamic-list")!, original = scenario.createState;
  try {
    scenario.createState = () => { throw new Error("isolated initializer failure"); };
    for (const route of ["reset", "seed"]) {
      const response = await fetch(`${lab.origin}/__control/${route}`, authorized({ method: "POST", ...(route === "seed" ? { body: JSON.stringify({ seed: 88 }) } : {}) }));
      assert.equal(response.status, 500); assert.equal(isDeepStrictEqual(await read(), before), true);
    }
  } finally { scenario.createState = original; }
}));
test("actual authenticated owner reset/seed/arm and no-op sequences are truthful", async () => withLab(async lab => {
  const health = async () => (await fetch(`${lab.origin}/__control/health`, authorized())).json() as Promise<{ seed: number; provenance: { ownerEpoch: string; resetGeneration: number; mutationSequence: number } }>;
  const first = await health();
  for (const [path, init, status] of [
    ["reset", { method: "POST" }, 401], ["reset", { method: "POST", headers: { authorization: "Bearer wrong" } }, 401],
    ["reset", authorized({ method: "GET" }), 405], ["reset", authorized({ method: "POST", body: JSON.stringify({ ownerEpoch: "forged" }) }), 400],
    ["seed", authorized({ method: "POST", body: JSON.stringify({ seed: 5, extra: true }) }), 400],
    ["seed", authorized({ method: "POST", body: JSON.stringify({ seed: Number.MAX_SAFE_INTEGER + 1 }) }), 400],
    ["arm", authorized({ method: "POST", body: JSON.stringify({ scenarioId: "social-scheduler", variantId: "missing" }) }), 404],
    ["reset", authorized({ method: "POST", body: "{" }), 400], ["reset", authorized({ method: "POST", body: "x".repeat(16385) }), 400],
  ] as Array<[string, RequestInit, number]>) {
    assert.equal((await fetch(`${lab.origin}/__control/${path}`, init)).status, status);
    assert.deepEqual(await health(), first);
  }
  const arm = () => fetch(`${lab.origin}/__control/arm`, authorized({ method: "POST", body: JSON.stringify({ scenarioId: "social-scheduler", variantId: "restyled" }) }));
  assert.equal((await arm()).status, 200); assert.equal((await health()).provenance.mutationSequence, 1);
  assert.equal((await arm()).status, 409); assert.equal((await health()).provenance.mutationSequence, 1);
  const noop = await fetch(`${lab.origin}/api/social-scheduler/unknown`, authorized({ method: "POST" }));
  assert.deepEqual((await noop.json() as { mutation: unknown }).mutation, { status: "no_change" });
  const reset = await fetch(`${lab.origin}/__control/reset`, authorized({ method: "POST" }));
  assert.equal(reset.status, 200); const second = await health();
  assert.equal(second.provenance.ownerEpoch, first.provenance.ownerEpoch); assert.equal(second.provenance.resetGeneration, 2); assert.equal(second.provenance.mutationSequence, 2);
  const seeded = await fetch(`${lab.origin}/__control/seed`, authorized({ method: "POST", body: JSON.stringify({ seed: 88 }) }));
  assert.equal(seeded.status, 200); assert.equal((await health()).seed, 88);
  assert.equal((await health()).provenance.resetGeneration, 3);
}));
test("actual route HEAD does not mutate while GET sequences real state", async () => withLab(async lab => {
  const read = async () => (await fetch(`${lab.origin}/__control/health`, authorized())).json() as Promise<{ provenance: { mutationSequence: number } }>;
  const before = await read();
  await fetch(`${lab.origin}/scenarios/file-transfer/report.csv`, { method: "HEAD" });
  assert.equal((await read()).provenance.mutationSequence, before.provenance.mutationSequence);
  await fetch(`${lab.origin}/scenarios/file-transfer/report.csv`);
  assert.equal((await read()).provenance.mutationSequence, before.provenance.mutationSequence + 1);
}));

test("fresh actual fixture child processes never reuse the prior owner epoch", async () => {
  const run = () => new Promise<{ epoch: string; generation: number }>((resolve, reject) => {
    const script = `const {startScenarioLab}=await import(${JSON.stringify(new URL("../server.js", import.meta.url).href)}); const token='isolated-child-token-1234'; const lab=await startScenarioLab({runToken:token,seed:7}); try { const data=await (await fetch(lab.origin+'/__control/health',{headers:{authorization:'Bearer '+token}})).json(); console.log(JSON.stringify({epoch:data.provenance.ownerEpoch,generation:data.provenance.resetGeneration})); } finally {await lab.close();}`;
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], { windowsHide: true, env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP } });
    let output = "", bytes = 0;
    const timeout = setTimeout(() => { child.kill(); reject(new Error("fixture child bounded timeout")); }, 10000);
    child.stdout.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 4096) { child.kill(); reject(new Error("fixture child output limit")); } else output += chunk.toString(); });
    child.stderr.on("data", () => { /* private child diagnostics deliberately withheld */ });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("close", code => { clearTimeout(timeout); if (code !== 0) reject(new Error("fixture child failed")); else try { resolve(JSON.parse(output) as { epoch: string; generation: number }); } catch { reject(new Error("fixture child packet invalid")); } });
  });
  const first = await run(), restarted = await run();
  assert.equal(first.generation, 1); assert.equal(restarted.generation, 1); assert.notEqual(first.epoch, restarted.epoch);
});
