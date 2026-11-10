import assert from "node:assert/strict";
import test from "node:test";
import { MARKET_SEED } from "../manifest/index.js";
import { PERSON_CHECKS } from "../person-check.js";
import { crossborderMarketplaceScenario as scenario } from "../scenario.js";
import type { MarketState } from "../state/index.js";

const context = { runToken: "crossborder-person-token", seed: MARKET_SEED };
const apply = (state: MarketState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);

/** The body served for the third results load, which the traffic screen replaces, and the state it leaves. */
function thirdLoad(): { body: string; state: MarketState } {
  let state = scenario.createState(MARKET_SEED);
  let body = "";
  for (const page of ["", "&page=2", "&page=3"]) {
    const served = scenario.route!(state, { subpath: "search", query: new URLSearchParams(`q=usb+c+hub${page}`), method: "GET" }, context);
    assert.ok(served);
    body = served.body ?? "";
    state = served.mutation ? apply(state, served.mutation.operation, served.mutation.payload) : state;
  }
  return { body, state };
}

test("the Lab recognises the traffic screen by what it shows, and presses the box a person presses", () => {
  assert.deepEqual(PERSON_CHECKS.checks.map(({ id }) => id), ["traffic-screen", "timed-check"]);
  const check = PERSON_CHECKS.checks.find(({ id }) => id === "traffic-screen");
  const { body, state } = thirdLoad();
  const timed = PERSON_CHECKS.checks.find(({ id }) => id === "timed-check")!;
  assert.ok(!body.includes(timed.shows), "the traffic screen is never taken for the timed check, whichever the Lab looks for first");
  assert.ok(body.includes(check!.shows), "the screen shows the text the Lab looks for");
  assert.deepEqual(check!.steps, [{ action: "click", text: "I'm not a robot" }]);
  assert.ok(body.includes("I'm not a robot"));
  assert.equal(state.search.challenged, true);
  // What pressing the box does on the page: the check passes, and the next load is the results.
  const passed = apply(state, "verify-human");
  const reloaded = scenario.route!(passed, { subpath: "search", query: new URLSearchParams("q=usb+c+hub&page=3"), method: "GET" }, context);
  assert.ok(!(reloaded?.body ?? "").includes(check!.shows), "once pressed, the reload is no longer the screen");
  assert.ok(check!.clearsWithinMs >= 2_300, "the wait covers the page's own two-second check and its reload");
});

test("the spain-hubs and free-hubs-under-ten rows expect a hand-off but do not require one; the timed check, which every path meets, is required", () => {
  assert.deepEqual(PERSON_CHECKS.handOffs.map(({ workflowId, variantId, person, required }) => `${workflowId}/${variantId ?? "-"}:${person}:${required}`), ["spain-hubs/-:completes:false", "spain-hubs/list-layout:completes:false", "free-hubs-under-ten/-:completes:false", "free-hubs-under-ten/timed-check:completes:true"]);
  assert.equal(PERSON_CHECKS.answer, undefined, "nothing on this check is read and typed");
});
