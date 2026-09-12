import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, runActionStatuses, scenarioPageFactSchedule, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import type { FailureSurfacesMode } from "../modes.js";
import { failureSurfacesScenario as scenario, type FailureSurfacesState } from "../scenario.js";

const context = { runToken: "unit-test-run-token-0001", seed: 108 };

/** The category and code each armed surface must be reported as. */
const EXPECTED_FAILURES: Record<string, { category: string; code: string }> = {
  disabled: { category: "blocked_by_capability_or_policy", code: "web.action.rejected" },
  detached: { category: "target_not_found", code: "web.target.not_found" },
  "blocked-url": { category: "navigation_unexpected", code: "web.navigation.unexpected" },
};

/** Each rendering and the variant that produces it; `baseline` is the unarmed page the recording is made against. */
const RENDERINGS: Array<[FailureSurfacesMode, string | undefined]> = [
  ["baseline", undefined], ["disabled", "disabled"], ["detached", "detached"], ["blocked-url", "blocked-url"],
];

function state(mode: FailureSurfacesMode): FailureSurfacesState {
  return mode === "baseline" ? scenario.createState(108) : scenario.mutate(scenario.createState(108), "set-mode", { mode });
}

function render(mode: FailureSurfacesMode): string {
  return scenario.render(state(mode), context);
}

/** The opening tag of the element carrying `data-testid`, or `undefined` when the rendering has none. */
function openingTag(html: string, testId: string): string | undefined {
  return new RegExp(`<[a-zA-Z][^>]*\\sdata-testid="${testId}"[^>]*>`, "u").exec(html)?.[0];
}

