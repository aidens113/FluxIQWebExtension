import { NativeAuthProbeError } from "./failure.js";

type Completion = Readonly<{ outcome: unknown; callbackMatched: boolean; nativeCallbackRequests: number; driverNativeClosed: boolean }>;

/** Diagnose a failed native completion without retaining callback material. */
export function assertNativeProbeCompletion(value: Completion): void {
  const diagnosis = { stage: "completion" as const, evidence: [] };
  if (value.outcome !== "success" || !value.driverNativeClosed) throw new NativeAuthProbeError("completion_unconfirmed", diagnosis);
  if (!value.callbackMatched) throw new NativeAuthProbeError("callback_mismatch", diagnosis);
  if (value.nativeCallbackRequests !== 0) throw new NativeAuthProbeError("callback_network_attempt", diagnosis);
}
