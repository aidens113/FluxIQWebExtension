import { randomBytes } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";

/**
 * A lab server, and a browser tab on it, for the honest-path and naive-path
 * specs. The tab is 1280 by 720, as the lab's page specs use, and every request
 * that is not to the loopback lab is refused and recorded, so a spec also
 * proves the site reaches nothing outside the machine.
 */
export type Session = { lab: RunningScenarioLab; context: BrowserContext; page: Page; consoleErrors: string[]; offsite: string[] };

export const ROOT = "/scenarios/professional-network/";

export function launchBrowser(): Promise<Browser> {
  // Full Chromium in headless mode: the separate headless shell crashes on launch on some Windows hosts.
  return chromium.launch({ channel: "chromium", headless: true });
}

export async function openSession(browser: Browser, seed = 42): Promise<Session> {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-US", timezoneId: "UTC" });
  const offsite: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.protocol === "data:") return route.continue();
    offsite.push(url.href);
    return route.abort();
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  return { lab, context, page, consoleErrors, offsite };
}

export async function closeSession(session: Session): Promise<void> {
  await session.context.close();
  await session.lab.close();
}

/** Arms a variant the way the Lab does: one authorized POST of its `arm`. */
export async function arm(session: Session, mode: string): Promise<void> {
  const response = await fetch(`${session.lab.origin}/api/professional-network/set-mode`, {
    method: "POST",
    headers: { authorization: `Bearer ${session.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!response.ok) throw new Error(`arming ${mode} answered ${response.status}`);
}

/** What the runner's fact probe reads for a `text` fact: the first element with the test id, its text trimmed. */
export async function factText(page: Page, subject: string): Promise<string | null> {
  const locator = page.locator(`[data-testid=${JSON.stringify(subject)}]`).first();
  return (await locator.count()) ? ((await locator.textContent()) ?? "").trim() : null;
}

/** A pause the length a person takes to read a page, which is what keeps the search from asking for a check. */
export function readingPause(page: Page): Promise<void> {
  return page.waitForTimeout(2_300);
}

/** Visible text of an element, trimmed, or null when it is absent. */
export async function textOf(locator: Locator): Promise<string | null> {
  return (await locator.count()) ? ((await locator.first().textContent()) ?? "").trim() : null;
}
