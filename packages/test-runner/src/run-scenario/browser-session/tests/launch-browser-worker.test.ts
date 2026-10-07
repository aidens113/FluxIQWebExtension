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

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { BrowserContext, Worker } from "@playwright/test";
import type { RunningTopology } from "../../../coordinator.js";
import { launchBrowser } from "../launch-browser.js";

const MANIFEST = { manifest_version: 3, name: "FluxIQ worker build probe", version: "0.1.0", background: { service_worker: "background.js" } };

async function writeBuild(extensionPath: string, build: string): Promise<void> {
  await writeFile(path.join(extensionPath, "manifest.json"), JSON.stringify(MANIFEST));
  await writeFile(path.join(extensionPath, "background.js"), `self.probeBuild = ${JSON.stringify(build)};\n`);
}

function topologyFor(browserProfileDir: string): RunningTopology {
  return {
    allocation: { browserProfileDir },
    scenarioOrigin: "http://127.0.0.1:4100",
    fluxiqOrigin: "http://127.0.0.1:4200",
    gatewayUrl: "ws://127.0.0.1:4300/client",
  } as unknown as RunningTopology;
}

async function workerOf(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 20_000 });
}

/** Launches the run's browser on `profile` and answers the build its background worker is running. */
async function runningBuild(profile: string, extensionPath: string): Promise<unknown> {
  const { context } = await launchBrowser(topologyFor(profile), extensionPath);
  try {
    const worker = await workerOf(context);
    return await worker.evaluate(() => (self as unknown as { probeBuild?: unknown }).probeBuild);
  } finally {
    await context.close();
  }
}

test("a persistent profile runs the background worker on disk, not the one it ran before", { timeout: 120_000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-worker-build-"));
  const profile = path.join(root, "browser-profile");
  const extensionPath = path.join(root, "extension");
  try {
    await mkdir(profile);
    await mkdir(extensionPath);
    await writeBuild(extensionPath, "first");
    assert.equal(await runningBuild(profile, extensionPath), "first");
    // The same path and the same manifest version, as every Lab instance has.
    await writeBuild(extensionPath, "second");
    assert.equal(await runningBuild(profile, extensionPath), "second", "the second launch runs the second build's worker");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
