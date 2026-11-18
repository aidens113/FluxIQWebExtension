import type { BrowserContext, Page } from "playwright-core";

/**
 * The extension's own side-panel page opened as a tab. The extension accepts
 * `fluxiq.connect` only from its own control pages, and this is one; a web page
 * cannot reach it.
 */
export async function openControlPage(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel/index.html`, { waitUntil: "domcontentloaded" });
  return page;
}
