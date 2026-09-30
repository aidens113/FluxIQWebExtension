// How long a run is read back for, and why it is not one number.
//
// The 90-second bound was measured on Flows of a single extraction node. Read
// as a whole-run deadline for a Flow of six to twenty nodes it expires while
// the run is still executing, and the wait then reports the failure that
// stopped the *request* -- a product verdict for a run nobody observed fail.
// These pin the derivation that replaced it, and pin it to Core's own
// published ceilings rather than to a number written here.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY, AUTOMATION_STUDIO_READINESS_CAP_MS } from "fluxiq/automation-studio";
import { awaitTerminalRunDetail, LIVE_LLM_RUN_WAIT_MS, TERMINAL_DETAIL_BASE_WAIT_MS, TERMINAL_DETAIL_MAX_WAIT_MS, TERMINAL_DETAIL_NODE_WAIT_MS, TERMINAL_DETAIL_POLL_MS, terminalDetailWaitMs } from "../terminal-run-wait.js";

test("one node's allowance is every attempt's readiness ceiling plus every retry's backoff, as Core defines them", () => {
  // Core awaits readiness once per attempt and sleeps a backoff before each
  // attempt after the first: 3 x 30 s, then 250 ms and 1 s.
  assert.equal(AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY.maxAttempts, 3);
  assert.equal(AUTOMATION_STUDIO_READINESS_CAP_MS, 30_000);
  assert.equal(TERMINAL_DETAIL_NODE_WAIT_MS, 91_250);
  // Stated the other way round, so a Core that moves a ceiling moves this and
  // does not leave a literal behind.
  assert.equal(TERMINAL_DETAIL_NODE_WAIT_MS - AUTOMATION_STUDIO_READINESS_CAP_MS * AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY.maxAttempts, 1_250);
});

test("a Flow of one node keeps the load-proven 90 seconds, and a caller that names no count gets it", () => {
  assert.equal(terminalDetailWaitMs(1), TERMINAL_DETAIL_BASE_WAIT_MS);
  assert.equal(terminalDetailWaitMs(undefined), TERMINAL_DETAIL_BASE_WAIT_MS);
  // Nothing a caller can pass shortens it: 0 nodes is a Flow this reader knows
  // nothing about, not a Flow that finishes faster than one of one node.
  assert.equal(terminalDetailWaitMs(0), TERMINAL_DETAIL_BASE_WAIT_MS);
  assert.equal(terminalDetailWaitMs(-4), TERMINAL_DETAIL_BASE_WAIT_MS);
  assert.equal(terminalDetailWaitMs(2.5), TERMINAL_DETAIL_BASE_WAIT_MS);
});

test("every node after the first adds its own allowance, so a multi-node Flow is not failed for still running", () => {
  assert.equal(terminalDetailWaitMs(2), TERMINAL_DETAIL_BASE_WAIT_MS + TERMINAL_DETAIL_NODE_WAIT_MS);
  assert.equal(terminalDetailWaitMs(6), 90_000 + 5 * 91_250);
  // The six-node case is the one the plan names, and it is 9.1 minutes: more
  // than six times the bound that would have failed it.
  assert.ok(terminalDetailWaitMs(6) > 6 * TERMINAL_DETAIL_BASE_WAIT_MS);
});

test("the derived bound is capped at the longest run this facility allows", () => {
  assert.equal(TERMINAL_DETAIL_MAX_WAIT_MS, LIVE_LLM_RUN_WAIT_MS);
  assert.equal(terminalDetailWaitMs(20), TERMINAL_DETAIL_MAX_WAIT_MS);
  assert.equal(terminalDetailWaitMs(Number.MAX_SAFE_INTEGER), TERMINAL_DETAIL_MAX_WAIT_MS);
  // Seven nodes is where Core's own per-node worst case reaches the cap, so
  // the count still governs every Flow smaller than that.
  assert.ok(terminalDetailWaitMs(6) < TERMINAL_DETAIL_MAX_WAIT_MS);
  assert.equal(terminalDetailWaitMs(7), TERMINAL_DETAIL_MAX_WAIT_MS);
});

// A node that ran and was then judged wrong is a node that ran.
//
// Core marks a refuted result as a failure on the last record-storing attempt,
// so a Flow whose every node executed as authored reads `failed` on that
// attempt. The wait took that for a node fault and spent the full five-minute
// recovery-record wait on a recovery Core had already declined to plan --
// 568 s of `run-muher0en-508ddb69`'s 949 s, against 192 s of exploration and
// 12.6 s of Flow actions.
test("a run refuted on its result takes the grace, not the five-minute recovery wait", async () => {
  const detail = {
    summaryStatus: "failed",
    actions: [
      { status: "succeeded", nodeId: "n1" },
      { status: "succeeded", nodeId: "n2" },
      // Executed, then refuted: Core's own stage word for the verdict.
      { status: "failed", nodeId: "n3", failure: { stage: "verification" } }
    ],
    resultVerification: "refuted",
    runDetail: {}
  };
  let clock = 0;
  const settled = await awaitTerminalRunDetail(
    async () => detail,
    new Error("unused"),
    {
      now: () => clock,
      sleep: async (ms: number) => { clock += ms; },
      timeoutMs: 272_500,
      awaitRecovery: true,
      recoveryWaitMs: 300_000,
      recoveryGraceMs: 5_000
    }
  );
  assert.equal(settled.unsettled, "recovery");
  // The grace, not the wait: five seconds rather than five minutes.
  assert.ok(clock <= 5_000 + TERMINAL_DETAIL_POLL_MS, `waited ${clock}ms`);
});

