// Runtime Debug presentation, read from the rendered panel and from Core's own
// run detail together. The run row and the Action Log must name the same run
// with the status, action count and attempt rows Core records, and a run
// started from the view must reach its terminal state there without a page
// reload. Promoted from the disposable observers behind
// w2-panel-run-presentation-live and w2-integrated-dev-ui-smoke. Every reading
// comes from a structural hook inside one page-side function -- the status
// badge's `title` (the raw status Core sent), each metric's own `span` and
// `strong`, each attempt row's node `title` -- rather than from composed text
// locators, which is what made the smoke's observer time out on a run that had
// passed. The result is a closed code plus closed statuses, counts and
// booleans; no page text leaves this module.

import { randomUUID } from "node:crypto";
import type { Page, Response } from "@playwright/test";
import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import {
  type ActionLogFacts,
  type ActionLogReading,
  actionLogFacts,
  actionLogMatches,
  type RefreshFacts,
  type RunRowFacts,
  type RunRowReading,
  runRowFacts,
  type RuntimeDebugCode,
  type RuntimeDebugCoreRun,
  runtimeDebugCoreRun,
  runtimeDebugVerdict,
} from "./runtime-debug-facts.js";

const RUN_ENDPOINT = "/api/programs/automation-studio/run-runtime-session";
const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);

export type RuntimeDebugAssertion = {
  code: RuntimeDebugCode;
  core: { status: RuntimeDebugCoreRun["status"]; actionCount: number; attemptCount: number };
  refresh?: RefreshFacts;
  inPlaceLog?: ActionLogFacts;
  runRow: RunRowFacts;
  reopenedLog: ActionLogFacts;
  durationMs: number;
};

export type RuntimeDebugRefreshWatch = {
  /** Stops observing and reports what was measured for `runId`. */
  finish(runId: string): Promise<RefreshFacts>;
};

/**
 * Starts measuring the Runtime Debug view before a run is dispatched: whether
 * the document is replaced (a marker is set on it now and must survive), when
 * the run's execute response arrives, and when the Action Log's header first
 * names the run. Call before the Run click; call `finish` once the run's ID is
 * known.
 */
