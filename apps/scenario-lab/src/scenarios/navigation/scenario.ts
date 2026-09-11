import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

export type NavigationState = { visits: string[]; redirectCount: number };

const navigationPageNames = ["start", "second", "history", "redirected"];

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
  }),
  createState: () => ({ visits: [], redirectCount: 0 }),
  mutate(state, operation, payload) {
    if (operation !== "visit" || !isRecord(payload) || typeof payload.page !== "string") return state;
    const pageName = navigationPageNames.includes(payload.page) ? payload.page : "unknown";
    return {
      visits: [...state.visits, pageName].slice(-50),
      redirectCount: state.redirectCount + (pageName === "redirected" ? 1 : 0),
    };
  },
  render(_state, context) {
    return navigationPage("start", context.runToken);
  },
  route(_state, request, context) {
    if (request.subpath === "redirect") return { status: 302, headers: { location: "/scenarios/navigation/redirected" } };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
