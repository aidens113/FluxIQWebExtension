import assert from "node:assert/strict";
import test from "node:test";
import { flowLaneExclusion, pagedExtractExclusion, scenarioStepOperations } from "../dist/index.js";
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
  // W05's shape. A recorded extract is one read node, so reaching further pages
  // adds no `web.dom.click` an expectation could be pinned to.
  const paginatedStep = step("extract", { target: "product", pagination: { next: "next", maxPages: 3 } });
  const paginated = recordableActionTypes([paginatedStep]);
  assert.deepEqual([...paginated].sort(), EXTRACT_ACTIONS);
  assert.ok(!paginated.has("web.dom.click"), "a paginated extract must not yield a click");
  assert.deepEqual([...recordableActionTypes([step("extract")])].sort(), EXTRACT_ACTIONS);
});

// Read-list S6: the read reads one page, and a Flow pages with read + Next page
// + repeat, which no recording can produce yet. A paged step is excluded, never
// recorded as a one-page read.
test("a script with a paged extract step has no Flow lane, and the reason names the step and the one-page read", () => {
  for (const pagination of [{ next: "next", maxPages: 3 }, { mode: "numbered", pages: "li > button", maxPages: 5 }, { mode: "loadMore", control: "more", maxPages: 4 }, { mode: "scroll", maxScrolls: 20 }]) {
    const reason = flowLaneExclusion([step("navigate", { path: "/" }), step("extract", { id: "extract-all-pages", target: "product", pagination }), step("checkpoint")]);
    assert.equal(typeof reason, "string", JSON.stringify(pagination));
    assert.match(reason, /^the Flow lane builds its Flow from the workflow's own recording, and its extract step extract-all-pages pages through its list, and FluxIQ's read reads one page/u);
    assert.match(reason, /a Next page step and a repeat, which no recording can produce yet/u);
  }
  // An unpaged extract keeps the Flow lane.
  assert.equal(flowLaneExclusion([step("extract", { id: "a", target: "row" }), step("checkpoint")]), undefined);
});

test("the paged-step exclusion is undefined for a script with no paged extract and names every paged step", () => {
  assert.equal(pagedExtractExclusion([step("click"), step("extract", { target: "row" })]), undefined);
  assert.equal(pagedExtractExclusion([]), undefined);
  // `pagination` on a non-extract step is not a paged read.
  assert.equal(pagedExtractExclusion([step("click", { pagination: { next: "n", maxPages: 2 } })]), undefined);
  const both = pagedExtractExclusion([step("extract", { id: "first", pagination: { next: "n", maxPages: 2 } }), step("extract", { id: "second", pagination: { mode: "scroll", maxScrolls: 3 } })]);
  assert.match(both ?? "", /^extract steps first, second page through its list/u);
});

test("an empty script is a playback goal, which the check does not judge", () => {
  assert.equal(flowLaneExclusion([]), undefined);
});
