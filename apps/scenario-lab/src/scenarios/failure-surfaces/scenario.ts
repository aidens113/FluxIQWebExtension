import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

type State = { lastFailure: string | null; attempts: number };
export const failureSurfacesScenario = defineScenario<State>({
  id: "failure-surfaces", title: "Failure surfaces", startPath: "/scenarios/failure-surfaces/",
  seed: 108,
  manifest: createScenarioManifest({
    id: "failure-surfaces", title: "Failure surfaces", tags: ["failure", "safety"], seed: 108,
    startPath: "/scenarios/failure-surfaces/", capabilities: ["navigation"],
    recordingScript: [
      { id: "disabled-target", operation: "click", target: "testid:disabled-target" },
      { id: "detach-target", operation: "click", target: "testid:detach-target" },
      { id: "detached-final", operation: "checkpoint" },
    ],
    expected: {
      pageFacts: [{ id: "disabled", subject: "disabled-target", predicate: "enabled", value: false }],
      recordingEvents: [{ type: "web.element.clicked" }],
      actions: [{ action: "web.dom.click", outcome: "rejected" }],
      finalState: [{ id: "detached", subject: "detach-target", predicate: "exists", value: false }],
      allowedConsoleErrors: [],
    },
    evidencePolicy: { screenshots: "events", trace: "always", video: "failure", sampleFps: 0, reviewRequired: true },
  }),
  createState: () => ({ lastFailure: null, attempts: 0 }),
  mutate(state, operation, payload) { return operation === "attempt" && isRecord(payload) && typeof payload.kind === "string" ? { lastFailure: payload.kind, attempts: state.attempts + 1 } : state; },
  render(_state, context) {
    return page("Failure surfaces", `<main><h1>Failure surfaces</h1><button data-testid="disabled-target" disabled>Disabled</button><button data-testid="detach-target">Detach me</button><button data-testid="blocked-url" data-blocked-url="https://example.invalid/blocked">Blocked external URL</button><button data-testid="close-surface">Page closure marker</button><p data-testid="result" aria-live="polite">Ready</p></main>`, `${fixtureClient(context.runToken, "failure-surfaces")}
const detached = document.querySelector('[data-testid="detach-target"]'); detached.addEventListener('click', async () => { detached.remove(); await mutate('attempt', { kind: 'detached' }); });
document.querySelector('[data-testid="close-surface"]').addEventListener('click', async () => { await mutate('attempt', { kind: 'page-closure' }); document.querySelector('[data-testid="result"]').textContent = 'Closure requested'; });`);
  },
});
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
