// How Runtime Debug's Action Log presents a failed run, read from the DOM and
// checked against Core's own run detail.
//
// A person watching the run must see, without reloading: the run's status
// badge reading Failed, one attempt row per attempt Core recorded with the
// failed one marked Failed, and the run's terminal reason. The terminal reason
// is compared with Core's `metadata.terminalFailureReason` in memory and
// reported only as a closed code: Core writes one of four fixed sentences, or
// the run trace's own message (Core `summaries/conversions.ts`,
// `runtimeTerminalFailureReason`), which is never copied out.
import type { Page } from "@playwright/test";
import { RunnerFailure } from "../../failure.js";

/** Core's fixed terminal-reason sentences and the closed code each is reported as. */
const TERMINAL_REASONS: ReadonlyMap<string, string> = new Map([
  ["Recovery ladder stopped at LLM diagnosis fallback because no deterministic recovery resolved the failure.", "terminal.recovery_diagnosis_only"],
  ["Recovery ladder exhausted all known recovery candidates.", "terminal.recovery_exhausted"],
  ["Run failed before recovery lookup produced a candidate.", "terminal.no_recovery_candidate"],
  ["Run failed after recovery was selected.", "terminal.recovery_selected_failed"],
]);

/** The closed code for Core's terminal reason: a fixed sentence's own code, `terminal.trace_message` for the trace's message, `terminal.absent` for none. */
export function classifyTerminalFailureReason(reason: string | undefined): string {
  if (reason === undefined || reason.trim() === "") return "terminal.absent";
  return TERMINAL_REASONS.get(reason.trim()) ?? "terminal.trace_message";
}

export type FailedRunPresentation = Readonly<{
  actionLogShown: true;
  statusBadge: "failed";
  statusMetric: "failed";
  attemptRows: number;
  failedAttemptRows: number;
  terminalReasonShown: boolean;
  terminalReasonCode: string;
}>;

const LOG_TIMEOUT_MS = 30_000;

/**
 * Requires the Action Log on screen to present `runId` as failed, with
 * `attemptCount` attempt rows of which exactly the attempts Core recorded as
 * failed -- `failedNodeIds`, in order -- are marked failed, and Core's terminal reason when Core recorded one.
 */
export async function readFailedRunPresentation(panelPage: Page, expected: { runId: string; attemptCount: number; failedNodeIds: readonly string[]; terminalFailureReason: string | undefined }): Promise<FailedRunPresentation> {
  const log = panelPage.locator(".automation-runtime-log-page").filter({ has: panelPage.locator(".automation-runtime-log-hero") });
  if (!await log.first().waitFor({ state: "visible", timeout: LOG_TIMEOUT_MS }).then(() => true, () => false)) {
    throw presentationFailure("presentation.action_log_missing", "Runtime Debug did not show the run's Action Log after the run", {});
  }
  const hero = log.locator(".automation-runtime-log-hero");
  if (!(await hero.innerText()).includes(expected.runId)) throw presentationFailure("presentation.run_mismatch", "The Action Log on screen is not the failed run's", {});
  // The badge carries Core's raw status as its title and shows its label; the Status metric shows the raw status.
  const failedBadge = hero.locator('.automation-runtime-log-title-row .status-badge-pill[title="failed"]').filter({ hasText: /^Failed$/u });
  const failedMetric = log.locator(".automation-runtime-metric").filter({ has: panelPage.getByText("Status", { exact: true }) }).locator("strong").filter({ hasText: /^failed$/u });
  const settled = await Promise.all([
    failedBadge.waitFor({ state: "visible", timeout: LOG_TIMEOUT_MS }),
    failedMetric.first().waitFor({ state: "visible", timeout: LOG_TIMEOUT_MS }),
  ]).then(() => true, () => false);
  if (!settled) throw presentationFailure("presentation.status_not_failed", "The Action Log did not present the run as Failed without a reload", {});
  const rows = log.locator(".automation-runtime-attempt-row");
  const rowsSettled = await waitUntil(panelPage, async () => await rows.count() === expected.attemptCount);
  const attemptRows = await rows.count();
  if (!rowsSettled) throw presentationFailure("presentation.attempt_rows", "The Action Log does not show one row per attempt Core recorded", { attemptRows, coreAttempts: expected.attemptCount });
  const failedRows = rows.filter({ has: panelPage.locator('.status-badge-pill[title="failed"]') });
  const failedAttemptRows = await failedRows.count();
  const failedRowNodeIds = await failedRows.locator("strong[title]").evaluateAll(elements => elements.map(element => element.getAttribute("title") ?? ""));
  if (expected.failedNodeIds.length === 0 || failedAttemptRows !== expected.failedNodeIds.length || failedRowNodeIds.some((nodeId, index) => nodeId !== expected.failedNodeIds[index])) {
    throw presentationFailure("presentation.failed_attempt", "The Action Log does not mark exactly the failed attempts as failed", { failedAttemptRows, coreFailedAttempts: expected.failedNodeIds.length });
  }
  const terminalReasonCode = classifyTerminalFailureReason(expected.terminalFailureReason);
  const messages = await log.locator(".automation-runtime-message").evaluateAll(elements => elements.map(element => (element.textContent ?? "").trim()));
  const terminalReasonShown = expected.terminalFailureReason !== undefined && messages.includes(expected.terminalFailureReason.trim());
  if (expected.terminalFailureReason !== undefined && !terminalReasonShown) {
    throw presentationFailure("presentation.terminal_reason_missing", "The Action Log does not show the run's terminal reason", { terminalReasonCode });
  }
  return { actionLogShown: true, statusBadge: "failed", statusMetric: "failed", attemptRows, failedAttemptRows, terminalReasonShown, terminalReasonCode };
}

async function waitUntil(page: Page, condition: () => Promise<boolean>): Promise<boolean> {
  const deadline = Date.now() + LOG_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await page.waitForTimeout(100);
  }
  return condition();
}

function presentationFailure(reasonCode: string, message: string, details: Readonly<Record<string, unknown>>): RunnerFailure {
  return new RunnerFailure("runtime.behavior", message, { details: { reasonCode, ...details } });
}
