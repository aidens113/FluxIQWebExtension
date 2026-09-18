import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario, type ExpectedExtraction } from "@fluxiq-web-extension/test-contracts";
import { ESCALATIONS_PATH, isBreaching, slaLabel, truncateSubject } from "../format.js";
import { applyDeskChanges, longestBreachingTicket, queueCounts, queueSummaryText, triageSummaryText, workloadText } from "../queue.js";
import { supportDeskScenario as scenario } from "../scenario.js";
import { QUEUE_SIZE, REPLY_TICKET, listedSubject, recoveredSlaTickets, supportAgents, supportTickets, TRIAGE_AGENT } from "../tickets.js";
import { defaultQueueFilters, filterTickets } from "../views.js";
import { UNASSIGNED, type SupportDeskState, type SupportTicket } from "../types.js";

const manifest = scenario.manifest;
const context = { runToken: "support-desk-unit-token", seed: 141 };
const initial = () => scenario.createState(scenario.seed);
const apply = (state: SupportDeskState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const view = (name: string) => ({ ...defaultQueueFilters(), view: name });
const TRIAGE_TARGETS = filterTickets(supportTickets, view("unassigned-priority"));

function route(state: SupportDeskState, subpath: string) {
  const handler = scenario.route;
  assert.ok(handler);
  return handler(state, { subpath, query: new URLSearchParams(""), method: "GET" }, context);
}

/** Tag text with whitespace collapsed: what `textContent` gives a column read. */
function text(html: string): string {
  return html.replace(/<[^>]*>/gu, " ").replaceAll("&#039;", "'").replace(/\s+/gu, " ").trim();
}

/** The document with its inline bundle taken out: the markup a person's browser paints. */
function markupOf(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gu, "");
}

function headers(html: string): string[] {
  const head = /<thead>([\s\S]*?)<\/thead>/u.exec(html)?.[1] ?? "";
  return [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gu)].map((match) => text(match[1] ?? ""));
}

/** The cells of one ticket's row, in column order, read the way `column:` reads them. */
function rowCells(html: string, reference: string): string[] {
  const row = new RegExp(`<tr class="[^"]*" data-ticket-ref="${reference}">([\\s\\S]*?)</tr>`, "u").exec(html)?.[1];
  assert.ok(row, `no row for ${reference}`);
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)].map((match) => text(match[1] ?? ""));
}

function extraction(workflowId: string | undefined, stepId: string, variantId?: string): ExpectedExtraction {
  const selection = { ...(workflowId === undefined ? {} : { workflowId }), ...(variantId === undefined ? {} : { variantId }) };
  const found = resolveScenarioWorkflow(manifest, selection).expected.extracted?.find(({ step }) => step === stepId);
  assert.ok(found, `${workflowId ?? "primary"} declares no dataset ${stepId}`);
  return found;
}

test("the manifest is valid and declares the three workflows and two variants the fixture renders", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["reply-and-resolve", "export-sla-breaches", "escalate-longest-breach"]);
  assert.deepEqual(manifest.variants?.map(({ id }) => id), ["relabelled-triage"]);
  assert.deepEqual(manifest.workflows?.flatMap((workflow) => (workflow.variants ?? []).map(({ id }) => id)), ["recovered-sla"]);
  assert.ok(manifest.playbackGoal);
});

test("the queue is the size the fixture claims, and every requester and reference is its own", () => {
  assert.equal(supportTickets.length, QUEUE_SIZE);
  assert.equal(new Set(supportTickets.map(({ reference }) => reference)).size, QUEUE_SIZE);
  assert.equal(new Set(supportTickets.map(({ requester }) => requester)).size, QUEUE_SIZE);
  assert.equal(new Set(supportTickets.map(({ account }) => account)).size, QUEUE_SIZE);
  assert.equal(recoveredSlaTickets.length, QUEUE_SIZE);
});

test("no two late tickets are late by the same amount, so the longest breach is one ticket", () => {
  const breaching = supportTickets.filter((ticket) => isBreaching(ticket));
  assert.ok(breaching.length > 1, "the queue has nothing past its response target");
  assert.equal(new Set(breaching.map(({ slaMinutes }) => slaMinutes)).size, breaching.length);
  const longest = longestBreachingTicket(supportTickets);
  assert.equal(breaching.filter(({ slaMinutes }) => slaMinutes === longest.slaMinutes).length, 1);
});

test("the triage backlog holds more than one ticket, so the workflow's toast is the plural one", () => {
  assert.ok(TRIAGE_TARGETS.length > 1, `the triage view holds ${TRIAGE_TARGETS.length} tickets`);
  for (const ticket of TRIAGE_TARGETS) {
    assert.equal(ticket.assignee, UNASSIGNED, ticket.reference);
    assert.notEqual(ticket.status, "Resolved", ticket.reference);
    assert.ok(ticket.priority === "Urgent" || ticket.priority === "High", ticket.reference);
  }
  const toast = manifest.expected.finalState?.find(({ id }) => id === "triage-toast");
  assert.equal(toast?.value, `${TRIAGE_TARGETS.length} tickets assigned to ${TRIAGE_AGENT}`);
});

