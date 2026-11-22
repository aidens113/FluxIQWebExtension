import type { OfflineTrialHost } from "../../offline-trial-experiment/run/offline-trial/index.js";
import { captureRecordedStoppedStart } from "./stopped-start.js";

/** Captures an owned provider-free fixture host before entry; historical/user hosts are never inputs. */
export function captureRecordedStart(input: Parameters<typeof captureRecordedStoppedStart>[0] & { host: OfflineTrialHost }) {
  return captureRecordedStoppedStart(input, () => input.host.close());
}
