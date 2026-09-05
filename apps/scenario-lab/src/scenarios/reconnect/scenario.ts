import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

type State = { connected: boolean; sequence: number; events: string[] };
export const reconnectScenario = defineScenario<State>({
  id: "reconnect", title: "Reconnect", startPath: "/scenarios/reconnect/",
  seed: 109,
  manifest: createScenarioManifest({
    id: "reconnect", title: "Reconnect", tags: ["gateway", "resilience"], seed: 109,
    startPath: "/scenarios/reconnect/", capabilities: ["mutation"],
    recordingScript: [
      { id: "disconnect", operation: "click", target: "role:button[name=Disconnect]" },
      { id: "queue-event", operation: "click", target: "role:button[name=Queue event]" },
      { id: "reconnect", operation: "click", target: "role:button[name=Reconnect]" },
      { id: "replayed", operation: "waitForState", target: "testid:events", timeoutMs: 2000 },
      { id: "reconnect-final", operation: "checkpoint" },
    ],
    expected: {
      recordingEvents: [{ type: "web.element.clicked", count: 3 }, { type: "web.dom.mutated" }],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "replayed", subject: "events", predicate: "contains", value: "replayed" }],
    },
    evidencePolicy: { screenshots: "events", trace: "always", video: "failure", sampleFps: 0.5, reviewRequired: true },
  }),
  createState: seed => ({ connected: true, sequence: Math.abs(seed) * 100, events: [] }),
  mutate(state, operation) {
    if (operation === "disconnect") return { ...state, connected: false, sequence: state.sequence + 1, events: [...state.events, "disconnect"] };
    if (operation === "queue") return { ...state, sequence: state.sequence + 1, events: [...state.events, "queued"] };
    if (operation === "reconnect") return { ...state, connected: true, sequence: state.sequence + 1, events: [...state.events, "reconnect", "replayed"] };
    return state;
  },
  render(_state, context) {
    return page("Reconnect", `<main><h1>Reconnect</h1><button data-op="disconnect">Disconnect</button><button data-op="queue">Queue event</button><button data-op="reconnect">Reconnect</button><ol data-testid="events"></ol></main>`, `${fixtureClient(context.runToken, "reconnect")}
document.querySelectorAll('[data-op]').forEach(button => button.addEventListener('click', async () => { const snapshot = await mutate(button.dataset.op); document.querySelector('[data-testid="events"]').innerHTML = snapshot.state.events.map(value => '<li>' + value + '</li>').join(''); }));`);
  },
});
