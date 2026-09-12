import { fixtureClient, page } from "../../html.js";
import type { AmbiguousTargetsMode } from "./modes.js";

/** The duplicate email fields every rendering carries: two controls one `<label>` names alike. */
const EMAIL_FIELDS = `<label>Email <input data-testid="email-primary"></label><label>Email <input data-testid="email-secondary"></label>`;
const RESULT = `<p data-testid="result" aria-live="polite">None</p>`;

/**
 * The recorded rendering. Left exactly as it was: the content-harness suite
 * pins its markup, its geometry, and the fact that both buttons report the same
 * `context`, so resolution there falls back to the test id.
 */
const BASELINE_BODY = `<main><h1>Ambiguous targets</h1><section aria-label="Primary"><button data-testid="choice-primary" data-choice="primary">Continue</button></section><section aria-label="Secondary"><button data-testid="choice-secondary" data-choice="secondary">Continue</button></section>${EMAIL_FIELDS}${RESULT}</main>`;

/**
 * Both choices in one unnamed group. No test id, no id, no name, no title, no
 * `aria-label`, no distinguishing class, no form, no fieldset, no list, and the
 * same nearest heading and landmark for both: nothing on this page prefers one
 * `Continue` over the other.
 */
const NO_CONTEXT_BODY = `<main><h1>Ambiguous targets</h1><div class="choice-group"><button class="ui-button">Continue</button><button class="ui-button">Continue</button></div>${EMAIL_FIELDS}${RESULT}</main>`;

/**
 * The same two buttons, each back inside the form and legend it belongs to.
 * Still no test ids and still the same accessible name, so `formName`,
 * `formAction` and `fieldsetLegend` are the only signals that differ.
 */
const FORM_CONTEXT_BODY = `<main><h1>Ambiguous targets</h1><form name="primary-choice" action="/scenarios/ambiguous-targets/primary"><fieldset><legend>Primary</legend><button type="button" class="ui-button">Continue</button></fieldset></form><form name="secondary-choice" action="/scenarios/ambiguous-targets/secondary"><fieldset><legend>Secondary</legend><button type="button" class="ui-button">Continue</button></fieldset></form>${EMAIL_FIELDS}${RESULT}</main>`;

const BODIES: Record<AmbiguousTargetsMode, string> = {
  baseline: BASELINE_BODY,
  "no-context": NO_CONTEXT_BODY,
  "form-context": FORM_CONTEXT_BODY,
};

/**
 * The baseline binds its handlers through `data-choice`, which is how this
 * fixture has always worked. The armed renderings carry no such attribute --
 * one more signal would be one more way to tell the buttons apart -- so they
 * bind by position instead, which the DOM knows and a recorded fingerprint
 * does not.
 */
const BASELINE_SCRIPT = `document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', async () => { await mutate('choose', { id: button.dataset.choice }); document.querySelector('[data-testid="result"]').textContent = button.dataset.choice; }));`;
const POSITIONAL_SCRIPT = `document.querySelectorAll('button').forEach((button, index) => button.addEventListener('click', async () => { const id = index === 0 ? 'primary' : 'secondary'; await mutate('choose', { id }); document.querySelector('[data-testid="result"]').textContent = id; }));`;

export function renderAmbiguousTargets(mode: AmbiguousTargetsMode, runToken: string): string {
  const script = mode === "baseline" ? BASELINE_SCRIPT : POSITIONAL_SCRIPT;
  return page("Ambiguous targets", BODIES[mode], `${fixtureClient(runToken, "ambiguous-targets")}
${script}`);
}
