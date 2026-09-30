import type { BrowserContext, Page } from "@playwright/test";
import type { CaptureSource } from "./capture-first-available.js";

/** Playwright's own wait, inside the capture deadline: a headed tab that is not composited never answers, so it may not wait longer. */
const FRONT_TAB_TIMEOUT_MS = 3_000;

/**
 * The fallback where the native capture is unavailable: a Playwright
 * screenshot of the scenario tab the person is looking at.
 *
 * Only a tab that reports itself visible is photographed. A headed Chromium
 * does not composite a background tab, so a screenshot of one waits out its
 * timeout and returns nothing, which is how this facility once spent 120 s of
 * a 437 s run photographing an abandoned `about:blank`. No tab is ever brought
 * to the front for the picture: the run, not the camera, decides what is in front.
 */
export function frontTabSource(context: BrowserContext, scenarioOrigin: string, quality: number): CaptureSource {
  return {
    name: "playwright-front-tab",
    timeoutMs: FRONT_TAB_TIMEOUT_MS,
    capture: async () => {
      const candidates = context.pages().filter(page => !page.isClosed() && originOf(page.url()) === scenarioOrigin).reverse();
      for (const page of candidates) {
        if (await isVisible(page)) return await page.screenshot({ type: "jpeg", quality, timeout: FRONT_TAB_TIMEOUT_MS });
      }
      throw new Error(`No ${scenarioOrigin} tab is in front`);
    },
  };
}

async function isVisible(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => document.visibilityState === "visible");
  } catch (error) {
    // A tab navigating or closing as it is asked cannot be the one in front at this instant; any other failure is the capture's.
    if (page.isClosed() || /navigat|context was destroyed|closed/iu.test(error instanceof Error ? error.message : String(error))) return false;
    throw error;
  }
}

function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
