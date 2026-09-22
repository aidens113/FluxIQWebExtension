// The Adaptations view, read from the rendered panel and from Core together:
// the history table's rows and statuses, the "Changed fields" before/after
// tables of the Changes tab, and the PIN-authorized review actions (Approve,
// Apply Changes, Revert Changes, Reject) driven through the real dialogs. A
// review is judged three ways: Core's status and audit trail after it, the
// view's own detail badge, table row and event count, and the patched nodes of
// the Flow graph, whose parameters an apply or a revert must change and an
// approve or a reject must not. Callers open the Flow's Adaptations workspace
// first. Results are closed codes, closed statuses, counts, booleans and
// SHA-256 digests; no page text leaves this module.

import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import {
  type AdaptationChangesFacts,
  type AdaptationChangesReading,
  adaptationChangesResult,
  type AdaptationHistoryFacts,
  adaptationHistoryResult,
  type AdaptationReviewAction,
  type AdaptationReviewFacts,
  adaptationReviewVerdict,
  type AdaptationStatus,
  type AdaptationTableReading,
  type AdaptationUiCode,
  closedAdaptationStatus,
  type CoreAdaptationView,
  coreAdaptationView,
  REVIEW_RESULT_STATUS,
} from "./adaptation-facts.js";

const REVIEW_ENDPOINT = "/api/programs/automation-studio/review-flow-adaptation";
const REVIEW_COPY: Readonly<Record<AdaptationReviewAction, { title: string; label: string }>> = {
  approve: { title: "Approve Adaptation", label: "Approve" },
  apply: { title: "Apply Adaptation", label: "Apply Changes" },
  revert: { title: "Revert Adaptation", label: "Revert Changes" },
  reject: { title: "Reject Adaptation", label: "Reject" },
};

export type AdaptationCoreReader = Pick<ExistingFluxIQControlClient, "automationStudioCall" | "listFlowAdaptations" | "getExactFlow" | "listFlowSubflows">;
type AdaptationTarget = { page: Page; control: AdaptationCoreReader; projectId: string; flowId: string; timeoutMs?: number };

export type AdaptationHistoryAssertion = { code: AdaptationUiCode; facts: AdaptationHistoryFacts };
export type AdaptationChangesAssertion = { code: AdaptationUiCode; status: AdaptationStatus; facts: AdaptationChangesFacts };
export type AdaptationReviewAssertion = { code: AdaptationUiCode; facts: AdaptationReviewFacts; durationMs: number };

/** The history table against Core's adaptation list, optionally also requiring Core statuses the caller expects. */
export async function assertAdaptationHistory(input: AdaptationTarget & { expected?: Readonly<Record<string, AdaptationStatus>> }): Promise<AdaptationHistoryAssertion> {
  const deadline = Date.now() + (input.timeoutMs ?? 30_000);
  for (;;) {
    const core = await input.control.listFlowAdaptations(input.projectId, input.flowId);
    const result = adaptationHistoryResult(await input.page.evaluate(readAdaptationTable), core, input.expected ?? {});
    if (result.code === "adaptations.verified" || Date.now() >= deadline) return result;
    await input.page.waitForTimeout(250);
  }
}

/** Selects one adaptation in the table and waits for its detail to name it. */
export async function selectAdaptation(page: Page, adaptationId: string, timeoutMs = 30_000): Promise<boolean> {
  const current = await page.evaluate(readAdaptationDetail);
  if (current.id.trim() === adaptationId) return true;
  const index = (await page.evaluate(readAdaptationTable)).rows.findIndex(row => row.id.trim() === adaptationId);
  if (index < 0) return false;
  await page.locator('[role="table"][aria-label="Adaptations"] > button[role="row"]').nth(index).click();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await page.evaluate(readAdaptationDetail)).id.trim() === adaptationId) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

/** The Changes tab's "Changed fields" tables against the before/after values Core holds for each change and applied mutation. */
export async function assertAdaptationChanges(input: AdaptationTarget & { adaptationId: string; requireFieldRows?: boolean }): Promise<AdaptationChangesAssertion> {
  const selected = await selectAdaptation(input.page, input.adaptationId, input.timeoutMs);
  const core = await readCoreAdaptation(input.control, input.projectId, input.flowId, input.adaptationId);
  if (!selected) return { ...adaptationChangesResult({ present: false, planned: [], applied: [] }, core, false), code: "adaptations.row_missing", status: core.status };
  await detailTab(input.page, "Changes").click();
  const deadline = Date.now() + (input.timeoutMs ?? 30_000);
  for (;;) {
    const result = adaptationChangesResult(await input.page.evaluate(readAdaptationChanges), core, input.requireFieldRows ?? true);
    if (result.code === "adaptations.verified" || Date.now() >= deadline) return { ...result, status: core.status };
    await input.page.waitForTimeout(200);
  }
}

