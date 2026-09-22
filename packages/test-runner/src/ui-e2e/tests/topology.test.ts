// The topology's allocation rules, run without starting anything: ports are
// distinct, never excluded and each proven bindable; a draw that keeps landing
// on excluded ports gives up instead of spinning; the identity is fresh per
// call; and the run root cannot leave `<runs>/ui-e2e`.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { allocateUiE2ePorts, freshUiE2eIdentity, UI_E2E_EXCLUDED_PORTS, uiE2eRunRoot } from "../topology.js";

test("the user's panel ports and the fixed demo defaults are excluded", () => {
  for (const port of [3000, 4711, 3300, 4877]) assert.equal(UI_E2E_EXCLUDED_PORTS.has(port), true, String(port));
});

test("an excluded or repeated draw is redrawn, and every kept port is proven bindable", async () => {
  const draws = [3000, 51000, 51000, 4711, 3300, 52000, 4877, 53000];
  const checked: number[] = [];
  const ports = await allocateUiE2ePorts(3, {
    allocate: async () => draws.shift()!,
    assertBindable: async port => { checked.push(port); },
  });
  assert.deepEqual(ports, [51000, 52000, 53000]);
  assert.deepEqual(checked, [51000, 52000, 53000]);
});

test("a port that cannot be bound fails the allocation", async () => {
  await assert.rejects(allocateUiE2ePorts(1, {
    allocate: async () => 51000,
    assertBindable: async () => { throw new Error("UI end-to-end topology port 51000 cannot be bound on 127.0.0.1 (EACCES)"); },
  }), /cannot be bound/u);
});

test("an allocator that only hands out excluded ports gives up after a bounded number of draws", async () => {
  let draws = 0;
  await assert.rejects(allocateUiE2ePorts(2, { allocate: async () => { draws += 1; return 3000; }, assertBindable: async () => {} }), /distinct non-excluded/u);
  assert.equal(draws, 16);
});

test("every identity is fresh, and its PIN is six digits", () => {
  const first = freshUiE2eIdentity();
  const second = freshUiE2eIdentity();
  assert.match(first.username, /^ui-e2e-[0-9a-f]{12}$/u);
  assert.match(first.pin, /^[1-9]\d{5}$/u);
  assert.ok(first.password.length >= 30);
  assert.notEqual(first.username, second.username);
  assert.notEqual(first.password, second.password);
});

test("the run root is a direct child of <runs>/ui-e2e", () => {
  const runs = path.resolve("runs-root");
  assert.equal(uiE2eRunRoot(runs, "r20260921t230112-265b"), path.join(runs, "ui-e2e", "r20260921t230112-265b"));
  for (const bad of ["", "..", "../escape", "a/b", "a\\b", "Upper", "dot.ted", "x".repeat(41), "-leading"]) {
    assert.throws(() => uiE2eRunRoot(runs, bad), /run ID/u, bad);
  }
});
