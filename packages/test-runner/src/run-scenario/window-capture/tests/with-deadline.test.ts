import assert from "node:assert/strict";
import test from "node:test";
import { withDeadline } from "../with-deadline.js";

test("work that runs over its deadline is rejected at the deadline and its signal is aborted", async () => {
  let aborted = false;
  const started = Date.now();
  await assert.rejects(
    withDeadline(signal => new Promise<never>(() => { signal.addEventListener("abort", () => { aborted = true; }); }), 50, "capture"),
    /capture took longer than 50 ms/u,
  );
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 45 && elapsed < 1_000, `rejected after ${elapsed} ms`);
  assert.equal(aborted, true);
});

test("work that finishes in time answers its value and is not aborted", async () => {
  let aborted = false;
  const value = await withDeadline(async signal => { signal.addEventListener("abort", () => { aborted = true; }); return 42; }, 1_000, "capture");
  assert.equal(value, 42);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(aborted, false);
});

test("work that fails in time rejects with its own failure, and one that throws synchronously is caught the same way", async () => {
  await assert.rejects(withDeadline(async () => { throw new Error("helper exited 1"); }, 1_000, "capture"), /helper exited 1/u);
  await assert.rejects(withDeadline(() => { throw new Error("thrown before any promise"); }, 1_000, "capture"), /thrown before any promise/u);
});

test("a late result after the deadline does not resurrect the capture", async () => {
  const late = withDeadline(() => new Promise<string>(resolve => setTimeout(() => resolve("late"), 80)), 20, "capture");
  await assert.rejects(late, /took longer than 20 ms/u);
  await new Promise(resolve => setTimeout(resolve, 100));
});
