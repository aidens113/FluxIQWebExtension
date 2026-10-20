// A build memory held here and written through to Core's store (`../memory.ts`,
// `../persistence.ts`, t728), keyed by the build Core frames the call with
// (`../build-key.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { runWithAutomationStudioEvidenceBuildScope } from "fluxiq/automation-studio";
import type { JsonValue } from "fluxiq/core";
import { createWebNodeBuildMemory, createWebNodeBuildStatePersistence, webNodeBuildOf, type WebNodeBuildKey } from "..";
import { coreBuildStateStore } from "./core-store";

const FLOW = { projectId: "project.one", flowId: "flow.one" };
const BUILD: WebNodeBuildKey = { ...FLOW, buildId: "build.one", callScope: undefined };

/** A memory of a list of words, as each build memory is made. */
function words(store: ReturnType<typeof coreBuildStateStore>) {
  const persistence = createWebNodeBuildStatePersistence(() => store);
  const memory = createWebNodeBuildMemory<string[]>({
    name: "test.words",
    bound: 2,
    encode: (held) => [...held],
    decode: (stored) => (Array.isArray(stored) ? stored.filter((word): word is string => typeof word === "string") : undefined),
    persistence
  });
  return { memory, persistence };
}

test("the build is the one Core frames the call with, its opening only where Core marks one, and none outside a frame", () => {
  assert.deepEqual(webNodeBuildOf(FLOW), { build: { ...FLOW, buildId: undefined, callScope: undefined }, opening: undefined });
  const framed = runWithAutomationStudioEvidenceBuildScope({ ...FLOW, buildId: "build.one", callScope: "brief-3", opening: "fresh" }, () => webNodeBuildOf(FLOW));
  assert.deepEqual(framed, { build: { ...FLOW, buildId: "build.one", callScope: "brief-3" }, opening: "fresh" });
  // A frame for another Flow is not this call's.
  const other = runWithAutomationStudioEvidenceBuildScope({ ...FLOW, flowId: "flow.two", buildId: "build.two" }, () => webNodeBuildOf(FLOW));
  assert.deepEqual(other.build.buildId, undefined);
});

test("a memory written in one process is read back by the next over the same store, and a fresh forget drops it there too", async () => {
  const store = coreBuildStateStore();
  const first = words(store);
  first.memory.entry(BUILD, () => []).push("napkins");
  first.memory.saved(BUILD);
  await first.persistence.settled();

  // A restarted host: nothing held, until the build's first call restores it.
  const second = words(store);
  assert.equal(second.memory.get(BUILD), undefined);
  await second.memory.restore(BUILD);
  assert.deepEqual(second.memory.get(BUILD), ["napkins"]);

  second.memory.forget(BUILD);
  await second.persistence.settled();
  assert.equal(await store.get({ ...FLOW, buildId: "build.one" }, "test.words"), undefined);
  const third = words(store);
  await third.memory.restore(BUILD);
  assert.equal(third.memory.get(BUILD), undefined);
});

test("briefs run side by side keep apart, and a call outside every build keeps nothing durable", async () => {
  const store = coreBuildStateStore();
  const first = words(store);
  const brief: WebNodeBuildKey = { ...BUILD, callScope: "brief-6" };
  const unbuilt: WebNodeBuildKey = { ...BUILD, buildId: undefined };
  for (const [build, word] of [[BUILD, "build"], [brief, "brief"], [unbuilt, "unbuilt"]] as const) {
    first.memory.entry(build, () => []).push(word);
    first.memory.saved(build);
  }
  await first.persistence.settled();

  const second = words(store);
  for (const build of [BUILD, brief, unbuilt]) await second.memory.restore(build);
  assert.deepEqual(second.memory.get(BUILD), ["build"]);
  assert.deepEqual(second.memory.get(brief), ["brief"]);
  assert.equal(second.memory.get(unbuilt), undefined);
});

test("writes go out in order and the last one stands; a value Core refuses leaves the stored copy and this process's memory as they were", async () => {
  const store = coreBuildStateStore();
  const first = words(store);
  const held = first.memory.entry(BUILD, () => []);
  for (const word of ["one", "two", "three"]) {
    held.push(word);
    first.memory.saved(BUILD);
  }
  await first.persistence.settled();
  assert.deepEqual(await store.get({ ...FLOW, buildId: "build.one" }, "test.words"), ["one", "two", "three"]);

  // Past Core's 64 KiB bound on one value: refused, and nothing fails here.
  held.push("x".repeat(70 * 1024));
  first.memory.saved(BUILD);
  await first.persistence.settled();
  assert.equal(first.memory.get(BUILD)?.length, 4);
  const stored = await store.get({ ...FLOW, buildId: "build.one" }, "test.words") as JsonValue[];
  assert.deepEqual(stored, ["one", "two", "three"]);
});

test("a build let go past the bound in this process is read back from the store when it calls again", async () => {
  const store = coreBuildStateStore();
  const { memory, persistence } = words(store);
  const builds = ["build.a", "build.b", "build.c"].map((buildId): WebNodeBuildKey => ({ ...FLOW, buildId, callScope: undefined }));
  for (const build of builds) {
    memory.entry(build, () => []).push(build.buildId!);
    memory.saved(build);
  }
  await persistence.settled();
  // Bound 2: the first build is no longer held here.
  assert.equal(memory.get(builds[0]!), undefined);
  await memory.restore(builds[0]!);
  assert.deepEqual(memory.get(builds[0]!), ["build.a"]);
});
