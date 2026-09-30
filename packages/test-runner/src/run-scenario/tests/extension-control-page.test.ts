import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { extensionControlPage, extensionStartFailureDetails, openExtensionControlPage } from "../extension-control-page.js";

type Outcome = "crash" | "abort" | "detached" | "ok" | "other";
type FakePage = { goto: (url: string) => Promise<void>; close: () => Promise<void>; closed: boolean; url?: string };

const MESSAGES: Record<Exclude<Outcome, "ok">, string> = {
  crash: "page.goto: Page crashed\nCall log:\n  - navigating to \"chrome-extension://x/sidepanel/index.html\"",
  abort: "page.goto: net::ERR_ABORTED; maybe frame was detached?\nCall log:\n  - navigating to \"chrome-extension://x/sidepanel/index.html\"",
  detached: "page.goto: Navigating frame was detached",
  other: "page.goto: net::ERR_FILE_NOT_FOUND",
};

function context(outcomes: Outcome[], clock?: { value: number; stepMs: number }) {
  const pages: FakePage[] = [];
  return {
    pages,
    newPage: async () => {
      const outcome = outcomes[pages.length] ?? "ok";
      const page: FakePage = {
        closed: false,
        goto: async url => {
          page.url = url;
          if (clock) clock.value += clock.stepMs;
          if (outcome !== "ok") throw new Error(MESSAGES[outcome]);
        },
        close: async () => { page.closed = true; },
      };
      pages.push(page);
      return page as never;
    },
  };
}

function sleeper() {
  const slept: number[] = [];
  return { slept, sleep: async (ms: number) => { slept.push(ms); } };
}

/** `run-muna3yfq-a7d8a2a0` and `run-munbu244-4f4021a8` ended on this crash before spending a call. */
test("a control page whose renderer crashed while loading is opened again in a fresh tab, once, without a pause", async () => {
  const fake = context(["crash", "ok"]);
  const { slept, sleep } = sleeper();
  const opened = await openExtensionControlPage(fake, "chrome-extension://x/sidepanel/index.html", { sleep });
  assert.equal(opened.attempts, 2);
  assert.deepEqual(opened.retried, ["renderer_crash"]);
  assert.equal(fake.pages.length, 2);
  assert.equal(fake.pages[0]!.closed, true);
  assert.equal(opened.page as unknown, fake.pages[1]);
  assert.deepEqual(slept, []);
});

/** Live run 12 ended on this 11 s in. */
test("an aborted or detached navigation is retried once in a fresh tab after the delay", async () => {
  for (const outcome of ["abort", "detached"] as const) {
    const fake = context([outcome, "ok"]);
    const { slept, sleep } = sleeper();
    const opened = await openExtensionControlPage(fake, "u", { sleep });
    assert.equal(opened.attempts, 2);
    assert.deepEqual(opened.retried, ["navigation_aborted"]);
    assert.equal(fake.pages[0]!.closed, true);
    assert.deepEqual(slept, [1_000], "the default pause");
  }
  const { slept, sleep } = sleeper();
  await openExtensionControlPage(context(["abort", "ok"]), "u", { sleep, retryDelayMs: 25 });
  assert.deepEqual(slept, [25]);
});

test("a second failure ends the start as a RunnerFailure with closed details only", async () => {
  const clock = { value: 1_000, stepMs: 300 };
  const { sleep } = sleeper();
  await assert.rejects(openExtensionControlPage(context(["abort", "crash"], clock), "u", { sleep, now: () => clock.value }), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "extension.worker");
    assert.deepEqual(error.details, { extensionStage: "control-page", attempts: 2, retried: ["navigation_aborted"], reason: "renderer_crash", waitedMs: 600 });
    assert.match(error.message, /Page crashed/u, "the browser's text stays on the message, not the details");
    assert.equal(JSON.stringify(error.details).includes("chrome-extension"), false);
    return true;
  });
});

test("any other navigation failure is not retried, and fails with its own reason", async () => {
  const other = context(["other", "ok"]);
  await assert.rejects(openExtensionControlPage(other, "u"), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.match(error.message, /ERR_FILE_NOT_FOUND/u);
    assert.deepEqual(error.details, { extensionStage: "control-page", attempts: 1, retried: [], reason: "navigation_failed", waitedMs: 0 });
    return true;
  });
  assert.equal(other.pages.length, 1);
});

test("a page that loads is returned on the first attempt", async () => {
  const opened = await openExtensionControlPage(context(["ok"]), "u");
  assert.equal(opened.attempts, 1);
  assert.deepEqual(opened.retried, []);
});

function startContext(outcomes: Outcome[], clock: { value: number; stepMs: number }) {
  return { ...context(outcomes, clock), serviceWorkers: () => [], on: () => undefined, off: () => undefined, browser: () => null };
}

