import assert from "node:assert/strict";
import test from "node:test";
import { bigboxRetailScenario } from "../index.js";
import { PERSON_CHECKS } from "../person-check.js";
import { createBigboxState, mutateBigboxState, ROBOT_CHECK_HOLD_MS } from "../state/index.js";

const context = { runToken: "bigbox-person-token", seed: 239, alternateOrigin: "http://127.0.0.1:9" };

test("the Lab recognises Robot or human? and holds the button longer than the check asks", () => {
  const [check] = PERSON_CHECKS.checks;
  let state = createBigboxState();
  let body = "";
  for (let load = 0; load < 3; load += 1) {
    const served = bigboxRetailScenario.route!(state, { subpath: "search", query: new URLSearchParams("q=paper+towels"), method: "GET" }, context);
    body = served?.body ?? "";
    if (served?.mutation) state = mutateBigboxState(state, served.mutation.operation, served.mutation.payload) ?? state;
  }
  assert.ok(body.includes(check!.shows), "the third results load is the check");
  assert.ok(body.includes("Press &amp; Hold"), "and its button reads Press & Hold once the markup is parsed");
  assert.deepEqual(check!.steps.map((step) => step.action), ["press-and-hold"]);
  const [hold] = check!.steps;
  assert.ok(hold?.action === "press-and-hold" && hold.text === "Press & Hold" && hold.holdMs > ROBOT_CHECK_HOLD_MS);
});

test("no bigbox row declares a hand-off: the check passes itself for an automation that waits", () => {
  assert.deepEqual(PERSON_CHECKS.handOffs, []);
});
