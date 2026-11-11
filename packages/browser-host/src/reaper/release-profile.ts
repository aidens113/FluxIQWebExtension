import { setTimeout as delay } from "node:timers/promises";
import { BrowserHostError } from "../errors/index.js";
import { findProfileProcesses } from "./find-profile-processes.js";
import { killProcessTree } from "./kill-process-tree.js";
import { listProcesses } from "./list-processes.js";
import type { BrowserProcessEntry } from "./process-entry.js";

const RECHECK_MS = 200;

/**
 * Ends every process still holding `profileDir` and returns once a fresh
 * listing shows none. A first pass asks politely where the platform has a
 * polite signal; later passes force. Rechecking, not a fixed wait, is how it
 * knows they are gone, and it fails naming the directory if they are not by
 * `deadlineMs`. Never kills its own process.
 */
export async function releaseProfile(profileDir: string, deadlineMs = 20_000, list: () => Promise<BrowserProcessEntry[]> = listProcesses): Promise<void> {
  const end = Date.now() + deadlineMs;
  for (let pass = 0; ; pass++) {
    const held = findProfileProcesses(await list(), profileDir).filter(entry => entry.pid !== process.pid);
    if (held.length === 0) return;
    if (Date.now() > end) throw new BrowserHostError("browser_host.profile_held", `Processes still hold the browser profile ${profileDir}: ${held.map(entry => entry.pid).join(", ")}.`);
    await Promise.all(held.map(entry => killProcessTree(entry.pid, pass > 0)));
    await delay(RECHECK_MS);
  }
}
