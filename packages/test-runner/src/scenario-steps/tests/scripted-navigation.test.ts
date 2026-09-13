import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { RunnerFailure } from "../../failure.js";
import { createScriptedNavigationDriver } from "../scripted-navigation.js";

const url = "http://127.0.0.1:4100/scenarios/navigation/history";
const intentId = "intent-123";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

type Message = { type: string; url?: string; intentId?: string };
type Fixture = {
  arm?: unknown | Promise<unknown>;
  acknowledge?: unknown | Promise<unknown>;
  cancel?: unknown | Promise<unknown>;
  gotoError?: unknown;
  gotoElapsedMs?: number;
};

function harness(fixture: Fixture = {}) {
  const calls: Array<Message | { goto: string; options: unknown }> = [];
  let clock = 1_000;
  let nextTimer = 1;
  const timers = new Map<number, { callback: () => void; delayMs: number }>();
  const response = (message: Message): unknown | Promise<unknown> => {
    if (message.type === "fluxiq.test.armScriptedNavigation") return fixture.arm ?? { ok: true, intentId };
    if (message.type === "fluxiq.test.awaitScriptedNavigation") return fixture.acknowledge ?? { ok: true, intentId };
    return fixture.cancel ?? { ok: true, cancelled: true };
  };
  const control = {
    evaluate: async (_callback: unknown, message: Message) => { calls.push(message); return response(message); },
  } as unknown as Page;
  const page = {
    goto: async (destination: string, options: unknown) => {
      calls.push({ goto: destination, options });
      if (fixture.gotoError !== undefined) throw fixture.gotoError;
      clock += fixture.gotoElapsedMs ?? 0;
      return null;
    },
  } as unknown as Page;
  const driver = createScriptedNavigationDriver(control, {
    now: () => clock,
    setTimer: (callback, delayMs) => { const id = nextTimer++; timers.set(id, { callback, delayMs }); return id as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: (id) => { timers.delete(id as unknown as number); },
    cleanupTimeoutMs: 20,
  });
  return {
    calls, page, driver,
    advance: (milliseconds: number) => { clock += milliseconds; },
    expire: () => { const timer = timers.values().next().value as { callback: () => void; delayMs: number } | undefined; assert.ok(timer); timer.callback(); },
    timerCount: () => timers.size,
    timerDelays: () => [...timers.values()].map(timer => timer.delayMs),
  };
}

test("arms, loads, awaits post-send acknowledgement, and cancels in exact order", async () => {
  const h = harness();
  await h.driver(h.page, url, 500);
  assert.deepEqual(h.calls, [
    { type: "fluxiq.test.armScriptedNavigation", url },
    { goto: url, options: { waitUntil: "load", timeout: 500 } },
    { type: "fluxiq.test.awaitScriptedNavigation", intentId },
    { type: "fluxiq.test.cancelScriptedNavigation", intentId },
  ]);
  assert.equal(h.timerCount(), 0);
});

test("waits for acknowledgement after load and gives it only the absolute deadline remainder", async () => {
  const acknowledgement = deferred<unknown>();
  const h = harness({ acknowledge: acknowledgement.promise, gotoElapsedMs: 300 });
  const navigation = h.driver(h.page, url, 500);
  await until(() => h.calls.some(call => "type" in call && call.type === "fluxiq.test.awaitScriptedNavigation"));
  assert.deepEqual(h.timerDelays(), [200]);
  let settled = false;
  void navigation.finally(() => { settled = true; }).catch(() => undefined);
  await Promise.resolve();
  assert.equal(settled, false);
  acknowledgement.resolve({ ok: true, intentId });
  await navigation;
  assert.equal(settled, true);
  assert.deepEqual(h.calls.at(-1), { type: "fluxiq.test.cancelScriptedNavigation", intentId });
});

test("an acknowledgement started with no deadline remaining is observed when it rejects late", async () => {
  const acknowledgement = deferred<unknown>();
  const h = harness({ acknowledge: acknowledgement.promise, gotoElapsedMs: 500 });
  await assert.rejects(h.driver(h.page, url, 500), failure("recording.persistence", /did not acknowledge/u));
  assert.deepEqual(h.calls.at(-1), { type: "fluxiq.test.cancelScriptedNavigation", intentId });
  acknowledgement.reject(new Error("private late transport text"));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.timerCount(), 0);
});

test("arm time is subtracted from the goto and acknowledgement deadline", async () => {
  const arm = deferred<unknown>();
  const h = harness({ arm: arm.promise });
  const navigation = h.driver(h.page, url, 500);
  h.advance(200);
  arm.resolve({ ok: true, intentId });
  await navigation;
  assert.deepEqual(h.calls[1], { goto: url, options: { waitUntil: "load", timeout: 300 } });
});

test("an arm timeout is authoritative and a late arm is cancelled once", async () => {
  const arm = deferred<unknown>();
  const h = harness({ arm: arm.promise });
  const navigation = h.driver(h.page, url, 25);
  await Promise.resolve();
  h.expire();
  await assert.rejects(navigation, failure("extension.worker", /did not arm/u));
  arm.resolve({ ok: true, intentId });
  await until(() => h.calls.filter(call => "type" in call && call.type === "fluxiq.test.cancelScriptedNavigation").length === 1 && h.timerCount() === 0);
  assert.equal(h.calls.some(call => "goto" in call), false);
  assert.equal(h.timerCount(), 0);
});

