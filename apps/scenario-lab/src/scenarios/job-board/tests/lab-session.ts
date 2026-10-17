import assert from "node:assert/strict";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { closeLabSession } from "../../tests/close-lab-session.js";
import { jobBoardScenario as scenario } from "../scenario.js";
import type { JobBoardMode, JobBoardState } from "../types.js";

const RUN_TOKEN = "job-board-browser-token-7f3a9c";

/** One lab, armed into `mode`, with a page open on the board's start page and every page error collected. */
export type LabSession = {
  lab: RunningScenarioLab;
  context: BrowserContext;
  page: Page;
  errors: string[];
  /** The board's state as the server holds it: what the run actually left behind. */
  finalState(): Promise<JobBoardState>;
  close(): Promise<void>;
};

/** Starts a lab for the job board's browser specs and opens its start page in a fresh context of `browser`. */
export async function openLabSession(browser: Browser, mode: JobBoardMode = "baseline"): Promise<LabSession> {
  const lab = await startScenarioLab({ runToken: RUN_TOKEN, seed: 42 });
  let context: BrowserContext | undefined;
  try {
    if (mode !== "baseline") await post(lab, "set-mode", { mode });
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-GB", timezoneId: "Europe/London" });
    const errors: string[] = [];
    const watch = (page: Page) => {
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
      });
    };
    context.on("page", watch);
    const page = await context.newPage();
    await page.goto(`${lab.origin}${scenario.startPath}`);
    const opened = context;
    return { lab, context: opened, page, errors, finalState: () => readFinalState(lab), close: () => closeLabSession(lab, opened) };
  } catch (error) {
    // The opening failure is the one to report; the lab is closed either way, or the file never exits.
    await closeLabSession(lab, context).catch(() => undefined);
    throw error;
  }
}

async function post(lab: RunningScenarioLab, operation: string, payload: unknown): Promise<void> {
  const response = await fetch(`${lab.origin}/api/job-board/${operation}`, { method: "POST", headers: { authorization: `Bearer ${RUN_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal(response.status, 200);
}

async function readFinalState(lab: RunningScenarioLab): Promise<JobBoardState> {
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=job-board`, { headers: { authorization: `Bearer ${RUN_TOKEN}` } });
  return ((await response.json()) as { state: JobBoardState }).state;
}
