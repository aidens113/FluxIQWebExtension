// Coverage of choice-storage.ts: one choice per server address, in storage shaped like chrome.storage.local.

import assert from "node:assert/strict";
import test from "node:test";

import { projectChoiceStorage } from "../choice-storage";

function area(initial: Record<string, unknown> = {}) {
  const data = { ...initial };
  return {
    get: async (key: string) => ({ [key]: data[key] }),
    set: async (items: Record<string, unknown>) => { Object.assign(data, items); }
  };
}

test("a choice is kept per server address, ignoring case and a trailing slash", async () => {
  const storage = projectChoiceStorage(area());
  await storage.write("http://Core.example/", { projectId: "p1", name: "One" });
  await storage.write("http://other.example", { projectId: "p2" });
  assert.deepEqual(await storage.read("http://core.example"), { projectId: "p1", name: "One" });
  assert.deepEqual(await storage.read("http://other.example"), { projectId: "p2" });
  assert.equal(await storage.read("http://third.example"), undefined);
});

test("writing null clears only that address", async () => {
  const storage = projectChoiceStorage(area());
  await storage.write("http://a", { projectId: "p1" });
  await storage.write("http://b", { projectId: "p2" });
  await storage.write("http://a", null);
  assert.equal(await storage.read("http://a"), undefined);
  assert.deepEqual(await storage.read("http://b"), { projectId: "p2" });
});

test("stored values of the wrong shape read as no choice", async () => {
  for (const bad of ["text", 4, [1], { "http://a": { projectId: 3 } }, { "http://a": null }]) {
    assert.equal(await projectChoiceStorage(area({ "fluxiq.projectChoice": bad })).read("http://a"), undefined);
  }
});