test("the extension start times the worker and the page, and a failed page carries both", async () => {
  const clock = { value: 0, stepMs: 200 };
  const { sleep } = sleeper();
  const awaitWorker = async () => { clock.value += 700; return { url: () => "chrome-extension://abcdefghijkl/background.js" }; };
  const fake = startContext(["abort", "abort"], clock);
  let failure: unknown;
  await extensionControlPage(fake, { awaitWorker, sleep, now: () => clock.value }).catch(error => { failure = error; });
  assert.ok(failure instanceof RunnerFailure);
  assert.equal(fake.pages[0]!.url, "chrome-extension://abcdefghijkl/sidepanel/index.html");
  assert.deepEqual(failure.details, { extensionStage: "control-page", attempts: 2, retried: ["navigation_aborted"], reason: "navigation_aborted", waitedMs: 400, workerMs: 700, openMs: 400 });
  assert.deepEqual(extensionStartFailureDetails(failure), failure.details);

  const ok = startContext(["ok"], clock);
  assert.equal(await extensionControlPage(ok, { awaitWorker, sleep, now: () => clock.value }) as unknown, ok.pages[0]);
});

test("a worker that never started fails at the worker stage with its wait time", async () => {
  const clock = { value: 0, stepMs: 0 };
  const awaitWorker = async () => {
    clock.value += 30_000;
    throw new RunnerFailure("extension.worker", "Timed out waiting for the Chrome extension service worker", { details: { timeoutMs: 30_000, observedWorkerCount: 0, browserConnected: true } });
  };
  const fake = startContext(["ok"], clock);
  let failure: unknown;
  await extensionControlPage(fake, { awaitWorker: awaitWorker as never, now: () => clock.value }).catch(error => { failure = error; });
  assert.ok(failure instanceof RunnerFailure);
  assert.equal(fake.pages.length, 0);
  assert.deepEqual(extensionStartFailureDetails(failure), { extensionStage: "worker", workerMs: 30_000, timeoutMs: 30_000, observedWorkerCount: 0, browserConnected: true });
});

test("only the closed extension-start shape is selected for publication", () => {
  assert.equal(extensionStartFailureDetails(new Error("x")), undefined);
  assert.equal(extensionStartFailureDetails(new RunnerFailure("gateway.connection", "x", { details: { extensionStage: "control-page" } })), undefined);
  assert.equal(extensionStartFailureDetails(new RunnerFailure("extension.worker", "x", { details: { extensionStage: "control-page", attempts: 1, retried: ["private"], reason: "renderer_crash", waitedMs: 0, workerMs: 0, openMs: 0 } })), undefined);
  assert.equal(extensionStartFailureDetails(new RunnerFailure("extension.worker", "x", { details: { extensionStage: "control-page", attempts: 1, retried: [], reason: "net::ERR_ABORTED", waitedMs: 0, workerMs: 0, openMs: 0 } })), undefined);
  assert.equal(extensionStartFailureDetails(new RunnerFailure("extension.worker", "Extension runtime message failed")), undefined);
});

/** t174-w7: 9 of 10 starts crashed the extension's renderer; the retried page loaded over a worker that never came back. */
test("after a retried control page the worker is woken and must be present again, or the start fails naming the retry", async () => {
  const clock = { value: 0, stepMs: 0 };
  let calls = 0;
  const awaitWorker = async () => {
    calls += 1;
    if (calls === 1) return { url: () => "chrome-extension://abcdefghijkl/background.js" };
    clock.value += 30_000;
    throw new RunnerFailure("extension.worker", "Timed out waiting for the Chrome extension service worker", { details: { timeoutMs: 30_000, observedWorkerCount: 0, browserConnected: true } });
  };
  const woken: unknown[] = [];
  const fake = startContext(["crash", "ok"], clock);
  let failure: unknown;
  await extensionControlPage(fake, { awaitWorker: awaitWorker as never, wakeWorker: async page => { woken.push(page); }, now: () => clock.value }).catch(error => { failure = error; });
  assert.ok(failure instanceof RunnerFailure);
  assert.equal(calls, 2, "the worker is required again after the retry");
  assert.deepEqual(woken, [fake.pages[1]], "the retried page is the one that wakes the worker");
  assert.match(failure.message, /did not come back after its control page was retried \(renderer_crash\)/u);
  assert.deepEqual(extensionStartFailureDetails(failure), { extensionStage: "worker", workerMs: 30_000, timeoutMs: 30_000, observedWorkerCount: 0, browserConnected: true, afterRetried: ["renderer_crash"] });
});

test("a retried control page whose worker is back is returned; a first-attempt page is not re-checked", async () => {
  const clock = { value: 0, stepMs: 0 };
  let calls = 0;
  const awaitWorker = async () => { calls += 1; return { url: () => "chrome-extension://abcdefghijkl/background.js" }; };
  const retried = startContext(["crash", "ok"], clock);
  assert.equal(await extensionControlPage(retried, { awaitWorker, wakeWorker: async () => undefined, now: () => clock.value }) as unknown, retried.pages[1]);
  assert.equal(calls, 2);
  calls = 0;
  let woke = false;
  const first = startContext(["ok"], clock);
  assert.equal(await extensionControlPage(first, { awaitWorker, wakeWorker: async () => { woke = true; }, now: () => clock.value }) as unknown, first.pages[0]);
  assert.equal(calls, 1);
  assert.equal(woke, false);
});
