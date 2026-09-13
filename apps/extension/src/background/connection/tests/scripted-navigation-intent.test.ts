import assert from "node:assert/strict";
import test from "node:test";

import { ScriptedNavigationIntent } from "../scripted-navigation-intent";

type Timer = ReturnType<typeof setTimeout>;

function harness(options: { recording?: boolean; tabId?: number; pendingSend?: boolean; sendError?: unknown } = {}) {
  let recording = options.recording ?? true;
  let tabId: number | undefined = options.tabId === undefined ? 7 : options.tabId;
  const recorded: Array<{ tabId: number; url: string; timestamp: number }> = [];
  const timers = new Map<Timer, { callback: () => void; delayMs: number }>();
  let clock = 1_000;
  let timerId = 0;
  let releaseSend: (() => void) | undefined;
  const sendGate = options.pendingSend ? new Promise<void>((resolve) => { releaseSend = resolve; }) : Promise.resolve();
  const scheduleTimer = (callback: () => void, delayMs: number): Timer => {
    const id = ++timerId as unknown as Timer;
    timers.set(id, { callback: () => { timers.delete(id); callback(); }, delayMs });
    return id;
  };
  const intents = new ScriptedNavigationIntent({
    recordingState: () => recording ? "recording" : "idle",
    activeTabId: () => tabId,
    recordNavigation: async (ownedTabId, url, timestamp) => {
      recorded.push({ tabId: ownedTabId, url, timestamp });
      await sendGate;
      if (options.sendError !== undefined) throw options.sendError;
    },
    createId: () => "intent-1",
    now: () => clock,
    setTimer: scheduleTimer,
    clearTimer: (timer) => { if (timer !== undefined) timers.delete(timer); }
  });
  return {
    intents,
    get scheduled() { return [...timers.values()].filter(timer => timer.delayMs === 250).map(timer => ({ callback: timer.callback })); },
    recorded,
    timers,
    setRecording: (value: boolean) => { recording = value; },
    setTab: (value: number | undefined) => { tabId = value; },
    releaseSend: () => releaseSend?.(),
    fireDelay: (delayMs: number) => {
      const entry = [...timers.entries()].find(([, timer]) => timer.delayMs === delayMs);
      if (!entry) return;
      timers.delete(entry[0]);
      clock += delayMs;
      entry[1].callback();
    },
    advance: (delayMs: number) => { clock += delayMs; },
    scheduleOrdinary: (callback: () => void) => scheduleTimer(callback, 250),
    timerDelays: () => [...timers.values()].map(timer => timer.delayMs).sort((a, b) => a - b),
    expireFirst: () => {
      const entry = [...timers.entries()][0];
      if (!entry) return;
      timers.delete(entry[0]);
      clock += entry[1].delayMs;
      entry[1].callback();
    }
  };
}

function commit(transitionType = "link", url = "http://127.0.0.1:4173/final", tabId = 7, frameId = 0) {
  return { tabId, frameId, url, transitionType, timeStamp: 123 } as chrome.webNavigation.WebNavigationTransitionCallbackDetails;
}

async function pending(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  void promise.then(() => { settled = true; });
  await Promise.resolve();
  return !settled;
}

test("arm validates a bounded loopback destination and current recording tab", () => {
  const h = harness();
  for (const url of ["", "https://example.test/final", "http://user:pass@127.0.0.1/final", "http://localhost/final?q=x", "http://localhost/final#x"]) {
    assert.deepEqual(h.intents.arm(url), { ok: false, code: "invalid_request" });
  }
  h.setRecording(false);
  assert.deepEqual(h.intents.arm("http://localhost/final"), { ok: false, code: "not_recording" });
  h.setRecording(true);
  h.setTab(undefined);
  assert.deepEqual(h.intents.arm("http://localhost/final"), { ok: false, code: "no_automation_tab" });
  h.setTab(7);
  assert.deepEqual(h.intents.arm("http://127.0.0.1:4173/final"), { ok: true, intentId: "intent-1" });
  assert.deepEqual(h.intents.arm("http://localhost/final"), { ok: false, code: "busy" });
});

test("the owned top-frame commit ignores transition labels and redirect-debounces to one send", async () => {
  for (const transition of ["typed", "link", "other", "reload"]) {
    const h = harness();
    h.intents.arm("http://127.0.0.1:4173/final");
    assert.equal(h.intents.claimCommit(commit(transition)), true);
    assert.equal(h.intents.claimCommit(commit(transition, "http://127.0.0.1:4173/final#ignored")), true);
    assert.equal(h.scheduled.length, 1);
    h.scheduled[0]?.callback();
    assert.deepEqual(await h.intents.await("intent-1"), { ok: true, intentId: "intent-1" });
    assert.deepEqual(h.recorded, [{ tabId: 7, url: "http://127.0.0.1:4173/final", timestamp: 123 }]);
  }
});

