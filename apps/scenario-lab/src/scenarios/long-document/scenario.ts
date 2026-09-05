import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

type State = { reached: boolean; targetIndex: number };

export const longDocumentScenario = defineScenario<State>({
  id: "long-document", title: "Long document", startPath: "/scenarios/long-document/",
  seed: 104,
  manifest: createScenarioManifest({
    id: "long-document", title: "Long document", tags: ["scroll", "coordinates"], seed: 104,
    startPath: "/scenarios/long-document/", capabilities: ["scroll"],
    recordingScript: [
      { id: "scroll-below-fold", operation: "scroll", value: 3200 },
      { id: "reach-target", operation: "click", target: "testid:below-fold-target" },
      { id: "reached", operation: "checkpoint" },
    ],
    expected: {
      recordingEvents: [{ type: "web.scroll.changed" }, { type: "web.element.clicked", count: 1 }],
      actions: [{ action: "web.dom.scroll", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "target-reached", subject: "result", predicate: "text", value: "Reached" }],
    },
  }),
  createState: seed => ({ reached: false, targetIndex: Math.abs(seed) % 5 + 15 }),
  mutate(state, operation) { return operation === "reach" ? { ...state, reached: true } : state; },
  render(state, context) {
    const sections = Array.from({ length: 24 }, (_, index) => `<section style="min-height:180px"><h2>Section ${index + 1}</h2><p>Deterministic content ${context.seed}-${index + 1}</p>${index === state.targetIndex ? '<button data-testid="below-fold-target">Reach target</button>' : ""}</section>`).join("");
    return page("Long document", `<header style="position:sticky;top:0;background:white" data-testid="sticky-header"><h1>Long document</h1></header><main>${sections}<p data-testid="result" aria-live="polite">Pending</p></main>`, `${fixtureClient(context.runToken, "long-document")}
document.querySelector('[data-testid="below-fold-target"]').addEventListener('click', async () => { await mutate('reach'); document.querySelector('[data-testid="result"]').textContent = 'Reached'; });`);
  },
});
