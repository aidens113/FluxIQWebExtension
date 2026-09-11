// The persistent scenario lab process: its allocated loopback port, the
// recovery path when that port is taken, and the URL each lane navigates to.
import { randomBytes } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { allocateLoopbackPort } from "../allocation.js";
import { RunnerFailure } from "../failure.js";
import { hardenWindowsPrivatePath } from "../windows-acl.js";
import type { DemoWorkspaceConfiguration } from "./configuration.js";

export async function persistentScenarioPort(config: DemoWorkspaceConfiguration): Promise<number> {
  const portPath = path.join(config.workspaceDirectory, "scenario-port.json");
  await mkdir(config.workspaceDirectory, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(portPath, "utf8")) as { port?: unknown };
    if (!Number.isInteger(parsed.port) || Number(parsed.port) < 1024 || Number(parsed.port) > 65_535) {
      throw new RunnerFailure("environment.missing", "The persistent demo scenario port file is invalid");
    }
    return Number(parsed.port);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
  }
  const port = await allocateLoopbackPort();
  await writeFile(portPath, JSON.stringify({ schemaVersion: "0.1", port }, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await hardenWindowsPrivatePath(portPath, "file");
  return port;
}

export async function replacePersistentScenarioPort(config: DemoWorkspaceConfiguration, expectedPort: number): Promise<number> {
  const portPath = path.join(config.workspaceDirectory, "scenario-port.json");
  const current = JSON.parse(await readFile(portPath, "utf8")) as { port?: unknown };
  if (current.port !== expectedPort) {
    throw new RunnerFailure("process.startup", "The persistent demo scenario port changed during recovery");
  }
  const port = await allocateLoopbackPort();
  if (port === expectedPort) throw new RunnerFailure("process.startup", "Scenario Lab recovery could not allocate a replacement port");
  const temporary = portPath + "." + randomBytes(6).toString("hex") + ".tmp";
  try {
    await writeFile(temporary, JSON.stringify({ schemaVersion: "0.1", port }, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
    if (process.platform === "win32") await hardenWindowsPrivatePath(temporary, "file");
    await rename(temporary, portPath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return port;
}

export type ScenarioLabProcess = Pick<ChildProcess, "exitCode" | "signalCode">;

export async function startPersistentScenarioLabWithRecovery(input: {
  config: DemoWorkspaceConfiguration;
  start: (port: number) => ScenarioLabProcess;
  waitUntilReady: (port: number, child: ScenarioLabProcess) => Promise<void>;
}): Promise<{ port: number; child: ScenarioLabProcess }> {
  const initialPort = await persistentScenarioPort(input.config);
  let child = input.start(initialPort);
  try {
    await input.waitUntilReady(initialPort, child);
    return { port: initialPort, child };
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) throw error;
  }
  const replacementPort = await replacePersistentScenarioPort(input.config, initialPort);
  child = input.start(replacementPort);
  await input.waitUntilReady(replacementPort, child);
  return { port: replacementPort, child };
}

export function requireDemoScenarioUrl(origin: string, scenarioPath: string): string {
  let originUrl: URL;
  let scenarioUrl: URL;
  try {
    originUrl = new URL(origin);
    scenarioUrl = new URL(scenarioPath, originUrl);
  } catch {
    throw new RunnerFailure("environment.missing", "The persistent demo scenario URL is invalid");
  }
  if (
    originUrl.protocol !== "http:"
    || originUrl.hostname !== "127.0.0.1"
    || originUrl.username
    || originUrl.password
    || scenarioUrl.origin !== originUrl.origin
    || !scenarioUrl.pathname.startsWith("/scenarios/")
    || scenarioUrl.search
    || scenarioUrl.hash
  ) throw new RunnerFailure("environment.missing", "The persistent demo scenario URL is invalid");
  return scenarioUrl.href;
}

export async function waitForUrl(url: string, token: string, child?: ScenarioLabProcess): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      throw new RunnerFailure("process.startup", "Scenario Lab exited before its health endpoint became ready");
    }
    try {
      const response = await fetch(url, { headers: { authorization: "Bearer " + token } });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("process.startup", "Timed out waiting for " + url);
}