/**
 * Drives one review action through the Audit tab's button and its PIN dialog,
 * then measures the outcome. `restoredDigest` is the target digest an earlier
 * apply reported before it ran; a revert that does not return the patched
 * nodes to it fails as `adaptations.revert_not_restored`.
 */
export async function reviewAdaptationViaUi(input: AdaptationTarget & {
  adaptationId: string;
  action: AdaptationReviewAction;
  pin: string;
  reason?: string;
  restoredDigest?: string;
}): Promise<AdaptationReviewAssertion> {
  const began = Date.now();
  const timeoutMs = input.timeoutMs ?? 30_000;
  const { page, action } = input;
  const copy = REVIEW_COPY[action];
  const expected = REVIEW_RESULT_STATUS[action];
  const before = await readCoreAdaptation(input.control, input.projectId, input.flowId, input.adaptationId);
  const targetBefore = await targetDigest(input.control, input.projectId, input.flowId, before);
  const facts: AdaptationReviewFacts = {
    action, actionOffered: false, httpOk: false,
    statusBefore: before.status, statusAfter: before.status, detailStatus: "unknown", rowStatus: "unknown",
    auditTotalBefore: before.auditTotal, auditTotalAfter: before.auditTotal, auditEventsToStatusAdded: 0, renderedAuditTotal: null, reopenedAuditTotal: null,
    targetNodes: targetBefore.nodes, targetDigestBefore: targetBefore.digest, targetDigestAfter: targetBefore.digest,
  };
  const finish = () => ({ code: adaptationReviewVerdict(facts, input.restoredDigest), facts, durationMs: Date.now() - began });
  if (!await selectAdaptation(page, input.adaptationId, timeoutMs)) return finish();
  await detailTab(page, "Audit").click();
  const detail = page.locator(".automation-adaptation-workspace > .automation-runtime-log-page");
  const button = detail.locator(".automation-runtime-json-actions").getByRole("button", { name: copy.label, exact: true });
  facts.actionOffered = await button.waitFor({ state: "visible", timeout: 5_000 }).then(() => true, (error: unknown) => isTimeout(error) ? false : Promise.reject(error));
  if (!facts.actionOffered) return finish();
  await button.click();
  const dialog = page.getByRole("dialog", { name: copy.title, exact: true });
  await dialog.waitFor({ state: "visible", timeout: timeoutMs });
  if (action === "reject") await dialog.getByLabel(/^Reason/u).fill(input.reason ?? "Rejected by the UI end-to-end suite");
  await dialog.getByLabel(/^PIN/u).fill(input.pin);
  const responded = page.waitForResponse(response => response.request().method() === "POST" && response.url().includes(REVIEW_ENDPOINT), { timeout: timeoutMs });
  await dialog.getByRole("button", { name: copy.label, exact: true }).click();
  facts.httpOk = (await responded).ok();
  if (!facts.httpOk) {
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    return finish();
  }
  await dialog.waitFor({ state: "hidden", timeout: timeoutMs });

  const after = await readCoreAdaptation(input.control, input.projectId, input.flowId, input.adaptationId);
  const targetAfter = await targetDigest(input.control, input.projectId, input.flowId, after);
  facts.statusAfter = after.status;
  facts.auditTotalAfter = after.auditTotal;
  facts.auditEventsToStatusAdded = after.auditToStatuses.filter(status => status === expected).length - before.auditToStatuses.filter(status => status === expected).length;
  facts.targetDigestAfter = targetAfter.digest;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rendered = await page.evaluate(readAdaptationDetail);
    const row = (await page.evaluate(readAdaptationTable)).rows.find(item => item.id.trim() === input.adaptationId);
    facts.detailStatus = closedAdaptationStatus(rendered.status);
    facts.rowStatus = closedAdaptationStatus(row?.status);
    facts.renderedAuditTotal = auditCount(rendered.auditEvents);
    if ((facts.detailStatus === expected && facts.rowStatus === expected) || Date.now() >= deadline) break;
    await page.waitForTimeout(200);
  }
  facts.reopenedAuditTotal = await reopenedAuditCount(page, input.adaptationId, facts.auditTotalAfter, timeoutMs);
  return finish();
}

/**
 * Has the view load the adaptation afresh -- selecting its row again, which
 * resets the detail to its Summary tab once the load answers -- then reads the
 * Audit tab's count, waiting for it to reach `expected` within the timeout.
 */
async function reopenedAuditCount(page: Page, adaptationId: string, expected: number, timeoutMs: number): Promise<number | null> {
  const index = (await page.evaluate(readAdaptationTable)).rows.findIndex(row => row.id.trim() === adaptationId);
  if (index < 0) return null;
  await page.locator('[role="table"][aria-label="Adaptations"] > button[role="row"]').nth(index).click();
  const summary = page.getByRole("navigation", { name: "Adaptation detail views", exact: true }).getByRole("button", { name: "Summary", exact: true });
  const deadline = Date.now() + timeoutMs;
  while (await summary.getAttribute("aria-pressed") !== "true" && Date.now() < deadline) await page.waitForTimeout(100);
  await detailTab(page, "Audit").click();
  let count = auditCount((await page.evaluate(readAdaptationDetail)).auditEvents);
  while (count !== expected && Date.now() < deadline) {
    await page.waitForTimeout(200);
    count = auditCount((await page.evaluate(readAdaptationDetail)).auditEvents);
  }
  return count;
}

