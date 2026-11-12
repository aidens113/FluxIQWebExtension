import { createReaperClient, type ReaperClient } from "./reaper/index.js";

let reaper: ReaperClient | undefined;

/** The engine process's one reaper, spawned on first use. */
export function sharedReaper(): ReaperClient {
  if (reaper === undefined) {
    const created = createReaperClient();
    reaper = created;
    void created.failed.then(() => { if (reaper === created) reaper = undefined; });
  }
  return reaper;
}
