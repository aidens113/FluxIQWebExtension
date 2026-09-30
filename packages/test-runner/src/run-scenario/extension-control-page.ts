// Opening the extension's control page, once more if its renderer crashed.
//
// Two live runs on 2026-09-29 (`run-muna3yfq-a7d8a2a0`, `run-munbu244-4f4021a8`)
// ended before their build with `page.goto: Page crashed` on
// `sidepanel/index.html`, while the machine had about 3 GB of commit free and
// other lanes' browsers running. The run between them loaded the same page
// cleanly. A renderer that died loading a static extension page says nothing
// about the product, and the run spent no provider call yet, so the page is
// opened again in a fresh tab, once. A second crash still ends the run, as it
// did, and both attempts are counted on the page that is returned.
import type { BrowserContext, Page } from "@playwright/test";

const RENDERER_CRASH = /\b(?:Page|Target) crashed\b/u;

/** How many times the control page was opened before it loaded. One is the ordinary case. */
export type ExtensionControlPageOpen = { page: Page; attempts: number };

export async function openExtensionControlPage(context: Pick<BrowserContext, "newPage">, url: string, maxAttempts = 2): Promise<ExtensionControlPageOpen> {
  for (let attempt = 1; ; attempt += 1) {
    const page = await context.newPage();
    try {
      await page.goto(url);
      return { page, attempts: attempt };
    } catch (error) {
      const crashed = error instanceof Error && RENDERER_CRASH.test(error.message);
      if (!crashed || attempt >= maxAttempts) throw error;
      await page.close().catch(/* best-effort: a crashed tab may already be gone */ () => undefined);
    }
  }
}
