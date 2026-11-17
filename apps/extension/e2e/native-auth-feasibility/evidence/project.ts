import type { ProbeEvidence } from "../model.js";

/** Closed projection: arbitrary browser/API payloads never enter evidence. */
export function nativeProbeEvidence(caseName: "artifact" | "pending" | "capture" | "completion" | "success" | "user_close" | "cancel" | "reload" | "worker_stop" | "graceful_restore" | "crash_restore" | "cleanup", input: Readonly<Record<string, unknown>>): ProbeEvidence {
  const values: Record<string, boolean | number | string> = {};
  for (const name of ["ordinaryVisible", "contentReady", "callbackMatched", "lateResultDiscarded", "pending", "driverNativeVisible", "driverNativeClosed", "extensionReloaded", "workerStopped", "nativeAfterRestart", "controlAfterRestart", "cleanupVerified", "contextClosed", "transportClosed", "profileIdle", "proxyClosed"]) {
    if (typeof input[name] === "boolean") values[name] = input[name];
  }
  for (const name of ["nativeMatches", "bytes", "width", "height", "forwarded", "denied", "nativeCallbackRequests", "connectionResets", "transportFailures"]) {
    if (typeof input[name] === "number" && Number.isSafeInteger(input[name]) && input[name] >= 0 && input[name] <= 1_000_000_000) values[name] = input[name];
  }
  for (const name of ["isolated", "main"]) if (["present", "absent", "refused", "not_visible"].includes(String(input[name]))) values[name] = String(input[name]);
  if (["idle", "pending", "success", "rejected", "locally_cancelled", "captured", "refused", "invalid"].includes(String(input.outcome))) values.outcome = String(input.outcome);
  for (const name of ["digest", "contentSha256", "pageWorldSha256"]) if (typeof input[name] === "string" && /^[0-9a-f]{64}$/u.test(input[name])) values[name] = input[name];
  if (typeof input.browserVersion === "string" && /^(?:Headless)?Chrome\/\d+(?:\.\d+){3}$/u.test(input.browserVersion)) values.browserVersion = input.browserVersion;
  return { case: caseName, values };
}
