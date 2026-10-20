import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { ESCALATIONS_PATH, SUPPORT_DESK_ROOT } from "../format.js";
import { longestBreachingTicket, queueCounts } from "../queue.js";
import { supportDeskScenario } from "../scenario.js";
import { REPLY_TICKET, supportTickets, TRIAGE_AGENT } from "../tickets.js";
import { defaultQueueFilters, filterTickets } from "../views.js";
import type { SupportDeskState } from "../types.js";

/**
 * The desk's server side, driven over HTTP exactly as its client script and
 * the Testing Lab drive it: the triage, reply, resolve and escalation
 * operations and the variant arms through `/api/support-desk/<operation>`, the
 * ticket pane and the escalations screen through their routes, and the oracle
 * through `/__control/final-state`. These replace the server-side halves of
 * the retired browser spec; its browser halves (buttons enabling as forms are
 * filled, the pane fetched into the page, views re-rendering the table) are
 * fixture behaviour no browser test may open.
 */

const SCENARIO = "support-desk";
const manifest = supportDeskScenario.manifest;
const BASE = queueCounts(supportTickets);
const TRIAGE_TARGETS = filterTickets(supportTickets, { ...defaultQueueFilters(), view: "unassigned-priority" }).map(({ reference }) => reference);

async function withLab(run: (io: ReturnType<typeof client>) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: "support-desk-lab-server-token", seed: 42 });
  try { await run(client(lab)); } finally { await lab.close(); }
}

function client(lab: RunningScenarioLab) {
  const authorization = `Bearer ${lab.runToken}`;
  return {
    get: async (path: string) => {
      const response = await fetch(`${lab.origin}${path}`);
      return { status: response.status, body: await response.text() };
    },
    post: async (operation: string, payload: unknown) => {
      const response = await fetch(`${lab.origin}/api/${SCENARIO}/${operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      assert.equal(response.status, 200, operation);
      return (await response.json() as { mutation: { status: string } }).mutation.status;
    },
    arm: async (selection: { workflowId?: string; variantId: string }) => {
      const { variant } = resolveScenarioWorkflow(manifest, selection);
      assert.ok(variant, selection.variantId);
      const response = await fetch(`${lab.origin}/api/${SCENARIO}/${variant.arm.operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(variant.arm.payload ?? {}),
      });
      assert.equal(response.status, 200, `arming ${selection.variantId}`);
    },
    state: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=${SCENARIO}`, { headers: { authorization } });
      assert.equal(response.status, 200);
      return (await response.json() as { state: SupportDeskState }).state;
    },
  };
}

test("over HTTP, triaging the backlog moves it onto one agent and empties the triage line", async () => withLab(async (io) => {
  assert.ok(TRIAGE_TARGETS.length > 1);
  assert.equal(await io.post("assign-tickets", { references: TRIAGE_TARGETS, agent: TRIAGE_AGENT }), "changed");
  const state = await io.state();
  assert.equal(state.oracle.awaitingTriageCount, 0);
  assert.equal(state.oracle.unassignedCount, BASE.unassignedCount - Object.keys(state.assignments).length);
  assert.deepEqual([...new Set(Object.values(state.assignments))], [TRIAGE_AGENT]);
}));

test("over HTTP, replying and resolving closes the ticket and stops its countdown", async () => withLab(async (io) => {
  const pane = await io.get(`${SUPPORT_DESK_ROOT}tickets/${REPLY_TICKET.reference}`);
  assert.equal(pane.status, 200);
  assert.ok(pane.body.includes(REPLY_TICKET.account), "the requester's account is on the ticket pane");
  assert.match(pane.body, /data-testid="send-reply" disabled>/);
  assert.equal(await io.post("reply-ticket", { reference: REPLY_TICKET.reference, template: "free-text" }), "changed");
  assert.equal(await io.post("reply-ticket", { reference: REPLY_TICKET.reference }), "no_change", "a reply names its template");
  assert.equal(await io.post("resolve-ticket", { reference: REPLY_TICKET.reference }), "changed");
  const state = await io.state();
  assert.deepEqual([state.replies, state.resolved], [[REPLY_TICKET.reference], [REPLY_TICKET.reference]]);
  assert.equal(state.oracle.breachingCount, BASE.breachingCount - 1);
}));

test("over HTTP, an escalation carries the desk's own requester and an unknown reference raises none", async () => withLab(async (io) => {
  const screen = await io.get(ESCALATIONS_PATH);
  assert.match(screen.body, /data-testid="raise-escalation" disabled>/);
  assert.equal(await io.post("raise-escalation", { reference: "TCK-0000", severity: "Critical" }), "no_change");
  const longest = longestBreachingTicket(supportTickets);
  assert.equal(await io.post("raise-escalation", { reference: longest.reference, severity: "Critical" }), "changed");
  assert.deepEqual((await io.state()).escalations, [{ reference: longest.reference, severity: "Critical", requester: longest.requester }]);
  assert.ok((await io.get(`${ESCALATIONS_PATH}/log`)).body.includes(`data-escalation-ref="${longest.reference}"`));
}));

test("over HTTP, the relabelled rendering drops the triage shortcut and the repaired run still empties the backlog", async () => withLab(async (io) => {
  await io.arm({ variantId: "relabelled-triage" });
  const page = (await io.get(SUPPORT_DESK_ROOT)).body;
  assert.equal(page.includes(`data-testid="triage-queue"`), false);
  assert.ok(page.includes("Work the backlog"));
  await io.post("assign-tickets", { references: TRIAGE_TARGETS, agent: TRIAGE_AGENT });
  const state = await io.state();
  assert.deepEqual([state.mode, state.oracle.awaitingTriageCount], ["relabelled-triage", 0]);

  await io.arm({ workflowId: "export-sla-breaches", variantId: "recovered-sla" });
  const recovered = await io.state();
  assert.deepEqual([recovered.mode, recovered.assignments], ["recovered-sla", {}], "arming clears the earlier run");
}));

test("the saved views narrow the queue, and a view and a filter that cannot both hold leave none", () => {
  const breaching = { ...defaultQueueFilters(), view: "breaching" };
  assert.equal(filterTickets(supportTickets, defaultQueueFilters()).length, BASE.ticketCount);
  assert.equal(filterTickets(supportTickets, breaching).length, BASE.breachingCount);
  assert.equal(filterTickets(supportTickets, { ...breaching, status: "resolved" }).length, 0);
});