test("another tab and a subframe are unowned; a wrong settled destination fails closed", async () => {
  const h = harness();
  h.intents.arm("http://localhost/final");
  assert.equal(h.intents.claimCommit(commit("typed", "http://localhost/final", 8)), false);
  assert.equal(h.intents.claimCommit(commit("typed", "http://localhost/final", 7, 2)), false);
  assert.equal(h.intents.claimCommit(commit("link", "http://localhost/wrong")), true);
  h.scheduled[0]?.callback();
  assert.deepEqual(await h.intents.await("intent-1"), { ok: false, code: "destination_mismatch" });
  assert.deepEqual(h.recorded, []);
});

test("acknowledgement waits for send and cancellation wins over a late send", async () => {
  const h = harness({ pendingSend: true });
  h.intents.arm("http://localhost/final");
  h.intents.claimCommit(commit("other", "http://localhost/final"));
  h.scheduled[0]?.callback();
  const acknowledgement = h.intents.await("intent-1");
  assert.equal(await pending(acknowledgement), true);
  assert.equal(h.intents.cancel("intent-1"), true);
  assert.deepEqual(await acknowledgement, { ok: false, code: "cancelled" });
  h.releaseSend();
  await Promise.resolve();
  assert.equal(h.intents.cancel("intent-1"), false);
});

test("expiry, tab close, recording stop, and idempotent cancellation settle with fixed results", async () => {
  const expired = harness();
  expired.intents.arm("http://localhost/final");
  const expiry = expired.intents.await("intent-1");
  expired.expireFirst();
  assert.deepEqual(await expiry, { ok: false, code: "expired" });
  assert.deepEqual(await expired.intents.await("intent-1"), { ok: false, code: "unknown_intent" });
  assert.equal(expired.timers.size, 0);

  const closed = harness();
  closed.intents.arm("http://localhost/final");
  closed.intents.cancelTab(7);
  assert.deepEqual(await closed.intents.await("intent-1"), { ok: false, code: "tab_closed" });

  const stopped = harness();
  stopped.intents.arm("http://localhost/final");
  stopped.intents.cancelAll("recording_stopped");
  assert.deepEqual(await stopped.intents.await("intent-1"), { ok: false, code: "recording_stopped" });

  const cancelled = harness();
  cancelled.intents.arm("http://localhost/final");
  assert.equal(cancelled.intents.cancel("intent-1"), true);
  assert.equal(cancelled.intents.cancel("intent-1"), false);
  assert.deepEqual(await cancelled.intents.await("intent-1"), { ok: false, code: "cancelled" });
  assert.deepEqual(await cancelled.intents.await("intent-1"), { ok: false, code: "unknown_intent" });
});

test("ordinary landing and intent redirect debounces survive independently exactly once", async () => {
  const h = harness();
  let ordinaryLanding = 0;
  h.scheduleOrdinary(() => { ordinaryLanding += 1; });
  h.intents.arm("http://localhost/final");
  h.intents.claimCommit(commit("link", "http://localhost/intermediate"));
  h.intents.claimCommit(commit("link", "http://localhost/final#settled"));
  assert.equal(h.scheduled.length, 2, "ordinary and redirect-replaced intent callbacks have independent slots");
  for (const scheduled of h.scheduled) scheduled.callback();
  assert.deepEqual(await h.intents.await("intent-1"), { ok: true, intentId: "intent-1" });
  assert.equal(ordinaryLanding, 1);
  assert.equal(h.recorded.length, 1);
});

test("terminal retention never extends the original arm deadline", async () => {
  const early = harness();
  early.intents.arm("http://localhost/final");
  early.intents.cancel("intent-1");
  assert.deepEqual(early.timerDelays(), [30_000]);

  const late = harness();
  late.intents.arm("http://localhost/final");
  late.advance(29_900);
  late.intents.cancel("intent-1");
  assert.deepEqual(late.timerDelays(), [100]);
});

test("a rejected recording send settles with only send_failed", async () => {
  const h = harness({ sendError: new Error("private gateway text") });
  h.intents.arm("http://localhost/final");
  h.intents.claimCommit(commit("typed", "http://localhost/final"));
  h.scheduled[0]?.callback();
  assert.deepEqual(await h.intents.await("intent-1"), { ok: false, code: "send_failed" });
});
