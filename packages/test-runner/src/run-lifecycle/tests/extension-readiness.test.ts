import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { awaitExtensionWorker } from "../extension-readiness.js";

type ExtensionServiceWorker = { url(): string };
type ExtensionWorkerContext = {
  serviceWorkers(): readonly ExtensionServiceWorker[];
  on(event: "serviceworker", listener: (worker: ExtensionServiceWorker) => void): unknown;
  off(event: "serviceworker", listener: (worker: ExtensionServiceWorker) => void): unknown;
  browser(): { isConnected(): boolean } | null;
};

test("observation zero returns an existing Chrome extension worker without subscribing", async () => {
  const extension = worker("chrome-extension://abcdefghijkl/background.js");
  const context = fakeContext([extension]);
  assert.equal(await awaitExtensionWorker(context), extension);
  assert.equal(context.listenerCount(), 0);
  assert.equal(context.timerCount(), 0);
});

test("a Chrome extension worker arriving after the old ten-second boundary is accepted", async () => {
  const context = fakeContext([]);
  const readiness = awaitExtensionWorker(context, context.timerOptions());
  assert.equal(context.nextDelay(), 30_000);
  const extension = worker("chrome-extension://abcdefghijkl/background.js");
  context.emit(extension, 12_000);
  assert.equal(await readiness, extension);
  assert.equal(context.listenerCount(), 0);
  assert.equal(context.timerCount(), 0);
});

test("an unrelated service worker is observed but never accepted", async () => {
  const context = fakeContext([]);
  const readiness = awaitExtensionWorker(context, context.timerOptions());
  context.emit(worker("https://fixture.example/sw.js"), 1_000);
  const extension = worker("chrome-extension://abcdefghijkl/background.js");
  context.emit(extension, 15_000);
  assert.equal(await readiness, extension);
});

test("timeout diagnostics are bounded, secret-safe, and cleanup the listener and timer", async () => {
  const context = fakeContext([], false);
  const readiness = awaitExtensionWorker(context, context.timerOptions());
  context.emit(worker("https://private.example/secret-worker.js"), 2_000);
  context.expire(30_000);
  await assert.rejects(readiness, (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "extension.worker");
    assert.equal(error.message, "Timed out waiting for the Chrome extension service worker");
    assert.deepEqual(error.details, {
      timeoutMs: 30_000,
      observedWorkerCount: 1,
      browserConnected: false,
    });
    assert.doesNotMatch(JSON.stringify(error), /private|https:|secret-worker/u);
    return true;
  });
  assert.equal(context.listenerCount(), 0);
  assert.equal(context.timerCount(), 0);
});

test("a worker registered while the listener is attached is not missed", async () => {
  const extension = worker("chrome-extension://abcdefghijkl/background.js");
  const context = fakeContext([], true, extension);
  assert.equal(await awaitExtensionWorker(context, context.timerOptions()), extension);
  assert.equal(context.listenerCount(), 0);
  assert.equal(context.timerCount(), 0);
});

function worker(url: string): ExtensionServiceWorker {
  return { url: () => url };
}

function fakeContext(initial: ExtensionServiceWorker[], connected = true, appearOnSubscribe?: ExtensionServiceWorker) {
  let workers = [...initial];
  let listener: ((worker: ExtensionServiceWorker) => void) | undefined;
  let timer: { callback: () => void; delayMs: number } | undefined;
  let elapsed = 0;
  const context: ExtensionWorkerContext & {
    emit(worker: ExtensionServiceWorker, atMs: number): void;
    expire(atMs: number): void;
    listenerCount(): number;
    timerCount(): number;
    nextDelay(): number | undefined;
    timerOptions(): { setTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>; clearTimer: () => void };
  } = {
    serviceWorkers: () => workers,
    on: (_event, next) => {
      listener = next;
      if (appearOnSubscribe) workers = [...workers, appearOnSubscribe];
    },
    off: (_event, current) => { if (listener === current) listener = undefined; },
    browser: () => ({ isConnected: () => connected }),
    emit: (next, atMs) => { elapsed = atMs; workers = [...workers, next]; listener?.(next); },
    expire: atMs => { elapsed = atMs; timer?.callback(); },
    listenerCount: () => listener ? 1 : 0,
    timerCount: () => timer ? 1 : 0,
    nextDelay: () => timer?.delayMs,
    timerOptions: () => ({
      setTimer: (callback, delayMs) => {
        timer = { callback, delayMs: delayMs - elapsed };
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => { timer = undefined; },
    }),
  };
  return context;
}
