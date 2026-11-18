import type { Browser, BrowserContext } from "@playwright/test";
import { NativeAuthProbeError } from "./failure.js";
import { nativeProbeEvidence } from "./evidence/index.js";
import { assertProbeProfileIdle } from "./profile-idle.js";
import type { ProbeAllocation } from "./model.js";
import type { NativeProxy } from "./proxy/index.js";

type Resources = { allocation: ProbeAllocation; context?: Pick<BrowserContext, "close"> | undefined; browser?: Pick<Browser, "isConnected" | "close"> | undefined; proxy: Pick<NativeProxy, "close"> };

/** Every owned resource is attempted; failed process proof retains the profile. */
export async function closeProbeResources(resources: Resources): Promise<void> {
  const context = await Promise.allSettled([Promise.resolve().then(() => resources.context?.close())]);
  const transport = await Promise.allSettled([Promise.resolve().then(() => resources.browser?.isConnected() ? resources.browser.close() : undefined)]);
  const profile = await Promise.allSettled([Promise.resolve().then(() => assertProbeProfileIdle(resources.allocation))]);
  const proxy = await Promise.allSettled([Promise.resolve().then(() => resources.proxy.close())]);
  const status = { contextClosed: context[0]!.status === "fulfilled", transportClosed: transport[0]!.status === "fulfilled", profileIdle: profile[0]!.status === "fulfilled", proxyClosed: proxy[0]!.status === "fulfilled" };
  if (Object.values(status).some(value => !value)) throw new NativeAuthProbeError(status.profileIdle ? "browser_close" : "process_survived", { stage: "cleanup", evidence: [nativeProbeEvidence("cleanup", { ...status, cleanupVerified: false })] });
}
