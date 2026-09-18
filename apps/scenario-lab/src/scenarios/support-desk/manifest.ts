import { createScenarioManifest } from "../../types.js";
import { REPLY_TEMPLATES } from "./detail-pane.js";
import { ESCALATIONS_PATH, slaLabel } from "./format.js";
import {
  applyDeskChanges, longestBreachingTicket, queueSummaryText, resultCountText,
  triageSummaryText, workloadText,
} from "./queue.js";
import { deskBuildMarker } from "./styles.js";
import { listedSubject, recoveredSlaTickets, REPLY_TICKET, supportTickets, TRIAGE_AGENT } from "./tickets.js";
import { defaultQueueFilters, filterTickets, slug } from "./views.js";
import type { SupportTicket } from "./types.js";

/** The rows an extract step reads: real tickets only, never the empty-state row a view with no matches renders. */
const QUEUE_ROWS = `[data-testid="ticket-rows"] > tr[data-ticket-ref]`;
/** The escalation log's rows, which exist only once something has been escalated. */
const ESCALATION_ROWS = `[data-testid="escalation-rows"] > tr[data-escalation-ref]`;
/**
 * The way into one ticket, addressed the only way it can be: by the row it is
 * in. All 320 subject controls declare the same `aria-controls`, carry the same
 * generated class and open the same pane.
 */
const ticketOpener = (reference: string) => `[data-ticket-ref="${reference}"] button[aria-controls="ticket-detail"]`;

/** The reply the recorded workflow sends: the one a person sends just before closing a ticket. */
const CLOSING_TEMPLATE = closingTemplate();

function closingTemplate(): { value: string; label: string } {
  const template = REPLY_TEMPLATES.find((candidate) => candidate.value === "closing-summary");
  if (!template) throw new Error("The support desk offers no closing summary template");
  return template;
}

const view = (name: string) => ({ ...defaultQueueFilters(), view: name });

const BASELINE = supportTickets;
const RECOVERED = recoveredSlaTickets;
/** Everything nobody owns that cannot wait: what the triage workflow hands to one agent. */
const TRIAGE_TARGETS = filterTickets(BASELINE, view("unassigned-priority"));
const AFTER_TRIAGE = applyDeskChanges(BASELINE, Object.fromEntries(TRIAGE_TARGETS.map((ticket) => [ticket.reference, TRIAGE_AGENT])), []);
const BREACHING = filterTickets(BASELINE, view("breaching"));
const RECOVERED_BREACHING = filterTickets(RECOVERED, view("breaching"));
const AFTER_RESOLVE = applyDeskChanges(BASELINE, {}, [REPLY_TICKET.reference]);
const RESOLVED_TICKET = ticketIn(AFTER_RESOLVE, REPLY_TICKET.reference);
/** The ticket that has been past its response target the longest: what the escalation workflow raises. */
const ESCALATED = longestBreachingTicket(BASELINE);

/**
 * What a person exporting this queue would read. `column:` follows the header
 * rather than the column position, and the requester cell's text is what it
 * looks like on a real page: the name, then the address, because both are text
 * in the cell. The subject is the *clipped* subject, because that is what the
 * column holds.
 */
const queueFields = {
  reference: "column:Ticket",
  requester: "column:Requester",
  subject: "column:Subject",
  priority: "column:Priority",
  assignee: "column:Assignee",
  sla: "column:SLA",
};

/**
 * What a ticket's own screen holds. Every field but the status is reachable
 * only by the label beside it, and `account` is on no other screen at all, so
 * a record carrying it proves the ticket was opened rather than read off the
 * queue.
 */
const ticketFields = {
  reference: `[data-field="reference"]`,
  requester: `[data-field="requester"]`,
  account: `[data-field="account"]`,
  priority: `[data-field="priority"]`,
  status: `[data-field="status"]`,
  assignee: `[data-field="assignee"]`,
};

const escalationFields = {
  ticket: "column:Ticket",
  severity: "column:Severity",
  requester: "column:Requester",
  status: "column:Status",
};

