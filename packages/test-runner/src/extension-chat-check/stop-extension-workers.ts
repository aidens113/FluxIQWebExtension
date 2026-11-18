import type { BrowserContext, Page } from "@playwright/test";

type TargetInfo = { targetId: string; type: string; url: string };

/**
 * Closes the extension's service worker target (`Target.closeTarget`, the call Chrome's own
 * extension documentation uses to test worker termination) and waits, briefly, for Chrome to
 * stop listing it. Chrome starts the worker again on the extension's next event, and the new one
 * reads its settings from storage.
 */
export async function stopExtensionWorkers(context: BrowserContext, page: Page, waitMs = 3_000): Promise<void> {
  const session = await context.newCDPSession(page);
  try {
    const listed = async (): Promise<TargetInfo[]> => ((await session.send("Target.getTargets")) as { targetInfos: TargetInfo[] }).targetInfos.filter(info => info.type === "service_worker" && info.url.startsWith("chrome-extension://"));
    const stopped = await listed();
    for (const worker of stopped) await session.send("Target.closeTarget", { targetId: worker.targetId });
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline && (await listed()).some(info => stopped.some(old => old.targetId === info.targetId))) await new Promise(resolve => setTimeout(resolve, 100));
  } finally {
    await session.detach().catch(/* best-effort: the session is only a means to close the worker */ () => undefined);
  }
}