function auditCount(text: string): number | null {
  return wholeNumber(/^\s*(\d+) events?\s*$/u.exec(text)?.[1]);
}

async function readCoreAdaptation(control: AdaptationCoreReader, projectId: string, flowId: string, adaptationId: string): Promise<CoreAdaptationView> {
  const payload = await control.automationStudioCall("get-flow-adaptation", { projectId, flowId, adaptationId });
  return coreAdaptationView(payload !== null && typeof payload === "object" ? (payload as { adaptation?: unknown }).adaptation : undefined);
}

/**
 * A SHA-256 over the parameter values of the nodes an adaptation patches, in
 * the graph those nodes live in: the Subflow's own graph Flow when the
 * adaptation names a Subflow, the Flow itself otherwise.
 */
async function targetDigest(control: AdaptationCoreReader, projectId: string, flowId: string, core: CoreAdaptationView): Promise<{ digest: string; nodes: number }> {
  const graphFlowId = core.subflowId
    ? (await control.listFlowSubflows(projectId, flowId)).find(item => item.subflowId === core.subflowId)?.graphFlowId ?? flowId
    : flowId;
  const document = (await control.getExactFlow(projectId, graphFlowId)).document;
  const nodes = Array.isArray(document.nodes) ? document.nodes as Array<Record<string, unknown>> : [];
  const found = core.targetIds.map(id => [id, nodes.find(node => node.id === id || node.nodeId === id)?.parameterValues ?? null] as const);
  return {
    digest: createHash("sha256").update(JSON.stringify(found)).digest("hex"),
    nodes: found.filter(([, values]) => values !== null).length,
  };
}

function detailTab(page: Page, label: "Changes" | "Audit") {
  return page.getByRole("navigation", { name: "Adaptation detail views", exact: true }).getByRole("button", { name: label, exact: true });
}

function isTimeout(error: unknown): boolean {
  return (error as { name?: unknown })?.name === "TimeoutError";
}

function wholeNumber(text: string | undefined): number | null {
  return text !== undefined && /^\d{1,9}$/u.test(text) ? Number(text) : null;
}

// The functions below run inside the page and must stay self-contained:
// Playwright sends their source, not their closure.

function readAdaptationTable(): AdaptationTableReading {
  const table = document.querySelector('[role="table"][aria-label="Adaptations"]');
  if (!table) return { present: false, rows: [] };
  return {
    present: true,
    rows: Array.from(table.querySelectorAll(':scope > button[role="row"]')).map(row => ({
      id: row.querySelector(':scope > [role="cell"] small')?.textContent ?? "",
      status: row.querySelector(':scope > [role="cell"]:last-child .status-badge-pill')?.getAttribute("title") ?? "",
    })),
  };
}

function readAdaptationDetail(): { id: string; status: string; auditEvents: string } {
  const detail = document.querySelector(".automation-adaptation-workspace > .automation-runtime-log-page");
  const header = detail?.querySelector(":scope > header");
  const audit = detail?.querySelector('table[aria-label="Adaptation lifecycle events"]')?.closest(".automation-runtime-log-section");
  return {
    id: header?.querySelector(":scope > div > span")?.textContent ?? "",
    status: header?.querySelector(":scope > .status-badge-pill")?.getAttribute("title") ?? "",
    auditEvents: audit?.querySelector(":scope > header > span")?.textContent ?? "",
  };
}

function readAdaptationChanges(): AdaptationChangesReading {
  const body = document.querySelector(".automation-adaptation-workspace > .automation-runtime-log-page .automation-adaptation-detail-body");
  const sections = body ? Array.from(body.querySelectorAll(":scope > .automation-runtime-log-section")) : [];
  const section = (title: string) => sections.find(item => item.querySelector(":scope > header > strong")?.textContent === title);
  const cards = (container: Element | undefined) => container ? Array.from(container.querySelectorAll(".automation-adaptation-change")).map(card => {
    const table = card.querySelector('[role="table"][aria-label="Changed fields"]');
    return table ? Array.from(table.querySelectorAll(':scope > [role="row"]'))
      .filter(row => !row.querySelector('[role="columnheader"]'))
      .map(row => {
        const cells = row.querySelectorAll(':scope > [role="cell"]');
        return { path: cells[0]?.textContent ?? "", before: cells[1]?.textContent ?? "", after: cells[2]?.textContent ?? "" };
      }) : [];
  }) : [];
  const planned = section("Planned Changes");
  return { present: planned !== undefined, planned: cards(planned), applied: cards(section("Applied Changes")) };
}