/** A boolean attribute on an opening tag: `disabled`, not the `disabled-target` inside a value. */
function hasAttribute(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(?=[\\s>=])`, "u").test(tag);
}

test("the manifest is valid and resolves one variant per surface, each with its own code", () => {
  const result = validateWebScenario(scenario.manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(scenario.manifest.variants?.map(({ id }) => id), ["disabled", "detached", "blocked-url"]);

  const primary = resolveScenarioWorkflow(scenario.manifest);
  assert.equal(primary.expected.failure, undefined);
  // The unarmed workflow is a workflow that works: it presses a live control
  // and its click succeeds. The refusals belong to the armed runs below.
  assert.deepEqual(primary.recordingScript.map(({ id, operation, target }) => ({ id, operation, target })), [
    { id: "detach-target", operation: "click", target: "testid:detach-target" },
    { id: "detached-final", operation: "checkpoint", target: undefined },
  ]);
  assert.deepEqual(primary.expected.actions, [{ action: "web.dom.click", outcome: "succeeded" }]);

  for (const [variantId, failure] of Object.entries(EXPECTED_FAILURES)) {
    const resolved = resolveScenarioWorkflow(scenario.manifest, { variantId });
    assert.deepEqual(resolved.variant?.arm, { operation: "set-mode", payload: { mode: variantId } }, variantId);
    assert.deepEqual(resolved.expected.failure, failure, variantId);
    assert.deepEqual(resolved.recordingScript, primary.recordingScript, variantId);
  }
  // Three surfaces, three distinct categories: a run that reports the wrong one
  // is wrong rather than lucky.
  assert.equal(new Set(Object.values(EXPECTED_FAILURES).map(({ category }) => category)).size, 3);
});

test("the recording script presses only controls the unarmed page can actually offer", () => {
  const html = render("baseline");
  const targeted = scenario.manifest.recordingScript.filter((step) => step.target !== undefined);
  assert.ok(targeted.length > 0, "a workflow that presses nothing records nothing");
  for (const step of targeted) {
    const testId = step.target?.startsWith("testid:") ? step.target.slice("testid:".length) : undefined;
    assert.ok(testId, `${step.id}: this fixture addresses its controls by test id`);
    const tag = openingTag(html, testId);
    assert.ok(tag, `${step.id}: ${testId} is not on the unarmed page`);
    // The recording lane drives each click through Playwright, whose click
    // waits for the enabled actionability check. A script aimed at a refused
    // control never finishes recording, so the variants replaying that
    // recording never run at all.
    assert.equal(hasAttribute(tag, "disabled"), false, `${step.id}: ${testId} is disabled unarmed, so no recording could press it`);
  }
});

test("the disabled surface stays on the page and stays out of the recording", () => {
  // Record time and replay time are different phases. `disabled-target` is a
  // page fact and the content harness's refused-target fixture; the refusal the
  // corpus measures is the armed one, on the control the recording pressed.
  assert.equal(hasAttribute(openingTag(render("baseline"), "disabled-target") ?? "", "disabled"), true);
  assert.equal(scenario.manifest.recordingScript.some((step) => step.target === "testid:disabled-target"), false);
  assert.equal(hasAttribute(openingTag(render("baseline"), "detach-target") ?? "", "disabled"), false);
  assert.equal(hasAttribute(openingTag(render("disabled"), "detach-target") ?? "", "disabled"), true);
});

test("every declared action outcome is one a run can actually record", () => {
  // `ExpectedAction.outcome` also admits `rejected`, which no lane can ever
  // report: an attempt's status is Core's `RuntimeStatus`, widened by
  // `runActionStatus()` to `unknown` for anything outside `runActionStatuses`.
  // A variant that expected `rejected` would fail on its own expectation
  // whatever the page did, so the refusal belongs in `failure`, not here.
  for (const [mode, variantId] of RENDERINGS) {
    const expected = resolveScenarioWorkflow(scenario.manifest, variantId === undefined ? {} : { variantId }).expected;
    for (const action of expected.actions ?? []) {
      const outcome = action.outcome ?? "succeeded";
      assert.ok((runActionStatuses as readonly string[]).includes(outcome), `${mode}: ${action.action} expects outcome ${outcome}, which no run can record`);
    }
  }
});

test("every rendering states page facts, and they are true of that rendering", () => {
  for (const [mode, variantId] of RENDERINGS) {
    const selection = variantId === undefined ? {} : { variantId };
    // Read through the schedule, not the merged `expected`, because the phase
    // is the point: the workflow describes the page the recording is made
    // against and each variant describes the page its run is judged on.
    const schedule = scenarioPageFactSchedule(scenario.manifest, selection, variantId === undefined ? "unarmed" : "arms-after-loading");
    const facts = variantId === undefined ? schedule.atLoad : schedule.afterArm;
    if (variantId !== undefined) assert.deepEqual(schedule.atLoad, scenario.manifest.expected.pageFacts, `${mode}: the recording is still made against the unarmed page`);
    assert.ok(facts.length > 0, `${mode}: a rendering that states no page fact cannot be caught lying`);
    const html = render(mode);
    for (const fact of facts) {
      const tag = openingTag(html, fact.subject);
      const label = `${mode}/${fact.id}`;
      // Markup is all a rendered string can answer for; `negative-variants.spec.ts`
      // puts the same facts to a real browser, where visibility is real.
      if (fact.predicate === "exists") assert.equal(tag !== undefined, fact.value, label);
      else if (fact.predicate === "visible") assert.equal(tag !== undefined && !hasAttribute(tag, "hidden"), fact.value, label);
      else if (fact.predicate === "enabled") assert.equal(tag !== undefined && !hasAttribute(tag, "disabled"), fact.value, label);
      else assert.fail(`${label}: predicate ${fact.predicate} is not one a rendering can state`);
    }
  }
});

test("no control on the page borrows a variant's name", () => {
  const variantIds = new Set(scenario.manifest.variants?.map(({ id }) => id) ?? []);
  for (const [mode] of RENDERINGS) {
    const html = render(mode);
    for (const [, testId] of html.matchAll(/data-testid="([^"]+)"/gu)) {
      // A control named for a variant reads as the surface that variant arms.
      // `blocked-url` was such a control -- inert in every mode, with no
      // handler and no destination -- beside a variant that arms
      // `detach-target` instead, so the shared name asserted a relationship
      // the page does not have.
      assert.ok(!variantIds.has(String(testId)), `${mode}: the control "${String(testId)}" is named after a variant it has nothing to do with`);
    }
  }
  const baseline = render("baseline");
  assert.match(baseline, /<button data-testid="dead-link">Link that goes nowhere<\/button>/u);
  assert.doesNotMatch(baseline, /data-testid="blocked-url"/u);
});

test("state is deterministic from the seed and arming clears what the recording did", () => {
  assert.deepEqual(scenario.createState(108), { lastFailure: null, attempts: 0 }, "the unarmed oracle shape is unchanged by the variants");
  const detached = scenario.mutate(scenario.createState(108), "attempt", { kind: "detached" });
  assert.deepEqual(detached, { lastFailure: "detached", attempts: 1 });
  assert.deepEqual(scenario.mutate(detached, "set-mode", { mode: "disabled" }), { lastFailure: null, attempts: 0, mode: "disabled" });
  for (const invalid of [{ mode: "missing" }, {}, null]) assert.equal(scenario.mutate(detached, "set-mode", invalid), detached, JSON.stringify(invalid));
});

test("baseline is untouched: the recorded control is present, enabled, and detaches itself", () => {
  const html = render("baseline");
  assert.match(html, /<button data-testid="detach-target">Detach me<\/button>/u);
  assert.match(html, /detached\.remove\(\)/u);
  assert.doesNotMatch(html, /detach-target-removed/u);
});

test("each armed mode changes the recorded control and nothing else", () => {
  const surface = (html: string) => /disabled>Disabled<\/button>(.*?)<button data-testid="dead-link"/su.exec(html)?.[1] ?? "";
  const script = (html: string) => /<script type="module">([\s\S]*)<\/script>/u.exec(html)?.[1] ?? "";
  const skeleton = (html: string) => html.replace(surface(html), "[surface]").replace(script(html), "[script]");

  assert.equal(surface(render("disabled")), `<button data-testid="detach-target" disabled>Detach me</button>`);
  assert.equal(surface(render("detached")), `<p data-testid="detach-target-removed">This item was deleted. Nothing here replaces it.</p>`);
  assert.equal(surface(render("blocked-url")), `<button data-testid="detach-target" data-blocked-url="https://partner.example.invalid/records/4821">Detach me</button>`);
  for (const mode of ["disabled", "detached", "blocked-url"] as const) {
    assert.equal(skeleton(render(mode)), skeleton(render("baseline")), `${mode} must change only the recorded control`);
  }
});

test("blocked-url navigates to the guard rather than reporting a refusal from the page", () => {
  const html = render("blocked-url");
  assert.match(html, /location\.href = "\/scenarios\/failure-surfaces\/blocked" \+ '\?to=' \+ encodeURIComponent\(blocked\.dataset\.blockedUrl\)/u);
  assert.doesNotMatch(html, /mutate\('attempt', \{ kind: 'blocked-url' \}\)/u);
});

test("detached binds no handler, so the page throws no console error where the control was", () => {
  const html = render("detached");
  assert.doesNotMatch(html, /const detached = document\.querySelector/u);
  assert.match(html, /\/\/ The item was deleted/u);
  // `allowedConsoleErrors` is empty, so a script that threw here would fail the
  // run on a console error rather than on the missing target.
  assert.deepEqual(scenario.manifest.expected.allowedConsoleErrors, []);
});

test("blocked-url: the guard interstitial is served 403 on loopback and names the refused destination", () => {
  const query = new URLSearchParams({ to: "https://partner.example.invalid/records/4821" });
  const routed = scenario.route?.(state("blocked-url"), { subpath: "blocked", query, method: "GET" }, context);
  assert.equal(routed?.status, 403);
  assert.match(routed?.body ?? "", /data-testid="access-blocked"/u);
  assert.match(routed?.body ?? "", /partner\.example\.invalid\/records\/4821/u);
  assert.deepEqual(routed?.mutation, { operation: "attempt", payload: { kind: "blocked-url" } });
  assert.equal(scenario.route?.(state("blocked-url"), { subpath: "elsewhere", query, method: "GET" }, context), undefined);
});

test("the guard escapes the destination it names rather than reflecting it", () => {
  const query = new URLSearchParams({ to: `https://x.invalid/"><script>alert(1)</script>` });
  const routed = scenario.route?.(state("blocked-url"), { subpath: "blocked", query, method: "GET" }, context);
  assert.doesNotMatch(routed?.body ?? "", /<script>alert/u);
  assert.match(routed?.body ?? "", /&lt;script&gt;alert/u);
});
