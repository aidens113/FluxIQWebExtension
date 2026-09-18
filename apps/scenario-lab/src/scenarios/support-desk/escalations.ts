import { escapeHtml } from "../../html.js";
import { ESCALATIONS_PATH } from "./format.js";
import type { DeskClasses } from "./styles.js";
import { escalationSeverities, type SupportDeskState } from "./types.js";

/**
 * The escalations screen: a second document, reached from the desk's own
 * navigation, where a ticket already in the queue is raised to someone else.
 *
 * It is the fixture's cross-screen work. Nothing here prefills a reference and
 * nothing here lists the queue, so the only way to escalate the right ticket is
 * to have read its reference off the queue and carried it here. The submit is
 * disabled until the reference matches a ticket the desk actually holds and a
 * severity has been chosen, so a reference invented rather than read cannot be
 * submitted at all, and the log names the requester the *desk* has for that
 * reference rather than anything the form was told.
 */

/** The `route` path that serves the log region on its own, so a raised escalation needs no page reload. */
export const ESCALATION_LOG_SUBPATH = "escalations/log";

/** The whole escalations screen, inside the desk's application shell. */
export function escalationsPageContent(css: DeskClasses, state: SupportDeskState): string {
  const severities = escalationSeverities
    .map((severity) => `<option value="${severity.toLowerCase()}">${severity}</option>`)
    .join("");
  return `<div class="${css.pageHead}">
<div>
<h1 class="${css.pageTitle}">Escalations</h1>
<p class="${css.statLine}" data-testid="escalation-summary">${escalationSummaryText(state)}</p>
</div>
</div>
<section class="${css.card}" aria-labelledby="raise-heading">
<div class="${css.paneBody}">
<h2 id="raise-heading">Raise an escalation</h2>
<form class="${css.formGrid}" data-testid="escalation-form" action="${ESCALATIONS_PATH}">
<p><label class="${css.fieldLabel}" for="escalation-reference">Ticket reference</label><br>
<input class="${css.input}" id="escalation-reference" data-testid="escalation-reference" name="reference" autocomplete="off" placeholder="TCK-0000"></p>
<p><label class="${css.fieldLabel}" for="escalation-severity">Severity</label><br>
<select class="${css.select}" id="escalation-severity" data-testid="escalation-severity" name="severity"><option value="">Choose a severity</option>${severities}</select></p>
<p><label class="${css.fieldLabel}" for="escalation-note">Why this needs escalating</label><br>
<textarea class="${css.textarea}" id="escalation-note" data-testid="escalation-note" name="note"></textarea></p>
<p class="${css.hint}">Raise escalation stays off until the reference matches a ticket on this desk and a severity is chosen.</p>
<p><button class="${css.button} ${css.buttonPrimary}" type="submit" data-testid="raise-escalation" disabled>Raise escalation</button></p>
</form>
</div>
</section>
<section class="${css.card}" aria-labelledby="log-heading">
<div class="${css.paneBody}">
<h2 id="log-heading">Escalation log</h2>
<div data-testid="escalation-log">${escalationLogMarkup(css, state)}</div>
</div>
</section>`;
}

/** The inside of the log region: the empty notice, or the table of what has been raised. */
export function escalationLogMarkup(css: DeskClasses, state: SupportDeskState): string {
  if (state.escalations.length === 0) return `<p class="${css.empty}" data-testid="escalation-empty">No escalations have been raised.</p>`;
  const rows = state.escalations.map((entry) => `<tr data-escalation-ref="${entry.reference}">
<td class="${css.cell}">${entry.reference}</td>
<td class="${css.cell}">${entry.severity}</td>
<td class="${css.cell}">${escapeHtml(entry.requester)}</td>
<td class="${css.cell}">Awaiting triage</td>
</tr>`).join("");
  return `<table class="${css.table}">
<thead><tr>
<th class="${css.headCell}" scope="col">Ticket</th>
<th class="${css.headCell}" scope="col">Severity</th>
<th class="${css.headCell}" scope="col">Requester</th>
<th class="${css.headCell}" scope="col">Status</th>
</tr></thead>
<tbody data-testid="escalation-rows">${rows}</tbody>
</table>`;
}

/** The line under the heading: what the desk has raised so far. */
export function escalationSummaryText(state: SupportDeskState): string {
  const count = state.escalations.length;
  if (count === 0) return "No escalations raised";
  return count === 1 ? "1 escalation raised" : `${count} escalations raised`;
}

/**
 * The browser half of the screen. The reference list is the desk's own, which
 * is why a typed reference can be checked before anything is submitted; the log
 * is re-fetched from the desk after a successful raise rather than rebuilt
 * here, so the screen and the server can never write the same row differently.
 */
export function escalationsClientScript(references: readonly string[]): string {
  return `const knownReferences = new Set(${JSON.stringify(references)});
const logPath = ${JSON.stringify(`/scenarios/support-desk/${ESCALATION_LOG_SUBPATH}`)};
${ESCALATIONS_CORE}`;
}

const ESCALATIONS_CORE = String.raw`
const form = document.querySelector('[data-testid="escalation-form"]');
const reference = document.querySelector('[data-testid="escalation-reference"]');
const severity = document.querySelector('[data-testid="escalation-severity"]');
const raise = document.querySelector('[data-testid="raise-escalation"]');
const summary = document.querySelector('[data-testid="escalation-summary"]');
const log = document.querySelector('[data-testid="escalation-log"]');

function typedReference() {
  return reference.value.trim().toUpperCase();
}

function syncRaise() {
  raise.disabled = !(knownReferences.has(typedReference()) && severity.value !== '');
}

reference.addEventListener('input', syncRaise);
severity.addEventListener('change', syncRaise);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void raiseEscalation();
});

async function raiseEscalation() {
  const chosen = severity.selectedOptions[0].textContent;
  const snapshot = await mutate('raise-escalation', { reference: typedReference(), severity: chosen });
  const raised = snapshot.state.escalations.length;
  summary.textContent = raised === 0 ? 'No escalations raised' : raised === 1 ? '1 escalation raised' : raised + ' escalations raised';
  const response = await fetch(logPath);
  if (!response.ok) throw new Error('Escalation log failed: ' + response.status);
  log.innerHTML = await response.text();
  reference.value = '';
  severity.value = '';
  syncRaise();
}
`;
