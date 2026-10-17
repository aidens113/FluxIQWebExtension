import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { closeLabSession } from "../../tests/close-lab-session.js";
import { photoSocialScenario as scenario } from "../scenario.js";

export type PhotoSession = { lab: RunningScenarioLab; context: BrowserContext; page: Page; problems: string[]; close(): Promise<void> };

/**
 * A fresh lab serving Framelight at the manifest's seed, armed into `mode`
 * when one is given, and a page opened on the start page. Every console
 * error, page error and failed response lands in `problems`, except the
 * grid's own 401 behind the session check, which is the site working.
 */
export async function openPhotoSession(browser: Browser, mode?: string): Promise<PhotoSession> {
  const manifest = scenario.manifest;
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: manifest.seed });
  let context: BrowserContext | undefined;
  try {
    if (mode) {
      const response = await fetch(`${lab.origin}/api/photo-social/set-mode`, { method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify({ mode }) });
      assert.equal(response.status, 200);
    }
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-US", timezoneId: "UTC" });
    // The lab serves no favicon, and the browser's 404 for it is not the site's.
    await context.route("**/favicon.ico", (route) => route.fulfill({ status: 204, body: "" }));
    const page = await context.newPage();
    const problems: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") problems.push(message.text()); });
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("response", (response) => { if (response.status() >= 400 && !response.url().includes("/grid?")) problems.push(`${response.status()} ${response.url()}`); });
    await page.goto(lab.origin + manifest.startPath);
    const opened = context;
    return { lab, context: opened, page, problems, close: () => closeLabSession(lab, opened) };
  } catch (error) {
    // The opening failure is the one to report; the lab is closed either way, or the file never exits.
    await closeLabSession(lab, context).catch(() => undefined);
    throw error;
  }
}
