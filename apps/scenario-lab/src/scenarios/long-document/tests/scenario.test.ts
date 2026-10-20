import assert from "node:assert/strict";
import test from "node:test";
import { longDocumentScenario as scenario } from "../scenario.js";

const context = { runToken: "long-document-unit-token", seed: 104 };

/** The 1-based section the single `below-fold-target` sits in. */
function targetSection(html: string): number {
  const sections = [...html.matchAll(/<section style="min-height:180px"><h2>Section (\d+)<\/h2>(.*?)<\/section>/gu)];
  assert.equal(sections.length, 24);
  const holding = sections.filter(([, , inner]) => String(inner).includes('data-testid="below-fold-target"'));
  assert.equal(holding.length, 1, "exactly one target");
  return Number(holding[0]?.[1]);
}

test("the target sits below at least fourteen 180px sections for every seed, inside the recorded 3,200px scroll's reach", () => {
  for (const seed of [104, 0, 1, 4, 42, -7, 2 ** 31]) {
    const state = scenario.createState(seed);
    assert.ok(state.targetIndex >= 15 && state.targetIndex <= 19, `seed ${seed}: index ${state.targetIndex}`);
    const section = targetSection(scenario.render(state, { ...context, seed }));
    assert.equal(section, state.targetIndex + 1, `seed ${seed}`);
    // 14+ sections of min-height 180px above it: well past any first viewport.
    assert.ok((section - 1) * 180 >= 2_520, `seed ${seed}: the target is below the fold`);
  }
  assert.deepEqual(scenario.manifest.recordingScript[0], { id: "scroll-below-fold", operation: "scroll", value: 3200 });
});

test("reach marks the target reached, every other operation is inert, and the result starts Pending", () => {
  const seeded = scenario.createState(104);
  assert.deepEqual(seeded, { reached: false, targetIndex: 19 });
  assert.deepEqual(scenario.mutate(seeded, "reach", {}), { reached: true, targetIndex: 19 });
  assert.equal(scenario.mutate(seeded, "scroll", {}), seeded);
  const html = scenario.render(seeded, context);
  assert.match(html, /<p data-testid="result" aria-live="polite">Pending<\/p>/u);
  assert.match(html, /mutate\('reach'\); document\.querySelector\('\[data-testid="result"\]'\)\.textContent = 'Reached'/u);
});
