import assert from "node:assert/strict";
import test from "node:test";
import { flowLaneExclusion, scenarioStepOperations } from "../dist/index.js";

const step = (operation, extra = {}) => ({ id: `step-${operation}`, operation, ...extra });
/** The operations whose recording holds no action: the runner's own waits and checks. Every other contract operation acts. */
const NON_ACTING = ["waitForState", "checkpoint", "waitForDownload", "extract"];

test("a script whose steps only read or wait on the page has no Flow lane, and the reason names its operations", () => {
  // W04's shape: an extract with no pagination, then a checkpoint.
  const reason = flowLaneExclusion([step("extract", { target: "product", fields: { name: ".name" } }), step("checkpoint")]);
  assert.equal(typeof reason, "string");
  assert.match(reason, /no step of the workflow's recordingScript records an action \(operations: extract, checkpoint\), so no recording of it can yield a Flow$/u);
  // W08's shape: one extract with no pagination.
  assert.match(flowLaneExclusion([step("extract", { target: "row" })]) ?? "", /\(operations: extract\)/u);
  for (const operation of NON_ACTING) assert.equal(typeof flowLaneExclusion([step(operation), step(operation === "checkpoint" ? "waitForState" : "checkpoint")]), "string", operation);
});

test("a script with any step that records an action keeps its Flow lane, whichever contract operation it is", () => {
  const acting = scenarioStepOperations.filter((operation) => !NON_ACTING.includes(operation));
  // A new contract operation fails here until it is placed on one side.
  assert.deepEqual(acting, ["click", "type", "select", "scroll", "navigate", "press", "check", "upload", "switchTab", "closeTab"]);
  for (const operation of acting) assert.equal(flowLaneExclusion([step("extract"), step(operation), step("checkpoint")]), undefined, operation);
  // W05's shape: a paginated extract clicks next, and the extension records those clicks.
  assert.equal(flowLaneExclusion([step("extract", { target: "product", pagination: { next: "next", maxPages: 3 } })]), undefined);
});

test("an empty script is a playback goal, which the check does not judge", () => {
  assert.equal(flowLaneExclusion([]), undefined);
});
