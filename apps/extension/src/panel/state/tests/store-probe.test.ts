// The store re-reads the status while the panel waits on the background, so a
// worker that was stopped mid-pairing (crash, update, the browser's own kill)
// is noticed and woken within a few seconds instead of leaving a dead code on
// screen (t707 P1).

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import { statusWith } from "../../tests/status-fixture";
import { createPanelStore, PANEL_STATUS_PROBE_MS } from "..";

type Call = { type: string; reply(value: unknown): void; fail(message: string): void };

function fakeChrome(t: TestContext) {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  t.after(() => {
    holder.chrome = previous;
  });
  const calls: Call[] = [];
  const pushes: Array<(message: unknown) => void> = [];
  const runtime = {
    lastError: undefined as { message: string } | undefined,
    sendMessage(message: { type: string }, callback: (value: unknown) => void) {
      calls.push({
        type: message.type,
        reply: (value) => callback(value),
        fail: (text) => {
          runtime.lastError = { message: text };
          callback(undefined);
          runtime.lastError = undefined;
        }
      });
    },
    onMessage: { addListener(listener: (message: unknown) => void) { pushes.push(listener); } }
  };
  holder.chrome = { runtime };
  return {
    calls,
    push(next: ExtensionStatus) {
      for (const listener of pushes) listener({ type: RUNTIME_MESSAGES.statusChanged, status: next });
    }
  };
}

function fakeTimers() {
  const queued: Array<{ run: () => void; ms: number }> = [];
  return {
    queued,
    schedule: (run: () => void, ms: number) => {
      queued.push({ run, ms });
    },
    /** Runs every timer due now, as the clock reaching them would. */
    fire() {
      const due = queued.splice(0);
      for (const timer of due) timer.run();
    }
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const pairing = statusWith({ connectionState: "pairing", pairingReferenceCode: "114605" });

test("while pairing, the store re-reads the status every few seconds; that read wakes a stopped worker", async (t) => {
  const chrome = fakeChrome(t);
  const timers = fakeTimers();
  createPanelStore({ schedule: timers.schedule });
  chrome.calls[0]!.reply({ ok: true, status: pairing });
  await settle();
  assert.equal(timers.queued.length, 1, "a probe is scheduled while pairing");
  assert.ok(timers.queued[0]!.ms <= 5000, "within a few seconds");
  assert.equal(timers.queued[0]!.ms, PANEL_STATUS_PROBE_MS);
  timers.fire();
  assert.equal(chrome.calls.length, 2);
  assert.equal(chrome.calls[1]!.type, RUNTIME_MESSAGES.getStatus);
});

test("a restarted worker that no longer holds the pairing drops the code and says the wait was lost", async (t) => {
  const chrome = fakeChrome(t);
  const timers = fakeTimers();
  const store = createPanelStore({ schedule: timers.schedule });
  chrome.calls[0]!.reply({ ok: true, status: pairing });
  await settle();
  timers.fire();
  chrome.calls[1]!.reply({ ok: true, status: statusWith() });
  await settle();
  assert.equal(store.current()?.connectionState, "disconnected");
  assert.equal(store.current()?.pairingReferenceCode, undefined);
  assert.equal(store.lost(), "pairing");
  assert.equal(timers.queued.length, 0, "nothing to wait on any more, so probing stops");
});

test("a probe the background cannot answer marks the pairing lost and keeps trying", async (t) => {
  const chrome = fakeChrome(t);
  const timers = fakeTimers();
  const store = createPanelStore({ schedule: timers.schedule });
  const seen: Array<string | undefined> = [];
  chrome.calls[0]!.reply({ ok: true, status: pairing });
  await settle();
  store.subscribe(() => seen.push(store.lost()));
  timers.fire();
  chrome.calls[1]!.fail("Could not establish connection. Receiving end does not exist.");
  await settle();
  assert.equal(store.lost(), "pairing");
  assert.deepEqual(seen, [undefined, "pairing"], "subscribers redraw when the loss is found");
  assert.equal(timers.queued.length, 1);
  timers.fire();
  chrome.calls[2]!.reply({ ok: true, status: pairing });
  await settle();
  assert.equal(store.lost(), undefined, "a background that still holds the pairing ends the loss");
});

test("a pairing the background still holds keeps the code and is not lost", async (t) => {
  const chrome = fakeChrome(t);
  const timers = fakeTimers();
  const store = createPanelStore({ schedule: timers.schedule });
  chrome.calls[0]!.reply({ ok: true, status: pairing });
  await settle();
  timers.fire();
  chrome.calls[1]!.reply({ ok: true, status: pairing });
  await settle();
  assert.equal(store.current()?.pairingReferenceCode, "114605");
  assert.equal(store.lost(), undefined);
  assert.equal(timers.queued.length, 1, "still waiting, so still probing");
});

test("a person's Disconnect pushed by a live background is not a loss", async (t) => {
  const chrome = fakeChrome(t);
  const timers = fakeTimers();
  const store = createPanelStore({ schedule: timers.schedule });
  chrome.calls[0]!.reply({ ok: true, status: pairing });
  await settle();
  chrome.push(statusWith());
  assert.equal(store.lost(), undefined);
  timers.fire();
  assert.equal(chrome.calls.length, 1, "a due probe with nothing to wait on sends nothing");
});

test("a push that lands while a probe is in flight wins over the probe's older answer", async (t) => {
  const chrome = fakeChrome(t);
  const timers = fakeTimers();
  const store = createPanelStore({ schedule: timers.schedule });
  chrome.calls[0]!.reply({ ok: true, status: pairing });
  await settle();
  timers.fire();
  chrome.push(statusWith({ connectionState: "connected", paired: true }));
  chrome.calls[1]!.reply({ ok: true, status: statusWith() });
  await settle();
  assert.equal(store.current()?.connectionState, "connected");
  assert.equal(store.lost(), undefined);
});

test("pressing Connect after a loss clears it once the background is connecting again", async (t) => {
  const chrome = fakeChrome(t);
  const timers = fakeTimers();
  const store = createPanelStore({ schedule: timers.schedule });
  chrome.calls[0]!.reply({ ok: true, status: pairing });
  await settle();
  timers.fire();
  chrome.calls[1]!.reply({ ok: true, status: statusWith() });
  await settle();
  const connecting = store.request({ type: RUNTIME_MESSAGES.connect });
  chrome.calls[2]!.reply({ ok: true, status: statusWith({ connectionState: "connecting" }) });
  await connecting;
  assert.equal(store.lost(), undefined);
  assert.equal(timers.queued.length, 1, "connecting is a wait too");
});
