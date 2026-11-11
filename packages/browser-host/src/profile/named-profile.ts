import { mkdir } from "node:fs/promises";
import path from "node:path";
import { safeSegment } from "./safe-segment.js";

/**
 * Where a named profile lives for one host: `<dataDir>/browser-hosts/<name>/<hostId>`.
 * Chromium locks a profile directory, so each host of a name gets its own; the
 * directory is kept across runs, so the extension's stored token resumes.
 */
export function namedProfileDirectory(dataDir: string, name: string, hostId: string): string {
  return path.join(dataDir, "browser-hosts", safeSegment(name, "profile name"), safeSegment(hostId, "host id"));
}

export async function createNamedProfile(dataDir: string, name: string, hostId: string): Promise<string> {
  const directory = namedProfileDirectory(dataDir, name, hostId);
  await mkdir(directory, { recursive: true });
  return directory;
}
