import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { createWriteStream, type WriteStream } from "node:fs";
import path from "node:path";
import { redactText } from "@fluxiq-web-extension/test-evidence";
import { RunnerFailure } from "./failure.js";
import { withoutProviderSecrets } from "./environment.js";

export type ProcessSpec = {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  logPath?: string;
  shell?: boolean;
};

type SpawnProcess = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
type KillTree = (child: ChildProcess) => Promise<void>;

type ManagedProcess = { spec: ProcessSpec; child: ChildProcess; log?: WriteStream };

export class ProcessSupervisor {
  private readonly children: ManagedProcess[] = [];
  private cleanupPromise?: Promise<void>;

  constructor(private readonly spawnProcess: SpawnProcess = defaultSpawn, private readonly killTree: KillTree = defaultKillTree) {}

  get activeProcessCount(): number {
    return this.children.filter(({ child }) => child.exitCode === null && child.signalCode === null).length;
  }

  processExitCodes(): Record<string, number | null> {
    return Object.fromEntries(this.children.map(({ spec, child }) => [spec.name, child.exitCode]));
  }

  start(spec: ProcessSpec): ChildProcess {
    if (this.cleanupPromise) throw new Error("Cannot start a process after cleanup began");
    const log = spec.logPath ? createWriteStream(spec.logPath, { flags: "a", encoding: "utf8" }) : undefined;
    let child: ChildProcess;
    try {
      child = this.spawnProcess(spec.command, spec.args, {
        cwd: spec.cwd,
        env: withoutProviderSecrets(spec.env),
        stdio: ["ignore", "pipe", "pipe"],
        shell: spec.shell ?? false,
        windowsHide: true,
        detached: process.platform !== "win32",
      });
    } catch (cause) {
      log?.end();
      throw new RunnerFailure("process.startup", `Could not start ${spec.name}`, { cause, details: { process: spec.name } });
    }
    const managed: ManagedProcess = { spec, child, ...(log ? { log } : {}) };
    this.children.push(managed);
    child.stdout?.on("data", chunk => log?.write(redactText(`[stdout] ${String(chunk)}`)));
    child.stderr?.on("data", chunk => log?.write(redactText(`[stderr] ${String(chunk)}`)));
    child.once("error", error => log?.write(`[spawn-error] ${error.message}\n`));
    child.once("exit", (code, signal) => log?.write(`[exit] code=${code ?? "null"} signal=${signal ?? "null"}\n`));
    return child;
  }

  async run(spec: ProcessSpec, timeoutMs = 120_000): Promise<void> {
    const child = this.start(spec);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new RunnerFailure("process.startup", `${spec.name} timed out`, { details: { process: spec.name, timeoutMs } })), timeoutMs);
      child.once("error", error => { clearTimeout(timer); reject(new RunnerFailure("process.startup", `${spec.name} failed to start`, { cause: error, details: { process: spec.name } })); });
      child.once("exit", (code, signal) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new RunnerFailure("process.startup", `${spec.name} exited unsuccessfully`, { details: { process: spec.name, code, signal } }));
      });
    });
  }

  cleanup(): Promise<void> {
    return this.cleanupPromise ??= this.cleanupProcesses();
  }

  private async cleanupProcesses(): Promise<void> {
    const failures: string[] = [];
    for (const managed of [...this.children].reverse()) {
      if (managed.child.exitCode === null && managed.child.signalCode === null) {
        await this.killTree(managed.child).catch(error => { failures.push(`${managed.spec.name}: ${String(error)}`); managed.log?.write(`[cleanup-error] ${String(error)}\n`); });
        if (managed.child.exitCode === null && managed.child.signalCode === null) failures.push(`${managed.spec.name}: process remained active`);
      }
      await new Promise<void>(resolve => managed.log ? managed.log.end(resolve) : resolve());
    }
    if (failures.length) throw new RunnerFailure("process.startup", `Process cleanup failed: ${failures.join("; ")}`);
  }
}

function defaultSpawn(command: string, args: readonly string[], options: SpawnOptions): ChildProcess {
  return spawn(command, [...args], options);
}

async function defaultKillTree(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    await new Promise<void>(resolve => {
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.once("error", () => resolve());
      killer.once("exit", () => resolve());
    });
    if (child.exitCode === null && child.signalCode === null) {
      await Promise.race([
        new Promise<void>(resolve => child.once("exit", () => resolve())),
        new Promise<void>(resolve => setTimeout(resolve, 2_000)),
      ]);
    }
    return;
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch { try { child.kill("SIGTERM"); } catch {} }
  await Promise.race([
    new Promise<void>(resolve => child.once("exit", () => resolve())),
    new Promise<void>(resolve => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
  }
}

export function executable(name: "node" | "pnpm"): string {
  if (name === "node") return process.execPath;
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

export function processLogPath(logsDir: string, name: string): string {
  return path.join(logsDir, `${name}.log`);
}
