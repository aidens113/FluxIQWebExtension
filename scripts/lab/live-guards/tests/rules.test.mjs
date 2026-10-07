// Each live-run rule refuses what it exists to refuse and admits the rest,
// and the override files let a run past only the rules that allow it.

import assert from "node:assert/strict";
import test from "node:test";
import { checkBalanceStop, checkBehindDev, checkPeakHours, checkPreviousDebug, checkRelaunchLoop, checkUnchangedRerun, evaluateLiveGuards, guardFiles } from "../index.mjs";

// Wednesday 2026-09-30 12:00 UTC: off-peak in every time zone the tests run in,
// so no rule but `peak` depends on when the suite runs.
const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);
/** A UTC instant on 2026-09-30 (Wednesday) or, with `day`, another day of that week. */
const utc = (hour, minute = 0, day = 30) => Date.UTC(2026, 8, day, hour, minute, 0);
const at = (msAgo) => new Date(NOW - msAgo).toISOString();
const MINUTE = 60_000;

/** A checkout whose HEAD contains its local dev. */
const level = (root) => ({ root, head: "a".repeat(40), dev: "a".repeat(40), contains: true, lacking: 0, error: null });

function state(overrides = {}) {
  return {
    now: NOW,
    launch: { instance: "slot-1", task: "bigbox-retail/bigbox-retail-pickup-cart" },
    stopBalance: null,
    entries: [],
    fingerprint: "sha256:current",
    devAncestry: { repository: level("/web"), core: level("/core") },
    hasDebug: () => true,
    debugPath: (runId) => `debugs/${runId}.md`,
    files: guardFiles("/slots"),
    ...overrides,
  };
}

const finish = (fields) => ({ event: "finish", launchId: "launch-x", at: at(60 * MINUTE), instance: "slot-1", task: "bigbox-retail/bigbox-retail-pickup-cart", runId: "run-a", verdict: "failed", totalEstimatedCostUsd: 0.1, balanceFailure: null, fingerprint: "sha256:current", exitCode: 1, ...fields });
const start = (msAgo, instance = "slot-1") => ({ event: "start", launchId: `launch-${msAgo}`, at: at(msAgo), pid: 1, instance, scenarioId: "bigbox-retail", task: "t", fingerprint: "f", repositoryRoot: "/r", runsDirectory: "/runs", overridden: [] });

test("balance: a STOP-balance file refuses every run, whatever override files exist", () => {
  assert.equal(checkBalanceStop(state()), null);
  const stopped = state({ stopBalance: "Run run-a ended on an empty balance at deepseek: Insufficient Balance.\nmore" });
  const refusal = checkBalanceStop(stopped);
  assert.equal(refusal.rule, "balance");
  assert.match(refusal.why, /Insufficient Balance\.$/u);
  assert.match(refusal.remedy, /STOP-balance by hand/u);
  assert.deepEqual(evaluateLiveGuards(stopped, new Set(["balance", "peak", "behind-dev", "loop", "debug", "unchanged"])).refusals.map((each) => each.rule), ["balance"]);
});

test("unchanged: a failed task is not rerun on the same source, but is after a change, after a pass, or for another task", () => {
  const failed = [finish({})];
  const refusal = checkUnchangedRerun(state({ entries: failed }));
  assert.equal(refusal.rule, "unchanged");
  assert.match(refusal.why, /run-a, which ended failed/u);
  assert.equal(checkUnchangedRerun(state({ entries: failed, fingerprint: "sha256:changed" })), null);
  assert.equal(checkUnchangedRerun(state({ entries: [finish({ verdict: "passed" })] })), null);
  assert.equal(checkUnchangedRerun(state({ entries: [finish({ task: "other/task" })] })), null);
  assert.equal(checkUnchangedRerun(state({ entries: [finish({ instance: "slot-2" })] })), null);
  // Only the latest run of the task counts: a later pass clears an earlier failure.
  assert.equal(checkUnchangedRerun(state({ entries: [finish({ runId: "run-old" }), finish({ runId: "run-new", verdict: "passed", at: at(MINUTE) })] })), null);
  assert.deepEqual(evaluateLiveGuards(state({ entries: failed }), new Set(["unchanged"])).overridden, ["unchanged"]);
});

test("debug: the next live run waits for the previous run's debug file, in any task", () => {
  const entries = [finish({ runId: "run-undebugged", task: "other/task", verdict: "passed" })];
  const refusal = checkPreviousDebug(state({ entries, hasDebug: (runId) => runId !== "run-undebugged" }));
  assert.equal(refusal.rule, "debug");
  assert.match(refusal.why, /run-undebugged, has no debug file at debugs\/run-undebugged\.md/u);
  assert.equal(checkPreviousDebug(state({ entries, hasDebug: () => true })), null);
  // A launch that produced no run has nothing to debug.
  assert.equal(checkPreviousDebug(state({ entries: [finish({ runId: null })], hasDebug: () => false })), null);
  assert.equal(checkPreviousDebug(state({ entries: [finish({ instance: "slot-2" })], hasDebug: () => false })), null);
});

