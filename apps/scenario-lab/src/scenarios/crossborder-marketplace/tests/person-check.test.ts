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
  const [check] = PERSON_CHECKS.checks;
  assert.equal(PERSON_CHECKS.checks.length, 1);
  const { body, state } = thirdLoad();
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

test("the spain-hubs rows expect a hand-off but do not require one", () => {
  assert.deepEqual(PERSON_CHECKS.handOffs.map(({ workflowId, variantId, person, required }) => `${workflowId}/${variantId ?? "-"}:${person}:${required}`), ["spain-hubs/-:completes:false", "spain-hubs/list-layout:completes:false"]);
  assert.equal(PERSON_CHECKS.answer, undefined, "nothing on this check is read and typed");
});
