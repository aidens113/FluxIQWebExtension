// Whether the start page will actually accept a Core-issued action on a
// target, which is not the same question as whether the target is visible.
//
// `selectCoreProbeStep` picks the first `type` step whose target is on the
// start page, and "on the start page" used to mean Playwright's `visible`.
// Visible ignores occlusion. On a fixture whose start page opens a consent
// overlay, every field underneath it is visible, so the probe always chose a
// covered one and Core rightly refused to type into it:
//
//   Action blocked: the point 439,360 landed on
//   div[data-testid="cookie-consent-scrim"], which covers the target; a modal
//   dialog is open over the page, so a person has to answer it
//
// A trial click asks the question the probe actually means. Playwright runs its
// whole actionability check -- attached, visible, stable, enabled, and
// *receives events*, which is the occlusion test -- and then does not click, so
// the page is left exactly as the recording expects to find it.

/** The part of a Playwright page this needs: enough for a fake to stand in for one. */
export type ProbeTargetPage = {
  locator(selector: string): { first(): { click(options: { trial: true; timeout: number }): Promise<void> } };
};

/**
 * Whether a Core-issued action on `selector` would reach the page, within
 * `timeoutMs`. A rejection is an answer, not a fault: an unusable target is the
 * ordinary case this exists to detect, and the next candidate is tried.
 */
export async function coreProbeTargetUsable(page: ProbeTargetPage, selector: string, timeoutMs: number): Promise<boolean> {
  return page.locator(selector).first().click({ trial: true, timeout: timeoutMs }).then(() => true, () => false);
}
