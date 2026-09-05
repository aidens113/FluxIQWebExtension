import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

type State = { revealed: boolean; delayMs: number };
export const delayedUiScenario = defineScenario<State>({
  id: "delayed-ui", title: "Delayed UI", startPath: "/scenarios/delayed-ui/",
  seed: 107,
  manifest: createScenarioManifest({
    id: "delayed-ui", title: "Delayed UI", tags: ["wait", "retry"], seed: 107,
    startPath: "/scenarios/delayed-ui/", capabilities: ["mutation"],
    recordingScript: [
      { id: "begin-delay", operation: "click", target: "testid:begin-delay" },
      { id: "await-late-action", operation: "waitForState", target: "testid:late-action", timeoutMs: 1000 },
      { id: "late-action", operation: "click", target: "testid:late-action" },
      { id: "delay-final", operation: "checkpoint" },
    ],
    expected: {
      recordingEvents: [{ type: "web.dom.mutated" }],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.wait_for_selector", outcome: "succeeded" }],
      finalState: [{ id: "late-visible", subject: "late-action", predicate: "visible", value: true }],
    },
  }),
  createState: seed => ({ revealed: false, delayMs: 75 + Math.abs(seed % 4) * 25 }),
  mutate(state, operation) { return operation === "reveal" ? { ...state, revealed: true } : state; },
  render(state, context) {
    return page("Delayed UI", `<main><h1>Delayed UI</h1><button data-testid="begin-delay">Load content</button><div data-testid="late-content" aria-live="polite"></div></main>`, `${fixtureClient(context.runToken, "delayed-ui")}
document.querySelector('[data-testid="begin-delay"]').addEventListener('click', () => setTimeout(async () => { await mutate('reveal'); const button = document.createElement('button'); button.dataset.testid = 'late-action'; button.textContent = 'Late action'; document.querySelector('[data-testid="late-content"]').replaceChildren(button); }, ${state.delayMs}));`);
  },
});
