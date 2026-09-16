import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";
import { renderSavedCards, savedCards } from "./saved-cards.js";

const SYNTHETIC_USER = "synthetic-user@example.test";
type State = { submitted: boolean; username: string; passwordStored: false; paymentStored: false };
export const sensitiveInputScenario = defineScenario<State>({
  id: "sensitive-input", title: "Sensitive input", startPath: "/scenarios/sensitive-input/",
  seed: 110,
  manifest: createScenarioManifest({
    id: "sensitive-input", title: "Sensitive input", tags: ["redaction", "security"], seed: 110,
    startPath: "/scenarios/sensitive-input/", capabilities: ["forms"],
    recordingScript: [
      { id: "replace-password", operation: "type", target: "testid:password", value: "synthetic-secret" },
      { id: "replace-payment", operation: "type", target: "testid:payment", value: "4242424242424242" },
      { id: "submit-sensitive", operation: "click", target: "role:button[name=Submit synthetic values]" },
      { id: "redaction-final", operation: "checkpoint" },
    ],
    expected: {
      recordingEvents: [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.clicked", count: 1 }],
      actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "secrets-discarded", subject: "result", predicate: "text", value: "Submitted with secrets discarded" }],
    },
    // Both typed fields are marked sensitive, so the recorder withholds their
    // values and the Flow asks for each at run time. The Flow lane pairs every
    // such request with exactly one declaration, matching the step's `testid:`
    // target against the control's recorded test id. That is why the password
    // step targets its test id: a password input has no implicit ARIA role in
    // the recorder, so a `role:textbox` target would pair with nothing.
    secrets: [
      { id: "sensitive-input-password", step: "replace-password" },
      { id: "sensitive-input-payment", step: "replace-payment" },
    ],
    // Two reads of the same list of saved cards, differing only in whether the
    // unlock code is one of the fields. They are workflows rather than one
    // workflow and a variant because a variant never changes the recording, and
    // which columns are read is a property of the extract step itself.
    workflows: [
      {
        id: "extract-card-secrets",
        description: "Extract the saved cards together with the unlock code beside each one. The code is a password control, so reading it is refused in every mode (D2) and the read fails rather than returning a blank or a placeholder that later looks like data.",
        recordingScript: [
          {
            id: "extract-cards-with-code", operation: "extract", target: "testid:card-row",
            // `@value` reads the control's value attribute: one of the modes D2
            // refuses, and the mode a scraper would reach for first.
            fields: { label: "testid:card-label", expiry: "testid:card-expiry", code: "testid:card-unlock-code@value" },
          },
          { id: "cards-refused", operation: "checkpoint" },
        ],
        // No `extracted`: the read never returns records. The refusal is the
        // whole expectation, and an extract step records no action to pin.
        expected: {
          failure: { category: "blocked_by_capability_or_policy", code: "web.action.rejected" },
          finalState: [{ id: "nothing-submitted", subject: "result", predicate: "text", value: "Not submitted" }],
        },
      },
      {
        id: "extract-card-labels",
        description: "The same list with the unlock code left out, which is what excluding a column means (D12): the page never reads it, so it is absent from the records rather than masked in them, and the read succeeds.",
        recordingScript: [
          {
            id: "extract-cards", operation: "extract", target: "testid:card-row",
            fields: { label: "testid:card-label", expiry: "testid:card-expiry" },
          },
          { id: "cards-extracted", operation: "checkpoint" },
        ],
        expected: {
          extracted: [{ step: "extract-cards", count: savedCards.length, records: savedCards.map(({ label, expiry }) => ({ label, expiry })) }],
          finalState: [{ id: "nothing-submitted", subject: "result", predicate: "text", value: "Not submitted" }],
        },
      },
    ],
    evidencePolicy: { screenshots: "events", trace: "failure", video: "failure", sampleFps: 0, reviewRequired: true },
  }),
  createState: () => ({ submitted: false, username: SYNTHETIC_USER, passwordStored: false, paymentStored: false }),
  mutate(state, operation, payload) {
    if (operation !== "submit" || !isRecord(payload) || payload.synthetic !== true) return state;
    return { submitted: true, username: SYNTHETIC_USER, passwordStored: false, paymentStored: false };
  },
  // A second card field carries the multi-token `autocomplete="billing cc-number"`.
  // That is the ordinary way the attribute is written, and it is the exact form
  // that has leaked a card number twice in this plan: once through a duplicated
  // sensitivity rule where one copy was fixed and the other was not, and once
  // through a copy that compared the whole attribute instead of its tokens. A
  // single-token fixture cannot catch either, which is why both fields exist.
  // The card field carries `autocomplete="cc-number"` because that is what a
  // real card field carries and it is what the extension's shared sensitivity
  // rule reads. Without it the rule cannot see the field, and this scenario --
  // tagged `redaction` and `security`, and expected to end "with secrets
  // discarded" -- captured the card value on every path while claiming to prove
  // the opposite. `inputmode="numeric"` is not a substitute: an ordinary
  // quantity field carries it too, so matching on it would redact real data.
  render(state, context) {
    return page("Sensitive input", `<main><h1>Synthetic sensitive input</h1><form data-testid="sensitive-form"><label>Email <input name="username" value="${state.username}" autocomplete="off"></label><label>Password <input name="password" data-testid="password" type="password" value="SYNTHETIC_PASSWORD_DO_NOT_USE"></label><label>Test card <input name="payment" data-testid="payment" autocomplete="cc-number" inputmode="numeric" value="4111111111111111"></label><label>Billing card <input name="billing" data-testid="billing" autocomplete="billing cc-number" inputmode="numeric" value="4222222222222220"></label><button>Submit synthetic values</button></form>${renderSavedCards()}<p data-testid="result" aria-live="polite">Not submitted</p></main>`, `${fixtureClient(context.runToken, "sensitive-input")}
document.querySelector('form').addEventListener('submit', async event => { event.preventDefault(); await mutate('submit', { synthetic: true }); document.querySelector('[data-testid="result"]').textContent = 'Submitted with secrets discarded'; });`);
  },
});
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
