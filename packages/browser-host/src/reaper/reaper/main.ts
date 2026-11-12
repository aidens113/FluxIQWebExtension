// The reaper: a detached process the engine spawns once, with an IPC channel.
// It holds the profile directories the engine's hosts run on. When the channel
// closes, which happens on any death of the engine (TerminateProcess, SIGKILL,
// a crash), it kills whatever still holds those directories, removes the fresh
// ones, and exits. It exits at once when nothing is registered.
import { removeProfile } from "../../profile/index.js";
import { releaseProfile } from "../release-profile.js";
import { isReaperMessage } from "./message.js";

const held = new Map<string, boolean>();

process.on("message", message => {
  if (!isReaperMessage(message)) return;
  if (message.type === "register") held.set(message.directory, message.fresh);
  else held.delete(message.directory);
  if (process.connected) process.send?.({ type: "ack", requestId: message.requestId });
});

process.on("disconnect", () => {
  void sweep().finally(() => process.exit(0));
});

async function sweep(): Promise<void> {
  for (const [directory, fresh] of held) {
    try {
      await releaseProfile(directory);
      if (fresh) await removeProfile(directory);
    } catch (error) {
      process.stderr.write(`browser-host reaper: could not clear a profile: ${(error as Error).message}\n`);
    }
  }
}

if (!process.connected) process.emit("disconnect");
