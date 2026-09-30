import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { PERSON_CHECKS } from "../person-check.js";
import { everythingStoreScenario as scenario } from "../scenario.js";
import { robotCode, type StoreState } from "../state/index.js";

const context = { runToken: "everything-store-person-token", seed: 241 };
const apply = (state: StoreState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
const armed = () => apply(scenario.createState(scenario.seed), "set-mode", { mode: "robot-check" });

test("the Lab recognises the type-the-characters check and names the field and button a person uses", () => {
  const [check] = PERSON_CHECKS.checks;
  const page = scenario.render(armed(), context);
  assert.ok(page.includes(check!.shows));
  assert.deepEqual(check!.steps, [{ action: "type-answer", label: "Type characters" }, { action: "press", button: "Continue shopping" }]);
  assert.ok(page.includes(`>Type characters</label>`) && page.includes(`>Continue shopping</button>`), "the field's label and the button's name are the page's own");
  assert.ok(!JSON.stringify(check!.steps).includes("different image"), "a person never asks for another image");
});

test("the answer is what the image shows, read from the store's state, and it passes the check", () => {
  const state = armed();
  const answer = PERSON_CHECKS.answer!(state);
  assert.equal(answer, robotCode(state.challengeSeed, 0));
  const passed = apply(state, "solve-robot-check", { answer });
  assert.equal(passed.guard.robot.solved, true);
  assert.ok(!scenario.render(passed, context).includes(PERSON_CHECKS.checks[0]!.shows), "the store is itself again");
});

test("a check the automation already guessed at, or asked a new image of, is one the person declines", () => {
  const state = armed();
  assert.equal(PERSON_CHECKS.tampered!(state), null);
  assert.match(PERSON_CHECKS.tampered!(apply(state, "solve-robot-check", { answer: "WRONG1" })) ?? "", /1 wrong answer/u);
  assert.match(PERSON_CHECKS.tampered!(apply(state, "new-robot-image")) ?? "", /different image/u);
  assert.throws(() => PERSON_CHECKS.answer!({ guard: {} }), /holds no robot check/u);
});

test("the robot-check row requires the hand-off, and the person completes it so the row is judged as the workflow is", () => {
  assert.deepEqual(PERSON_CHECKS.handOffs.map(({ workflowId, variantId, person, required }) => `${workflowId}/${variantId}:${person}:${required}`), ["first-page-earbuds/robot-check:completes:true"]);
  const expected = resolveScenarioWorkflow(scenario.manifest, { workflowId: "first-page-earbuds", variantId: "robot-check" }).expected;
  assert.equal(expected.failure, undefined);
  assert.equal(expected.extracted?.[0]?.count, 16, "the table the person's pass lets the run read");
});
