import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProbeAllocation } from "../model.js";

export async function createProbeAllocation(): Promise<ProbeAllocation> {
  const intended = fileURLToPath(new URL("../../../test-results/native-auth-feasibility-owned/", import.meta.url));
  await mkdir(intended, { recursive: true });
  const parent = await realpath(intended);
  const root = await mkdtemp(path.join(parent, "probe-chrome-"));
  const allocation = { parent, root, profile: path.join(root, "profile"), extension: path.join(root, "extension") };
  await mkdir(allocation.profile);
  return allocation;
}
