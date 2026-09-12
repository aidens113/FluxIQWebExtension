import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { navigationScenario as scenario, type NavigationState } from "../scenario.js";

const context = { runToken: "unit-test-run-token-0001", seed: 103 };

function armed(): NavigationState {
  return scenario.mutate(scenario.createState(103), "set-mode", { mode: "broken-link" });
}

test("the manifest is valid and resolves its primary workflow and broken-link variant", () => {
  const result = validateWebScenario(scenario.manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(scenario.manifest.variants?.map(({ id }) => id), ["broken-link"]);

  const primary = resolveScenarioWorkflow(scenario.manifest);
  assert.equal(primary.expected.failure, undefined);

  const broken = resolveScenarioWorkflow(scenario.manifest, { variantId: "broken-link" });
  assert.deepEqual(broken.variant?.arm, { operation: "set-mode", payload: { mode: "broken-link" } });
  assert.deepEqual(broken.expected.failure, { category: "navigation_unexpected", code: "web.navigation.unexpected" });
  // A variant never changes the recording: the run replays what was recorded.
  assert.deepEqual(broken.recordingScript, primary.recordingScript);
  assert.deepEqual(broken.expected.recordingEvents, primary.expected.recordingEvents);
});

test("state is deterministic from the seed and arming resets what the recording visited", () => {
  assert.deepEqual(scenario.createState(103), { visits: [], redirectCount: 0 }, "the unarmed oracle shape is unchanged by the variant");
  assert.deepEqual(scenario.createState(103), scenario.createState(7));
  const visited = scenario.mutate(scenario.createState(103), "visit", { page: "second" });
  assert.deepEqual(visited.visits, ["second"]);
  assert.deepEqual(scenario.mutate(visited, "set-mode", { mode: "broken-link" }), { visits: [], redirectCount: 0, mode: "broken-link" });
  for (const invalid of [{ mode: "sideways" }, {}, "broken-link", null]) {
    assert.equal(scenario.mutate(visited, "set-mode", invalid), visited, JSON.stringify(invalid));
  }
});

test("baseline: the recorded link is served, and the retired notice is not", () => {
  const baseline = scenario.createState(103);
  const second = scenario.route?.(baseline, { subpath: "second", query: new URLSearchParams(), method: "GET" }, context);
  assert.equal(second?.status, 200);
  assert.match(second?.body ?? "", /data-testid="navigation-page"/u);
});

test("broken-link: the retired page redirects to a 404 notice that cannot satisfy the recorded wait", () => {
  const state = armed();
  const second = scenario.route?.(state, { subpath: "second", query: new URLSearchParams(), method: "GET" }, context);
  assert.deepEqual(second, { status: 302, headers: { location: "/scenarios/navigation/link-retired" } });

  const notice = scenario.route?.(state, { subpath: "link-retired", query: new URLSearchParams(), method: "GET" }, context);
  assert.equal(notice?.status, 404);
  assert.match(notice?.body ?? "", /data-testid="link-retired"/u);
  // The wait the recording performs is for `navigation-page`; a notice carrying
  // it would let the armed run pass for the wrong reason.
  assert.doesNotMatch(notice?.body ?? "", /data-testid="navigation-page"/u);
  assert.deepEqual(notice?.mutation, { operation: "visit", payload: { page: "link-retired" } });
});

test("broken-link changes nothing but the retired destination", () => {
  const state = armed();
  const start = scenario.route?.(state, { subpath: "start", query: new URLSearchParams(), method: "GET" }, context);
  assert.equal(start?.body, scenario.route?.(scenario.createState(103), { subpath: "start", query: new URLSearchParams(), method: "GET" }, context)?.body);
  // The link's own href is untouched: the page it points at is what is gone.
  assert.match(start?.body ?? "", /href="\/scenarios\/navigation\/second"/u);
});
