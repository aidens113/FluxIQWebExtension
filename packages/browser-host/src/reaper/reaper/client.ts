import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cleanEnvironment } from "../../clean-environment.js";
import { BrowserHostError } from "../../errors/index.js";
import type { ReaperMessage } from "./message.js";

/** The engine process's handle on its reaper. */
export type ReaperClient = {
  /** Resolves once the reaper has the message, so a launch can wait for its protection before it starts a browser. */
  register(directory: string, fresh: boolean): Promise<void>;
  forget(directory: string): Promise<void>;
  /** Cuts the link, as the engine's death would: the reaper then clears every registered profile. */
  disconnect(): void;
};

const REAPER_SCRIPT = fileURLToPath(new URL("./main.js", import.meta.url));

/**
 * Spawns a reaper: detached, with no window, no stdio but the IPC channel, and
 * a credential-free environment. Neither the process nor its channel keeps the
 * engine alive.
 */
export function createReaperClient(): ReaperClient {
  const child = spawn(process.execPath, [REAPER_SCRIPT], { detached: true, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"], env: cleanEnvironment() });
  child.on("error", () => undefined);
  if (child.pid === undefined) throw new BrowserHostError("browser_host.reaper_failed", "The browser-host reaper could not be started, so leftover browsers could not be cleaned up after an engine crash.");
  child.unref();
  child.channel?.unref();
  const send = (message: ReaperMessage): Promise<void> =>
    new Promise(resolve => {
      if (!child.connected) return resolve();
      child.send(message, () => resolve());
    });
  return {
    register: (directory, fresh) => send({ type: "register", directory, fresh }),
    forget: directory => send({ type: "forget", directory }),
    disconnect: () => {
      if (child.connected) child.disconnect();
    }
  };
}
