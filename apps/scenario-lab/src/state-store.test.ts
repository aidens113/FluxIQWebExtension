import assert from "node:assert/strict";
import test from "node:test";
import { ScenarioStateStore } from "./state-store.js";

test("same seed creates the same dynamic-list identities", () => {
  const first = new ScenarioStateStore(42).snapshot("dynamic-list");
  const second = new ScenarioStateStore(42).snapshot("dynamic-list");
  assert.deepEqual(first, second);
});

test("reset restores declared scenario state", () => {
  const store = new ScenarioStateStore(7);
  const initial = store.snapshot("dynamic-list");
  store.mutate("dynamic-list", "add", { label: "Temporary" });
  assert.notDeepEqual(store.snapshot("dynamic-list"), initial);
  store.reset();
  assert.deepEqual(store.snapshot("dynamic-list"), initial);
});

test("reseed deterministically replaces all scenario state", () => {
  const store = new ScenarioStateStore(1);
  store.mutate("basic-form", "submit", { name: "Ada", plan: "team", notes: "test" });
  store.reseed(99);
  const formState = store.snapshot("basic-form")?.state as { submitted?: unknown } | undefined;
  assert.equal(formState?.submitted, false);
  assert.match(JSON.stringify(store.snapshot("dynamic-list")), /Seed 99 item 1/);
});
