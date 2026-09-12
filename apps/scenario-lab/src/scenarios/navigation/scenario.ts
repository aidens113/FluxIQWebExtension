import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

/** `broken-link` retires the page the recorded link points at, so following it lands somewhere else. */
export type NavigationMode = "baseline" | "broken-link";

/** `mode` is absent until the fixture is armed; see `ambiguous-targets` for why. */
export type NavigationState = { visits: string[]; redirectCount: number; mode?: NavigationMode };

const navigationPageNames = ["start", "second", "history", "redirected"];
/** Pages `visit` may name; the retired notice is a page of its own but is not rendered by `navigationPage`. */
const visitablePageNames = [...navigationPageNames, "link-retired"];

/**
 * Where a retired link lands. Nothing rewrites the recorded link's `href`: the
 * page it points at is simply gone, and the site answers the way a large site
 * answers a retired URL -- a redirect to a notice served `404`. So the landed
 * URL is not the requested one, which is what `navigation_unexpected` names,
 * and the notice carries no `navigation-page` heading, so the recorded wait for
 * the second page cannot be satisfied by the notice standing in for it.
 */
const RETIRED_LINK_PATH = "/scenarios/navigation/link-retired";

export const navigationScenario = defineScenario<NavigationState>({
  id: "navigation",
  title: "Navigation",
  startPath: "/scenarios/navigation/start",
  seed: 103,
  manifest: createScenarioManifest({
    id: "navigation", title: "Navigation", tags: ["navigation", "history"], seed: 103,
    startPath: "/scenarios/navigation/start", capabilities: ["navigation"],
    recordingScript: [
      { id: "full-navigation", operation: "click", target: "testid:full-navigation" },
      { id: "second-page", operation: "waitForState", target: "testid:navigation-page", timeoutMs: 1000 },
      { id: "history-page", operation: "navigate", path: "/scenarios/navigation/history" },
      { id: "navigation-final", operation: "checkpoint" },
    ],
    expected: {
      recordingEvents: [{ type: "web.page.navigated" }],
      actions: [{ action: "web.browser.navigate", outcome: "succeeded" }],
      finalState: [{ id: "history-location", subject: "document", predicate: "path", value: "/scenarios/navigation/history" }],
    },
    variants: [{
      id: "broken-link",
      description: "The second page has been retired: the recorded link still points at it, the site answers with a redirect to a 404 notice, and the run lands on a URL it never asked for.",
      arm: { operation: "set-mode", payload: { mode: "broken-link" } },
      expected: {
        actions: [{ action: "web.dom.click" }],
        finalState: [
          { id: "retired-location", subject: "document", predicate: "path", value: RETIRED_LINK_PATH },
          { id: "retired-notice", subject: "link-retired", predicate: "visible", value: true },
          { id: "second-page-absent", subject: "navigation-page", predicate: "exists", value: false },
        ],
        // The notice really is served `404`, and Chromium reports a non-2xx
        // main-frame response as a console error. Allowing exactly that string
        // keeps the page honest rather than dressing a retired URL up as a 200.
        allowedConsoleErrors: ["Failed to load resource: the server responded with a status of 404"],
        failure: { category: "navigation_unexpected", code: "web.navigation.unexpected" },
      },
    }],
  }),
  createState: () => ({ visits: [], redirectCount: 0 }),
  mutate(state, operation, payload) {
    if (operation === "set-mode") {
      const mode = readMode(payload);
      // Arming clears the recording's visits, so a stale `second` can never
      // stand in for the armed run's own landing.
      return mode ? { visits: [], redirectCount: 0, mode } : state;
    }
    if (operation !== "visit" || !isRecord(payload) || typeof payload.page !== "string") return state;
    const pageName = visitablePageNames.includes(payload.page) ? payload.page : "unknown";
    return {
      ...state,
      visits: [...state.visits, pageName].slice(-50),
      redirectCount: state.redirectCount + (pageName === "redirected" ? 1 : 0),
    };
  },
  render(_state, context) {
    return navigationPage("start", context.runToken);
  },
  route(state, request, context) {
    if (request.subpath === "redirect") return { status: 302, headers: { location: "/scenarios/navigation/redirected" } };
    if (request.subpath === "second" && state.mode === "broken-link") return { status: 302, headers: { location: RETIRED_LINK_PATH } };
    if (request.subpath === "link-retired") {
      return { status: 404, body: retiredLinkPage(), mutation: { operation: "visit", payload: { page: "link-retired" } } };
    }
    return navigationPageNames.includes(request.subpath) ? { status: 200, body: navigationPage(request.subpath, context.runToken) } : undefined;
  },
});

function navigationPage(name: string, runToken: string): string {
  const body = `<main><h1 data-testid="navigation-page">Navigation: ${name}</h1>
    <nav><a data-testid="full-navigation" href="/scenarios/navigation/second">Second page</a>
    <a data-testid="redirect" href="/scenarios/navigation/redirect">Redirect</a>
    <button data-testid="history">History state</button><button data-testid="reload" onclick="location.reload()">Reload</button></nav>
    <p data-testid="history-state" aria-live="polite"></p></main>`;
  const script = `${fixtureClient(runToken, "navigation")}
await mutate('visit', { page: ${JSON.stringify(name)} });
document.querySelector('[data-testid="history"]').addEventListener('click', async () => {
  history.pushState({ fixture: true }, '', '/scenarios/navigation/history');
  document.querySelector('[data-testid="navigation-page"]').textContent = 'Navigation: history';
  document.querySelector('[data-testid="history-state"]').textContent = 'History updated';
  await mutate('visit', { page: 'history' });
});
addEventListener('popstate', () => { document.querySelector('[data-testid="history-state"]').textContent = 'History restored'; });`;
  return page(`Navigation: ${name}`, body, script);
}

/**
 * The retired-page notice. No fixture client and no `navigation-page` heading:
 * a real 404 runs none of the site's application code, and a notice that
 * carried the heading would satisfy the recorded wait and let the armed run
 * pass for the wrong reason.
 */
function retiredLinkPage(): string {
  const body = `<main><h1 data-testid="link-retired">Page not found</h1>
    <p>The page this link points at was retired. Nothing here replaces it.</p>
    <nav><a data-testid="back-to-start" href="/scenarios/navigation/start">Back to the start page</a></nav></main>`;
  return page("Page not found", body, "");
}

function readMode(payload: unknown): NavigationMode | undefined {
  if (!isRecord(payload)) return undefined;
  return payload.mode === "baseline" || payload.mode === "broken-link" ? payload.mode : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
