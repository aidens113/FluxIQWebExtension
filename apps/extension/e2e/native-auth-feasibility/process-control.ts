import { findProfileProcesses, killProcessTree, listProcesses } from "../../../../packages/browser-host/src/reaper/index.js";
import { assertProbeAllocation } from "./allocation/index.js";
import { NativeAuthProbeError } from "./failure.js";
import type { ProbeAllocation } from "./model.js";

export async function stopProbeProcess(allocation: ProbeAllocation): Promise<void> {
  await assertProbeAllocation(allocation);
  const matches = findProfileProcesses(await listProcesses(), allocation.profile);
  const browsers = matches.filter(entry => !/(?:^|\s|")--type=/u.test(entry.commandLine));
  if (browsers.length !== 1) throw new NativeAuthProbeError("ownership");
  const verified = findProfileProcesses(await listProcesses(), allocation.profile).filter(entry => entry.pid === browsers[0]!.pid && !/(?:^|\s|")--type=/u.test(entry.commandLine));
  if (verified.length !== 1) throw new NativeAuthProbeError("ownership");
  await killProcessTree(verified[0]!.pid, true);
}
