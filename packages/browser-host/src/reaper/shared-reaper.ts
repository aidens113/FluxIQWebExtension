import { createReaperClient, type ReaperClient } from "./reaper/index.js";

let reaper: ReaperClient | undefined;

/** The engine process's one reaper, spawned on first use. */
export function sharedReaper(): ReaperClient {
  reaper ??= createReaperClient();
  return reaper;
}