test("navigation rejection cancels without awaiting and preserves the primary failure", async () => {
  const h = harness({ gotoError: new Error("private page text"), cancel: Promise.reject(new Error("private cleanup text")) });
  await assert.rejects(h.driver(h.page, url), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "runtime.behavior");
    assert.equal(error.message.includes("private"), false);
    return true;
  });
  assert.equal(h.calls.some(call => "type" in call && call.type === "fluxiq.test.awaitScriptedNavigation"), false);
  assert.deepEqual(h.calls.at(-1), { type: "fluxiq.test.cancelScriptedNavigation", intentId });
});

test("a primary navigation failure wins over a cleanup timeout", async () => {
  const cancel = deferred<unknown>();
  const h = harness({ gotoError: new Error("page failed"), cancel: cancel.promise });
  const navigation = h.driver(h.page, url);
  await until(() => h.calls.some(call => "type" in call && call.type === "fluxiq.test.cancelScriptedNavigation"));
  h.expire();
  await assert.rejects(navigation, failure("runtime.behavior", /did not complete scripted navigation/u));
  assert.equal(h.timerCount(), 0);
});

test("missing or negative acknowledgement cancels once and maps only fixed codes", async () => {
  const pending = deferred<unknown>();
  const timeout = harness({ acknowledge: pending.promise, cancel: Promise.reject(new Error("private cleanup")) });
  const navigation = timeout.driver(timeout.page, url, 25);
  await until(() => timeout.calls.some(call => "type" in call && call.type === "fluxiq.test.awaitScriptedNavigation"));
  timeout.expire();
  await assert.rejects(navigation, failure("recording.persistence", /did not acknowledge/u));

  const refused = harness({ acknowledge: { ok: false, code: "send_failed" } });
  await assert.rejects(refused.driver(refused.page, url), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "recording.persistence");
    assert.deepEqual(error.details, { reasonCode: "send_failed" });
    assert.equal(error.message.includes("send_failed"), false);
    return true;
  });
});

test("an acknowledgement transport rejection is fixed extension.worker and still cancels", async () => {
  const h = harness({ acknowledge: Promise.reject(new Error("private acknowledgement transport text")) });
  await assert.rejects(h.driver(h.page, url), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "extension.worker");
    assert.equal(error.message.includes("private"), false);
    return true;
  });
  assert.deepEqual(h.calls.at(-1), { type: "fluxiq.test.cancelScriptedNavigation", intentId });
});

test("malformed IDs and acknowledgements never leak response text", async () => {
  for (const fixture of [
    { arm: { ok: true, intentId: "bad id", error: "private arm text" } },
    { acknowledge: { ok: true, intentId: "different", error: "private ack text" } },
  ]) {
    const h = harness(fixture);
    await assert.rejects(h.driver(h.page, url), (error: unknown) => error instanceof RunnerFailure && error.category === "extension.worker" && !error.message.includes("private"));
  }
});

test("every response shape rejects extra own fields without exposing them", async () => {
  const cases: Array<{ fixture: Fixture; category: RunnerFailure["category"] }> = [
    { fixture: { arm: { ok: true, intentId, url: "private arm page" } }, category: "extension.worker" },
    { fixture: { acknowledge: { ok: true, intentId, error: "private acknowledgement" } }, category: "extension.worker" },
    { fixture: { acknowledge: { ok: false, code: "send_failed", error: "private send failure" } }, category: "extension.worker" },
    { fixture: { cancel: { ok: true, cancelled: false, url: "private cleanup page" } }, category: "extension.worker" },
  ];
  for (const { fixture, category } of cases) {
    const h = harness(fixture);
    await assert.rejects(h.driver(h.page, url), (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, category);
      assert.equal(error.message.includes("private"), false);
      return true;
    });
  }
});

test("successful work requires bounded cleanup confirmation", async () => {
  const cancel = deferred<unknown>();
  const h = harness({ cancel: cancel.promise });
  const navigation = h.driver(h.page, url);
  await until(() => h.calls.some(call => "type" in call && call.type === "fluxiq.test.cancelScriptedNavigation"));
  h.expire();
  await assert.rejects(navigation, failure("extension.worker", /confirm scripted navigation cleanup/u));
  assert.equal(h.timerCount(), 0);
});

test("unsafe destinations fail before messages or navigation", async () => {
  for (const destination of [
    "https://example.com/path", "http://user:pass@localhost/path",
    "http://localhost/path?secret=yes", "http://localhost/path#fragment",
    `http://localhost/${"x".repeat(2_100)}`,
  ]) {
    const h = harness();
    await assert.rejects(h.driver(h.page, destination), failure("fixture.invalid", /safe loopback/u));
    assert.deepEqual(h.calls, []);
  }
});

function failure(category: RunnerFailure["category"], message: RegExp) {
  return (error: unknown) => error instanceof RunnerFailure && error.category === category && message.test(error.message);
}

async function until(predicate: () => boolean): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) { if (predicate()) return; await Promise.resolve(); }
  assert.fail("condition did not become true");
}
