import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, CDPSession, Page } from "@playwright/test";
import { RunnerFailure } from "../../failure.js";
import { runScriptedNavigation } from "../scripted-navigation.js";

const url = "http://127.0.0.1:4100/scenarios/navigation/history";
type Listener = (event: { frameId: string; loaderId: string; name: string }) => void;
type HarnessOptions = {
  commandError?: unknown;
  commandPending?: boolean;
  detachError?: unknown;
  detachPending?: boolean;
  errorText?: string | undefined;
  loadBeforeCommandResponse?: boolean;
  loaderId?: string | undefined;
  sessionError?: unknown;
  sessionPending?: boolean;
};

function harness(options: HarnessOptions = {}) {
  const calls: unknown[] = [];
  const listeners = new Set<Listener>();
  const timers = new Map<object, () => void>();
  let resolveSession!: (session: CDPSession) => void;
  const sessionGate = new Promise<CDPSession>((resolve) => { resolveSession = resolve; });
  const session = {
    on: (event: string, listener: Listener) => { calls.push(["on", event]); listeners.add(listener); return session; },
    off: (event: string, listener: Listener) => { calls.push(["off", event]); listeners.delete(listener); return session; },
    send: async (method: string, parameters?: unknown): Promise<Record<string, unknown>> => {
      calls.push(["send", method, parameters]);
      if (method !== "Page.navigate") return {};
      if (options.commandError) throw options.commandError;
      if (options.commandPending) return new Promise(() => undefined);
      const response: Record<string, unknown> = { frameId: "frame", loaderId: options.loaderId ?? "loader" };
      if ("errorText" in options) response.errorText = options.errorText;
      if (options.loadBeforeCommandResponse) {
        for (const listener of [...listeners]) listener({ frameId: "frame", loaderId: "loader", name: "load" });
      }
      return response;
    },
    detach: async () => {
      calls.push(["detach"]);
      if (options.detachError) throw options.detachError;
      if (options.detachPending) return new Promise<void>(() => undefined);
    },
  } as unknown as CDPSession;
  const context = {
    newCDPSession: () => {
      calls.push(["session"]);
      if (options.sessionError) return Promise.reject(options.sessionError);
      if (options.sessionPending) return sessionGate;
      return Promise.resolve(session);
    },
  } as unknown as BrowserContext;
  const page = { url: () => url } as unknown as Page;
  const timerOptions = {
    setTimer: (callback: () => void) => { const handle = {}; timers.set(handle, callback); return handle as ReturnType<typeof setTimeout>; },
    clearTimer: (handle: ReturnType<typeof setTimeout>) => { timers.delete(handle as unknown as object); },
  };
  return {
    calls,
    context,
    page,
    resolveSession: () => resolveSession(session),
    listenerCount: () => listeners.size,
    timerCount: () => timers.size,
    expire: () => { for (const callback of [...timers.values()]) callback(); },
    load: (frameId = "frame", loaderId = "loader") => {
      for (const listener of [...listeners]) listener({ frameId, loaderId, name: "load" });
    },
    timerOptions,
  };
}

async function reachNavigate(calls: unknown[]): Promise<void> {
  for (let attempt = 0; attempt < 10 && !calls.some((call) => Array.isArray(call) && call[1] === "Page.navigate"); attempt += 1) await Promise.resolve();
}

async function reachDetach(calls: unknown[]): Promise<void> {
  for (let attempt = 0; attempt < 10 && !calls.some((call) => Array.isArray(call) && call[0] === "detach"); attempt += 1) await Promise.resolve();
}

function options(h: ReturnType<typeof harness>, timeoutMs = 2_500) {
  return { timeoutMs, ...h.timerOptions };
}

test("enables lifecycle events before sending the exact typed Page.navigate request", async () => {
  const h = harness();
  const navigation = runScriptedNavigation(h.context, h.page, url, options(h));
  await reachNavigate(h.calls);
  assert.deepEqual(h.calls.slice(0, 5), [
    ["session"],
    ["on", "Page.lifecycleEvent"],
    ["send", "Page.enable", undefined],
    ["send", "Page.setLifecycleEventsEnabled", { enabled: true }],
    ["send", "Page.navigate", { url, transitionType: "typed" }],
  ]);
  h.load();
  await navigation;
  assert.deepEqual(h.calls.slice(-2), [["off", "Page.lifecycleEvent"], ["detach"]]);
  assert.equal(h.listenerCount(), 0);
  assert.equal(h.timerCount(), 0);
});

test("an already-current URL cannot satisfy the resulting new-document wait", async () => {
  const h = harness();
  let settled = false;
  const navigation = runScriptedNavigation(h.context, h.page, url, options(h)).then(() => { settled = true; });
  await reachNavigate(h.calls);
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
  assert.equal(settled, false, "the command response alone is not a new loaded document");
  h.load();
  await navigation;
  assert.equal(settled, true);
});

test("a matching load emitted before the command response closes the fast-event race", async () => {
  const h = harness({ loadBeforeCommandResponse: true });
  await runScriptedNavigation(h.context, h.page, url, options(h));
  assert.equal(h.listenerCount(), 0);
});

