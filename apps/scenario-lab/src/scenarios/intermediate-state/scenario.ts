import { fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

/** `unannounced` puts a confirmation step, which the recording never saw, between processing and the result. */
type IntermediateStateMode = "baseline" | "unannounced";

/** Where the latest claim is. `awaiting-confirmation` is reachable only in `unannounced` mode. */
type ClaimPhase = "idle" | "processing" | "awaiting-confirmation" | "complete";

export type IntermediateStateState = {
  reference: string;
  mode: IntermediateStateMode;
  phase: ClaimPhase;
  claim: { employee: string; amount: string } | null;
  submissionCount: number;
  confirmationCount: number;
  completionCount: number;
};

/** A fixed constant, never derived from the seed or the clock. */
const PROCESSING_DELAY_MS = 800;
const AMOUNT_PATTERN = /^\d{1,6}(?:\.\d{1,2})?$/;

export const intermediateStateScenario = defineScenario<IntermediateStateState>({
  id: "intermediate-state",
  title: "Intermediate state",
  startPath: "/scenarios/intermediate-state/",
  seed: 122,
  manifest: createScenarioManifest({
    id: "intermediate-state", title: "Intermediate state", tags: ["forms", "wait", "intermediate-state"], seed: 122,
    startPath: "/scenarios/intermediate-state/", capabilities: ["forms", "mutation"],
    recordingScript: [
      { id: "enter-employee", operation: "type", target: "testid:employee-name", value: "Ada Lovelace" },
      { id: "enter-amount", operation: "type", target: "testid:claim-amount", value: "42.50" },
      { id: "submit-claim", operation: "click", target: "testid:submit-claim" },
      { id: "await-result", operation: "waitForState", target: "testid:claim-result", timeoutMs: 5000 },
      { id: "result-shown", operation: "checkpoint" },
    ],
    expected: {
      pageFacts: [{ id: "claim-form-visible", subject: "claim-form", predicate: "visible", value: true }],
      recordingEvents: [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.clicked", count: 1 }, { type: "web.dom.mutated" }],
      actions: [
        { action: "web.dom.type", outcome: "succeeded" },
        { action: "web.dom.click", outcome: "succeeded" },
        { action: "web.dom.wait_for_selector", outcome: "succeeded" },
      ],
      finalState: [
        { id: "claim-status", subject: "result-status", predicate: "text", value: "Submitted for review" },
        { id: "claim-employee", subject: "result-employee", predicate: "text", value: "Ada Lovelace" },
        { id: "claim-amount", subject: "result-amount", predicate: "text", value: "$42.50" },
        { id: "no-confirmation-step", subject: "confirmation-step", predicate: "exists", value: false },
      ],
      allowedConsoleErrors: [],
    },
    variants: [{
      id: "unannounced",
      description: "After processing, a confirmation step the recording never saw (a checkbox and Continue) stands between the claim and its result, so the recorded wait for the result is never satisfied.",
      arm: { operation: "set-mode", payload: { mode: "unannounced" } },
      expected: {
        actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click" }],
        finalState: [
          { id: "confirmation-step-shown", subject: "confirmation-step", predicate: "visible", value: true },
          { id: "claim-result-absent", subject: "claim-result", predicate: "exists", value: false },
        ],
        failure: { category: "output_not_observed" },
      },
    }],
  }),
  createState: seed => ({
    reference: `EXP-${String(Math.abs(seed) % 100_000).padStart(5, "0")}`,
    mode: "baseline",
    phase: "idle",
    claim: null,
    submissionCount: 0,
    confirmationCount: 0,
    completionCount: 0,
  }),
  mutate(state, operation, payload) {
    if (operation === "submit") {
      const claim = parseClaim(payload);
      return claim ? { ...state, phase: "processing", claim, submissionCount: state.submissionCount + 1 } : state;
    }
    if (operation === "finish-processing" && state.phase === "processing") {
      return state.mode === "unannounced" ? { ...state, phase: "awaiting-confirmation" } : { ...state, phase: "complete", completionCount: state.completionCount + 1 };
    }
    if (operation === "confirm" && state.phase === "awaiting-confirmation" && isRecord(payload) && payload.confirmed === true) {
      return { ...state, phase: "complete", confirmationCount: state.confirmationCount + 1, completionCount: state.completionCount + 1 };
    }
    const mode = operation === "set-mode" ? readMode(payload) : undefined;
    // Arming also clears the claim the recording left behind, so a stale
    // `complete` can never stand in for the run's own outcome.
    return mode ? { ...state, mode, phase: "idle", claim: null } : state;
  },
  render(_state, context) {
    return page("Submit an expense claim", startPageBody, clientScript(context.runToken));
  },
});

/** The start page is the same in both modes: the armed step exists only once processing reports it. */
const startPageBody = `<main>
  <h1>Submit an expense claim</h1>
  <p>Claims are checked automatically before they go to your manager for review.</p>
  <form data-testid="claim-form" aria-labelledby="claim-form-heading" novalidate>
    <h2 id="claim-form-heading">Claim details</h2>
    <label>Employee name <input name="employee" data-testid="employee-name" autocomplete="off" required></label>
    <label>Amount (USD) <input name="amount" data-testid="claim-amount" inputmode="decimal" autocomplete="off" required></label>
    <p data-testid="form-error" role="alert"></p>
    <button type="submit" data-testid="submit-claim">Submit claim</button>
  </form>
  <div data-testid="claim-progress" aria-live="polite"></div>
</main>`;

function clientScript(runToken: string): string {
  return `${fixtureClient(runToken, "intermediate-state")}
const processingDelayMs = ${PROCESSING_DELAY_MS};
const amountPattern = new RegExp(${JSON.stringify(AMOUNT_PATTERN.source)});
const form = document.querySelector('[data-testid="claim-form"]');
const formError = document.querySelector('[data-testid="form-error"]');
const progress = document.querySelector('[data-testid="claim-progress"]');
const part = testId => progress.querySelector('[data-testid="' + testId + '"]');
function showForm(message) { progress.replaceChildren(); form.hidden = false; formError.textContent = message; }
function showProcessing() {
  form.hidden = true;
  progress.innerHTML = '<section data-testid="processing" aria-labelledby="processing-heading"><h2 id="processing-heading">Processing your claim</h2>'
    + '<progress aria-labelledby="processing-heading"></progress><p>Checking the claim details. This takes a moment.</p></section>';
}
function showConfirmation() {
  progress.innerHTML = '<section data-testid="confirmation-step" aria-labelledby="confirmation-heading"><h2 id="confirmation-heading" tabindex="-1">Confirm your claim</h2>'
    + '<p>Before we send your claim for review, confirm that the details are accurate.</p>'
    + '<form data-testid="confirmation-form" novalidate><label><input type="checkbox" name="confirmed" data-testid="confirm-details"> I confirm these details are accurate</label>'
    + '<p data-testid="confirmation-error" role="alert"></p><button type="submit" data-testid="continue">Continue</button></form></section>';
  part('confirmation-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!part('confirm-details').checked) { part('confirmation-error').textContent = 'Confirm the details to continue.'; return; }
    part('continue').disabled = true;
    showStep((await mutate('confirm', { confirmed: true })).state);
  });
  progress.querySelector('#confirmation-heading').focus();
}
function showResult(state) {
  progress.innerHTML = '<section data-testid="claim-result" aria-labelledby="result-heading"><h2 id="result-heading" tabindex="-1">Claim submitted</h2>'
    + '<p data-testid="result-status">Submitted for review</p><dl><dt>Reference</dt><dd data-testid="result-reference"></dd>'
    + '<dt>Employee</dt><dd data-testid="result-employee"></dd><dt>Amount</dt><dd data-testid="result-amount"></dd></dl></section>';
  part('result-reference').textContent = state.reference;
  part('result-employee').textContent = state.claim.employee;
  part('result-amount').textContent = '$' + state.claim.amount;
  progress.querySelector('#result-heading').focus();
}
function showStep(state) {
  if (state.phase === 'awaiting-confirmation') showConfirmation();
  else if (state.phase === 'complete') showResult(state);
  else showForm('The claim could not be processed. Try again.');
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (!String(data.employee ?? '').trim() || !amountPattern.test(String(data.amount ?? '').trim())) {
    formError.textContent = 'Enter your name and an amount such as 42.50.';
    return;
  }
  formError.textContent = '';
  showProcessing();
  const submitted = await mutate('submit', data);
  if (submitted.state.phase !== 'processing') { showForm('The claim could not be submitted. Try again.'); return; }
  setTimeout(async () => showStep((await mutate('finish-processing')).state), processingDelayMs);
});`;
}

function parseClaim(payload: unknown): IntermediateStateState["claim"] {
  if (!isRecord(payload) || typeof payload.employee !== "string" || typeof payload.amount !== "string") return null;
  const employee = payload.employee.trim().slice(0, 100);
  const amount = payload.amount.trim();
  if (!employee || !AMOUNT_PATTERN.test(amount)) return null;
  const [whole = "0", fraction = ""] = amount.split(".");
  return { employee, amount: `${Number(whole)}.${fraction.padEnd(2, "0")}` };
}

function readMode(payload: unknown): IntermediateStateMode | undefined {
  if (!isRecord(payload)) return undefined;
  return payload.mode === "baseline" || payload.mode === "unannounced" ? payload.mode : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