test("loop: a fourth start within 30 minutes on one instance is refused; older starts and other instances do not count", () => {
  const two = [start(5 * MINUTE), start(10 * MINUTE)];
  assert.equal(checkRelaunchLoop(state({ entries: two })), null);
  const three = [...two, start(29 * MINUTE)];
  const refusal = checkRelaunchLoop(state({ entries: three }));
  assert.equal(refusal.rule, "loop");
  assert.match(refusal.why, /already started 3 live runs/u);
  assert.match(refusal.remedy, new RegExp(new Date(NOW + MINUTE).toISOString().replace(/[.]/gu, "\\.")));
  assert.equal(checkRelaunchLoop(state({ entries: [...two, start(31 * MINUTE)] })), null);
  assert.equal(checkRelaunchLoop(state({ entries: [...two, start(1 * MINUTE, "slot-2")] })), null);
});

test("behind-dev: a checkout or Core whose HEAD lacks its dev is refused, naming each side; one git could not read is refused with git's reason", () => {
  assert.equal(checkBehindDev(state()), null);
  const behind = { ...level("/web"), head: "b".repeat(40), contains: false, lacking: 3 };
  const refusal = checkBehindDev(state({ devAncestry: { repository: behind, core: { ...level("/core"), root: "/core", error: "/core has no local dev branch (refs/heads/dev)", contains: false, head: null, dev: null, lacking: null } } }));
  assert.equal(refusal.rule, "behind-dev");
  assert.match(refusal.why, /this repository, \/web, is at bbbbbbb, which lacks 3 commit\(s\) of its local dev \(aaaaaaa\)/u);
  assert.match(refusal.why, /FluxIQ Core it builds against, \/core, could not be read: \/core has no local dev branch/u);
  assert.match(refusal.remedy, /In \/web and \/core, run `git merge dev`/u);
  assert.match(refusal.remedy, /OVERRIDE-behind-dev/u);
  assert.deepEqual(evaluateLiveGuards(state({ devAncestry: { repository: behind, core: level("/core") } }), new Set(["behind-dev"])).overridden, ["behind-dev"]);
});

test("evaluation reports every refusing rule, in order, so one refusal names them all", () => {
  const behind = { ...level("/web"), contains: false, lacking: 1 };
  const evaluated = evaluateLiveGuards(state({ stopBalance: "stopped", devAncestry: { repository: behind, core: level("/core") }, entries: [finish({}), start(1 * MINUTE), start(2 * MINUTE), start(3 * MINUTE)], hasDebug: () => false }), new Set());
  assert.deepEqual(evaluated.refusals.map((each) => each.rule), ["balance", "behind-dev", "loop", "debug", "unchanged"]);
});

test("peak: a weekday start inside 01:00-04:00 or 06:00-10:00 UTC is refused, naming the window, the next off-peak start and the override file", () => {
  const early = checkPeakHours(state({ now: utc(2, 30) }));
  assert.equal(early.rule, "peak");
  assert.equal(early.overridable, true);
  assert.match(early.why, /01:00-04:00 UTC/u);
  assert.match(early.remedy, /2026-09-30T04:00:00\.000Z/u);
  assert.ok(early.remedy.includes(guardFiles("/slots").override("peak")));
  const morning = checkPeakHours(state({ now: utc(7, 15) }));
  assert.match(morning.why, /06:00-10:00 UTC/u);
  assert.match(morning.remedy, /2026-09-30T10:00:00\.000Z/u);
});

test("peak: each window's start is refused and its end admitted; the hours between and around them are off-peak", () => {
  const refused = (now) => checkPeakHours(state({ now })) !== null;
  assert.deepEqual([utc(1), utc(3, 59), utc(6), utc(9, 59)].map(refused), [true, true, true, true]);
  assert.deepEqual([utc(0, 59), utc(4), utc(5, 59), utc(10), utc(23, 59)].map(refused), [false, false, false, false, false]);
});

test("peak: a Saturday or Sunday (UTC) is off-peak all day; Monday and Friday are weekdays", () => {
  const refused = (day, hour) => checkPeakHours(state({ now: Date.UTC(2026, 9, day, hour, 0, 0) })) !== null;
  // 2026-10-03 is a Saturday, 10-04 a Sunday, 10-05 a Monday, 10-02 a Friday.
  assert.deepEqual([refused(3, 2), refused(3, 7), refused(4, 2), refused(4, 7)], [false, false, false, false]);
  assert.deepEqual([refused(5, 2), refused(2, 7)], [true, true]);
});

test("peak: only the OVERRIDE-peak file lets a peak-hour run past, and the refusal is listed after balance", () => {
  assert.deepEqual(evaluateLiveGuards(state({ now: utc(8) }), new Set(["peak"])), { refusals: [], overridden: ["peak"] });
  const evaluated = evaluateLiveGuards(state({ now: utc(8), stopBalance: "stopped" }), new Set());
  assert.deepEqual(evaluated.refusals.map((each) => each.rule), ["balance", "peak"]);
});
