import assert from "node:assert/strict";
import test from "node:test";
import { flowLaneExclusion, scenarioStepOperations } from "../dist/index.js";
import { recordableActionTypes } from "../dist/recordable-actions.js";

const step = (operation, extra = {}) => ({ id: `step-${operation}`, operation, ...extra });
/** The operations whose recording holds no action: the runner's own waits and checks. Every other contract operation acts. */
const NON_ACTING = ["waitForState", "checkpoint", "waitForDownload"];
/** Both types an extract step can be recorded as: the list read, and the single-element read. */
const EXTRACT_ACTIONS = ["web.dom.extract", "web.dom.extract_list"];

test("a script whose steps only wait on or check the page has no Flow lane, and the reason names its operations", () => {
  const reason = flowLaneExclusion([step("waitForState"), step("checkpoint")]);
  assert.equal(typeof reason, "string");
  assert.match(reason, /no step of the workflow's recordingScript records an action \(operations: waitForState, checkpoint\), so no recording of it can yield a Flow$/u);
  assert.match(flowLaneExclusion([step("waitForDownload")]) ?? "", /\(operations: waitForDownload\)/u);
  for (const operation of NON_ACTING) assert.equal(typeof flowLaneExclusion([step(operation), step(operation === "checkpoint" ? "waitForState" : "checkpoint")]), "string", operation);
});

test("W04's and W08's shapes keep a Flow lane, because an extract is recorded as a data-extraction action", () => {
  // W04's shape: an extract with no pagination, then a checkpoint.
  assert.equal(flowLaneExclusion([step("extract", { target: "product", fields: { name: ".name" } }), step("checkpoint")]), undefined);
  // W08's shape: one extract with no pagination.
  assert.equal(flowLaneExclusion([step("extract", { target: "row" })]), undefined);
});

test("a script with any step that records an action keeps its Flow lane, whichever contract operation it is", () => {
  const acting = scenarioStepOperations.filter((operation) => !NON_ACTING.includes(operation));
  // A new contract operation fails here until it is placed on one side.
  assert.deepEqual(acting, ["click", "type", "select", "scroll", "navigate", "press", "check", "upload", "switchTab", "closeTab", "extract"]);
  for (const operation of acting) assert.equal(flowLaneExclusion([step(operation), step("checkpoint")]), undefined, operation);
});

test("a paginated extract yields the extraction actions, not the clicks it makes on next", () => {
  // W05's shape. Pagination belongs to the recorded extract node, so reaching further
  // pages adds no `web.dom.click` an expectation could be pinned to.
  const paginatedStep = step("extract", { target: "product", pagination: { next: "next", maxPages: 3 } });
  const paginated = recordableActionTypes([paginatedStep]);
  assert.deepEqual([...paginated].sort(), EXTRACT_ACTIONS);
  assert.ok(!paginated.has("web.dom.click"), "a paginated extract must not yield a click");
  // Paginated or not, the same two types: the one node carries the pagination.
  assert.deepEqual([...recordableActionTypes([step("extract")])].sort(), EXTRACT_ACTIONS);
  assert.equal(flowLaneExclusion([paginatedStep]), undefined);
});

test("an empty script is a playback goal, which the check does not judge", () => {
  assert.equal(flowLaneExclusion([]), undefined);
});
