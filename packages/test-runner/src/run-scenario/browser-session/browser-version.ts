import type { BrowserContext, Page } from "@playwright/test";

/**
 * The browser build the run actually executed in, read over CDP.
 *
 * `context.browser()?.version()` answers for the Playwright-managed browser and
 * returns nothing useful for a persistent context, so the run manifest recorded
 * "chromium" and nothing more. `Browser.getVersion` answers from the running
 * process itself, and its `product` is the exact build string; the user agent is
 * the fallback for a build that reports no product.
 */
export async function browserVersionFromCdp(context: BrowserContext, page: Page): Promise<string> {
  const session = await context.newCDPSession(page);
  try {
    const result = await session.send("Browser.getVersion");
    return result.product || result.userAgent;
  } finally {
    await session.detach();
  }
}
