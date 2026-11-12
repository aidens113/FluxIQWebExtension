import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cleanEnvironment } from "../../clean-environment.js";
import { BrowserHostError } from "../../errors/index.js";

/** The engine process's handle on its reaper. */
export type ReaperClient = {
  /** Resolves once the reaper has the message, so a launch can wait for its protection before it starts a browser. */
  register(directory: string, fresh: boolean): Promise<void>;
  forget(directory: string): Promise<void>;
  /** Resolves if crash protection is lost; every protected host must close. */
  failed: Promise<Error>;
  /** Cuts the link, as the engine's death would: the reaper then clears every registered profile. */
  disconnect(): void;
};

const REAPER_SCRIPT = fileURLToPath(new URL("./main.js", import.meta.url));

/**
 * Spawns a reaper: detached, with no window, no stdio but the IPC channel, and
 * a credential-free environment. Neither the process nor its channel keeps the
 * engine alive.
 */
export function createReaperClient(options: { spawnReaper?: () => ChildProcess } = {}): ReaperClient {
  const child = options.spawnReaper?.() ?? spawn(process.execPath, [REAPER_SCRIPT], { detached: true, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"], env: cleanEnvironment() });
  const pending = new Map<number, { resolve(): void; reject(error: Error): void }>();
  let failure: Error | undefined;
  let resolveFailure: (error: Error) => void = () => undefined;
  const failed = new Promise<Error>((resolve) => { resolveFailure = resolve; });
  const fail = (cause: unknown): void => {
    if (failure) return;
    failure = new BrowserHostError("browser_host.reaper_lost", "The browser-host reaper lost its IPC connection; protected hosts are closing.", { cause });
    for (const waiter of pending.values()) waiter.reject(failure);
    pending.clear();
    resolveFailure(failure);
  };
  child.on("error", fail);
  child.on("disconnect", () => fail(new Error("The reaper disconnected.")));
  child.on("exit", () => fail(new Error("The reaper exited.")));
  child.on("message", (value: unknown) => {
    const message = value as { type?: string; requestId?: number } | null;
    if (message?.type !== "ack" || message.requestId === undefined) return;
    pending.get(message.requestId)?.resolve();
    pending.delete(message.requestId);
  });
  if (child.pid === undefined) throw new BrowserHostError("browser_host.reaper_failed", "The browser-host reaper could not be started, so leftover browsers could not be cleaned up after an engine crash.");
  child.unref();
  child.channel?.unref();
  let requestId = 0;
  const send = (type: "register" | "forget", directory: string, fresh?: boolean): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!child.connected || failure) return reject(failure ?? new BrowserHostError("browser_host.reaper_lost", "The reaper is not connected."));
      const id = ++requestId;
      pending.set(id, { resolve, reject });
      try {
        child.send({ type, directory, requestId: id, ...(type === "register" ? { fresh } : {}) }, (error) => { if (error) fail(error); });
      } catch (error) { fail(error); }
    });
  return {
    register: (directory, fresh) => send("register", directory, fresh),
    forget: directory => send("forget", directory),
    failed,
    disconnect: () => {
      if (child.connected) child.disconnect();
    }
  };
}
