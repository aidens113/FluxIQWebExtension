import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { listProcesses, userDataDirOf } from "@fluxiq-web-extension/browser-host/reaper";
import { hostProofProcessExit } from "./process-exit.js";

/** Starts the real engine CLI and observes only public, credential-free proof events. */
export async function startProofEngine(input: {
  coreRoot: string;
  dataDir: string;
  evidenceDirectory: string;
  environment: NodeJS.ProcessEnv;
  hosts: number;
  marker: string;
  profile?: string;
}): Promise<{
  child: ChildProcess;
  apiUrl: string;
  events: Array<Record<string, unknown>>;
  flushEvents(): Promise<void>;
  profiles(): Promise<string[]>;
  stop(hard?: boolean): Promise<void>;
  waitFor(predicate: () => boolean | Promise<boolean>, what: string): Promise<void>;
}> {
  const events: Array<Record<string, unknown>> = [];
  const child = spawn(process.execPath, [path.join(input.coreRoot, "packages/fluxiq/dist/server/cli/main.js"), "dev", "--data-dir", input.dataDir,
    "--port", "0", "--gateway-port", "0", "--browsers", String(input.hosts), "--browser-host", path.join(import.meta.dirname, "proof-launcher.js"),
    ...(input.profile ? ["--browser-profile", input.profile] : [])], { cwd: input.dataDir, env: { ...input.environment, FLUXIQ_HOST_PROOF_MARKER: input.marker }, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  const log = createWriteStream(path.join(input.evidenceDirectory, `${input.marker}.log`));
  child.stdout?.pipe(log, { end: false });
  child.stderr?.pipe(log, { end: false });
  const exited = hostProofProcessExit(child);
  const output = Promise.allSettled([finished(child.stdout!), finished(child.stderr!)]);
  const logOutput = Promise.allSettled([finished(log)]);
  let completion: ReturnType<typeof hostProofProcessExit> | undefined;
  const complete = (): ReturnType<typeof hostProofProcessExit> => completion ??= (async () => {
    const status = await exited;
    const captured = await output;
    if (!log.destroyed) log.end();
    const written = await logOutput;
    const failures = [...captured, ...written].filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map((failure) => failure.reason), "The proof engine's output could not be fully captured.");
    return status;
  })();
  const ready = new Promise<string>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`The proof engine exited before readiness (exit ${String(code)}).`)));
    child.on("message", (message: unknown) => {
      if (!message || typeof message !== "object") return;
      const event = message as Record<string, unknown>;
      events.push(event);
      if (event.type === "fluxiq.ready" && typeof event.apiUrl === "string") resolve(event.apiUrl);
    });
  });
  const waitFor = async (predicate: () => boolean | Promise<boolean>, what: string): Promise<void> => {
    const deadline = Date.now() + 30_000;
    while (!await predicate()) {
      if (Date.now() >= deadline) throw new Error(`Host lifecycle proof did not observe ${what}; inspect this stage before another launch.`);
      await delay(100);
    }
  };
  const profiles = async (): Promise<string[]> => [...new Set((await listProcesses()).filter((entry) => entry.commandLine.includes(`--fluxiq-proof-run=${input.marker}`))
    .map((entry) => userDataDirOf(entry.commandLine)).filter((profile): profile is string => profile !== undefined))];
  const flushEvents = async (): Promise<void> => {
    if (!child.connected) throw new Error("The proof engine disconnected before its observations could be flushed.");
    const id = randomUUID();
    let observe = (_message: unknown): void => undefined;
    const flushed = new Promise<void>((resolve, reject) => {
      observe = (message) => {
        const event = message as { type?: string; id?: string } | null;
        if (event?.type === "proof.flushed" && event.id === id) resolve();
      };
      child.on("message", observe);
      child.send({ type: "proof.flush", id }, (error) => { if (error) reject(error); });
    });
    try {
      await Promise.race([flushed, exited.then((status) => { throw new Error(`The proof engine exited before observations flushed (exit ${String(status.code)}, signal ${String(status.signal)}).`); })]);
    } finally { child.off("message", observe); }
  };
  let stopping: Promise<void> | undefined;
  const stop = (hard = false): Promise<void> => stopping ??= (async () => {
    let killed = false;
    if (child.exitCode === null && child.signalCode === null) {
      if (hard) killed = child.kill();
      else if (child.connected) child.disconnect();
    }
    const status = await complete();
    await waitFor(async () => (await profiles()).length === 0, "all owned browser processes to exit");
    if (status.error) throw status.error;
    if (hard && !killed) throw new Error(`The proof engine was not terminated by this hard-death stage (exit ${String(status.code)}, signal ${String(status.signal)}).`);
    if (!hard && (status.code !== 0 || status.signal !== null)) throw new Error(`The proof engine did not stop normally (exit ${String(status.code)}, signal ${String(status.signal)}).`);
  })();
  try { return { child, apiUrl: await ready, events, profiles, flushEvents, stop, waitFor }; }
  catch (error) {
    if (child.connected) child.disconnect();
    try { await complete(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], "The proof engine failed during startup and output capture."); }
    throw error;
  }
}
