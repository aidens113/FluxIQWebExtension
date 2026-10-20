import assert from "node:assert/strict";
import test from "node:test";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { feedItem } from "../feed-content.js";
import { infiniteFeedScenario as scenario, type InfiniteFeedState } from "../scenario.js";

/**
 * The feed's server side over HTTP, as its client script drives it: the start
 * document posts `open`, each scroll-triggered load GETs the next page, and the
 * Testing Lab arms `end-early` through the mutation endpoint. These replace the
 * server-side halves of the retired browser spec; the scroll, sentinel and
 * busy-indicator behaviour is fixture-only and barred from browsers.
 */

const START = "/scenarios/infinite-feed/";
const SEED = scenario.manifest.seed;

async function withLab(run: (io: ReturnType<typeof client>) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: "infinite-feed-lab-server-token", seed: SEED });
  try { await run(client(lab)); } finally { await lab.close(); }
}

function client(lab: RunningScenarioLab) {
  const authorization = `Bearer ${lab.runToken}`;
  return {
    page: async (number: number, method = "GET") => {
      const response = await fetch(`${lab.origin}${START}page/${number}`, { method });
      return { status: response.status, body: await response.text() };
    },
    post: async (operation: string, payload: unknown = {}) => {
      const response = await fetch(`${lab.origin}/api/infinite-feed/${operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      assert.equal(response.status, 200, operation);
      await response.text();
    },
    state: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=infinite-feed`, { headers: { authorization } });
      return (await response.json() as { state: InfiniteFeedState }).state;
    },
  };
}

test("over HTTP, an opened feed loads pages strictly in order, refuses a skip, and HEAD loads nothing", async () => withLab(async (io) => {
  await io.post("open");
  assert.deepEqual(await io.state(), { mode: "baseline", feedLength: 60, loadedCount: 10, ended: false, sessions: 1, lastOperation: "opened" });

  assert.equal((await io.page(3)).status, 409, "a page out of order is refused");
  assert.equal((await io.page(2, "HEAD")).status, 200);
  assert.equal((await io.state()).loadedCount, 10, "neither the refusal nor HEAD loads a page");

  for (const number of [2, 3, 4]) {
    const served = await io.page(number);
    assert.equal(served.status, 200, `page ${number}`);
    assert.ok(served.body.includes(`>${feedItem(SEED, number * 10).title}</h2>`), `page ${number} carries post ${number * 10}`);
  }
  assert.deepEqual(await io.state(), { mode: "baseline", feedLength: 60, loadedCount: 40, ended: false, sessions: 1, lastOperation: "page-loaded" });

  await io.post("open");
  assert.deepEqual(await io.state(), { mode: "baseline", feedLength: 60, loadedCount: 10, ended: false, sessions: 2, lastOperation: "opened" }, "reopening starts a fresh session at page one");
}));

test("over HTTP, the end-early arm shortens the feed to 25 posts and the third page is its last", async () => withLab(async (io) => {
  const variant = scenario.manifest.variants?.find(({ id }) => id === "end-early");
  assert.ok(variant);
  await io.post(variant.arm.operation, variant.arm.payload);
  assert.equal((await io.state()).feedLength, 25);
  await io.post("open");
  assert.equal((await io.page(2)).status, 200);
  const last = await io.page(3);
  assert.equal(last.status, 200);
  assert.match(last.body, /data-testid="feed-page-3" data-page="3" data-last-page="true"/);
  assert.equal(last.body.match(/data-testid="feed-item"/g)?.length, 5);
  assert.equal((await io.page(4)).status, 404, "nothing exists past the end");
  assert.deepEqual(await io.state(), { mode: "end-early", feedLength: 25, loadedCount: 25, ended: true, sessions: 1, lastOperation: "page-loaded" });
}));
