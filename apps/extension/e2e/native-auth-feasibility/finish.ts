import { removeProbeAllocation } from "./allocation/index.js";
import { NativeAuthProbeError } from "./failure.js";
import { nativeProbeEvidence } from "./evidence/index.js";
import type { ProbeAllocation, ProbeEvidence } from "./model.js";

type FinishPorts = { allocation?: ProbeAllocation | undefined; host?: { close(): Promise<void> } | undefined; fixture?: { close(): Promise<void> } | undefined; evidence: ProbeEvidence[] };

/** Partial setup cannot erase earlier cleanup uncertainty or delete its evidence. */
export async function finishNativeProbe(ports: FinishPorts): Promise<boolean> {
  let clean = !ports.evidence.some(value => value.case === "cleanup" && Object.values(value.values).some(field => field === false));
  try { await ports.host?.close(); } catch (error) {
    clean = false;
    if (error instanceof NativeAuthProbeError) ports.evidence.push(...error.evidence);
  }
  try { await ports.fixture?.close(); } catch { clean = false; }
  if (clean && ports.allocation) {
    try { await removeProbeAllocation(ports.allocation); } catch { clean = false; }
  }
  const observation = nativeProbeEvidence("cleanup", { cleanupVerified: clean });
  ports.evidence.push(observation);
  process.stdout.write(`${JSON.stringify({ nativeProbe: observation })}\n`);
  return clean;
}
