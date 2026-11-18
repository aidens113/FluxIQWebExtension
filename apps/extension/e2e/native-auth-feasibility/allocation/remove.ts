import { rm } from "node:fs/promises";
import { assertProbeProfileIdle } from "../profile-idle.js";
import type { ProbeAllocation } from "../model.js";
import { assertProbeAllocation } from "./assert.js";

export async function removeProbeAllocation(allocation: ProbeAllocation): Promise<void> {
  await assertProbeAllocation(allocation);
  await assertProbeProfileIdle(allocation);
  await rm(allocation.root, { recursive: true, force: true });
}
