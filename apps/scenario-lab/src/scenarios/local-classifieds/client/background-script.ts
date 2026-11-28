/**
 * What every page does in the background, the way a real marketplace's pages
 * do, without ever changing the page (t1094):
 *
 * - An analytics beacon: the page view, then an engagement heartbeat every
 *   `cfg.timing.beaconInterval` ms (600-900 by seed) for as long as the page
 *   is open. Each beat is scheduled after the last one answered, by a fresh
 *   closure, as tag managers' batching does.
 * - A long poll for new messages: `updates.json` is asked with a 25-second
 *   wait, and asked again at once when it answers. The Lab's server cannot
 *   hold a request open (its routes answer synchronously), so it answers at
 *   once with no news and `held: false`, and the page falls back to asking
 *   every 25 seconds, as long-poll clients do when the server cannot hold. A
 *   browser spec that needs the request held holds it itself
 *   (`apps/extension/e2e/content/tests/page-readiness/`).
 *
 * Real sites never go quiet on the network; this is what lets the Lab show
 * that a step's readiness waits for the page being drawn and not for the
 * network to stop (`docs/architecture/testing-facility.md`, "Background
 * traffic").
 */
export const BACKGROUND_SCRIPT = String.raw`
(function background() {
  let beats = 0;
  const beacon = async (event) => {
    beats += 1;
    try {
      await fetch(root + 'collect?ev=' + event + '&n=' + beats, { keepalive: true, cache: 'no-store' });
    } catch (error) {
      // A lost beacon is not sent again.
    }
    setTimeout(() => beacon('heartbeat'), cfg.timing.beaconInterval);
  };
  beacon('page_view');

  let since = 0;
  let fallback;
  async function listen() {
    const asked = Date.now();
    let answer = null;
    try {
      answer = await (await fetch(root + 'updates.json?since=' + since + '&wait=25', { cache: 'no-store' })).json();
    } catch (error) {
      answer = null;
    }
    if (answer && typeof answer.since === 'number') since = answer.since;
    // A server that held the question answers when something happens or its wait ends: ask again at once.
    if (answer && answer.held !== false && Date.now() - asked >= 1000) { listen(); return; }
    // One that could not hold it, or a failed question, is asked every 25 seconds instead.
    if (fallback === undefined) fallback = setInterval(listen, 25000);
  }
  listen();
})();
`;
