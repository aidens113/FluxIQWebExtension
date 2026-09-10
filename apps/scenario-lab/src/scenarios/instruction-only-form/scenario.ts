import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

export type InstructionOnlyFormState = {
  submitted: boolean;
  submissionCount: number;
  targetMode: "baseline" | "drifted";
  targetTransitionCount: number;
  values: { name: string; plan: string };
};

export const instructionOnlyFormScenario = defineScenario<InstructionOnlyFormState>({
  id: "instruction-only-form",
  title: "Instruction-only form",
  startPath: "/scenarios/instruction-only-form/",
  seed: 113,
  manifest: createScenarioManifest({
    id: "instruction-only-form",
    title: "Instruction-only form",
    tags: ["llm", "instruction-only", "forms"],
    seed: 113,
    startPath: "/scenarios/instruction-only-form/",
    capabilities: ["forms"],
    recordingScript: [],
    playbackGoal: {
      id: "instruction-only-submit",
      description: "Enter Ada as the name, choose the Team plan, submit the form, and confirm that the result says Submitted: Ada / team.",
      successFacts: [{ id: "instruction-only-result", subject: "result", predicate: "text", value: "Submitted: Ada / team" }],
    },
    expected: {
      pageFacts: [{ id: "instruction-only-form-visible", subject: "instruction-only-form", predicate: "visible", value: true }],
      actions: [
        { action: "web.dom.type", outcome: "succeeded" },
        { action: "web.dom.select", outcome: "succeeded" },
        { action: "web.dom.click", outcome: "succeeded" },
      ],
      finalState: [{ id: "instruction-only-submitted", subject: "result", predicate: "text", value: "Submitted: Ada / team" }],
      allowedConsoleErrors: [],
    },
    evidencePolicy: { screenshots: "events", trace: "always", video: "off", sampleFps: 0, reviewRequired: true },
  }),
  createState: () => ({ submitted: false, submissionCount: 0, targetMode: "baseline", targetTransitionCount: 0, values: { name: "", plan: "starter" } }),
  mutate(state, operation, payload) {
    if (operation === "introduce-target-drift" && state.targetMode === "baseline") {
      return { ...state, targetMode: "drifted", targetTransitionCount: state.targetTransitionCount + 1 };
    }
    if (operation === "reset-target-drift" && state.targetMode === "drifted") {
      return { ...state, targetMode: "baseline", targetTransitionCount: state.targetTransitionCount + 1 };
    }
    if (operation === "submit" && isRecord(payload)) {
      const name = boundedString(payload.name);
      const plan = boundedString(payload.plan);
      if (!name || !["starter", "team", "enterprise"].includes(plan)) return state;
      return { ...state, submitted: true, submissionCount: state.submissionCount + 1, values: { name, plan } };
    }
    return state;
  },
  render(state, context) {
    const result = state.submitted ? `Submitted: ${escapeHtml(state.values.name)} / ${escapeHtml(state.values.plan)}` : "Not submitted";
    const targets = state.targetMode === "baseline"
      ? { name: "instruction-name", plan: "instruction-plan", submit: "instruction-submit" }
      : { name: "instruction-name-adapted", plan: "instruction-plan", submit: "instruction-submit" };
    const nameControl = state.targetMode === "baseline"
      ? `<input name="name" data-testid="${targets.name}" required autocomplete="off">`
      : `<textarea data-field="name" data-testid="${targets.name}" required autocomplete="off" rows="1"></textarea>`;
    const body = `<main>
      <h1>Instruction-only automation</h1>
      <p>Complete this form using the active FluxIQ Flow instruction.</p>
      <section aria-label="Target drift controls">
        <button data-testid="instruction-introduce-target-drift" type="button">Introduce target drift</button>
        <button data-testid="instruction-reset-target-drift" type="button">Reset target drift</button>
        <p data-testid="instruction-target-drift-status">Target mode: ${state.targetMode}</p>
      </section>
      <form data-testid="instruction-only-form">
        <label>Name ${nameControl}</label>
        <label>Plan <select name="plan" data-testid="${targets.plan}">
          <option value="starter">Starter</option><option value="team">Team</option><option value="enterprise">Enterprise</option>
        </select></label>
        <button type="submit" data-testid="${targets.submit}">Submit</button>
      </form>
      <p data-testid="result" aria-live="polite">${result}</p>
    </main>`;
    const script = `${fixtureClient(context.runToken, "instruction-only-form")}
async function transition(operation) {
  await mutate(operation);
  window.location.reload();
}
document.querySelector('[data-testid="instruction-introduce-target-drift"]').addEventListener('click', () => transition('introduce-target-drift'));
document.querySelector('[data-testid="instruction-reset-target-drift"]').addEventListener('click', () => transition('reset-target-drift'));
const form = document.querySelector('[data-testid="instruction-only-form"]');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const nameControl = form.querySelector('[data-field="name"], [name="name"]');
  const planControl = form.querySelector('[name="plan"]');
  const snapshot = await mutate('submit', { name: nameControl.value, plan: planControl.value });
  const values = snapshot.state.values;
  document.querySelector('[data-testid="result"]').textContent = snapshot.state.submitted ? 'Submitted: ' + values.name + ' / ' + values.plan : 'Invalid';
});`;
    return page("Instruction-only automation", body, script);
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 200) : "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
