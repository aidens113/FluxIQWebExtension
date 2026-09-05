import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

export type BasicFormState = {
  submitted: boolean;
  submissionCount: number;
  values: { name: string; plan: string; notes: string };
};

export const basicFormScenario = defineScenario<BasicFormState>({
  id: "basic-form",
  title: "Basic form",
  startPath: "/scenarios/basic-form/",
  seed: 101,
  manifest: createScenarioManifest({
    id: "basic-form", title: "Basic form", tags: ["forms", "smoke"], seed: 101,
    startPath: "/scenarios/basic-form/", capabilities: ["forms"],
    recordingScript: [
      { id: "enter-name", operation: "type", target: "testid:name", value: "Ada" },
      { id: "choose-plan", operation: "select", target: "testid:plan", value: "team" },
      { id: "enter-notes", operation: "type", target: "testid:notes", value: "deterministic" },
      { id: "submit", operation: "click", target: "testid:submit" },
      { id: "submitted", operation: "checkpoint" },
    ],
    expected: {
      pageFacts: [{ id: "form-visible", subject: "basic-form", predicate: "visible", value: true }],
      recordingEvents: [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.changed", count: 1 }, { type: "web.element.clicked", count: 1 }],
      actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.select", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "submitted", subject: "result", predicate: "text", value: "Submitted" }],
    },
  }),
  createState: () => ({
    submitted: false,
    submissionCount: 0,
    values: { name: "", plan: "starter", notes: "" },
  }),
  mutate(state, operation, payload) {
    if (operation !== "submit" || !isRecord(payload)) return state;
    const name = stringValue(payload.name);
    const plan = stringValue(payload.plan);
    const notes = stringValue(payload.notes);
    if (!name || !["starter", "team", "enterprise"].includes(plan)) return state;
    return {
      submitted: true,
      submissionCount: state.submissionCount + 1,
      values: { name, plan, notes },
    };
  },
  render(state, context) {
    const body = `<main>
      <h1>Basic form</h1>
      <form data-testid="basic-form">
        <label>Name <input name="name" data-testid="name" required autocomplete="off"></label>
        <label>Plan <select name="plan" data-testid="plan">
          <option value="starter">Starter</option><option value="team">Team</option><option value="enterprise">Enterprise</option>
        </select></label>
        <label>Notes <textarea name="notes" data-testid="notes"></textarea></label>
        <button type="reset" data-testid="clear">Clear</button>
        <button type="submit" data-testid="submit">Submit</button>
      </form>
      <p data-testid="result" aria-live="polite">${state.submitted ? "Submitted" : "Not submitted"}</p>
    </main>`;
    const script = `${fixtureClient(context.runToken, "basic-form")}
const form = document.querySelector('[data-testid="basic-form"]');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const snapshot = await mutate('submit', data);
  document.querySelector('[data-testid="result"]').textContent = snapshot.state.submitted ? 'Submitted' : 'Invalid';
});`;
    return page("Basic form", body, script);
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 500) : "";
}
