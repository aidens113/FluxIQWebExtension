import { findProfileProcesses, listProcesses } from "../../../../packages/browser-host/src/reaper/index.js";
import { NativeAuthProbeError } from "./failure.js";
import type { ProbeAllocation } from "./model.js";

export async function assertProbeProfileIdle(allocation: ProbeAllocation): Promise<void> {
  if (findProfileProcesses(await listProcesses(), allocation.profile).length !== 0) throw new NativeAuthProbeError("process_survived");
}
