import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import type { ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { halvardCareersRolesWorkflow, halvardLabsOfficeJobsWorkflow, remoteEasyApplyWorkflow, saveQuillmarkRemoteWorkflow, UNCHANGED_ACCOUNT } from "../breadth/index.js";
import { postingById } from "../catalog/index.js";
import { openLabSession } from "./lab-session.js";
import { Driver } from "./scenario-driver.js";

/*
 * The breadth round's four tasks driven in a real browser. Each honest path is
 * the workflow's own recording and must meet its records and its account
 * read-out; each wrong path is what a plausible careless run does -- one page
 * of results, every quick-apply card, a lookalike employer, a recommendation
 * taken as a result, Rolefinch's own list for the careers site's -- and must
 * fail the same oracle.
 */

let browser: Browser;

// Same-site tabs share one renderer process (`browser-paths.test.ts` says why).
before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--process-per-site"] }); });
after(async () => { await browser?.close(); });

const ACCOUNT = "job-closed-account";
const account = async (page: Page) => ((await page.getByTestId(ACCOUNT).textContent()) ?? "").trim();
const recordsOf = (workflow: ScenarioWorkflow) => workflow.expected.extracted![0]!.records;
const stepOf = (workflow: ScenarioWorkflow) => workflow.expected.extracted![0]!.step;
const finalAccount = (workflow: ScenarioWorkflow) => String(workflow.expected.finalState![0]!.value);
const without = (workflow: ScenarioWorkflow, ...ids: string[]) => workflow.recordingScript.filter((step) => !ids.includes(step.id));

/** The steps of `workflow` with `extra` run right after the step `afterId`. */
function inserted(workflow: ScenarioWorkflow, afterId: string, extra: ScenarioStep[]): ScenarioStep[] {
  const at = workflow.recordingScript.findIndex((step) => step.id === afterId) + 1;
  assert.ok(at > 0, afterId);
  return [...workflow.recordingScript.slice(0, at), ...extra, ...workflow.recordingScript.slice(at)];
}

/** Every organic card on the page, read the way the recordings read them. */
async function cards(page: Page): Promise<Array<{ title: string; company: string; location: string; salary: string; link: string; easy: boolean }>> {
  return page.locator("article[data-jk]").evaluateAll((articles) => articles.map((article) => {
    const text = (selector: string) => (article.querySelector(selector)?.textContent ?? "").replace(/\s+/gu, " ").trim();
    return {
      title: text("h2 a"),
      company: text(":scope > div:nth-of-type(2) > span:nth-of-type(1)"),
      location: text(":scope > div:nth-of-type(2) > span:nth-of-type(2)"),
      salary: text(":scope > div:nth-of-type(3)"),
      link: article.querySelector("h2 a")?.getAttribute("href") ?? "",
      easy: (article.textContent ?? "").includes("Easily apply"),
    };
  }));
}

describe("the breadth tasks in a browser", { concurrency: true, timeout: 120_000 }, () => {
  test("honest: the recorded remote search reads exactly the seven quick-apply jobs and changes nothing", async () => {
    const run = await openLabSession(browser);
    try {
      const driver = new Driver(run.context, run.page);
      await driver.run(remoteEasyApplyWorkflow.recordingScript);
      assert.deepEqual(driver.extracted.get(stepOf(remoteEasyApplyWorkflow)), recordsOf(remoteEasyApplyWorkflow));
      assert.equal(await account(driver.active), finalAccount(remoteEasyApplyWorkflow));
      // Wrong path: every quick-apply card on the page, the one that shows no salary too.
      const everyEasy = (await cards(driver.active)).filter((card) => card.easy).map(({ title, company, salary }) => ({ title, company, salary }));
      assert.notDeepEqual(everyEasy, recordsOf(remoteEasyApplyWorkflow));
      assert.deepEqual(run.errors, []);
    } finally {
      await run.close();
    }
  });

  test("naive: reading the remote search's first page of ten misses most of the quick-apply jobs", async () => {
    const run = await openLabSession(browser);
    try {
      const driver = new Driver(run.context, run.page);
      await driver.run(without(remoteEasyApplyWorkflow, "easy-fifty-per-page", "easy-all-listed"));
      const read = driver.extracted.get(stepOf(remoteEasyApplyWorkflow)) ?? [];
      assert.ok(read.length > 0 && read.length < recordsOf(remoteEasyApplyWorkflow)!.length, `page one read ${read.length} records`);
    } finally {
      await run.close();
    }
  });

  test("honest: the recorded saves keep the saved list, add Quillmark's three remote jobs, and read it back", async () => {
    const run = await openLabSession(browser);
    try {
      const driver = new Driver(run.context, run.page);
      await driver.run(saveQuillmarkRemoteWorkflow.recordingScript);
      assert.deepEqual(driver.extracted.get(stepOf(saveQuillmarkRemoteWorkflow)), recordsOf(saveQuillmarkRemoteWorkflow));
      assert.equal(await account(driver.active), finalAccount(saveQuillmarkRemoteWorkflow));
      assert.deepEqual([...(await run.finalState()).saved].sort(), JSON.parse(finalAccount(saveQuillmarkRemoteWorkflow)).saved);
      assert.deepEqual(run.errors, []);
    } finally {
      await run.close();
    }
  });

  test("naive: also saving Quillmark Labs' Senior Rust Engineer fails the account oracle", async () => {
    const run = await openLabSession(browser);
    try {
      const labs = `article[data-jk="${postingById("d15").key}"] h2 + span`;
      const driver = new Driver(run.context, run.page);
      await driver.run(inserted(saveQuillmarkRemoteWorkflow, "quillmark-contract-saved", [
        { id: "naive-save-labs", operation: "click", target: labs },
        { id: "naive-labs-saved", operation: "waitForState", target: "text=Job saved", timeoutMs: 3000 },
      ]));
      assert.notEqual(await account(driver.active), finalAccount(saveQuillmarkRemoteWorkflow));
      assert.notDeepEqual(driver.extracted.get(stepOf(saveQuillmarkRemoteWorkflow)), recordsOf(saveQuillmarkRemoteWorkflow));
    } finally {
      await run.close();
    }
  });

  test("honest: Halvard Labs has no office or hybrid job, so the table is empty beside a page of recommendations", async () => {
    const run = await openLabSession(browser);
    try {
      const driver = new Driver(run.context, run.page);
      await driver.run(halvardLabsOfficeJobsWorkflow.recordingScript);
      assert.deepEqual(driver.extracted.get(stepOf(halvardLabsOfficeJobsWorkflow)), []);
      assert.match(driver.active.url(), /wp=onsite/u);
      assert.equal(await account(driver.active), UNCHANGED_ACCOUNT);
      assert.ok(await driver.active.getByText("Jobs you might like").isVisible());
      // Wrong path: the recommendations taken as results.
      const recommended = await cards(driver.active);
      assert.ok(recommended.some((card) => card.company === "Halvard Labs"), "the Halvard Labs job is not recommended");
      assert.notDeepEqual(recommended, []);
      assert.deepEqual(run.errors, []);
    } finally {
      await run.close();
    }
  });

  test("naive: saving the recommended Halvard Labs job fails the untouched-account oracle", async () => {
    const run = await openLabSession(browser);
    try {
      const heart = `article[data-jk="${postingById("hl1").key}"] h2 + span`;
      const driver = new Driver(run.context, run.page);
      await driver.run(halvardLabsOfficeJobsWorkflow.recordingScript);
      await driver.run([
        { id: "naive-chat-opened", operation: "waitForState", target: "rf-assistant .fa-min", timeoutMs: 9000 },
        { id: "naive-minimise-chat", operation: "click", target: "rf-assistant .fa-min" },
        { id: "naive-save-first-try", operation: "click", target: heart },
        { id: "naive-save-refused", operation: "waitForState", target: "text=Couldn't save this job. Try again.", timeoutMs: 3000 },
        { id: "naive-save", operation: "click", target: heart },
        { id: "naive-saved", operation: "waitForState", target: "text=Job saved", timeoutMs: 3000 },
      ]);
      assert.notEqual(await account(driver.active), finalAccount(halvardLabsOfficeJobsWorkflow));
      assert.ok((await run.finalState()).saved.includes(postingById("hl1").key));
    } finally {
      await run.close();
    }
  });

  test("honest: the recorded journey reaches Halvard Systems' careers list in a new tab, reads it, and applies for nothing", async () => {
    const run = await openLabSession(browser);
    try {
      const driver = new Driver(run.context, run.page);
      await driver.run(halvardCareersRolesWorkflow.recordingScript);
      assert.notEqual(driver.active, run.page, "the careers site did not open in its own tab");
      assert.deepEqual(driver.extracted.get(stepOf(halvardCareersRolesWorkflow)), recordsOf(halvardCareersRolesWorkflow));
      assert.equal(await account(run.page), finalAccount(halvardCareersRolesWorkflow));
      const state = await run.finalState();
      assert.deepEqual(state.applications, []);
      assert.equal(state.careersConsent, true);
      assert.deepEqual(run.errors, []);
    } finally {
      await run.close();
    }
  });

  test("naive: Rolefinch's own Halvard Systems search is not the careers site's list", async () => {
    const run = await openLabSession(browser);
    try {
      const page = run.page;
      await page.getByRole("button", { name: "Accept all", exact: true }).click();
      await page.locator("input[name=\"q\"]").fill("Halvard Systems");
      await page.getByRole("button", { name: "Find jobs", exact: true }).click();
      await page.locator(`article[data-jk="${postingById("hv1").key}"]`).waitFor({ timeout: 5000 });
      const board = (await cards(page)).map(({ title, location, link }) => ({ title, location, link }));
      assert.ok(board.length >= 6, `the search showed ${board.length} cards`);
      assert.notDeepEqual(board, recordsOf(halvardCareersRolesWorkflow));
      assert.ok(board.every((record) => record.link.startsWith("/scenarios/job-board/viewjob")), "a Rolefinch card links off the board");
    } finally {
      await run.close();
    }
  });
});
