import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { safeSegment } from "./safe-segment.js";

/** A new, empty profile directory in the user's own temp directory, owned by one host and removed when it closes. */
export async function createFreshProfile(hostId: string, root: string = os.tmpdir()): Promise<string> {
  return mkdtemp(path.join(root, `fluxiq-host-${safeSegment(hostId, "host id")}-`));
}
