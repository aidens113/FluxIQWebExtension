import assert from "node:assert/strict";
import test from "node:test";
import { createWorkingHold, WORKING_OFF_MS, WORKING_ON_MS } from "../working-hold";

function setup() {
  const timers: Array<{ run(): void; ms: number }> = []; const canceled: unknown[] = []; const changes: boolean[] = [];
  const clock = { setTimeout(run: () => void, ms: number) { const handle = { run, ms }; timers.push(handle); return handle; }, clearTimeout(handle: unknown) { canceled.push(handle); } };
  const hold = createWorkingHold(clock, value => changes.push(value)); return { hold, timers, canceled, changes };
}
test("owner reset clears shown/raw together and publishes idle only if changed", () => {
  const f = setup(); f.hold.observe(true); assert.equal(f.timers[0]!.ms, WORKING_ON_MS); f.timers[0]!.run(); assert.equal(f.hold.working(), true);
  f.hold.reset(); assert.equal(f.hold.working(), false); assert.deepEqual(f.changes, [true, false]); f.hold.reset(); assert.deepEqual(f.changes, [true, false]);
  f.hold.observe(true); assert.equal(f.timers.length, 2); assert.equal(f.timers[1]!.ms, WORKING_ON_MS);
});
test("reset retires queued callbacks and cannot clear newer pending schedule", () => {
  const f = setup(); f.hold.observe(true); const old = f.timers[0]!; f.hold.reset(); f.hold.observe(true); const latest = f.timers[1]!;
  old.run(); assert.equal(f.hold.working(), false); assert.deepEqual(f.changes, []); f.hold.stop(); assert.ok(f.canceled.includes(latest)); latest.run(); assert.equal(f.hold.working(), false);
});
test("reset during pending idle retires old callback before new owner working delay", () => {
  const f = setup(); f.hold.observe(true); f.timers[0]!.run(); f.hold.observe(false); const idle = f.timers[1]!; assert.equal(idle.ms, WORKING_OFF_MS);
  f.hold.reset(); f.hold.observe(true); idle.run(); assert.equal(f.hold.working(), false); f.timers[2]!.run(); assert.equal(f.hold.working(), true); assert.deepEqual(f.changes, [true, false, true]);
});
test("stop preserves raw/shown contract but stale callback can never publish", () => {
  const f = setup(); f.hold.observe(true); f.hold.stop(); f.hold.observe(true); assert.equal(f.timers.length, 1); f.timers[0]!.run(); assert.equal(f.hold.working(), false); assert.deepEqual(f.changes, []);
});
test("ordinary canceled callbacks cannot publish or clear a later schedule", () => {
  const f = setup(); f.hold.observe(true); const old = f.timers[0]!; f.hold.observe(false); f.hold.observe(true); old.run(); assert.equal(f.hold.working(), false);
  f.hold.stop(); assert.ok(f.canceled.includes(f.timers[1])); f.timers[1]!.run(); assert.deepEqual(f.changes, []);
});
test("reset publishes before allowing a reentrant observer's new schedule", () => {
  const timers: Array<() => void> = []; const changes: boolean[] = []; let reenter = false;
  const hold = createWorkingHold({ setTimeout(run) { timers.push(run); return run; }, clearTimeout() {} }, value => { changes.push(value); if (reenter && !value) hold.observe(true); });
  hold.observe(true); timers[0]!(); reenter = true; hold.reset(); assert.deepEqual(changes, [true, false]); assert.equal(timers.length, 2); timers[1]!(); assert.equal(hold.working(), true);
});
