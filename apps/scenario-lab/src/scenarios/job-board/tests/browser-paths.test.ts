import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type BrowserContext, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { APPLICATION_FRAME_TITLE } from "../ats/index.js";
import { postingById } from "../catalog/index.js";
import { APPLICATION_RECORD, EXPECTED_REFERENCE } from "../candidate.js";
import { halvardWeek, remoteRustRecords, shortlistFacts } from "../expectations.js";
import { jobBoardScenario as scenario } from "../scenario.js";
import type { JobBoardMode, JobBoardState } from "../types.js";

/*
 * The site driven in a real browser. The honest paths are the manifest's own
 * recording scripts, run the way the recording lane runs them (test ids, roles
 * with exact names, frames by title, CSS), and each must meet every oracle the
 * manifest declares. The naive paths are what a careless automation does --
 * fill every field, click whatever is under an overlay, take every card, trust
 * Next, keep pressing a heart -- and each must fail the same oracle.
 */

const RUN_TOKEN = "job-board-browser-token-7f3a9c";
type Role = Parameters<Page["getByRole"]>[0];
type Records = Array<Record<string, string | null>>;
let browser: Browser;

// Same-site tabs share one renderer process. The honest paths open a page in a new tab, and Chromium's default, a
// new renderer process for each such tab, was measured at 24 to 30 s a tab on a CPU-saturated machine against under
// 1.2 s with the flag. These specs judge the site, not the browser's process model.
before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--process-per-site"] }); });
after(async () => { await browser?.close(); });

type Session = { lab: RunningScenarioLab; context: BrowserContext; page: Page; errors: string[]; close(): Promise<void> };

async function session(mode: JobBoardMode = "baseline"): Promise<Session> {
  const lab = await startScenarioLab({ runToken: RUN_TOKEN, seed: 42 });
  if (mode !== "baseline") await post(lab, "set-mode", { mode });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-GB", timezoneId: "Europe/London" });
  const errors: string[] = [];
  const watch = (page: Page) => {
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  };
  context.on("page", watch);
  const page = await context.newPage();
  await page.goto(`${lab.origin}${scenario.startPath}`);
  return { lab, context, page, errors, close: async () => { await context.close(); await lab.close(); } };
}

