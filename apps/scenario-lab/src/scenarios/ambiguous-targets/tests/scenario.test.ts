import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { ambiguousTargetsScenario as scenario, type AmbiguousTargetsState } from "../scenario.js";
import type { AmbiguousTargetsMode } from "../modes.js";

const context = { runToken: "unit-test-run-token-0001", seed: 106 };

function render(mode: AmbiguousTargetsMode): string {
  const state: AmbiguousTargetsState = mode === "baseline" ? scenario.createState(106) : scenario.mutate(scenario.createState(106), "set-mode", { mode });
  assert.equal(state.mode ?? "baseline", mode);
  return scenario.render(state, context);
}

/** Every `<button …>…</button>` on the page, opening tag and text, in document order. */
function buttons(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*>.*?<\/button>/gu)].map(([match]) => match);
}

test("the manifest is valid and resolves both variants, one negative and one positive", () => {
  const result = validateWebScenario(scenario.manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(scenario.manifest.variants?.map(({ id }) => id), ["no-context", "form-context"]);

  const primary = resolveScenarioWorkflow(scenario.manifest);
  assert.equal(primary.expected.failure, undefined);

  const ambiguous = resolveScenarioWorkflow(scenario.manifest, { variantId: "no-context" });
  assert.deepEqual(ambiguous.variant?.arm, { operation: "set-mode", payload: { mode: "no-context" } });
  assert.deepEqual(ambiguous.expected.failure, { category: "target_ambiguous", code: "web.target.ambiguous" });
  assert.deepEqual(ambiguous.recordingScript, primary.recordingScript);

  // The positive half of the same proof: the same page with the context put back.
  const contextual = resolveScenarioWorkflow(scenario.manifest, { variantId: "form-context" });
  assert.equal(contextual.expected.failure, undefined);
  assert.deepEqual(contextual.expected.finalState?.map(({ id }) => id), ["recorded-testid-gone", "context-selected-primary"]);
});

test("state is deterministic from the seed and arming clears the recording's choice", () => {
  assert.deepEqual(scenario.createState(106), { selected: null }, "the unarmed oracle shape is unchanged by the variants");
  const chosen = scenario.mutate(scenario.createState(106), "choose", { id: "primary" });
  assert.equal(chosen.selected, "primary");
  assert.deepEqual(scenario.mutate(chosen, "set-mode", { mode: "no-context" }), { selected: null, mode: "no-context" });
  for (const invalid of [{ mode: "unnamed" }, {}, null]) assert.equal(scenario.mutate(chosen, "set-mode", invalid), chosen, JSON.stringify(invalid));
});

test("baseline is untouched: the two Continue buttons are told apart by their test ids", () => {
  const [first, second, ...rest] = buttons(render("baseline"));
  assert.deepEqual(rest, []);
  assert.equal(first, `<button data-testid="choice-primary" data-choice="primary">Continue</button>`);
  assert.equal(second, `<button data-testid="choice-secondary" data-choice="secondary">Continue</button>`);
});

test("no-context: the two Continue buttons are byte-identical, so nothing on the page prefers one", () => {
  const html = render("no-context");
  const [first, second, ...rest] = buttons(html);
  assert.deepEqual(rest, []);
  assert.equal(first, second, "the armed buttons must be indistinguishable");
  assert.equal(first, `<button class="ui-button">Continue</button>`);
  // The recorded selector, id and xpath are all dead, and no form, fieldset,
  // list or second heading stands between the two.
  assert.doesNotMatch(html, /choice-primary|choice-secondary|data-choice/u);
  for (const container of ["<form", "<fieldset", "<legend", "<li", "<h2", "<section"]) {
    assert.equal(html.includes(container), false, `no-context must carry no ${container}`);
  }
});

test("form-context: the same indistinguishable buttons, and only the context differs", () => {
  const html = render("form-context");
  const [first, second, ...rest] = buttons(html);
  assert.deepEqual(rest, []);
  assert.equal(first, second, "context, not the control, is what tells these apart");
  assert.equal(first, `<button type="button" class="ui-button">Continue</button>`);
  assert.doesNotMatch(html, /choice-primary|choice-secondary|data-choice/u);
  assert.match(html, /<form name="primary-choice" action="\/scenarios\/ambiguous-targets\/primary">/u);
  assert.match(html, /<form name="secondary-choice" action="\/scenarios\/ambiguous-targets\/secondary">/u);
  assert.match(html, /<legend>Primary<\/legend>/u);
  assert.match(html, /<legend>Secondary<\/legend>/u);
});

test("the two armed renderings differ in context alone", () => {
  const strip = (html: string) => html.replace(/<\/?(?:form|fieldset|legend|div)\b[^>]*>/gu, "").replace(/Primary|Secondary/gu, "").replace(/ type="button"/gu, "");
  assert.equal(strip(render("no-context")), strip(render("form-context")));
});
