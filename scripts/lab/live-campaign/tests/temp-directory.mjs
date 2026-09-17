import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Runs `body` with a fresh temporary directory, removed afterwards whatever happens. */
export async function withTemp(body) {
  const directory = await mkdtemp(path.join(tmpdir(), "fluxiq-live-campaign-"));
  try { return await body(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
