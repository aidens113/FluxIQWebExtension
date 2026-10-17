import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { closeLabSession } from "../../tests/close-lab-session.js";
import { CLASSIFIEDS_ROOT } from "../root.js";
import { localClassifiedsScenario as scenario } from "../scenario.js";
import type { ClassifiedsMode, ClassifiedsState } from "../types.js";

/** One person's visit: a lab on the manifest's seed, a fresh browser context on the front page, and every page error it raised. */
export type Session = { lab: RunningScenarioLab; page: Page; errors: string[]; close(): Promise<void> };

/** Opens a session on the front page, with `mode` armed first when it is not the site as it ships. */
export async function openSession(browser: Browser, mode: ClassifiedsMode = "baseline"): Promise<Session> {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: scenario.manifest.seed });
  let context: BrowserContext | undefined;
  try {
    if (mode !== "baseline") await postToLab(lab, "set-mode", { mode });
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-GB", timezoneId: "Europe/London" });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${lab.origin}${CLASSIFIEDS_ROOT}`);
    const opened = context;
    return { lab, page, errors, close: () => closeLabSession(lab, opened) };
  } catch (error) {
    // The opening failure is the one to report; the lab is closed either way, or the file never exits.
    await closeLabSession(lab, context).catch(() => undefined);
    throw error;
  }
}

/** Reports a change to the scenario as its own page would. */
export async function postToLab(lab: RunningScenarioLab, operation: string, payload: unknown): Promise<void> {
  const response = await fetch(`${lab.origin}/api/local-classifieds/${operation}`, {
    method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
}

/** The session as the server holds it. */
export async function serverState(lab: RunningScenarioLab): Promise<ClassifiedsState> {
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=local-classifieds`, { headers: { authorization: `Bearer ${lab.runToken}` } });
  return (await response.json() as { state: ClassifiedsState }).state;
}

/** Each listing once, first sighting kept, by the address it links to: the dedupe step a correct Flow ends with. */
export function onceEach(records: ReadonlyArray<Record<string, string>>): Array<Record<string, string>> {
  const seen = new Set<string>();
  return records.filter((record) => !seen.has(record.url!) && Boolean(seen.add(record.url!)));
}
