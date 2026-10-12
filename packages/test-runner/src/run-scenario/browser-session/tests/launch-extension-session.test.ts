import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import type { RunningTopology } from "../../../coordinator.js";

type Options = Parameters<typeof launchExtensionSession>[2];
import { launchExtensionSession } from "../launch-extension-session.js";

function timeout(details: Record<string, unknown> = {}) {
  return new RunnerFailure("extension.worker", "Timed out waiting for the Chrome extension service worker", {
    details: { extensionStage: "worker", observedWorkerCount: 0, timeoutMs: 30_000, workerMs: 30_010, browserConnected: false, ...details },
  });
}

function harness(failures: unknown[] = [timeout()]) {
  const events: string[] = [];
  let launches = 0;
  let controls = 0;
  let targets = 0;
  let violation = false;
  let proof: Promise<void> = Promise.resolve();
  const current: { context?: { close(): Promise<void> } } = {};
  const options: Options = {
    scenarioOrigins: ["http://127.0.0.1:4100"],
    trace: { attach: async () => { events.push("trace"); }, mark: () => { events.push("retry"); } },
    launch: (async () => {
      const attempt = ++launches;
      events.push(`launch.${attempt}`);
      return { context: { close: async () => { events.push(`close.${attempt}`); } }, browserVersion: "unit", headless: false };
    }) as unknown as NonNullable<Options["launch"]>,
    onLaunched: (session: { context: { close(): Promise<void> } }) => { current.context = session.context; },
    installGuard: (async () => {
      events.push("guard");
      return {
        serviceWorkersProven: async () => { events.push("proof");
          await proof; },
        assertNoViolations: () => { events.push("assert");
          if (violation) throw new Error("Unit containment violation"); },
      };
    }) as unknown as NonNullable<Options["installGuard"]>,
    openControl: (async () => {
      events.push("control");
      const failure = failures[controls++];
      if (failure) throw failure;
      return {};
    }) as unknown as NonNullable<Options["openControl"]>,
    findTarget: async () => {
      targets++;
      events.push("target");
      return { url: () => "chrome-extension://unit/background.js" };
    },
  };
  return { events, options, current, counts: () => ({ launches, controls, targets }), violate: () => { violation = true; }, holdProof: (value: Promise<void>) => { proof = value; } };
}

const topology = {} as RunningTopology;

test("a proved observation timeout closes its owner once and repeats strict readiness and containment", async () => {
  const h = harness();
  const result = await launchExtensionSession(topology, "unit-extension", h.options);
  assert.equal(result.context as unknown, h.current.context);
  assert.deepEqual(h.counts(), { launches: 2, controls: 2, targets: 1 });
  assert.deepEqual(h.events, ["launch.1", "trace", "guard", "control", "target", "proof", "assert", "retry", "close.1", "launch.2", "trace", "guard", "control", "proof", "assert"]);
});

test("missing timeout evidence, other failures and nonzero worker observations never relaunch", async () => {
  for (const failure of [timeout({ timeoutMs: undefined }), timeout({ timeoutMs: 0 }), timeout({ workerMs: 1 }), timeout({ observedWorkerCount: 1 }), timeout({ extensionStage: "control-page" }), new Error("Unit readiness failure")]) {
    const h = harness([failure]);
    await assert.rejects(launchExtensionSession(topology, "unit-extension", h.options), error => error === failure);
    assert.deepEqual(h.counts(), { launches: 1, controls: 1, targets: 0 });
  }
});

test("missing or ambiguous Chrome evidence preserves the original refusal", async () => {
  const failure = timeout();
  const h = harness([failure]);
  h.options.findTarget = async () => undefined;
  await assert.rejects(launchExtensionSession(topology, "unit-extension", h.options), error => error === failure);
  assert.equal(h.counts().launches, 1);
  assert.equal(h.events.includes("close.1"), false);
});

test("a second worker timeout refuses without another discovery or browser restart", async () => {
  const failure = timeout();
  const h = harness([timeout(), failure]);
  await assert.rejects(launchExtensionSession(topology, "unit-extension", h.options), error => error === failure);
  assert.deepEqual(h.counts(), { launches: 2, controls: 2, targets: 1 });
  await h.current.context!.close();
  assert.equal(h.events.at(-1), "close.2", "terminal owner remains available to caller cleanup/evidence capture");
});

test("an abandoned guard violation cannot be lost by browser recovery", async () => {
  const h = harness();
  h.violate();
  await assert.rejects(launchExtensionSession(topology, "unit-extension", h.options), /Unit containment violation/u);
  assert.equal(h.counts().launches, 1);
});

test("fresh worker proof must settle successfully before the control session is returned", async () => {
  const h = harness([]);
  let rejectProof!: (error: Error) => void;
  h.holdProof(new Promise<void>((_resolve, reject) => { rejectProof = reject; }));
  let returned = false;
  const pending = launchExtensionSession(topology, "unit-extension", h.options).then(() => { returned = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(returned, false);
  rejectProof(new Error("Unit canary was not observed"));
  await assert.rejects(pending, /Unit canary was not observed/u);
  assert.equal(returned, false);
});

test("an already-started first-owner proof failure is retained without a restart", async () => {
  const h = harness();
  let rejectProof!: (error: Error) => void;
  h.holdProof(new Promise<void>((_resolve, reject) => { rejectProof = reject; }));
  const pending = launchExtensionSession(topology, "unit-extension", h.options);
  await new Promise(resolve => setImmediate(resolve));
  rejectProof(new Error("Unit first-owner canary failed"));
  await assert.rejects(pending, /Unit first-owner canary failed/u);
  assert.equal(h.counts().launches, 1);
  assert.equal(h.events.includes("close.1"), false);
});
