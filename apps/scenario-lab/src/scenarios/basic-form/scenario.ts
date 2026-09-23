import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

/**
 * The adversarial conditions this fixture can be armed into, each one of the
 * ways a real site differs from the page a recording was taken on.
 *
 * `timed-overlay` is the promotional interstitial that is not there when the
 * page loads and is there by the time the Flow reaches Submit: it appears a
 * short time after the person starts filling the form, and it covers the
 * submit button and nothing else, so every earlier step still works and only
 * the last one is refused.
 *
 * `renamed-submit` is the deploy that renamed a control. The button keeps its
 * text, its type, its position and its role, and loses only the identifier the
 * recording matched it by -- which is what a front-end rename actually looks
 * like, and what the browser's own target resolution exists to survive.
 */
export type BasicFormMode = "baseline" | "timed-overlay" | "renamed-submit";

/**
 * `mode` is absent until the fixture is armed, so an unarmed run renders and
 * publishes exactly what it did before the variants existed.
 */
export type BasicFormState = {
  submitted: boolean;
  submissionCount: number;
  values: { name: string; plan: string; notes: string };
  mode?: BasicFormMode;
};

/**
 * How long after the first keystroke the interstitial appears. It is long
 * enough that the recording lane never meets it -- the recording's own steps
 * are driven straight through -- and short enough that a replay, which takes
 * seconds per node, always has it by the time it reaches Submit.
 *
 * It never goes away, and that is deliberate rather than convenient. A
 * self-dismissing promo would be absorbed by a retry on any runtime that
 * retried this failure, and this one does not: the domain marks
 * `web.action.rejected` non-retryable (`domain/src/runtime/failure/codes.ts`),
 * so the ladder's retry rung is never offered the node. An overlay that
 * cleared would therefore measure exactly the same outcome and would make the
 * result look like a timing accident instead of the rule it is.
 */
const INTERSTITIAL_DELAY_MS = 400;

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
    variants: [
      {
        id: "timed-overlay",
        description: "A promotional interstitial that is absent at load, appears once the form is being filled, and covers the submit button: every earlier step works and the last one is refused.",
        arm: { operation: "set-mode", payload: { mode: "timed-overlay" } },
        expected: {
          actions: [
            { action: "web.dom.type", outcome: "succeeded" },
            { action: "web.dom.select", outcome: "succeeded" },
            { action: "web.dom.click", outcome: "failed" },
          ],
          finalState: [{ id: "not-submitted", subject: "result", predicate: "text", value: "Not submitted" }],
          failure: { category: "blocked_by_capability_or_policy", code: "web.action.rejected" },
          recovery: {
            absorbedBy: "none",
            because: "A covered control is refused as web.action.rejected, which the domain marks non-retryable, so the ladder's retry rung is never offered the node and clear_interference has no node to run.",
          },
        },
      },
      {
        id: "renamed-submit",
        description: "The submit button keeps its text, type, role and position and loses the identifier the recording matched it by, as a front-end rename between authoring and replay does.",
        arm: { operation: "set-mode", payload: { mode: "renamed-submit" } },
        expected: {
          actions: [
            { action: "web.dom.type", outcome: "succeeded" },
            { action: "web.dom.select", outcome: "succeeded" },
            { action: "web.dom.click", outcome: "succeeded" },
          ],
          finalState: [{ id: "submitted", subject: "result", predicate: "text", value: "Submitted" }],
          providerCalls: {
            count: 0,
            because: "The browser re-resolves the renamed control before Core is told anything failed, so the model is never reached.",
          },
          recovery: {
            absorbedBy: "host_target_resolution",
            because: "The recorded selector misses and the host falls through to the recorded fingerprint or to scoring, which is the recovery that has no ladder rung because it happens before a failure is reported.",
            maxAttemptsPerNode: 1,
          },
        },
      },
    ],
  }),
  createState: () => ({
    submitted: false,
    submissionCount: 0,
    values: { name: "", plan: "starter", notes: "" },
  }),
  mutate(state, operation, payload) {
    if (operation === "set-mode") {
      const mode = readMode(payload);
      // Arming clears the recording's submission, so a stale `submitted` can
      // never stand in for the armed run's own outcome.
      return mode ? { ...state, mode, submitted: false } : state;
    }
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
    // The rename changes the identifier and nothing else: same text, same
    // type, same place in the form, same accessible name.
    const submitTestId = state.mode === "renamed-submit" ? "send-form" : "submit";
    const body = `<main>
      <h1>Basic form</h1>
      <form data-testid="basic-form">
        <label>Name <input name="name" data-testid="name" required autocomplete="off"></label>
        <label>Plan <select name="plan" data-testid="plan">
          <option value="starter">Starter</option><option value="team">Team</option><option value="enterprise">Enterprise</option>
        </select></label>
        <label>Notes <textarea name="notes" data-testid="notes"></textarea></label>
        <button type="reset" data-testid="clear">Clear</button>
        <span data-testid="submit-slot" style="position:relative;display:inline-block"><button type="submit" data-testid="${submitTestId}">Submit</button></span>
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
});
${state.mode === "timed-overlay" ? `
// Armed only. Scheduled on the first keystroke rather than on load, so what
// the page shows when it is first rendered is what it has always shown, and
// the interstitial is something the run brings on itself by filling the form.
form.addEventListener('input', () => {
  if (form.dataset.interstitial) return;
  form.dataset.interstitial = 'scheduled';
  setTimeout(() => {
    const slot = document.querySelector('[data-testid="submit-slot"]');
    const promo = document.createElement('div');
    promo.dataset.testid = 'interstitial';
    promo.textContent = 'Save 20% today';
    promo.setAttribute('style', 'position:absolute;inset:-8px;z-index:10;background:#fde68a;border:1px solid #f59e0b;text-align:center');
    slot.append(promo);
  }, ${INTERSTITIAL_DELAY_MS});
}, { once: true });
` : ""}`;
    return page("Basic form", body, script);
  },
});

function readMode(payload: unknown): BasicFormMode | undefined {
  if (!isRecord(payload)) return undefined;
  return payload.mode === "baseline" || payload.mode === "timed-overlay" || payload.mode === "renamed-submit" ? payload.mode : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 500) : "";
}
