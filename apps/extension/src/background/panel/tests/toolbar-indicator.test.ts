// Coverage of toolbar-badge.ts and toolbar-indicator.ts: what the toolbar says
// while recording and running, "!" while the work waits on the person (a run
// held for them, a question, a check), that "..." survives the gap between two steps
// and then clears on its own, and that the badge is written only on a change.

import assert from "node:assert/strict";
import test from "node:test";

import type { ExtensionStatus, RuntimeCommandStatus } from "../../../shared/protocol";
import { RUN_BADGE_HOLD_MS, toolbarBadge } from "../toolbar-badge";
import { ToolbarIndicator } from "../toolbar-indicator";

type BadgeStatus = Pick<ExtensionStatus, "recordingState" | "runtime">;

const idle: BadgeStatus = { recordingState: "idle", runtime: { state: "idle" } };
const running: BadgeStatus = { recordingState: "idle", runtime: { state: "running", startedAt: 100 } };
function finished(state: RuntimeCommandStatus["state"], finishedAt: number): BadgeStatus {
  return { recordingState: "idle", runtime: { state, finishedAt } };
}

test("REC while recording, whatever is running; ... while a step runs; nothing otherwise", () => {
  assert.deepEqual(toolbarBadge({ recordingState: "recording", runtime: { state: "running" } }, 0), { text: "REC" });
  assert.deepEqual(toolbarBadge(running, 0), { text: "..." });
  assert.deepEqual(toolbarBadge(idle, 0), { text: "" });
  assert.deepEqual(toolbarBadge({ recordingState: "idle" }, 0), { text: "" });
});

test("... holds after a step finishes, succeeded or failed, then clears", () => {
  assert.deepEqual(toolbarBadge(finished("succeeded", 1_000), 1_000 + RUN_BADGE_HOLD_MS - 1), { text: "...", recheckAt: 1_000 + RUN_BADGE_HOLD_MS });
  assert.deepEqual(toolbarBadge(finished("failed", 1_000), 2_000), { text: "...", recheckAt: 1_000 + RUN_BADGE_HOLD_MS });
  assert.deepEqual(toolbarBadge(finished("succeeded", 1_000), 1_000 + RUN_BADGE_HOLD_MS), { text: "" });
});

function clock() {
  let now = 0;
  const pending: Array<{ at: number; callback: () => void; handle: number }> = [];
  let next = 1;
  return {
    timers: {
      now: () => now,
      setTimeout: (callback: () => void, delayMs: number) => {
        const handle = next++;
        pending.push({ at: now + delayMs, callback, handle });
        return handle;
      },
      clearTimeout: (handle: unknown) => {
        const index = pending.findIndex((entry) => entry.handle === handle);
        if (index >= 0) pending.splice(index, 1);
      }
    },
    advance(to: number) {
      now = to;
      for (const entry of pending.filter((candidate) => candidate.at <= to)) {
        pending.splice(pending.indexOf(entry), 1);
        entry.callback();
      }
    },
    pendingCount: () => pending.length
  };
}

test("the indicator writes only on a change, and clears ... by itself when the hold runs out", () => {
  const written: string[] = [];
  const c = clock();
  const indicator = new ToolbarIndicator((text) => written.push(text), c.timers);

  indicator.update(idle);
  indicator.update(idle);
  indicator.update(running);
  indicator.update(running);
  c.advance(500);
  indicator.update(finished("succeeded", 500));
  assert.deepEqual(written, ["", "..."]);
  assert.equal(c.pendingCount(), 1);

  c.advance(500 + RUN_BADGE_HOLD_MS);
  assert.deepEqual(written, ["", "...", ""]);
  assert.equal(c.pendingCount(), 0);
});

test("a step that starts inside the hold keeps ... up without a blink", () => {
  const written: string[] = [];
  const c = clock();
  const indicator = new ToolbarIndicator((text) => written.push(text), c.timers);

  indicator.update(running);
  c.advance(1_000);
  indicator.update(finished("succeeded", 1_000));
  c.advance(3_000);
  indicator.update({ recordingState: "idle", runtime: { state: "running", startedAt: 3_000 } });
  c.advance(1_000 + RUN_BADGE_HOLD_MS);

  assert.deepEqual(written, ["..."]);
  assert.equal(c.pendingCount(), 0);
});

test("recording replaces ... and clears when the recording ends", () => {
  const written: string[] = [];
  const indicator = new ToolbarIndicator((text) => written.push(text), clock().timers);
  indicator.update(running);
  indicator.update({ recordingState: "recording", runtime: { state: "idle" } });
  indicator.update(idle);
  assert.deepEqual(written, ["...", "REC", ""]);
});

test("! while the work waits on the person, over ...; REC keeps priority", () => {
  const waiting = { outcome: "waiting" as const };
  assert.deepEqual(toolbarBadge(idle, 0, waiting), { text: "!" });
  assert.deepEqual(toolbarBadge(running, 0, waiting), { text: "!" });
  assert.deepEqual(toolbarBadge({ recordingState: "recording", runtime: { state: "idle" } }, 0, waiting), { text: "REC" });
  assert.deepEqual(toolbarBadge(running, 0, { outcome: null }), { text: "..." });
  assert.deepEqual(toolbarBadge(idle, 0, { outcome: "failed" }), { text: "" });
});

test("the indicator shows ! when the activity starts waiting and clears it when the run continues", () => {
  const written: string[] = [];
  const indicator = new ToolbarIndicator((text) => written.push(text), clock().timers);
  indicator.update(running);
  indicator.activity({ outcome: null });
  indicator.activity({ outcome: "waiting" });
  indicator.activity({ outcome: "waiting" });
  indicator.update(idle);
  indicator.activity({ outcome: null });
  indicator.activity(null);
  assert.deepEqual(written, ["...", "!", ""]);
});
