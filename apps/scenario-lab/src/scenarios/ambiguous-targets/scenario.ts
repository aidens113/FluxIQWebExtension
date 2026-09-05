import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

type State = { selected: string | null };
export const ambiguousTargetsScenario = defineScenario<State>({
  id: "ambiguous-targets", title: "Ambiguous targets", startPath: "/scenarios/ambiguous-targets/",
  seed: 106,
  manifest: createScenarioManifest({
    id: "ambiguous-targets", title: "Ambiguous targets", tags: ["targeting", "ambiguity"], seed: 106,
    startPath: "/scenarios/ambiguous-targets/", capabilities: ["forms"],
    recordingScript: [
      { id: "choose-primary", operation: "click", target: "testid:choice-primary" },
      { id: "primary-selected", operation: "waitForState", target: "testid:result", timeoutMs: 500 },
      { id: "selection-final", operation: "checkpoint" },
    ],
    expected: {
      pageFacts: [{ id: "duplicate-labels", subject: "document", predicate: "label-count:Email", value: 2 }],
      recordingEvents: [{ type: "web.element.clicked", count: 1 }],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "primary-selected", subject: "result", predicate: "text", value: "primary" }],
    },
  }),
  createState: () => ({ selected: null }),
  mutate(state, operation, payload) { return operation === "choose" && isRecord(payload) && typeof payload.id === "string" ? { selected: payload.id } : state; },
  render(_state, context) {
    return page("Ambiguous targets", `<main><h1>Ambiguous targets</h1><section aria-label="Primary"><button data-testid="choice-primary" data-choice="primary">Continue</button></section><section aria-label="Secondary"><button data-testid="choice-secondary" data-choice="secondary">Continue</button></section><label>Email <input data-testid="email-primary"></label><label>Email <input data-testid="email-secondary"></label><p data-testid="result" aria-live="polite">None</p></main>`, `${fixtureClient(context.runToken, "ambiguous-targets")}
document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', async () => { await mutate('choose', { id: button.dataset.choice }); document.querySelector('[data-testid="result"]').textContent = button.dataset.choice; }));`);
  },
});
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
