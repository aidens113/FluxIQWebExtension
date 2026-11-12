import { rm } from "node:fs/promises";

/** Removes a profile directory, retrying while Windows still holds a file lock from a process that is exiting. */
export async function removeProfile(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}
