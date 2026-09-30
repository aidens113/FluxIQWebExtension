// `pnpm ui:e2e`'s arguments and journey selection, without starting anything:
// the provider-free lane is the default, the provider lane never runs unless
// named, a named journey outside the lane stays selected, prerequisites come
// along, and anything unrecognized is refused with a closed code.

import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { parseUiE2eArguments, selectUiE2eJourneys } from "../journey-selection.js";

function reasonOf(run: () => unknown): unknown {
  try { run(); } catch (error) { return error instanceof RunnerFailure ? error.details?.reasonCode : "not-a-runner-failure"; }
  return "no-error";
}

function selectedIds(args: Parameters<typeof selectUiE2eJourneys>[0]): string[] {
  return selectUiE2eJourneys(args).journeys.filter(journey => journey.selected).map(journey => journey.definition.id);
}

test("no arguments select the provider-free lane", () => {
  assert.deepEqual(parseUiE2eArguments([]), { lane: "provider-free", laneExplicit: false, journeys: [] });
  assert.deepEqual(selectedIds({ lane: "provider-free", journeys: [] }), ["F1", "F2", "F3", "F4"]);
});

test("--lane accepts its three values, spaced or with =, once", () => {
  assert.equal(parseUiE2eArguments(["--lane", "provider"]).lane, "provider");
  assert.equal(parseUiE2eArguments(["--lane=all"]).lane, "all");
  assert.equal(parseUiE2eArguments(["--lane", "all"]).laneExplicit, true);
  assert.equal(reasonOf(() => parseUiE2eArguments(["--lane", "live"])), "ui_e2e.usage.lane_unknown");
  assert.equal(reasonOf(() => parseUiE2eArguments(["--lane"])), "ui_e2e.usage.lane_unknown");
  assert.equal(reasonOf(() => parseUiE2eArguments(["--lane", "all", "--lane", "provider"])), "ui_e2e.usage.lane_repeated");
});

test("--journey takes several ids, repeated or comma-separated, case-insensitively, without duplicates", () => {
  assert.deepEqual(parseUiE2eArguments(["--journey", "F2", "f3", "--journey=F2,F4"]).journeys, ["F2", "F3", "F4"]);
  assert.equal(reasonOf(() => parseUiE2eArguments(["--journey"])), "ui_e2e.usage.journey_missing");
  assert.equal(reasonOf(() => parseUiE2eArguments(["--journey", "F9"])), "ui_e2e.usage.journey_unknown");
  assert.equal(reasonOf(() => parseUiE2eArguments(["--headed"])), "ui_e2e.usage.argument_unknown");
});

test("the provider lane selects only provider journeys, and all selects both", () => {
  assert.deepEqual(selectedIds({ lane: "provider", journeys: [] }), ["P1", "P2", "P3", "P4", "P5", "P6"]);
  assert.equal(selectedIds({ lane: "all", journeys: [] }).length, 10);
});

test("a named journey brings its prerequisites, and a provider journey named outside its lane stays selected with its lane unselected", () => {
  assert.deepEqual(selectedIds({ lane: "provider-free", journeys: ["F4"] }), ["F2", "F3", "F4"]);
  const p6 = selectUiE2eJourneys({ lane: "provider-free", journeys: ["P6"] }).journeys.find(journey => journey.definition.id === "P6")!;
  assert.deepEqual({ selected: p6.selected, laneSelected: p6.laneSelected }, { selected: true, laneSelected: false });
});
