import type { BrowserContext, CDPSession } from "@playwright/test";
import { RunnerFailure } from "../../failure.js";

/** Discovery only: pairing and running-build checks still establish executable identity. */
export async function chromeWorkerTarget(context: unknown): Promise<{ url(): string } | undefined> {
  const browser = context as Partial<Pick<BrowserContext, "pages" | "newCDPSession">> | null;
  if (!browser || typeof browser.pages !== "function" || typeof browser.newCDPSession !== "function") return undefined;
  const page = browser.pages()[0];
  if (!page) return undefined;
  let session: CDPSession | undefined;
  try {
    session = await browser.newCDPSession(page);
    const result = await session.send("Target.getTargets") as { targetInfos?: Array<{ type?: unknown; url?: unknown }> };
    if (!Array.isArray(result.targetInfos)) return undefined;
    const urls = result.targetInfos.flatMap(target => {
      if (target.type !== "service_worker" || typeof target.url !== "string") return [];
      if (!URL.canParse(target.url)) return [];
      const url = new URL(target.url);
      return url.protocol === "chrome-extension:" && url.hostname && url.pathname !== "/" ? [target.url] : [];
    });
    return urls.length === 1 ? { url: () => urls[0]! } : undefined;
  } catch (error) {
    throw new RunnerFailure("extension.worker", "Chrome extension worker discovery was unavailable", {
      cause: error, details: { extensionStage: "worker-discovery" },
    });
  }
  finally { await session?.detach().catch(/* best-effort: diagnostic sessions may disconnect during browser shutdown */ () => undefined); }
}
