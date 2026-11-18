import type { Page } from "@playwright/test";
import { NativeAuthProbeError } from "./failure.js";
import type { ProbeReply } from "./model.js";

export async function nativeProbeCommand(page: Page, command: "ready" | "control" | "start" | "status" | "observe" | "capture" | "complete" | "close" | "cancel" | "alternate" | "reload"): Promise<ProbeReply> {
  let response: ProbeReply;
  try { response = await page.evaluate(value => chrome.runtime.sendMessage({ type: "native-probe", command: value }), command) as ProbeReply; }
  catch { throw new NativeAuthProbeError("operation_refused"); }
  if (response?.ok !== true) throw new NativeAuthProbeError("operation_refused");
  return response;
}