export async function watchRuntimeDebugRefresh(page: Page, pollMs = 100): Promise<RuntimeDebugRefreshWatch> {
  const mainFrame = page.mainFrame();
  const marker = randomUUID();
  await page.evaluate(markDocument, marker);
  let navigations = 0;
  let responseAt: number | undefined;
  let active = true;
  const samples: Array<{ at: number; header: string; sameDocument: boolean }> = [];
  const probeFailures: unknown[] = [];
  const onNavigated = (frame: unknown) => { if (frame === mainFrame) navigations += 1; };
  const onResponse = (response: Response) => {
    if (response.request().method() === "POST" && response.url().includes(RUN_ENDPOINT)) responseAt ??= Date.now();
  };
  page.on("framenavigated", onNavigated);
  page.on("response", onResponse);
  const polling = (async () => {
    while (active && !page.isClosed()) {
      try { samples.push({ at: Date.now(), ...await page.evaluate(readRefreshSample, marker) }); }
      catch (error) { probeFailures.push(error); }
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
  })();
  return {
    async finish(runId: string): Promise<RefreshFacts> {
      active = false;
      await polling;
      page.off("framenavigated", onNavigated);
      page.off("response", onResponse);
      const firstNamed = samples.find(sample => sample.header.includes(runId))?.at;
      const finalSample = await page.evaluate(readRefreshSample, marker);
      return {
        documentReplaced: !finalSample.sameDocument || samples.some(sample => !sample.sameDocument),
        mainFrameNavigations: navigations,
        responseObserved: responseAt !== undefined,
        logNamedRunBeforeResponse: firstNamed !== undefined && responseAt !== undefined && firstNamed < responseAt,
        probeFailures: probeFailures.length,
      };
    },
  };
}

/**
 * Reads the run from Core until it is terminal, then checks the view three
 * ways: the Action Log already open for it (when a refresh watch is given) must
 * reach Core's terminal state in place; the run list, searched for the run's
 * ID, must show one row with Core's status and action count; and opening that
 * row must show an Action Log naming the run with Core's status, action count
 * and attempt rows in order.
 */
export async function assertRuntimeDebugRun(input: {
  page: Page;
  control: Pick<ExistingFluxIQControlClient, "getRunDetail">;
  projectId: string;
  runId: string;
  refresh?: RuntimeDebugRefreshWatch;
  timeoutMs?: number;
}): Promise<RuntimeDebugAssertion> {
  const began = Date.now();
  const timeoutMs = input.timeoutMs ?? 30_000;
  const { page } = input;
  const core = await terminalCoreRun(input.control, input.projectId, input.runId, timeoutMs);
  const refresh = input.refresh ? await input.refresh.finish(input.runId) : undefined;
  const inPlaceLog = input.refresh ? await settledLogFacts(page, core, timeoutMs) : undefined;

  const log = page.locator(".automation-runtime-stage .automation-runtime-log-page");
  const back = log.locator(":scope > header .automation-runtime-back");
  if (await back.isVisible()) await back.click();
  const search = page.locator('.automation-runtime-stage input[aria-label="Find a run"]');
  await search.waitFor({ state: "visible", timeout: timeoutMs });
  await search.fill(input.runId);
  await page.locator(".automation-runtime-stage .automation-runtime-run-filters button[type=submit]").click();
  const rowReading = await settledRunRow(page, input.runId, core, timeoutMs);
  const runRow = runRowFacts(rowReading);
  let reopenedLog = actionLogFacts(emptyLogReading(), core);
  if (runRow.present) {
    await page.locator(".automation-runtime-stage article.automation-runtime-run-row").nth(rowReading.index).click();
    reopenedLog = await settledLogFacts(page, core, timeoutMs);
  }
  const code = runtimeDebugVerdict({ core, ...(refresh ? { refresh } : {}), ...(inPlaceLog ? { inPlaceLog } : {}), runRow, reopenedLog });
  return {
    code,
    core: { status: core.status, actionCount: core.actionCount, attemptCount: core.attempts.length },
    ...(refresh ? { refresh } : {}),
    ...(inPlaceLog ? { inPlaceLog } : {}),
    runRow,
    reopenedLog,
    durationMs: Date.now() - began,
  };
}

async function terminalCoreRun(control: Pick<ExistingFluxIQControlClient, "getRunDetail">, projectId: string, runId: string, timeoutMs: number): Promise<RuntimeDebugCoreRun> {
  const deadline = Date.now() + timeoutMs;
  let core = runtimeDebugCoreRun(await control.getRunDetail(projectId, runId));
  while (!TERMINAL.has(core.status) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
    core = runtimeDebugCoreRun(await control.getRunDetail(projectId, runId));
  }
  return core;
}

/** The Action Log's facts once they match Core, or the last reading when the timeout passes first. */
async function settledLogFacts(page: Page, core: RuntimeDebugCoreRun, timeoutMs: number): Promise<ActionLogFacts> {
  const deadline = Date.now() + timeoutMs;
  let facts = actionLogFacts(await page.evaluate(readActionLog), core);
  while (!actionLogMatches(facts, core) && Date.now() < deadline) {
    await page.waitForTimeout(200);
    facts = actionLogFacts(await page.evaluate(readActionLog), core);
  }
  return facts;
}

/** The run row once it shows Core's status and count, or the last reading when the timeout passes first. */
async function settledRunRow(page: Page, runId: string, core: RuntimeDebugCoreRun, timeoutMs: number): Promise<RunRowReading> {
  const deadline = Date.now() + timeoutMs;
  let reading = await page.evaluate(readRunRow, runId);
  const settled = (value: RunRowReading) => {
    const facts = runRowFacts(value);
    return facts.present && facts.status === core.status && facts.actionCount === core.actionCount;
  };
  while (!settled(reading) && Date.now() < deadline) {
    await page.waitForTimeout(200);
    reading = await page.evaluate(readRunRow, runId);
  }
  return reading;
}

function emptyLogReading(): ActionLogReading {
  return { present: false, heroLine: "", badge: "", metrics: [], rows: [] };
}

// The functions below run inside the page and must stay self-contained:
// Playwright sends their source, not their closure.

function markDocument(marker: string): void {
  (window as unknown as Record<string, unknown>).__fluxiqUiE2eDocument = marker;
}

function readRefreshSample(marker: string): { header: string; sameDocument: boolean } {
  return {
    header: document.querySelector(".automation-runtime-stage .automation-runtime-log-page > header")?.textContent ?? "",
    sameDocument: (window as unknown as Record<string, unknown>).__fluxiqUiE2eDocument === marker,
  };
}

function readActionLog(): ActionLogReading {
  const log = document.querySelector(".automation-runtime-stage .automation-runtime-log-page");
  const hero = log?.querySelector(":scope > header.automation-runtime-log-hero");
  if (!log || !hero) return { present: false, heroLine: "", badge: "", metrics: [], rows: [] };
  return {
    present: true,
    heroLine: hero.querySelector(":scope > div:not([class]) > span")?.textContent ?? "",
    badge: hero.querySelector(".automation-runtime-log-title-row .status-badge-pill")?.getAttribute("title") ?? "",
    metrics: Array.from(log.querySelectorAll(".automation-runtime-metric")).map(metric => [
      metric.querySelector(":scope > span")?.textContent?.trim() ?? "",
      metric.querySelector(":scope > strong")?.textContent?.trim() ?? "",
    ] as const),
    rows: Array.from(log.querySelectorAll(".automation-runtime-action-log .automation-runtime-attempt-row")).map(row => ({
      nodeId: row.querySelector(":scope > strong")?.getAttribute("title") ?? "",
      status: row.querySelector(":scope > .status-badge-pill")?.getAttribute("title") ?? "",
    })),
  };
}

function readRunRow(runId: string): RunRowReading {
  const rows = Array.from(document.querySelectorAll(".automation-runtime-stage article.automation-runtime-run-row"));
  const index = rows.findIndex(row => row.querySelector(":scope > strong")?.getAttribute("title") === runId);
  const row = rows[index];
  if (!row) return { index: -1, badge: "", activity: "" };
  return {
    index,
    badge: row.querySelector(":scope > .status-badge-pill")?.getAttribute("title") ?? "",
    activity: row.querySelector(":scope > span:last-child")?.textContent ?? "",
  };
}