test("a run with a node that would not run still takes the full recovery wait", async () => {
  const detail = {
    summaryStatus: "failed",
    actions: [
      { status: "succeeded", nodeId: "n1" },
      // A node fault, which Core's recovery can plan from, so the record may
      // genuinely be coming.
      { status: "failed", nodeId: "n2", failure: { stage: "dispatch" } }
    ],
    resultVerification: null,
    runDetail: {}
  };
  let clock = 0;
  const settled = await awaitTerminalRunDetail(
    async () => detail,
    new Error("unused"),
    {
      now: () => clock,
      sleep: async (ms: number) => { clock += ms; },
      timeoutMs: 272_500,
      awaitRecovery: true,
      recoveryWaitMs: 300_000,
      recoveryGraceMs: 5_000
    }
  );
  assert.equal(settled.unsettled, "recovery");
  assert.ok(clock > 5_000 + TERMINAL_DETAIL_POLL_MS, `waited only ${clock}ms`);
});

// Core's own marker on the recovery, not a fixed guess.
//
// Core saves a failed run before its recovery starts and the recovery record
// only with the recovery's last save. When the recovery threw, no record was
// ever written, and the wait spent its whole five minutes on one. Core now
// marks the recovery on the run detail (`metadata.recoveryState`), and the wait
// follows the marker.
function markedRun(recoveryState?: Record<string, unknown>, record = false) {
  return {
    summaryStatus: "failed",
    actions: [{ status: "failed", nodeId: "n1", failure: { stage: "dispatch" } }],
    resultVerification: null,
    runDetail: { metadata: { ...(recoveryState ? { recoveryState } : {}), ...(record ? { llmGate: { decision: "allowed" } } : {}) } }
  };
}

async function waitOn(reads: (clock: number) => ReturnType<typeof markedRun>) {
  let clock = 0;
  const settled = await awaitTerminalRunDetail(
    async () => reads(clock),
    new Error("unused"),
    { now: () => clock, sleep: async (ms: number) => { clock += ms; }, timeoutMs: 400_000, awaitRecovery: true, recoveryWaitMs: 300_000, recoveryGraceMs: 5_000 }
  );
  return { settled, clock };
}

test("a recovery Core still marks running is waited for up to the live-run deadline, past the fixed five minutes", async () => {
  // Core finishes the recovery at 400 s, which the fixed wait would have missed.
  const { settled, clock } = await waitOn((now) => now < 400_000 ? markedRun({ state: "running", startedAt: 1 }) : markedRun({ state: "ended", startedAt: 1, endedAt: 2 }, true));
  assert.equal(settled.unsettled, undefined);
  assert.equal(settled.recoveryState, undefined);
  assert.ok(clock >= 400_000 && clock < 400_000 + 2 * TERMINAL_DETAIL_POLL_MS, `waited ${clock}ms`);
});

test("a recovery still running when the lease runs out is returned unsettled and named", async () => {
  const { settled, clock } = await waitOn(() => markedRun({ state: "running", startedAt: 1 }));
  assert.equal(settled.unsettled, "recovery");
  assert.equal(settled.recoveryState, "recovery.still_running");
  assert.equal(clock, TERMINAL_DETAIL_MAX_WAIT_MS);
});

test("a recovery Core marked threw or ended with no record stops at once and is named", async () => {
  for (const [state, code] of [["threw", "recovery.threw"], ["ended", "recovery.ended_without_record"]] as const) {
    // A read before the marker lands, then the marker.
    const { settled, clock } = await waitOn((now) => now === 0 ? markedRun() : markedRun({ state, startedAt: 1, endedAt: 2, ...(state === "threw" ? { code: "recovery.threw" } : {}) }));
    assert.equal(settled.unsettled, "recovery");
    assert.equal(settled.recoveryState, code);
    assert.equal(clock, TERMINAL_DETAIL_POLL_MS, `waited ${clock}ms`);
  }
});

test("a recovery that wrote its record is done, whatever the marker says", async () => {
  const { settled, clock } = await waitOn(() => markedRun({ state: "ended", startedAt: 1, endedAt: 2 }, true));
  assert.equal(settled.unsettled, undefined);
  assert.equal(settled.recoveryState, undefined);
  assert.equal(clock, 0);
});

test("a run with no marker keeps the fixed recovery wait and names nothing", async () => {
  const { settled, clock } = await waitOn(() => markedRun());
  assert.equal(settled.unsettled, "recovery");
  assert.equal(settled.recoveryState, undefined);
  assert.equal(clock, 300_000);
});
