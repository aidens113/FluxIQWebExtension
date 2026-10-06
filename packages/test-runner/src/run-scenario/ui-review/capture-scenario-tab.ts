import type { Page } from "@playwright/test";
import { screenText } from "../extension-start-trace/index.js";
import type { OpenTab } from "./choose-scenario-tab.js";
import { screenLocation } from "./screen-location.js";
import type { UiReviewCapture } from "./types.js";
import { withTimeout } from "./with-timeout.js";

export type ScenarioTabCaptureInput = { page: Page; documentVisibility?: string; inFront?: boolean | "unknown"; frontTabs?: readonly string[]; openTabs?: readonly OpenTab[]; path: string; file: string; secrets: readonly string[]; timeoutMs: number };

// The page's rendered text and the values of fields that show theirs (never a password field, which paints dots). Read-only.
const shownText = () => {
  const values = [...document.querySelectorAll("input, textarea")]
    .filter(field => !(field instanceof HTMLInputElement && field.type === "password"))
    .map(field => (field as HTMLInputElement | HTMLTextAreaElement).value);
  return [document.body?.innerText ?? "", ...values].join("\n");
};

/**
 * Photographs the scenario tab's viewport into `path`, or says why not.
 *
 * Nothing is added to the page to take it. Playwright's own caret-hiding and
 * masking both insert elements, and this page is the one the extension may be
 * recording, so `caret: "initial"` and no mask. What cannot be masked is
 * withheld instead: when a run secret is shown in the page's text or a field
 * that displays its value, the picture is not taken. The check happens here, in
 * Node, so the secret is never handed to the page.
 *
 * A background tab in a headed Chromium does not paint and a screenshot of it
 * waits for a frame that never comes, so the capture is bounded by
 * `timeoutMs` and its failure recorded. It never throws.
 */
export async function captureScenarioTab(input: ScenarioTabCaptureInput): Promise<UiReviewCapture> {
  const started = Date.now();
  const base: UiReviewCapture = { source: "scenario-tab", location: screenLocation(input.page.url(), input.secrets), ...(input.documentVisibility === undefined ? {} : { documentVisibility: input.documentVisibility }), ...(input.inFront === undefined ? {} : { inFront: input.inFront }), ...(input.frontTabs ? { frontTabs: input.frontTabs.map(url => url.startsWith("unreadable:") ? screenText(url, input.secrets) : screenLocation(url, input.secrets)) } : {}), ...(input.openTabs ? { openTabs: input.openTabs.map(tab => ({ location: screenLocation(tab.url, input.secrets), inFront: tab.inFront })) } : {}) };
  try {
    const text = await withTimeout(input.page.evaluate(shownText), input.timeoutMs, "the scenario tab's text");
    if (input.secrets.some(secret => secret.length > 0 && text.includes(secret))) return { ...base, withheld: "a run secret is shown on the page", ms: Date.now() - started };
    await input.page.screenshot({ path: input.path, timeout: input.timeoutMs, caret: "initial", animations: "allow" });
    return { ...base, file: input.file, ms: Date.now() - started };
  } catch (error) {
    return { ...base, error: screenText(error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error), input.secrets), ms: Date.now() - started };
  }
}
