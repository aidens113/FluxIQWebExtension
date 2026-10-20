import assert from "node:assert/strict";
import test from "node:test";
import { startScenarioLab, type RunningScenarioLab } from "../server.js";

const TOKEN = "fixture-request-count-token";

async function withLab(run: (lab: RunningScenarioLab) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: TOKEN, seed: 3 });
  try {
    await run(lab);
  } finally {
    await lab.close();
  }
}

function authorized(init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, authorization: `Bearer ${TOKEN}` } };
}

/** What the counter says about `path`, which may carry its own query. */
async function counted(lab: RunningScenarioLab, path: string): Promise<number> {
  const response = await fetch(`${lab.origin}/__control/requests?${new URLSearchParams({ path })}`, authorized());
  assert.equal(response.status, 200);
  const body = await response.json() as { path: string; count: number };
  assert.equal(body.path, path);
  return body.count;
}

const IMAGE = "/scenarios/everything-store/img/B0TWGOOSE9.svg";

test("the request counter needs the run token and a path", async () => withLab(async lab => {
  assert.equal((await fetch(`${lab.origin}/__control/requests?path=${encodeURIComponent(IMAGE)}`)).status, 401);
  assert.equal((await fetch(`${lab.origin}/__control/requests`, authorized())).status, 400);
  assert.equal((await fetch(`${lab.origin}/__control/requests?path=relative`, authorized())).status, 400);
  assert.equal((await fetch(`${lab.origin}/__control/requests?path=${encodeURIComponent(IMAGE)}`, authorized({ method: "POST" }))).status, 405);
}));

test("the request counter counts every request that reached a path, by its query when one is named", async () => withLab(async lab => {
  assert.equal(await counted(lab, IMAGE), 0);
  await fetch(`${lab.origin}${IMAGE}?v=first`);
  await fetch(`${lab.origin}${IMAGE}?v=first`);
  await fetch(`${lab.origin}${IMAGE}?v=second`, { method: "HEAD" });
  await fetch(`${lab.origin}${IMAGE}`);
  assert.equal(await counted(lab, IMAGE), 4, "a bare path counts every query");
  assert.equal(await counted(lab, `${IMAGE}?v=first`), 2);
  assert.equal(await counted(lab, `${IMAGE}?v=second`), 1);
  assert.equal(await counted(lab, `${IMAGE}?v=third`), 0);
  // A request the lab answers with nothing still reached it.
  await fetch(`${lab.origin}/scenarios/everything-store/missing?x=1`);
  assert.equal(await counted(lab, "/scenarios/everything-store/missing"), 1);
  // Requests to the scenario frame origin count too: it is the same lab.
  await fetch(`${lab.frameOrigin}${IMAGE}?v=first`);
  assert.equal(await counted(lab, `${IMAGE}?v=first`), 3);
}));

test("the request counter never counts control requests, and a reset starts it over", async () => withLab(async lab => {
  await counted(lab, IMAGE);
  await fetch(`${lab.origin}/__control/health`, authorized());
  assert.equal(await counted(lab, "/__control/health"), 0);
  assert.equal(await counted(lab, "/__control/requests"), 0);
  await fetch(`${lab.origin}${IMAGE}?v=kept`);
  assert.equal(await counted(lab, IMAGE), 1);
  assert.equal((await fetch(`${lab.origin}/__control/reset`, authorized({ method: "POST" }))).status, 200);
  assert.equal(await counted(lab, IMAGE), 0);
}));
