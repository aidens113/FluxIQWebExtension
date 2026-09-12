import { escapeHtml, fixtureClient, page } from "../../html.js";
import type { FailureSurfacesMode } from "./modes.js";

/** Where the workspace link guard sends a refused destination. */
export const BLOCKED_URL_PATH = "/scenarios/failure-surfaces/blocked";
/** The off-site destination the armed control now leads to, and which the guard refuses. */
const REFUSED_DESTINATION = "https://partner.example.invalid/records/4821";

/** The recorded control, in each of its four states. Everything else on the page is the same in every mode. */
const DETACH_SURFACE: Record<FailureSurfacesMode, string> = {
  baseline: `<button data-testid="detach-target">Detach me</button>`,
  disabled: `<button data-testid="detach-target" disabled>Detach me</button>`,
  detached: `<p data-testid="detach-target-removed">This item was deleted. Nothing here replaces it.</p>`,
  "blocked-url": `<button data-testid="detach-target" data-blocked-url="${REFUSED_DESTINATION}">Detach me</button>`,
};

/**
 * The detach handler for each mode. `detached` binds nothing, because the
 * control is not on the page: a page whose script threw on a missing element
 * would fail the run on a console error rather than on the target.
 */
const DETACH_SCRIPT: Record<FailureSurfacesMode, string> = {
  baseline: detachScript(),
  disabled: detachScript(),
  detached: `// The item was deleted, so there is no detach control to bind.`,
  "blocked-url": `const blocked = document.querySelector('[data-testid="detach-target"]');
blocked.addEventListener('click', () => { location.href = ${JSON.stringify(BLOCKED_URL_PATH)} + '?to=' + encodeURIComponent(blocked.dataset.blockedUrl); });`,
};

/**
 * `disabled-target` is disabled in every mode, `dead-link` is a control that
 * goes nowhere, and `close-surface` marks a page closure. They are page
 * furniture and content-harness fixtures, never recording-script targets: the
 * recording is made against this page unarmed, and a permanently refused
 * control is one no recording could ever press.
 *
 * `dead-link` was `blocked-url` until it collided with the variant of that
 * name. Nothing connected them: the variant arms `detach-target` to lead
 * off-site, while this control has never had a handler in any mode and never
 * carried a destination anywhere would follow. A shared name implied a
 * relationship the page does not have, and a script that reached for
 * `testid:blocked-url` expecting the guard would have recorded a click that
 * does nothing.
 */
export function renderFailureSurfaces(mode: FailureSurfacesMode, runToken: string): string {
  const body = `<main><h1>Failure surfaces</h1><button data-testid="disabled-target" disabled>Disabled</button>${DETACH_SURFACE[mode]}<button data-testid="dead-link">Link that goes nowhere</button><button data-testid="close-surface">Page closure marker</button><p data-testid="result" aria-live="polite">Ready</p></main>`;
  return page("Failure surfaces", body, `${fixtureClient(runToken, "failure-surfaces")}
${DETACH_SCRIPT[mode]}
document.querySelector('[data-testid="close-surface"]').addEventListener('click', async () => { await mutate('attempt', { kind: 'page-closure' }); document.querySelector('[data-testid="result"]').textContent = 'Closure requested'; });`);
}

/**
 * The workspace's link-guard interstitial: the destination is named and not
 * followed. It stays on loopback deliberately -- a run that actually reached
 * `partner.example.invalid` would be stopped by the deterministic network
 * policy and reported as a network violation, which is a different failure
 * from the one this surface is for.
 */
export function renderBlockedDestination(destination: string | null): string {
  const named = escapeHtml((destination ?? REFUSED_DESTINATION).slice(0, 200));
  const body = `<main><h1 data-testid="access-blocked">Blocked by your workspace</h1>
    <p>This workspace does not allow requests to <code data-testid="blocked-destination">${named}</code>.</p>
    <nav><a data-testid="back-to-surfaces" href="/scenarios/failure-surfaces/">Back to the record</a></nav></main>`;
  return page("Blocked by your workspace", body, "");
}

function detachScript(): string {
  return `const detached = document.querySelector('[data-testid="detach-target"]'); detached.addEventListener('click', async () => { detached.remove(); await mutate('attempt', { kind: 'detached' }); });`;
}