test("the ticket the reply workflow closes is late, owned, and the only row its requester matches", () => {
  assert.equal(REPLY_TICKET.status, "Pending");
  assert.notEqual(REPLY_TICKET.assignee, UNASSIGNED);
  assert.ok(isBreaching(REPLY_TICKET));
  const matching = filterTickets(supportTickets, { ...defaultQueueFilters(), search: REPLY_TICKET.requester });
  assert.deepEqual(matching.map(({ reference }) => reference), [REPLY_TICKET.reference]);
});

test("the start page renders every ticket, with generated class names and no authored ones", () => {
  const html = scenario.render(initial(), context);
  assert.equal([...html.matchAll(/data-ticket-ref="/gu)].length, QUEUE_SIZE);
  const classNames = [...markupOf(html).matchAll(/class="([^"]*)"/gu)].flatMap((match) => (match[1] ?? "").split(" ")).filter((name) => name !== "");
  assert.deepEqual([...new Set(classNames.filter((name) => !/^css-[0-9a-z]{7}$/u.test(name)))], []);
  assert.ok(html.includes(`data-testid="queue-summary">${queueSummaryText(supportTickets)}<`));
  assert.ok(html.includes(`data-testid="triage-summary">${triageSummaryText(supportTickets)}<`));
  assert.ok(html.includes(workloadText(supportTickets)));
});

test("the queue column read the export workflow declares is what the rendered rows hold", () => {
  const html = scenario.render(initial(), context);
  const columns = headers(html);
  const breaching = filterTickets(supportTickets, view("breaching"));
  const declared = extraction("export-sla-breaches", "extract-sla-breaches");
  assert.deepEqual(declared.records?.map((record) => record.reference), breaching.map(({ reference }) => reference));
  for (const ticket of breaching) {
    const cells = rowCells(html, ticket.reference);
    const cell = (header: string) => cells[columns.indexOf(header)];
    assert.equal(cell("Ticket"), ticket.reference);
    assert.equal(cell("Requester"), `${ticket.requester} ${ticket.requesterEmail}`);
    assert.equal(cell("Subject"), listedSubject(ticket));
    assert.equal(cell("Priority"), ticket.priority);
    assert.equal(cell("Assignee"), ticket.assignee);
    assert.equal(cell("SLA"), slaLabel(ticket));
  }
});

test("a clipped subject keeps a whole word and ends in an ellipsis; a short one is left alone", () => {
  assert.equal(truncateSubject("Request to add a second billing contact"), "Request to add a second billing contact");
  const clipped = truncateSubject("Please move our renewal date to the end of the quarter");
  assert.ok(clipped.endsWith("…"), clipped);
  assert.ok(clipped.length <= 45, clipped);
  assert.ok(supportTickets.some((ticket) => listedSubject(ticket).endsWith("…")), "no subject in the queue is long enough to clip");
});

test("assigning tickets moves them onto the named agent and empties the triage line", () => {
  const references = TRIAGE_TARGETS.map(({ reference }) => reference);
  const assigned = apply(initial(), "assign-tickets", { references, agent: TRIAGE_AGENT });
  const after = applyDeskChanges(supportTickets, assigned.assignments, assigned.resolved);
  assert.equal(assigned.oracle.awaitingTriageCount, 0);
  assert.equal(queueCounts(after).unassignedCount, queueCounts(supportTickets).unassignedCount - references.length);
  assert.equal(workloadText(after), manifest.playbackGoal?.successFacts.find(({ id }) => id === "workload")?.value);
  assert.deepEqual(assigned.activity, [`assigned ${references.length} ${TRIAGE_AGENT}`]);
});

test("resolving a late ticket stops its countdown, which is what moves the breach count", () => {
  const resolved = apply(initial(), "resolve-ticket", { reference: REPLY_TICKET.reference });
  const after = applyDeskChanges(supportTickets, resolved.assignments, resolved.resolved);
  assert.equal(resolved.oracle.breachingCount, queueCounts(supportTickets).breachingCount - 1);
  assert.equal(slaLabel(ticketIn(after, REPLY_TICKET.reference)), "Met");
  assert.equal(queueSummaryText(after), workflowFact("reply-and-resolve", "queue-after-resolve"));
});

test("an escalation names the requester the desk holds for that reference, not anything the form was told", () => {
  const longest = longestBreachingTicket(supportTickets);
  const raised = apply(initial(), "raise-escalation", { reference: longest.reference, severity: "Critical" });
  assert.deepEqual(raised.escalations, [{ reference: longest.reference, severity: "Critical", requester: longest.requester }]);
  // The same reference twice is one escalation, and an unknown reference is none.
  assert.equal(apply(raised, "raise-escalation", { reference: longest.reference, severity: "Normal" }), raised);
  assert.equal(apply(initial(), "raise-escalation", { reference: "TCK-0000", severity: "Critical" }).escalations.length, 0);
});

test("a payload the page could not have sent leaves the desk alone", () => {
  const state = initial();
  const rejected: Array<[string, unknown]> = [
    ["assign-tickets", { references: [REPLY_TICKET.reference], agent: "Somebody Else" }],
    ["assign-tickets", { references: ["TCK-0000"], agent: TRIAGE_AGENT }],
    ["assign-tickets", { references: "TCK-2100", agent: TRIAGE_AGENT }],
    ["resolve-ticket", { reference: 42 }],
    ["raise-escalation", { reference: REPLY_TICKET.reference, severity: "Apocalyptic" }],
    ["set-mode", { mode: "nonsense" }],
    ["unknown-operation", { reference: REPLY_TICKET.reference }],
  ];
  for (const [operation, payload] of rejected) assert.equal(apply(state, operation, payload), state, operation);
  for (const payload of [null, "text", ["array"], 7]) assert.equal(apply(state, "resolve-ticket", payload), state, JSON.stringify(payload));
});

test("arming a rendering clears what an earlier run did, so an armed run's oracle is its own", () => {
  const worked = apply(apply(initial(), "resolve-ticket", { reference: REPLY_TICKET.reference }), "raise-escalation", { reference: REPLY_TICKET.reference, severity: "Serious" });
  const armed = apply(worked, "set-mode", { mode: "recovered-sla" });
  assert.deepEqual([armed.resolved, armed.escalations, armed.assignments], [[], [], {}]);
  assert.equal(armed.oracle.breachingCount, queueCounts(recoveredSlaTickets).breachingCount);
  assert.equal(extraction("export-sla-breaches", "extract-sla-breaches", "recovered-sla").count, armed.oracle.breachingCount);
});

test("the relabelled rendering drops every identifier from the triage shortcut and keeps its neighbours", () => {
  const baseline = scenario.render(initial(), context);
  const armed = scenario.render(apply(initial(), "set-mode", { mode: "relabelled-triage" }), context);
  assert.ok(baseline.includes(`data-testid="triage-queue"`));
  assert.ok(!armed.includes(`data-testid="triage-queue"`));
  assert.ok(!armed.includes("Triage queue"));
  assert.ok(armed.includes("Work the backlog"));
  for (const decoy of [`data-action="import"`, `data-action="new-ticket"`]) assert.ok(armed.includes(decoy), decoy);
  const declared = manifest.variants?.[0]?.expected.pageFacts?.find(({ id }) => id === "recorded-triage-gone");
  assert.deepEqual([declared?.subject, declared?.predicate, declared?.value], ["triage-queue", "exists", false]);
});

test("the route serves a ticket, the escalations screen and the log, and nothing else", () => {
  const state = initial();
  const pane = route(state, `tickets/${REPLY_TICKET.reference}`);
  assert.equal(pane?.status, 200);
  // The account is on the ticket and on no other screen, which is what makes
  // reading it proof the ticket was opened.
  assert.ok(pane?.body?.includes(REPLY_TICKET.account));
  assert.ok(!scenario.render(state, context).includes(REPLY_TICKET.account));
  const screen = route(state, "escalations");
  assert.ok(screen?.body?.includes(`data-testid="escalation-form"`));
  assert.ok(screen?.body?.includes("No escalations have been raised."));
  assert.ok(route(state, "escalations/log")?.body?.includes(`data-testid="escalation-empty"`));
  const raised = apply(state, "raise-escalation", { reference: REPLY_TICKET.reference, severity: "Critical" });
  const log = route(raised, "escalations/log");
  assert.ok(log?.body?.includes(`data-escalation-ref="${REPLY_TICKET.reference}"`));
  assert.ok(log?.body?.includes(REPLY_TICKET.requester));
  for (const missing of ["tickets/TCK-0000", "tickets/nonsense", "escalations/nope", ""]) assert.equal(route(state, missing), undefined, missing);
});

test("the escalations screen links back from the desk's navigation and names every agent it can assign to", () => {
  const html = scenario.render(initial(), context);
  assert.ok(html.includes(`href="${ESCALATIONS_PATH}"`));
  for (const agent of supportAgents) assert.ok(html.includes(agent), agent);
});

function ticketIn(tickets: readonly SupportTicket[], reference: string): SupportTicket {
  const found = tickets.find((ticket) => ticket.reference === reference);
  assert.ok(found, reference);
  return found;
}

function workflowFact(workflowId: string, factId: string): unknown {
  const workflow = manifest.workflows?.find(({ id }) => id === workflowId);
  return workflow?.expected.finalState?.find(({ id }) => id === factId)?.value;
}
