import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import test from "node:test";
import { getScenario } from "../registry.js";
import { ScenarioStateStore } from "../state-store.js";

test("same seed creates the same dynamic-list identities", () => {
  const first = new ScenarioStateStore(42).snapshot("dynamic-list");
  const second = new ScenarioStateStore(42).snapshot("dynamic-list");
  assert.deepEqual(first?.state, second?.state);
  assert.notEqual(first?.provenance.ownerEpoch, second?.provenance.ownerEpoch);
});

test("reset restores declared scenario state", () => {
  const store = new ScenarioStateStore(7);
  const initial = store.snapshot("dynamic-list");
  store.mutate("dynamic-list", "add", { label: "Temporary" });
  assert.notDeepEqual(store.snapshot("dynamic-list"), initial);
  store.reset();
  assert.deepEqual(store.snapshot("dynamic-list")?.state, initial?.state);
  assert.equal(store.snapshot("dynamic-list")?.provenance.resetGeneration, 2);
});

test("reseed deterministically replaces all scenario state", () => {
  const store = new ScenarioStateStore(1);
  store.mutate("basic-form", "submit", { name: "Ada", plan: "team", notes: "test" });
  store.reseed(99);
  const formState = store.snapshot("basic-form")?.state as { submitted?: unknown } | undefined;
  assert.equal(formState?.submitted, false);
  assert.match(JSON.stringify(store.snapshot("dynamic-list")), /Seed 99 item 1/);
});

for (const reseed of [false, true]) test(`failed ${reseed ? "reseed" : "reset"} retains actual whole state`, () => {
  const store = new ScenarioStateStore(7);
  store.mutate("dynamic-list", "add", { label: "Retained" });
  const before = store.all(), seed = store.seed;
  const scenario = getScenario("dynamic-list")!, original = scenario.createState;
  try {
    scenario.createState = () => { throw new Error("isolated initializer failure"); };
    assert.throws(() => reseed ? store.reseed(88) : store.reset(), /initializer failure/);
    assert.equal(store.seed, seed);
    assert.equal(isDeepStrictEqual(store.all(), before), true);
  } finally { scenario.createState = original; }
});
test("a reducer mutating its input then throwing cannot change the actual owner", () => {
  const store = new ScenarioStateStore(7), before = store.all();
  const scenario = getScenario("basic-form")!, original = scenario.mutate;
  try {
    scenario.mutate = state => { Object.assign(state, { injected: "partial" }); throw new Error("isolated reducer failure"); };
    assert.throws(() => store.mutate("basic-form", "submit", {}), /reducer failure/);
    assert.equal(isDeepStrictEqual(store.all(), before), true);
  } finally { scenario.mutate = original; }
});

test("actual owner sequences changed state, no-op and registered arms", () => {
  const store = new ScenarioStateStore(7), initial = store.provenance();
  assert.equal(initial.resetGeneration, 1); assert.equal(initial.mutationSequence, 0);
  assert.equal(Object.isFrozen(initial), true);
  const copied = store.snapshot("social-scheduler")!;
  Object.assign(copied.state, { mode: "injected" });
  assert.equal(store.snapshot("social-scheduler")?.variant.status, "baseline");
  store.mutate("social-scheduler", "unknown", {});
  assert.deepEqual(store.provenance(), initial);
  const armed = store.arm({ scenarioId: "social-scheduler", variantId: "restyled" });
  assert.equal(armed.status, "changed"); assert.deepEqual(armed.snapshot.variant, { status: "armed", variantId: "restyled", workflowId: null, armSequence: 1 });
  assert.equal(store.arm({ scenarioId: "social-scheduler", variantId: "restyled" }).status, "no_change");
  store.mutate("social-scheduler", "schedule-post", { accountSlug: "photogram-northwind-trails", body: "probe", date: "2026-09-24", time: "09:00" });
  assert.equal(store.provenance().mutationSequence, 2);
  assert.equal(store.snapshot("social-scheduler")?.variant.status, "unknown");
  const beforeReset = store.provenance(); store.reset();
  assert.equal(store.provenance().resetGeneration, 2); assert.equal(store.provenance().mutationSequence, beforeReset.mutationSequence + 1);
  assert.equal(store.snapshot("social-scheduler")?.variant.status, "baseline");
  store.reseed(7); assert.equal(store.provenance().resetGeneration, 3);
});
test("actual workflow arm resolves its registered definition and ambiguity refuses", () => {
  const scenario = getScenario("social-scheduler")!, workflow = scenario.manifest.workflows!.find(item => item.variants?.length)!;
  const variant = workflow.variants![0]!, store = new ScenarioStateStore(7);
  const result = store.arm({ scenarioId: scenario.id, workflowId: workflow.id, variantId: variant.id });
  assert.equal(result.status, "changed"); assert.equal(result.snapshot.variant.status, "armed");
  const before = store.all(), variants = scenario.manifest.variants!;
  try {
    scenario.manifest.variants = [scenario.manifest.variants![0]!, scenario.manifest.variants![0]!];
    assert.throws(() => store.arm({ scenarioId: scenario.id, variantId: scenario.manifest.variants![0]!.id }), /variant_unknown/);
    assert.equal(isDeepStrictEqual(store.all(), before), true);
  } finally { scenario.manifest.variants = variants; }
});
test("reentrant reducer publication and unsafe next counter refuse before any publication", () => {
  const store = new ScenarioStateStore(7), before = store.all(), scenario = getScenario("basic-form")!, original = scenario.mutate;
  try {
    scenario.mutate = state => { store.reset(); return state; };
    assert.throws(() => store.mutate("basic-form", "submit", {}), /reentrant/);
    assert.equal(isDeepStrictEqual(store.all(), before), true);
  } finally { scenario.mutate = original; }
  const safe = Number.isSafeInteger; let called = 0;
  try {
    scenario.mutate = state => { called++; return state; };
    Number.isSafeInteger = value => value === 0 ? false : safe(value);
    assert.throws(() => store.mutate("basic-form", "submit", {}), /counter_exhausted/);
    assert.equal(called, 0);
  } finally { Number.isSafeInteger = safe; scenario.mutate = original; }
  assert.equal(isDeepStrictEqual(store.all(), before), true);
});
