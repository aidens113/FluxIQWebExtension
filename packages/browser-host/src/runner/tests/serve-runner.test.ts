import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import type { FluxIQHostLaunchRequest, FluxIQLaunchedHost } from "fluxiq/server";
import { BrowserHostError } from "../../errors/index.js";
import { relayEnrolment } from "../relay-enrolment.js";
import { runnerBrowserArgs } from "../runner-browser-args.js";
import type { RunnerSettings } from "../runner-settings.js";
import { serveRunner } from "../serve-runner.js";

let pipes = 0;
async function settingsIn(): Promise<{ settings: RunnerSettings; cleanup(): Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fx-runner-"));
  const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\fx-runner-${process.pid}-${pipes++}` : path.join(dir, "enrol.sock");
  return {
    settings: { environmentId: "env-1", coreApiUrl: "https://app.fluxiq.localhost", gatewayUrl: "wss://app.fluxiq.localhost/client", profileDir: dir, resolveOriginTo: "host.docker.internal", authority: null, extensionPath: "/opt/fluxiq/extension", executablePath: "/usr/bin/chromium", socketPath },
    cleanup: () => rm(dir, { recursive: true, force: true })
  };
}

/** The environment driver's side of the relay: answers each `ticket` with a fresh one and keeps what it printed. */
function driver(): { io: { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough }; printed: () => string; errors: () => string; minted: string[] } {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let printed = "";
  let errors = "";
  const minted: string[] = [];
  stdout.setEncoding("utf8").on("data", (chunk: string) => {
    printed += chunk;
    for (const line of chunk.split("\n")) {
      if (line !== "ticket") continue;
      const ticket = `fxet_runner_${minted.length + 1}`;
      minted.push(ticket);
      stdin.write(`${ticket}\n`);
    }
  });
  stderr.setEncoding("utf8").on("data", (chunk: string) => { errors += chunk; });
  return { io: { stdin, stdout, stderr }, printed: () => printed, errors: () => errors, minted };
}

function host(): FluxIQLaunchedHost & { end(): void } {
  let end = (): void => undefined;
  const closed = new Promise<void>((resolve) => { end = resolve; });
  return { hostId: "env-1", closed, close: async () => end(), end };
}

test("the runner enrols with the ticket its relay hands it, and the relay never prints the ticket", async () => {
  const { settings, cleanup } = await settingsIn();
  const seen: { request: Omit<FluxIQHostLaunchRequest, "takeEnrolmentTicket" | "signal">; ticket: string }[] = [];
  const runner = await serveRunner(settings, async (request) => {
    const { takeEnrolmentTicket, signal: _signal, ...rest } = request;
    seen.push({ request: rest, ticket: takeEnrolmentTicket() });
    return host();
  });
  try {
    const side = driver();
    assert.equal(await relayEnrolment(settings.socketPath, side.io), 0);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.ticket, side.minted[0]);
    assert.deepEqual(seen[0]?.request, { hostId: "env-1", gatewayUrl: settings.gatewayUrl, coreApiUrl: settings.coreApiUrl, dataDir: settings.profileDir, profile: { kind: "named", name: "environment" }, headless: true });
    assert.equal(side.printed(), "ticket\nconnected\n");
    for (const ticket of side.minted) assert.equal(side.printed().includes(ticket) || side.errors().includes(ticket), false);
  } finally {
    await runner.stop();
    assert.equal(await runner.ended, 0);
    await cleanup();
  }
});

test("a failed attempt asks for a fresh ticket; a gateway refusal is final and reported", async () => {
  const { settings, cleanup } = await settingsIn();
  let calls = 0;
  const runner = await serveRunner(settings, async (request) => {
    request.takeEnrolmentTicket();
    calls += 1;
    if (calls === 1) throw new BrowserHostError("browser_host.connect_failed", "timed out");
    if (calls === 2) return host();
    throw new BrowserHostError("enrolment.unknown", "refused");
  });
  try {
    const first = driver();
    assert.equal(await relayEnrolment(settings.socketPath, first.io), 0);
    assert.equal(first.minted.length, 2);
    const second = driver();
    assert.equal(await relayEnrolment(settings.socketPath, second.io), 3);
    assert.match(second.errors(), /enrolment\.unknown/u);
    assert.equal(calls, 3);
  } finally {
    await runner.stop();
    await cleanup();
  }
});

test("a browser that ends unasked ends the runner with code 1", async () => {
  const { settings, cleanup } = await settingsIn();
  const launched = host();
  const runner = await serveRunner(settings, async (request) => {
    request.takeEnrolmentTicket();
    return launched;
  });
  try {
    assert.equal(await relayEnrolment(settings.socketPath, driver().io), 0);
    launched.end();
    assert.equal(await runner.ended, 1);
  } finally {
    await runner.stop();
    await cleanup();
  }
});

test("the runner presents its first ticket at once, since every start revoked the profile's stored trust", async () => {
  const { settings, cleanup } = await settingsIn();
  let resumes: boolean | undefined;
  const runner = await serveRunner(settings, async (request, options) => {
    resumes = options.resumeStoredToken;
    request.takeEnrolmentTicket();
    return host();
  });
  try {
    assert.equal(await relayEnrolment(settings.socketPath, driver().io), 0);
    assert.equal(resumes, false);
  } finally {
    await runner.stop();
    await cleanup();
  }
});

test("the runner's browser maps a rehearsal's public name to the host that serves it, and runs without Chromium's own sandbox", () => {
  assert.deepEqual(runnerBrowserArgs({ coreApiUrl: "https://app.fluxiq.localhost", resolveOriginTo: "host.docker.internal" }), ["--no-sandbox", "--disable-gpu", "--host-resolver-rules=MAP app.fluxiq.localhost host.docker.internal"]);
  assert.deepEqual(runnerBrowserArgs({ coreApiUrl: "https://app.example.org", resolveOriginTo: null }), ["--no-sandbox", "--disable-gpu"]);
});