async function post(lab: RunningScenarioLab, operation: string, payload: unknown): Promise<void> {
  const response = await fetch(`${lab.origin}/api/job-board/${operation}`, { method: "POST", headers: { authorization: `Bearer ${RUN_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal(response.status, 200);
}

async function finalState(lab: RunningScenarioLab): Promise<JobBoardState> {
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=job-board`, { headers: { authorization: `Bearer ${RUN_TOKEN}` } });
  return ((await response.json()) as { state: JobBoardState }).state;
}

/** A manifest step runner with the recording lane's target grammar. */
class Driver {
  active: Page;
  readonly extracted = new Map<string, Records>();
  constructor(private readonly context: BrowserContext, page: Page) { this.active = page; }

  locate(target: string): Locator {
    if (!target.startsWith("frame:")) return scoped(this.active, target);
    const body = target.slice("frame:".length);
    const slash = body.indexOf("/");
    return scoped(this.active.frameLocator(`iframe[title="${body.slice(0, slash)}"]`), body.slice(slash + 1));
  }

  async run(script: readonly ScenarioStep[]): Promise<void> {
    for (const step of script) {
      try { await this.perform(step); } catch (error) { throw new Error(`step ${step.id} failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`); }
    }
  }

  private async perform(step: ScenarioStep): Promise<void> {
    const target = () => this.locate(step.target ?? "");
    switch (step.operation) {
      case "click": return target().click({ timeout: 8000 });
      case "type": return target().fill(String(step.value), { timeout: 8000 });
      case "select": { await target().selectOption(String(step.value), { timeout: 8000 }); return; }
      case "check": return target().setChecked(step.value === true, { timeout: 8000 });
      case "waitForState": return target().first().waitFor({ state: "visible", timeout: step.timeoutMs ?? 5000 });
      case "checkpoint": return;
      case "switchTab": {
        const deadline = Date.now() + (step.timeoutMs ?? 5000);
        for (;;) {
          const page = this.context.pages().find((candidate) => new URL(candidate.url()).pathname === step.path);
          if (page) { await page.waitForLoadState("domcontentloaded"); this.active = page; return; }
          if (Date.now() > deadline) throw new Error(`no tab at ${step.path}`);
          await delay(100);
        }
      }
      case "extract": {
        const items = target();
        const records: Records = [];
        for (let index = 0; index < await items.count(); index += 1) {
          const record: Record<string, string | null> = {};
          for (const [name, spec] of Object.entries(step.fields ?? {})) {
            const at = spec.lastIndexOf("@");
            const selector = at < 0 ? spec : spec.slice(0, at);
            const element = selector ? items.nth(index).locator(selector).first() : items.nth(index);
            record[name] = at < 0 ? ((await element.textContent()) ?? "").replace(/\s+/gu, " ").trim() : await element.getAttribute(spec.slice(at + 1));
          }
          records.push(record);
        }
        this.extracted.set(step.id, records);
        return;
      }
      default: throw new Error(`the job-board driver does not run ${step.operation}`);
    }
  }
}

function scoped(scope: Page | FrameLocator, target: string): Locator {
  if (target.startsWith("testid:")) return scope.getByTestId(target.slice("testid:".length));
  if (target.startsWith("role:")) {
    const body = target.slice("role:".length);
    const colon = body.indexOf(":");
    return colon < 0 ? scope.getByRole(body as Role) : scope.getByRole(body.slice(0, colon) as Role, { name: body.slice(colon + 1), exact: true });
  }
  return scope.locator(target);
}

const script = (workflowId?: string) => resolveScenarioWorkflow(scenario.manifest, workflowId === undefined ? {} : { workflowId }).recordingScript;
const readOut = async (page: Page, id: string) => ((await page.getByTestId(id).textContent()) ?? "").trim();

describe("the job board in a browser", { concurrency: true, timeout: 120_000 }, () => {
  test("honest: the recorded shortlist saves the week's Halvard Systems jobs and meets the playback goal", async () => {
    const run = await session();
    try {
      const driver = new Driver(run.context, run.page);
      await driver.run(script());
      for (const fact of shortlistFacts("baseline")) assert.equal(await readOut(driver.active, fact.subject), fact.value, fact.id);
      const state = await finalState(run.lab);
      for (const posting of halvardWeek()) assert.ok(state.saved.includes(posting.key), posting.id);
      assert.deepEqual(state.follows, []);
      assert.deepEqual(run.errors, []);
    } finally { await run.close(); }
  });

  test("honest: the recorded search collects exactly the seven remote Rust roles", async () => {
    const run = await session();
    try {
      const driver = new Driver(run.context, run.page);
      await driver.run(script("remote-rust-roles"));
      assert.deepEqual(driver.extracted.get("extract-remote-rust-roles"), remoteRustRecords("baseline"));
      assert.deepEqual(run.errors, []);
    } finally { await run.close(); }
  });

  test("honest: the recorded application reaches Talentloom in a new tab and its confirmation carries the expected reference", async () => {
    const run = await session();
    try {
      const driver = new Driver(run.context, run.page);
      await driver.run(script("apply-remote-rust-role"));
      assert.deepEqual(driver.extracted.get("extract-application"), [APPLICATION_RECORD]);
      const [application] = (await finalState(run.lab)).applications;
      assert.equal(application?.reference, EXPECTED_REFERENCE);
      assert.equal(application?.flagged, false);
      assert.deepEqual(run.errors, []);
    } finally { await run.close(); }
  });

  test("honest: in a quiet market the same search finds nothing, beside a page of recommendations", async () => {
    const run = await session("quiet-market");
    try {
      const driver = new Driver(run.context, run.page);
      const steps = script("remote-rust-roles");
      const at = steps.findIndex((step) => step.id === "all-listed");
      await driver.run(steps.slice(0, at));
      await driver.active.waitForURL(/limit=50/u);
      await driver.run(steps.slice(at + 1));
      assert.deepEqual(driver.extracted.get("extract-remote-rust-roles"), []);
      assert.ok(await driver.active.getByText("Jobs you might like").isVisible());
      assert.ok(await driver.active.locator("article[data-jk]").count() >= 3);
    } finally { await run.close(); }
  });

  test("honest: on the redesign, saving from each job's More actions menu meets the goal; the recorded hearts do not", async () => {
    const recorded = await session("overflow-save");
    try {
      await assert.rejects(new Driver(recorded.context, recorded.page).run(script()), /save-first/u);
      assert.deepEqual((await finalState(recorded.lab)).follows, ["Halvard Systems"]);
    } finally { await recorded.close(); }
    const run = await session("overflow-save");
    try {
      const page = run.page;
      await page.getByRole("button", { name: "Accept all", exact: true }).click();
      await page.locator(`input[name="q"]`).fill("Halvard Systems");
      await page.getByRole("button", { name: "Find jobs", exact: true }).click();
      await page.getByText("No thanks").click({ timeout: 8000 });
      await page.locator("rf-assistant .fa-min").click({ timeout: 9000 });
      const pane = page.locator("aside");
      for (const posting of halvardWeek().filter(({ id }) => id !== "hv2")) {
        await page.locator(`article[data-jk="${posting.key}"] h2 a`).click();
        const retry = pane.getByText("Retry");
        const more = pane.getByText("···");
        // Whichever the pane shows first. A race of two waits leaves the loser running, and its timeout, six seconds on, fails the test from outside it.
        await retry.or(more).first().waitFor({ timeout: 6000 });
        if (await retry.isVisible()) await retry.click();
        await more.click({ timeout: 6000 });
        await pane.getByText("Save job", { exact: true }).click();
        await page.getByText("Couldn't save this job. Try again.").or(page.getByText("Job saved")).first().waitFor();
        if (await page.getByText("Couldn't save this job. Try again.").isVisible()) {
          await more.click();
          await pane.getByText("Save job", { exact: true }).click();
          await page.getByText("Job saved").waitFor();
        }
      }
      await page.locator(`header a[href="/scenarios/job-board/myjobs"]`).click();
      for (const fact of shortlistFacts("overflow-save")) assert.equal(await readOut(page, fact.subject), fact.value, fact.id);
    } finally { await run.close(); }
  });

  test("honest: when the posting is filled the recorded application stops at the missing apply link and nothing is sent", async () => {
    const run = await session("posting-closed");
    try {
      const driver = new Driver(run.context, run.page);
      await assert.rejects(driver.run(script("apply-remote-rust-role")), /step posting-shown failed/u);
      assert.equal(await readOut(driver.active, "posting-status"), "No longer accepting applications");
      assert.equal(await driver.active.getByTestId("application-reference").count(), 0);
      assert.deepEqual((await finalState(run.lab)).applications, []);
    } finally { await run.close(); }
  });

  test("naive: an application whose honeypot is filled is thanked, flagged, and given no reference", async () => {
    const run = await session();
    try {
      const steps = script("apply-remote-rust-role");
      const at = steps.findIndex((step) => step.id === "email") + 1;
      const bot: ScenarioStep = { id: "fill-every-field", operation: "type", target: `frame:${APPLICATION_FRAME_TITLE}/input[name="confirm_email"]`, value: "morgan.ellery@example.net" };
      const driver = new Driver(run.context, run.page);
      await assert.rejects(driver.run([...steps.slice(0, at), bot, ...steps.slice(at)]), /step confirmation-shown failed/u);
      assert.ok(await driver.locate(`frame:${APPLICATION_FRAME_TITLE}/text=Thank you for applying, Morgan!`).isVisible());
      const [application] = (await finalState(run.lab)).applications;
      assert.equal(application?.flagged, true);
      assert.equal(application?.reference, null);
    } finally { await run.close(); }
  });

  test("naive: clicks under the consent wall and the job-alert offer do nothing, whether a pointer or a script sends them", async () => {
    const run = await session();
    try {
      const page = run.page;
      await page.locator(`input[name="q"]`).fill("Halvard Systems");
      await page.getByRole("button", { name: "Find jobs", exact: true }).dispatchEvent("click");
      await delay(500);
      assert.equal(new URL(page.url()).pathname, scenario.startPath, "a scripted click under the consent wall searched");
      await page.getByRole("button", { name: "Accept all", exact: true }).click();
      await page.getByRole("button", { name: "Find jobs", exact: true }).click();
      await page.getByText("No thanks").waitFor({ timeout: 8000 });
      const heart = page.locator(`article[data-jk="${postingById("hv1").key}"] h2 + span`);
      await heart.dispatchEvent("click");
      await heart.dispatchEvent("click");
      await assert.rejects(heart.click({ timeout: 1500 }));
      await delay(800);
      assert.deepEqual((await finalState(run.lab)).saved, [postingById("hv2").key, postingById("px").key]);
    } finally { await run.close(); }
  });

  test("naive: taking every card as it comes, sponsored and repeated, and trusting Next, does not give the oracle", async () => {
    const run = await session();
    try {
      const page = run.page;
      await page.getByRole("button", { name: "Accept all", exact: true }).click();
      await page.goto(`${run.lab.origin}/scenarios/job-board/jobs?q=rust&wp=remote&sort=date`);
      const naive: string[] = [];
      for (let visit = 0; visit < 3; visit += 1) {
        for (const title of await page.locator("article h2 a").allTextContents()) if (/\bRust\b/u.test(title)) naive.push(title);
        const next = page.getByRole("link", { name: "Next", exact: true });
        if (!await next.count()) break;
        await next.click();
        await page.waitForLoadState("domcontentloaded");
      }
      assert.equal(new URL(page.url()).searchParams.get("page"), "2", "Next reached page three");
      assert.notDeepEqual(naive, remoteRustRecords("baseline").map(({ title }) => title));
      assert.ok(naive.length > new Set(naive).size, "nothing repeated");
    } finally { await run.close(); }
  });
});
