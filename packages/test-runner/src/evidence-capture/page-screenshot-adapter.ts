// What a run's evidence is a picture of, and what it costs when there is no
// picture to be had.
//
// A screenshot of a Playwright page is `Page.captureScreenshot` over CDP, and
// the Lab drives a *headed* persistent context (`run-scenario.ts`,
// `chromium.launchPersistentContext(..., { headless: false })`). A headed
// Chromium does not composite a tab that is not in front, so the command never
// answers; Playwright's screenshotter does not raise the tab first, and aborts
// the attempt at its own `DEFAULT_TIMEOUT` of 30_000 ms
// (`playwright-core/lib/client/timeoutSettings.js`). The runner's default is
// unset, so that is the number every failed capture pays.
//
// The created-Flow lane makes that the ordinary case rather than the rare one.
// A task whose Flow must reach its own page has the harness blank its tab
// before the build and again before playback (`lane-rules/flow-start-page.ts`),
// and FluxIQ then drives a tab of its own, which takes the front. The page the
// capture rule names -- the step runner's active page, else the scenario tab --
// is from that moment an abandoned `about:blank` in the background, and no
// capture of it can ever succeed again.
//
// Two live runs measured what that cost. In `run-muhnh0s5-98a27f42` the repair
// settled at 376.6 s and the run's failure was published at 436.6 s, a tail of
// exactly 60.0 s in which nothing ran but two screenshots of that tab: the
// failure screenshot, and then the identical capture the failure event's own
// publication asked for. `run-muher0en-508ddb69` measured 889.0 s to 949.1 s
// for the same two. A third and a fourth are paid at the build settlement and
// the repair settlement, each 30.0 s -- the gap from `snapshots/live-llm.json`
// being written to the settlement event being published is 346.6 s to 376.6 s
// in the first run and 859.0 s to 889.0 s in the second. Every one of them
// ended as `capture-unavailable`.
//
// So the latch below. The first attempt on a page is made in full, because a
// capture that can succeed must be waited for. Its failure is then the proof
// that this page, as it now stands, cannot be photographed, and every later
// request for the same page at the same address is answered from that proof
// instead of paying 30_000 ms to be told again. A page that navigates, or a
// different page, is a different question and is attempted afresh; a capture
// that succeeds clears the proof. Nothing is given a shorter deadline and no
// evidence that could have arrived is skipped -- what is removed is the second,
// third and fourth wait for evidence the first wait established cannot come.

import type { CaptureEvidenceEventInput, ScreenshotAdapter, VerifiedVisual } from "@fluxiq-web-extension/test-evidence";

/**
 * The part of a Playwright `Page` a capture needs. Structural, so the adapter
 * is unit-testable without a browser, which is the only way the waits above
 * can be measured at all outside a live run.
 */
export type CapturablePage = {
  isClosed(): boolean;
  url(): string;
  screenshot(options: { type: "png" }): Promise<Uint8Array>;
};

/**
 * The evidence capture controller's screenshot adapter, over whichever page the
 * run currently says it is looking at.
 *
 * `shownPage` is read on every capture rather than bound once: the page the
 * runner is showing changes as a scenario proceeds, and a capture must picture
 * the page as it is at the moment of the event, not as it was when the run
 * started.
 */
export function createPageScreenshotAdapter(shownPage: () => CapturablePage | undefined): ScreenshotAdapter {
  // The page and address a capture has already failed on. Held rather than
  // counted: this is a statement about one page in one state, not a budget.
  let unphotographable: { page: CapturablePage; address: string } | undefined;
  return {
    async capture(_input: CaptureEvidenceEventInput): Promise<VerifiedVisual | undefined> {
      const page = shownPage();
      // Before the scenario tab exists, and after it closes, there is nothing
      // to photograph. Neither is a failed attempt, so neither latches.
      if (!page || page.isClosed()) return undefined;
      const address = page.url();
      if (unphotographable && unphotographable.page === page && unphotographable.address === address) return undefined;
      const attempt = await attemptCapture(page);
      unphotographable = attempt.captured ? undefined : { page, address };
      return attempt.captured ? attempt.visual : undefined;
    },
  };
}

/**
 * One photograph of one page, stated either way.
 *
 * A capture that fails becomes `captured: false` rather than nothing: the
 * caller has to read which happened, so a tab that could not be photographed
 * can be told apart from a tab there was no reason to photograph, and only the
 * first of those is worth remembering.
 */
type CaptureAttempt = { captured: true; visual: VerifiedVisual } | { captured: false };

async function attemptCapture(page: CapturablePage): Promise<CaptureAttempt> {
  try {
    const bytes = await page.screenshot({ type: "png" });
    return { captured: true, visual: { bytes, mediaType: "image/png", redactionVerified: true } };
  } catch {
    return { captured: false };
  }
}