const summary = (tickets: readonly SupportTicket[]) => ({ id: "queue-summary", subject: "queue-summary", predicate: "text", value: queueSummaryText(tickets) });
const triageLine = (tickets: readonly SupportTicket[]) => ({ id: "triage-summary", subject: "triage-summary", predicate: "text", value: triageSummaryText(tickets) });
const workloadLine = (tickets: readonly SupportTicket[]) => ({ id: "workload", subject: "workload", predicate: "text", value: workloadText(tickets) });
const listed = (tickets: readonly SupportTicket[]) => ({ id: "rows-listed", subject: "result-count", predicate: "text", value: resultCountText(tickets.length, tickets.length) });
const showing = (shown: number, total: number) => ({ id: "rows-shown", subject: "result-count", predicate: "text", value: resultCountText(shown, total) });
/**
 * "No filters are applied" as a page fact, for a workflow's own unarmed page.
 *
 * It is deliberately never declared on a variant. `filter-summary` is a control
 * the recording waits on, and the repair-coverage check reads a variant's
 * "this recorded subject does not exist" fact as the drift having removed it
 * (`tests/live-repair-tasks.test.ts`). On a variant that changes only data, that
 * reading would be wrong, and it would demand a repair task for a row a
 * recorded Flow passes perfectly well.
 */
const unfiltered = { id: "no-filters", subject: "filter-summary", predicate: "exists", value: false };
const filtered = { id: "filters-shown", subject: "filter-summary", predicate: "exists", value: true };
const noTicketOpen = { id: "no-ticket-open", subject: "ticket-detail", predicate: "exists", value: false };
const assignDialogClosed = { id: "assign-dialog-closed", subject: "assign-dialog", predicate: "exists", value: false };
const confirmDialogClosed = { id: "confirm-dialog-closed", subject: "confirm-dialog", predicate: "exists", value: false };
const buildMarker = { id: "build-marker", subject: "build-marker", predicate: "text", value: deskBuildMarker() };
/**
 * The top bar's search input and the queue filter's are both labelled
 * "Search": two controls on one page with one accessible name, neither
 * distinguishable from the other by its name alone.
 */
const duplicateSearchLabels = { id: "duplicate-search-labels", subject: "document", predicate: "label-count:Search", value: 2 };

/** What the triage workflow's toast says. `TRIAGE_TARGETS` holds more than one ticket, which the unit tests pin. */
const TRIAGE_TOAST = `${TRIAGE_TARGETS.length} tickets assigned to ${TRIAGE_AGENT}`;
/** The final state of a triage, however it was carried out: nothing left waiting, and the work on the named agent. */
const TRIAGED = [triageLine(AFTER_TRIAGE), workloadLine(AFTER_TRIAGE), summary(AFTER_TRIAGE)];

/**
 * A support desk at the scale and with the markup of a real one: 320 tickets,
 * generated class names, a portalled row menu, a detail pane fetched from the
 * desk when a ticket is opened, and a second screen where an escalation is
 * raised against a reference that exists nowhere but the queue.
 *
 * Four workflows, and every one of them requires a multi-step automation with a
 * consequence. The manifest's own script triages the unassigned backlog onto
 * one agent; `reply-and-resolve` answers one requester from a template and
 * closes their ticket; `export-sla-breaches` reads everything past its response
 * target; `escalate-longest-breach` carries a reference off the queue onto the
 * escalations screen and reads back what the desk logged. Two of them are
 * judged on state the run left behind rather than on anything it read.
 *
 * `recordingEvents` name types without counts on purpose. No recording lane has
 * run this fixture yet, so "this type occurred" is a claim that can be made
 * honestly and an exact tally is not; a count belongs here once a run has
 * produced one.
 */
