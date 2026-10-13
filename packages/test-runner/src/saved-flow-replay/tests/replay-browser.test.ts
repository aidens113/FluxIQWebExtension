// The replay's browser starts through the run lane's guarded session
// (`launchExtensionSession`), so it gets that session's one-time relaunch on a
// proved worker observation gap and closes whichever browser it launched last
// when it fails. Replay `replay-mv62rwy7-fcb23be8` died on the bare readiness
// wait with no relaunch and no details; these pin that it no longer can.

import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import type { RunningTopology } from "../../coordinator.js";
import { RunnerFailure } from "../../failure.js";
import { openReplayBrowser } from "../replay-browser.js";

type Seams = NonNullable<Parameters<typeof openReplayBrowser>[2]>;
type Trace = NonNullable<Parameters<typeof openReplayBrowser>[1]["trace"]>;
type Session = Required<NonNullable<Seams["session"]>>;

function workerTimeout() {
  return new RunnerFailure("extension.worker", "Timed out waiting for the Chrome extension service worker", {
    details: { extensionStage: "worker", observedWorkerCount: 0, timeoutMs: 30_000, workerMs: 30_010, browserConnected: false },
  });
}

const topology = {
  control: { approvePairing: async () => undefined },
  allocation: { browserProfileDir: "unit-profile", controllerToken: "unit-controller-token" },
  scenarioOrigin: "http://127.0.0.1:4100",
  fluxiqOrigin: "http://127.0.0.1:4200",
} as unknown as RunningTopology;

function harness(failures: unknown[]) {
  const events: string[] = [];
  const marks: Array<{ event: string; detail?: Record<string, unknown> }> = [];
  let launches = 0;
  let controls = 0;
  const contexts: Array<{ id: number }> = [];
  const trace: Trace = {
    attach: async () => { events.push("trace"); },
    mark: (event, detail) => {
      marks.push({ event, ...(detail ? { detail } : {}) });
      events.push(`mark:${event}`);
    },
    observePage: () => { events.push("observe"); },
  };
  const seams: Seams = {
    probeProfile: async profileDir => {
      events.push(`probe:${profileDir}`);
      return { lockfile: true, sinceLastWriteMs: 58_000 };
    },
    session: {
      launch: (async () => {
        const id = ++launches;
        events.push(`launch.${id}`);
        const context = { id, close: async () => { events.push(`close.${id}`); } };
        contexts.push(context);
        return { context, browserVersion: "unit", headless: false };
      }) as unknown as Session["launch"],
      installGuard: (async () => ({
        serviceWorkersProven: async () => { events.push("proof"); },
        assertNoViolations: () => { events.push("assert"); },
      })) as unknown as Session["installGuard"],
      openControl: (async () => {
        events.push("control");
        const failure = failures[controls++];
        if (failure) throw failure;
        return { unit: "control-page" };
      }) as unknown as Session["openControl"],
      findTarget: async () => {
        events.push("target");
        return { url: () => "chrome-extension://unit/background.js" };
      },
    },
    openScenario: async (session, start) => {
      events.push(`scenario:${start}:context.${(session.context as unknown as { id: number }).id}`);
      return { unit: "scenario-page", goto: async () => undefined } as unknown as Page;
    },
  };
  return { events, marks, seams, trace, contexts, counts: () => ({ launches, controls }) };
}

test("a first proved observation gap closes the first browser and the replay continues on the relaunched one", async () => {
  const h = harness([workerTimeout()]);
  const browser = await openReplayBrowser(topology, { extensionPath: "unit-extension", startPath: "/start", trace: h.trace }, h.seams);
  assert.deepEqual(h.counts(), { launches: 2, controls: 2 });
  assert.equal(browser.context as unknown, h.contexts[1]);
  assert.deepEqual(h.events, [
    "probe:unit-profile", "mark:browser.profile-handover",
    "launch.1", "trace", "control", "target", "proof", "assert", "mark:browser.worker-observation.retry", "close.1",
    "launch.2", "trace", "control", "proof", "assert", "observe",
    "scenario:http://127.0.0.1:4100/start:context.2",
  ]);
  await browser.close();
  assert.equal(h.events.at(-1), "close.2");
});

test("a second worker failure closes the relaunched browser and keeps the original error", async () => {
  const failure = workerTimeout();
  const h = harness([workerTimeout(), failure]);
  await assert.rejects(openReplayBrowser(topology, { extensionPath: "unit-extension", startPath: "/start", trace: h.trace }, h.seams), error => error === failure);
  assert.deepEqual(h.counts(), { launches: 2, controls: 2 });
  assert.deepEqual(h.events.filter(event => event.startsWith("close.")), ["close.1", "close.2"]);
  assert.equal(h.events.some(event => event.startsWith("scenario:")), false);
});

test("a failure that is not a proved observation gap is not relaunched, and its browser is closed", async () => {
  const failure = new RunnerFailure("extension.worker", "Unit control page failed", { details: { extensionStage: "control-page" } });
  const h = harness([failure]);
  await assert.rejects(openReplayBrowser(topology, { extensionPath: "unit-extension", startPath: "/start", trace: h.trace }, h.seams), error => error === failure);
  assert.deepEqual(h.counts(), { launches: 1, controls: 1 });
  assert.deepEqual(h.events.filter(event => event.startsWith("close.")), ["close.1"]);
});

test("a pairing failure after the session started closes that session's browser and keeps the pairing error", async () => {
  const h = harness([]);
  const failure = new Error("Unit pairing failure");
  h.seams.openScenario = async () => { throw failure; };
  await assert.rejects(openReplayBrowser(topology, { extensionPath: "unit-extension", startPath: "/start", trace: h.trace }, h.seams), error => error === failure);
  assert.deepEqual(h.events.filter(event => event.startsWith("close.")), ["close.1"]);
});

test("the profile handover probe is recorded before the first launch, as a boolean and an integer only", async () => {
  const h = harness([]);
  await openReplayBrowser(topology, { extensionPath: "unit-extension", startPath: "/start", trace: h.trace }, h.seams);
  assert.deepEqual(h.marks[0], { event: "browser.profile-handover", detail: { lockfile: true, sinceLastWriteMs: 58_000 } });
  assert.ok(h.events.indexOf("mark:browser.profile-handover") < h.events.indexOf("launch.1"));
});

test("a profile probe that cannot read the profile is recorded as unavailable and the replay still starts", async () => {
  const h = harness([]);
  h.seams.probeProfile = async () => { throw Object.assign(new Error("Unit denied"), { code: "EPERM" }); };
  await openReplayBrowser(topology, { extensionPath: "unit-extension", startPath: "/start", trace: h.trace }, h.seams);
  assert.deepEqual(h.marks[0], { event: "browser.profile-handover", detail: { unavailable: "EPERM" } });
  assert.equal(h.counts().launches, 1);
});

test("a replay with no authenticated Core is refused before any browser starts", async () => {
  const h = harness([]);
  await assert.rejects(openReplayBrowser({ ...topology, control: undefined } as unknown as RunningTopology, { extensionPath: "unit-extension", startPath: "/start", trace: h.trace }, h.seams), (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing");
  assert.deepEqual(h.events, []);
});
