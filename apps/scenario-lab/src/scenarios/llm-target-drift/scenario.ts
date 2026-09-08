import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

export type TargetDriftMode = "baseline" | "missing" | "renamed";

export type LlmTargetDriftState = {
  seedMarker: string;
  mode: TargetDriftMode;
  activationCount: number;
  transitionCount: number;
  lastOperation: "seeded" | "activated" | "missing" | "renamed" | "restored";
  oracle: {
    recordedTargetTestId: "diagnosis-target";
    renderedTargetTestId: "diagnosis-target" | "diagnosis-target-v2" | null;
    targetPresent: boolean;
    expectedResult: string;
  };
};

export const llmTargetDriftScenario = defineScenario<LlmTargetDriftState>({
  id: "llm-target-drift",
  title: "LLM target drift diagnosis",
  startPath: "/scenarios/llm-target-drift/",
  seed: 111,
  manifest: createScenarioManifest({
    id: "llm-target-drift",
    title: "LLM target drift diagnosis",
    tags: ["llm", "diagnosis", "target-drift", "failure"],
    seed: 111,
    startPath: "/scenarios/llm-target-drift/",
    capabilities: ["mutation"],
    recordingScript: [
      { id: "activate-recorded-target", operation: "click", target: "testid:diagnosis-target" },
      { id: "baseline-completed", operation: "checkpoint" },
    ],
    playbackGoal: {
      id: "baseline-target-activation",
      description: "Activate the deterministic recorded target exactly once while the fixture is in baseline mode.",
      successFacts: [{ id: "baseline-result", subject: "result", predicate: "text", value: "Completed: 1" }],
    },
    expected: {
      pageFacts: [{ id: "baseline-target-visible", subject: "diagnosis-target", predicate: "visible", value: true }],
      recordingEvents: [{ type: "web.element.clicked", count: 1 }],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "baseline-completed", subject: "result", predicate: "text", value: "Completed: 1" }],
      allowedConsoleErrors: [],
    },
    evidencePolicy: { screenshots: "events", trace: "always", video: "failure", sampleFps: 0, reviewRequired: true },
  }),
  createState: seed => stateFor(seed, "baseline", 0, 0, "seeded"),
  mutate(state, operation, payload) {
    if (operation === "activate" && state.mode === "baseline") {
      return stateForSeedMarker(state.seedMarker, "baseline", state.activationCount + 1, state.transitionCount, "activated");
    }
    if (operation === "set-mode" && isRecord(payload) && (payload.mode === "missing" || payload.mode === "renamed")) {
      return stateForSeedMarker(state.seedMarker, payload.mode, 0, state.transitionCount + 1, payload.mode);
    }
    if (operation === "restore") {
      return stateForSeedMarker(state.seedMarker, "baseline", 0, state.transitionCount + 1, "restored");
    }
    return state;
  },
  render(state, context) {
    const target = state.mode === "baseline"
      ? '<button data-testid="diagnosis-target" type="button">Activate recorded target</button>'
      : state.mode === "renamed"
        ? '<button data-testid="diagnosis-target-v2" aria-label="Replacement control" type="button">Replacement control</button>'
        : "";
    const body = `<main>
      <h1>LLM target drift diagnosis</h1>
      <p>This loopback fixture records a stable target, then deliberately removes or renames it for diagnosis-only runs.</p>
      <section aria-label="Target drift controls">
        <button data-testid="introduce-missing-target" type="button">Introduce missing target</button>
        <button data-testid="introduce-renamed-target" type="button">Introduce renamed target</button>
        <button data-testid="restore-target" type="button">Restore target</button>
      </section>
      <p data-testid="drift-mode">Mode: ${state.mode}</p>
      <section aria-label="Recorded action surface">${target}</section>
      <p data-testid="result" aria-live="polite">${state.oracle.expectedResult}</p>
      <code data-testid="seed-marker">${state.seedMarker}</code>
    </main>`;
    const script = `${fixtureClient(context.runToken, "llm-target-drift")}
async function transition(operation, payload) {
  await mutate(operation, payload);
  window.location.reload();
}
document.querySelector('[data-testid="introduce-missing-target"]').addEventListener('click', () => transition('set-mode', { mode: 'missing' }));
document.querySelector('[data-testid="introduce-renamed-target"]').addEventListener('click', () => transition('set-mode', { mode: 'renamed' }));
document.querySelector('[data-testid="restore-target"]').addEventListener('click', () => transition('restore', {}));
const target = document.querySelector('[data-testid="diagnosis-target"]');
if (target) target.addEventListener('click', async () => {
  const snapshot = await mutate('activate', {});
  document.querySelector('[data-testid="result"]').textContent = snapshot.state.oracle.expectedResult;
});`;
    return page("LLM target drift diagnosis", body, script);
  },
});

function stateFor(seed: number, mode: TargetDriftMode, activationCount: number, transitionCount: number, lastOperation: LlmTargetDriftState["lastOperation"]): LlmTargetDriftState {
  return stateForSeedMarker(`target-drift-seed-${seed}`, mode, activationCount, transitionCount, lastOperation);
}

function stateForSeedMarker(seedMarker: string, mode: TargetDriftMode, activationCount: number, transitionCount: number, lastOperation: LlmTargetDriftState["lastOperation"]): LlmTargetDriftState {
  const renderedTargetTestId = mode === "baseline" ? "diagnosis-target" as const : mode === "renamed" ? "diagnosis-target-v2" as const : null;
  const expectedResult = mode === "baseline" ? (activationCount ? `Completed: ${activationCount}` : "Ready") : mode === "missing" ? "Target missing: deterministic failure armed" : "Target renamed: deterministic failure armed";
  return {
    seedMarker,
    mode,
    activationCount,
    transitionCount,
    lastOperation,
    oracle: {
      recordedTargetTestId: "diagnosis-target",
      renderedTargetTestId,
      targetPresent: renderedTargetTestId !== null,
      expectedResult,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}