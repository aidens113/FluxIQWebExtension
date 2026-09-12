import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

const SYNTHETIC_USER = "synthetic-user@example.test";
type State = { submitted: boolean; username: string; passwordStored: false; paymentStored: false };
export const sensitiveInputScenario = defineScenario<State>({
  id: "sensitive-input", title: "Sensitive input", startPath: "/scenarios/sensitive-input/",
  seed: 110,
  manifest: createScenarioManifest({
    id: "sensitive-input", title: "Sensitive input", tags: ["redaction", "security"], seed: 110,
    startPath: "/scenarios/sensitive-input/", capabilities: ["forms"],
    recordingScript: [
      { id: "replace-password", operation: "type", target: "role:textbox[name=Password]", value: "synthetic-secret" },
      { id: "replace-payment", operation: "type", target: "testid:payment", value: "4242424242424242" },
      { id: "submit-sensitive", operation: "click", target: "role:button[name=Submit synthetic values]" },
      { id: "redaction-final", operation: "checkpoint" },
    ],
    expected: {
      recordingEvents: [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.clicked", count: 1 }],
      actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "secrets-discarded", subject: "result", predicate: "text", value: "Submitted with secrets discarded" }],
    },
    evidencePolicy: { screenshots: "events", trace: "failure", video: "failure", sampleFps: 0, reviewRequired: true },
  }),
  createState: () => ({ submitted: false, username: SYNTHETIC_USER, passwordStored: false, paymentStored: false }),
  mutate(state, operation, payload) {
    if (operation !== "submit" || !isRecord(payload) || payload.synthetic !== true) return state;
    return { submitted: true, username: SYNTHETIC_USER, passwordStored: false, paymentStored: false };
  },
  // The card field carries `autocomplete="cc-number"` because that is what a
  // real card field carries and it is what the extension's shared sensitivity
  // rule reads. Without it the rule cannot see the field, and this scenario --
  // tagged `redaction` and `security`, and expected to end "with secrets
  // discarded" -- captured the card value on every path while claiming to prove
  // the opposite. `inputmode="numeric"` is not a substitute: an ordinary
  // quantity field carries it too, so matching on it would redact real data.
  render(state, context) {
    return page("Sensitive input", `<main><h1>Synthetic sensitive input</h1><form data-testid="sensitive-form"><label>Email <input name="username" value="${state.username}" autocomplete="off"></label><label>Password <input name="password" data-testid="password" type="password" value="SYNTHETIC_PASSWORD_DO_NOT_USE"></label><label>Test card <input name="payment" data-testid="payment" autocomplete="cc-number" inputmode="numeric" value="4111111111111111"></label><button>Submit synthetic values</button></form><p data-testid="result" aria-live="polite">Not submitted</p></main>`, `${fixtureClient(context.runToken, "sensitive-input")}
document.querySelector('form').addEventListener('submit', async event => { event.preventDefault(); await mutate('submit', { synthetic: true }); document.querySelector('[data-testid="result"]').textContent = 'Submitted with secrets discarded'; });`);
  },
});
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
