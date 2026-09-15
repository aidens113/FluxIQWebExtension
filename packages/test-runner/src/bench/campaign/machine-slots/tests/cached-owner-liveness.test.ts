import assert from "node:assert/strict";
import test from "node:test";
import { createCachedOwnerLiveness, type PidPresence } from "../index.js";

const INTERVAL_MS = 60_000;

type Owner = Readonly<{ ticketId: string; pid: number; bootIdentitySha256: string; processIdentitySha256: string }>;

const owner = (ticketId: string, pid: number, identity = "a"): Owner => ({ ticketId, pid, bootIdentitySha256: "b".repeat(64), processIdentitySha256: identity.repeat(64) });

function harness(presence: PidPresence = "present") {
  const state = { clock: 0, presence, calls: 0, probeDurationMs: 0, fail: false, live: new Set(["a".repeat(64)]) };
  const liveness = createCachedOwnerLiveness({
    verify: async candidate => {
      state.calls += 1;
      state.clock += state.probeDurationMs;
      if (state.fail) throw new Error("probe failed");
      return state.live.has(candidate.processIdentitySha256);
    },
    presence: () => state.presence,
    monotonicNowMs: () => state.clock,
    reverifyIntervalMs: INTERVAL_MS,
  });
  return { state, liveness };
}

test("an owner seen for the first time is always probed", async () => {
  const { state, liveness } = harness();
  assert.equal(await liveness.isLive(owner("ticket_dead_owner_1", 5, "d")), false);
  assert.equal(state.calls, 1);
  assert.equal(await liveness.isLive(owner("ticket_live_owner_1", 6)), true);
  assert.equal(state.calls, 2);
});

test("a verified owner whose PID stays present is not probed again inside the interval", async () => {
  const { state, liveness } = harness();
  const holder = owner("ticket_live_owner_1", 5);
  assert.equal(await liveness.isLive(holder), true);
  for (let poll = 0; poll < 1_000; poll += 1) {
    state.clock = poll * 59;
    assert.equal(await liveness.isLive(holder), true);
  }
  assert.equal(state.calls, 1);
});

test("re-verification is due exactly one interval after the last probe started", async () => {
  const { state, liveness } = harness();
  const holder = owner("ticket_live_owner_1", 5);
  state.probeDurationMs = 5_000;
  await liveness.isLive(holder);
  state.clock = INTERVAL_MS - 1;
  await liveness.isLive(holder);
  assert.equal(state.calls, 1, "still inside the window");
  state.clock = INTERVAL_MS;
  await liveness.isLive(holder);
  assert.equal(state.calls, 2, "a slow probe must not lengthen the window");
});

test("a PID reported absent is confirmed by the probe before any not-live verdict", async () => {
  const { state, liveness } = harness("absent");
  const holder = owner("ticket_live_owner_1", 5);
  assert.equal(await liveness.isLive(holder), true);
  assert.equal(await liveness.isLive(holder), true, "a live owner is never called dead on presence alone");
  assert.equal(state.calls, 2);
  state.live.clear();
  assert.equal(await liveness.isLive(holder), false, "a dead owner is reported on the next check, not after the interval");
  assert.equal(state.calls, 3);
});

test("a live owner is never reported not live, whatever presence and the clock say", async () => {
  for (const presence of ["present", "absent", "unknown"] as const) {
    const { state, liveness } = harness(presence);
    const holder = owner("ticket_live_owner_1", 5);
    for (const clock of [0, 1, INTERVAL_MS - 1, INTERVAL_MS, 10 * INTERVAL_MS, 3]) {
      state.clock = clock;
      assert.equal(await liveness.isLive(holder), true, `${presence} at ${clock}`);
    }
  }
});

test("a presence result that is not evidence falls back to probing on every check", async () => {
  const { state, liveness } = harness("unknown");
  const holder = owner("ticket_live_owner_1", 5);
  for (let check = 0; check < 3; check += 1) await liveness.isLive(holder);
  assert.equal(state.calls, 3);
});

test("a different owner record on an already verified PID is probed on first sight", async () => {
  const { state, liveness } = harness();
  assert.equal(await liveness.isLive(owner("ticket_live_owner_1", 5)), true);
  assert.equal(await liveness.isLive(owner("ticket_stale_owner", 5, "c")), false);
  assert.equal(state.calls, 2);
});

test("markVerified records an owner the caller has just probed, without probing again", async () => {
  const { state, liveness } = harness();
  const self = owner("ticket_self_owner_1", 5);
  liveness.markVerified(self);
  assert.equal(await liveness.isLive(self), true);
  assert.equal(state.calls, 0);
});

test("a failing probe propagates instead of producing a verdict", async () => {
  const { state, liveness } = harness();
  const holder = owner("ticket_live_owner_1", 5);
  state.fail = true;
  await assert.rejects(liveness.isLive(holder), /probe failed/u);
  state.fail = false;
  assert.equal(await liveness.isLive(holder), true);
  assert.equal(state.calls, 2, "a failed first probe leaves nothing trusted");
  state.fail = true;
  state.clock = INTERVAL_MS;
  await assert.rejects(liveness.isLive(holder), /probe failed/u);
});
