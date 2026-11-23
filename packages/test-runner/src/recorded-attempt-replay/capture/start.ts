import type { OfflineTrialHost } from "../../offline-trial-experiment/run/offline-trial/index.js";
import { captureRecordedStoppedStart } from "./stopped-start.js";
import { recordedStartReceipt } from "./receipt.js";

/**
 * Captures an owned provider-free fixture host before entry; historical/user hosts are never inputs.
 * The caller enters this host's service itself, so `entry` is the exact service entry and is bound now.
 */
export async function captureRecordedStart(input: Parameters<typeof captureRecordedStoppedStart>[0] & { host: OfflineTrialHost; entry: unknown }) {
  const stopped = await captureRecordedStoppedStart(input, () => input.host.close());
  return { ...stopped, ...recordedStartReceipt(stopped.facts, input.entry) };
}
