// A run's browser runs the extension's background worker that is on disk, even
// in a persistent profile that ran another build before.
//
// Live run `run-muxky0df-c9839389` (lane C, persistent workspace `t274-c`)
// refused every Next page with `node_not_runnable_here`: Chromium had kept the
// profile's first background worker, a build from before `web.dom.next_page`
// existed, and that worker's gateway mapping answers an action type it does not
// know with `UNSUPPORTED_TYPE` (`../../../guarded-browser/forget-cached-service-workers.ts`).
// This drives the real Chromium through `launchBrowser` twice on one profile,
// with a two-file extension whose worker says which build it is.
//
// **It waits on the browser, never on a budget (t616).** Under a full sweep this
// test failed and then passed twice on rerun. Alone it takes about 1.4 s; under
// load (six copies beside twelve CPU-bound processes) three of six copies hit
// the test's 120 s budget and the other three took 106-115 s. Timing each phase
// showed where: the launches and the worker's answer took at most 7 s, and each
// graceful `context.close()` took 50-125 s while the loaded machine let Chromium
// shut its profile down. That close is the scenario itself -- the second launch
// must find a profile a browser ran and left normally -- so the test waits on the
// browser's own signals only, and its timeout is a hang guard far past any loaded
// run measured, which closes the browser so a hung run cannot hold the suite.
//
// The worker's build is read from Chrome's own target list, over CDP, not from
// Playwright's worker handle: one loaded run never saw Playwright's worker at all
// and waited until the guard, the observation gap the Lab already relaunches for
// (`../launch-extension-session.ts`) and the worker-stop perturbation reads around
// (`../../../perturbations/stop-service-worker.ts`). The probe worker keeps itself
// running, so Chrome lists it from its start until the browser closes.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { BrowserContext, CDPSession } from "@playwright/test";
import type { RunningTopology } from "../../../coordinator.js";
import { launchBrowser } from "../launch-browser.js";

const MANIFEST = { manifest_version: 3, name: "FluxIQ worker build probe", version: "0.1.0", background: { service_worker: "background.js" } };

/** A hang guard only (header): ten minutes, about four times the slowest loaded run measured (130 s). */
const HANG_GUARD_MS = 600_000;

/** The worker says its build, and an extension call every 20 s keeps Chrome from stopping it while idle (header). */
async function writeBuild(extensionPath: string, build: string): Promise<void> {
  await writeFile(path.join(extensionPath, "manifest.json"), JSON.stringify(MANIFEST));
  await writeFile(path.join(extensionPath, "background.js"), `self.probeBuild = ${JSON.stringify(build)};\nsetInterval(() => chrome.runtime.getPlatformInfo(() => undefined), 20_000);\n`);
}

function topologyFor(browserProfileDir: string): RunningTopology {
  return {
    allocation: { browserProfileDir },
    scenarioOrigin: "http://127.0.0.1:4100",
    fluxiqOrigin: "http://127.0.0.1:4200",
    gatewayUrl: "ws://127.0.0.1:4300/client",
  } as unknown as RunningTopology;
}

type TargetInfo = { targetId: string; type: string; url: string };

/** One `Runtime.evaluate` in a worker's own target, attached for that read alone; `undefined` when the target went away first. */
async function evaluateInTarget(session: CDPSession, targetId: string, expression: string): Promise<{ value: unknown } | undefined> {
  const ask = { id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } };
  let attachedId: string | undefined;
  let listener: ((event: { sessionId: string; message: string }) => void) | undefined;
  const answered = new Promise<{ value: unknown }>(resolve => {
    listener = event => {
      if (event.sessionId !== attachedId) return;
      const reply = JSON.parse(event.message) as { id?: number; result?: { result?: { value?: unknown } } };
      if (reply.id === ask.id) resolve({ value: reply.result?.result?.value });
    };
    session.on("Target.receivedMessageFromTarget", listener);
  });
  try {
    const attached = await session.send("Target.attachToTarget", { targetId, flatten: false }).catch(() => undefined);
    if (!attached) return undefined;
    attachedId = attached.sessionId;
    await session.send("Target.sendMessageToTarget", { sessionId: attachedId, message: JSON.stringify(ask) });
    return await answered;
  } finally {
    if (listener) session.off("Target.receivedMessageFromTarget", listener);
    if (attachedId !== undefined) await session.send("Target.detachFromTarget", { sessionId: attachedId }).catch(/* best-effort: a worker gone since the read has nothing to detach */ () => undefined);
  }
}

/**
 * The build the extension's worker is running, read from Chrome's target list (header). The list is read again until
 * Chrome shows a worker that has run its script, however long the machine takes: no budget of its own, only the guard.
 */
async function workerBuild(context: BrowserContext): Promise<unknown> {
  const page = context.pages()[0] ?? await context.newPage();
  const session = await context.newCDPSession(page);
  try {
    for (;;) {
      const { targetInfos } = await session.send("Target.getTargets") as { targetInfos: TargetInfo[] };
      const worker = targetInfos.find(target => target.type === "service_worker" && target.url.startsWith("chrome-extension://"));
      const read = worker ? await evaluateInTarget(session, worker.targetId, "self.probeBuild") : undefined;
      // The probe always sets a string, so `undefined` is a worker listed before its script ran.
      if (read && read.value !== undefined) return read.value;
      await delay(50);
    }
  } finally {
    await session.detach().catch(/* best-effort: the session may close with the browser */ () => undefined);
  }
}

/** Launches the run's browser on `profile` and answers the build its background worker is running; the guard's abort closes it. */
async function runningBuild(profile: string, extensionPath: string, guard: AbortSignal): Promise<unknown> {
  const { context } = await launchBrowser(topologyFor(profile), extensionPath);
  const close = () => { void context.close().catch(/* best-effort: the guard's close of a hung run */ () => undefined); };
  guard.addEventListener("abort", close, { once: true });
  try {
    return await workerBuild(context);
  } finally {
    guard.removeEventListener("abort", close);
    await context.close();
  }
}

test("a persistent profile runs the background worker on disk, not the one it ran before", { timeout: HANG_GUARD_MS }, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-worker-build-"));
  const profile = path.join(root, "browser-profile");
  const extensionPath = path.join(root, "extension");
  try {
    await mkdir(profile);
    await mkdir(extensionPath);
    await writeBuild(extensionPath, "first");
    assert.equal(await runningBuild(profile, extensionPath, t.signal), "first");
    // The same path and the same manifest version, as every Lab instance has.
    await writeBuild(extensionPath, "second");
    assert.equal(await runningBuild(profile, extensionPath, t.signal), "second", "the second launch runs the second build's worker");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