test("redirect lifecycle noise is ignored until the command's final document loads", async () => {
  const h = harness();
  let settled = false;
  const navigation = runScriptedNavigation(h.context, h.page, url, options(h)).then(() => { settled = true; });
  await reachNavigate(h.calls);
  h.load("frame", "redirect-loader");
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(h.calls.some((call) => Array.isArray(call) && call[0] === "detach"), false);
  h.load("frame", "loader");
  await navigation;
});

test("a pending CDP command is bounded and cleanup removes every owned resource", async () => {
  const h = harness({ commandPending: true });
  const navigation = runScriptedNavigation(h.context, h.page, url, options(h, 25));
  await reachNavigate(h.calls);
  h.expire();
  await assert.rejects(
    navigation,
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /command did not finish in time/u.test(error.message),
  );
  assert.deepEqual(h.calls.at(-1), ["detach"]);
  assert.equal(h.listenerCount(), 0);
  assert.equal(h.timerCount(), 0);
});

test("pending session acquisition is bounded and a late session is cleaned up", async () => {
  const h = harness({ sessionPending: true });
  const navigation = runScriptedNavigation(h.context, h.page, url, options(h, 25));
  await Promise.resolve();
  h.expire();
  await assert.rejects(
    navigation,
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /session acquisition did not finish in time/u.test(error.message),
  );
  assert.equal(h.listenerCount(), 0);
  assert.equal(h.timerCount(), 0);
  h.resolveSession();
  await reachDetach(h.calls);
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
  assert.deepEqual(h.calls.at(-1), ["detach"]);
  assert.equal(h.timerCount(), 0);
});

test("pending detach is bounded after success and after a primary failure", async () => {
  const success = harness({ detachPending: true });
  const successfulNavigation = runScriptedNavigation(success.context, success.page, url, options(success));
  await reachNavigate(success.calls);
  success.load();
  await reachDetach(success.calls);
  success.expire();
  await assert.rejects(
    successfulNavigation,
    (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /cleanup did not finish in time/u.test(error.message),
  );
  assert.equal(success.timerCount(), 0);

  const primary = harness({ commandError: new Error("command failed"), detachPending: true });
  const failedNavigation = runScriptedNavigation(primary.context, primary.page, url, options(primary));
  await reachDetach(primary.calls);
  primary.expire();
  await assert.rejects(
    failedNavigation,
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /rejected the scripted navigation command/u.test(error.message),
  );
  assert.equal(primary.timerCount(), 0);
});

test("command and protocol rejection dispose a still-pending document waiter", async () => {
  for (const [fixture, expected] of [
    [{ commandError: new Error("command failed") }, /rejected the scripted navigation command/u],
    [{ errorText: "navigation rejected" }, /could not navigate/u],
  ] as const) {
    const h = harness(fixture);
    await assert.rejects(
      runScriptedNavigation(h.context, h.page, url, options(h)),
      (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && expected.test(error.message),
    );
    assert.equal(h.listenerCount(), 0);
    assert.equal(h.timerCount(), 0);
    assert.deepEqual(h.calls.at(-1), ["detach"]);
  }
});

test("empty or undefined protocol error text is not a rejection", async () => {
  for (const errorText of ["", undefined]) {
    const h = harness({ errorText });
    const navigation = runScriptedNavigation(h.context, h.page, url, options(h));
    await reachNavigate(h.calls);
    h.load();
    await navigation;
  }
});

test("a same-document response without a loader is rejected and cleaned up", async () => {
  const h = harness({ loaderId: "" });
  await assert.rejects(
    runScriptedNavigation(h.context, h.page, url, options(h)),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /did not create a new document/u.test(error.message),
  );
  assert.equal(h.listenerCount(), 0);
  assert.equal(h.timerCount(), 0);
});

test("primary command, protocol, and load failures win over simultaneous detach failures", async () => {
  for (const [fixture, expire] of [
    [{ commandError: new Error("command failed"), detachError: new Error("detach failed") }, false],
    [{ errorText: "navigation rejected", detachError: new Error("detach failed") }, false],
    [{ commandPending: true, detachError: new Error("detach failed") }, true],
    [{ detachError: new Error("detach failed") }, true],
  ] as const) {
    const h = harness(fixture);
    const navigation = runScriptedNavigation(h.context, h.page, url, options(h));
    await reachNavigate(h.calls);
    if (expire) h.expire();
    await assert.rejects(navigation, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && !/cleanup/u.test(error.message));
    assert.deepEqual(h.calls.at(-1), ["detach"]);
  }
});

test("unsupported CDP and successful-navigation cleanup failures keep explicit categories", async () => {
  const unsupported = harness({ sessionError: new Error("unsupported") });
  await assert.rejects(
    runScriptedNavigation(unsupported.context, unsupported.page, url, options(unsupported)),
    (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /requires a Chromium CDP session/u.test(error.message),
  );

  const cleanup = harness({ detachError: new Error("detach failed") });
  const navigation = runScriptedNavigation(cleanup.context, cleanup.page, url, options(cleanup));
  await reachNavigate(cleanup.calls);
  cleanup.load();
  await assert.rejects(
    navigation,
    (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /session cleanup failed/u.test(error.message),
  );
});