export const supportDeskManifest = createScenarioManifest({
  id: "support-desk",
  title: "Support desk",
  tags: ["support", "queue", "table", "generated-classes", "row-actions", "bulk-actions", "modal", "detail-pane", "cross-screen"],
  seed: 141,
  startPath: "/scenarios/support-desk/",
  capabilities: ["forms", "mutation", "navigation", "scroll"],
  recordingScript: [
    { id: "open-triage-view", operation: "click", target: "testid:triage-queue" },
    { id: "triage-view-applied", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
    { id: "select-every-ticket", operation: "check", target: "role:checkbox:Select every ticket in this view", value: true },
    { id: "open-assign-dialog", operation: "click", target: "role:button:Assign" },
    { id: "assign-dialog-open", operation: "waitForState", target: "testid:assign-dialog", timeoutMs: 2000 },
    { id: "choose-agent", operation: "select", target: "testid:assign-agent", value: slug(TRIAGE_AGENT) },
    { id: "confirm-assign", operation: "click", target: "testid:assign-confirm" },
    { id: "tickets-assigned", operation: "waitForState", target: "testid:toast", timeoutMs: 2000 },
    { id: "triage-done", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "triage-unassigned-backlog",
    description: `Assign every unassigned urgent or high priority ticket to ${TRIAGE_AGENT}, and leave the queue showing none still waiting for an owner.`,
    // Deliberately says nothing about how the tickets were assigned: one at a
    // time through the row menus reaches the same two lines as a bulk
    // assignment, and assigning them to anybody else fails the second.
    successFacts: [triageLine(AFTER_TRIAGE), workloadLine(AFTER_TRIAGE)],
  },
  expected: {
    pageFacts: [summary(BASELINE), triageLine(BASELINE), workloadLine(BASELINE), listed(BASELINE), unfiltered, noTicketOpen, duplicateSearchLabels, buildMarker],
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.changed" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.select", outcome: "succeeded" }],
    finalState: [
      { id: "triage-toast", subject: "toast", predicate: "text", value: TRIAGE_TOAST },
      ...TRIAGED,
      assignDialogClosed,
    ],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "relabelled-triage",
    description: "Only a repair can pass this row. The queue's triage shortcut was redesigned: the same control in the same place doing the same job, with none of the three things a recording wrote down -- no test id, a new class, and the label renamed to Work the backlog -- so the element matcher refuses it and a provider-free run fails with target_not_found. The expectations are the repaired run's: a model that re-points the click at Work the backlog reaches the same view and assigns the same tickets. Import and New ticket sit beside it as the pressable wrong answers; either leaves the whole queue selected and fails the oracle.",
    arm: { operation: "set-mode", payload: { mode: "relabelled-triage" } },
    expected: {
      pageFacts: [
        { id: "recorded-triage-gone", subject: "triage-queue", predicate: "exists", value: false },
        summary(BASELINE), triageLine(BASELINE), listed(BASELINE), buildMarker,
      ],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.select", outcome: "succeeded" }],
      finalState: [
        { id: "triage-toast", subject: "toast", predicate: "text", value: TRIAGE_TOAST },
        ...TRIAGED,
        assignDialogClosed,
      ],
    },
  }],
  workflows: [
    {
      id: "reply-and-resolve",
      description: `Find ${REPLY_TICKET.requester}'s ticket, open it, reply from the ${CLOSING_TEMPLATE.label} template, resolve it, and read the ticket back.`,
      recordingScript: [
        { id: "find-requester", operation: "type", target: "testid:ticket-search", value: REPLY_TICKET.requester },
        { id: "requester-found", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "open-ticket", operation: "click", target: ticketOpener(REPLY_TICKET.reference) },
        { id: "ticket-open", operation: "waitForState", target: "testid:ticket-detail", timeoutMs: 2000 },
        { id: "choose-template", operation: "select", target: "testid:reply-template", value: CLOSING_TEMPLATE.value },
        { id: "insert-template", operation: "click", target: "testid:insert-template" },
        { id: "send-reply", operation: "click", target: "testid:send-reply" },
        { id: "reply-sent", operation: "waitForState", target: "testid:toast", timeoutMs: 4000 },
        { id: "open-resolve", operation: "click", target: "testid:resolve-ticket" },
        { id: "resolve-confirmed", operation: "waitForState", target: "testid:confirm-dialog", timeoutMs: 2000 },
        { id: "confirm-resolve", operation: "click", target: "role:button:Resolve this ticket" },
        // The desk raises this toast only after the pane has been re-fetched,
        // so waiting for it is what makes the read below the resolved ticket.
        { id: "ticket-resolved", operation: "waitForState", target: "testid:toast", timeoutMs: 4000 },
        { id: "read-resolved-ticket", operation: "extract", target: "testid:ticket-detail", fields: ticketFields },
        { id: "reply-and-resolve-done", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [summary(BASELINE), triageLine(BASELINE), listed(BASELINE), unfiltered, noTicketOpen, duplicateSearchLabels],
        recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.changed" }, { type: "web.element.input_changed" }],
        actions: [
          { action: "web.dom.type", outcome: "succeeded" },
          { action: "web.dom.select", outcome: "succeeded" },
          { action: "web.dom.click", outcome: "succeeded" },
        ],
        extracted: [{ step: "read-resolved-ticket", count: 1, records: [ticketRecord(RESOLVED_TICKET)] }],
        finalState: [
          { id: "resolve-toast", subject: "toast", predicate: "text", value: `${REPLY_TICKET.reference} resolved` },
          { id: "ticket-now-resolved", subject: "detail-status", predicate: "text", value: "Resolved" },
          { id: "queue-after-resolve", subject: "queue-summary", predicate: "text", value: queueSummaryText(AFTER_RESOLVE) },
          confirmDialogClosed,
        ],
        allowedConsoleErrors: [],
      },
    },
    {
      id: "export-sla-breaches",
      description: "Switch the queue to everything past its response target and export those rows as a table.",
      recordingScript: [
        { id: "choose-breaching-view", operation: "select", target: "testid:saved-view", value: "breaching" },
        { id: "breaching-view-applied", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "extract-sla-breaches", operation: "extract", target: QUEUE_ROWS, fields: queueFields },
        { id: "sla-breaches-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [summary(BASELINE), triageLine(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels],
        recordingEvents: [{ type: "web.element.changed" }],
        actions: [{ action: "web.dom.select", outcome: "succeeded" }, { action: "web.dom.extract_list" }],
        extracted: [{ step: "extract-sla-breaches", count: BREACHING.length, records: queueRecords(BREACHING) }],
        finalState: [showing(BREACHING.length, BASELINE.length), filtered],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "recovered-sla",
        description: "The night shift worked the backlog down, so far fewer tickets are past their response target. Nothing on the page moves: the same view, the same columns and the same read, returning the rows that are still late.",
        arm: { operation: "set-mode", payload: { mode: "recovered-sla" } },
        expected: {
          pageFacts: [summary(RECOVERED), triageLine(RECOVERED), listed(RECOVERED), buildMarker],
          extracted: [{ step: "extract-sla-breaches", count: RECOVERED_BREACHING.length, records: queueRecords(RECOVERED_BREACHING) }],
          finalState: [showing(RECOVERED_BREACHING.length, RECOVERED.length), filtered],
        },
      }],
    },
    {
      id: "escalate-longest-breach",
      description: "Carry the reference of the ticket that has been late longest onto the escalations screen, raise a critical escalation for it, and read the log back.",
      recordingScript: [
        { id: "list-the-late-tickets", operation: "select", target: "testid:saved-view", value: "breaching" },
        { id: "late-tickets-listed", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "open-escalations", operation: "click", target: "role:link:Escalations" },
        { id: "escalation-form-shown", operation: "waitForState", target: "testid:escalation-form", timeoutMs: 5000 },
        { id: "enter-reference", operation: "type", target: "testid:escalation-reference", value: ESCALATED.reference },
        { id: "choose-severity", operation: "select", target: "testid:escalation-severity", value: "critical" },
        { id: "explain-escalation", operation: "type", target: "testid:escalation-note", value: "Past its response target longer than anything else on the desk." },
        // Disabled until the reference matches a ticket the desk holds and a
        // severity is chosen, so a reference invented rather than read cannot
        // be submitted at all.
        { id: "raise-escalation", operation: "click", target: "testid:raise-escalation" },
        { id: "escalation-logged", operation: "waitForState", target: "testid:escalation-rows", timeoutMs: 5000 },
        { id: "extract-escalation-log", operation: "extract", target: ESCALATION_ROWS, fields: escalationFields },
        { id: "escalation-log-read", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [summary(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels],
        recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.changed" }, { type: "web.element.input_changed" }],
        actions: [
          { action: "web.dom.type", outcome: "succeeded" },
          { action: "web.dom.select", outcome: "succeeded" },
          { action: "web.dom.click", outcome: "succeeded" },
          { action: "web.dom.extract_list" },
        ],
        // The requester is the desk's own for that reference, never anything
        // the form was told, so a log row naming the right person is proof the
        // right ticket was carried across.
        extracted: [{
          step: "extract-escalation-log",
          count: 1,
          records: [{ ticket: ESCALATED.reference, severity: "Critical", requester: ESCALATED.requester, status: "Awaiting triage" }],
        }],
        finalState: [
          { id: "one-escalation-raised", subject: "escalation-summary", predicate: "text", value: "1 escalation raised" },
          { id: "on-the-escalations-screen", subject: "document", predicate: "path", value: ESCALATIONS_PATH },
        ],
        allowedConsoleErrors: [],
      },
    },
  ],
});

/** The records the queue yields for a set of tickets, in the page's own text. */
function queueRecords(tickets: readonly SupportTicket[]): Array<Record<string, string>> {
  return tickets.map((ticket) => ({
    reference: ticket.reference,
    requester: `${ticket.requester} ${ticket.requesterEmail}`,
    subject: listedSubject(ticket),
    priority: ticket.priority,
    assignee: ticket.assignee,
    sla: slaLabel(ticket),
  }));
}

/** The record a ticket's own screen yields. */
function ticketRecord(ticket: SupportTicket): Record<string, string> {
  return {
    reference: ticket.reference,
    requester: `${ticket.requester} (${ticket.requesterEmail})`,
    account: ticket.account,
    priority: ticket.priority,
    status: ticket.status,
    assignee: ticket.assignee,
  };
}

function ticketIn(tickets: readonly SupportTicket[], reference: string): SupportTicket {
  const found = tickets.find((ticket) => ticket.reference === reference);
  if (!found) throw new Error(`The support desk queue has no ticket ${reference}`);
  return found;
}
