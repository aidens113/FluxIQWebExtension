import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { closeLabSession } from "../../tests/close-lab-session.js";
import { ACCOUNT_CHANGES_SUBJECT } from "../oracle/index.js";
import { claimFoundKeyWorkflow, deleteStrangerRequestsWorkflow, hideSuggestedPostsWorkflow, recentGroupPostsWorkflow } from "../qualification/index.js";
import { socialNetworkFeedScenario as scenario } from "../scenario.js";

/**
 * The four breadth workflows against a real browser: each recording reaches
 * its table and its final account, and a plausible careless path -- an
 * unfiltered read, a long post left cut short, an extra hide, an extra delete,
 * the wrong group, a single press of Post -- misses one of the two.
 *
 * The driver restates, in miniature, how the Lab drives a recording script
 * (`packages/test-runner/src/scenario-steps/`), as `variant-and-naive-paths`
 * does: `role:` and `testid:` targets, `scroll` as a wheel turn and a
 * half-second settle, and an extract field whose element is absent left out.
 */
const manifest = scenario.manifest;
let browser: Browser;

type Row = Record<string, string>;
type Session = { page: Page; errors: string[]; close(): Promise<void> };

async function session(): Promise<Session> {
  const lab: RunningScenarioLab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: manifest.seed });
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-GB", timezoneId: "UTC" });
    await context.route("**/favicon.ico", (route) => route.fulfill({ status: 204, body: "" }));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${lab.origin}${manifest.startPath}`);
    const opened = context;
    return { page, errors, close: () => closeLabSession(lab, opened) };
  } catch (error) {
    await closeLabSession(lab, context).catch(() => undefined);
    throw error;
  }
}

function locate(page: Page, target: string): Locator {
  if (target.startsWith("testid:")) return page.locator(`[data-testid=${JSON.stringify(target.slice(7))}]`);
  if (target.startsWith("role:")) {
    const body = target.slice(5);
    const split = body.indexOf(":");
    const role = (split < 0 ? body : body.slice(0, split)) as Parameters<Page["getByRole"]>[0];
    return split < 0 ? page.getByRole(role) : page.getByRole(role, { name: body.slice(split + 1), exact: true });
  }
  return page.locator(target);
}

async function extract(page: Page, step: ScenarioStep): Promise<Row[]> {
  const rows: Row[] = [];
  for (const item of await locate(page, step.target!).all()) {
    const row: Row = {};
    for (const [name, spec] of Object.entries(step.fields ?? {})) {
      const at = spec.lastIndexOf("@");
      const attribute = at >= 0 && /^[A-Za-z_][-A-Za-z0-9_:.]*$/u.test(spec.slice(at + 1)) ? spec.slice(at + 1) : undefined;
      const element = item.locator(attribute === undefined ? spec : spec.slice(0, at)).first();
      if (await element.count() === 0) continue;
      row[name] = attribute === undefined ? ((await element.textContent()) ?? "").replace(/\s+/gu, " ").trim() : (await element.getAttribute(attribute)) ?? "";
    }
    rows.push(row);
  }
  return rows;
}

/** One step as the Lab performs it; an extract step's rows come back, every other step's nothing. */
async function perform(page: Page, step: ScenarioStep): Promise<Row[] | undefined> {
  const timeout = step.timeoutMs ?? 5000;
  if (step.operation === "click") return void await locate(page, step.target!).click({ timeout });
  if (step.operation === "type") return void await locate(page, step.target!).fill(String(step.value ?? ""), { timeout });
  if (step.operation === "waitForState") return void await locate(page, step.target!).waitFor({ state: "visible", timeout });
  if (step.operation === "checkpoint") return undefined;
  if (step.operation === "extract") return extract(page, step);
  if (step.operation !== "scroll") throw new Error(`this driver does not run ${step.operation}`);
  await page.mouse.wheel(0, Number(step.value ?? 500));
  await page.waitForTimeout(500);
  return undefined;
}

async function run(page: Page, script: readonly ScenarioStep[]): Promise<Map<string, Row[]>> {
  const read = new Map<string, Row[]>();
  for (const step of script) {
    try {
      const rows = await perform(page, step);
      if (rows) read.set(step.id, rows);
    } catch (error) {
      throw new Error(`step ${step.id} (${step.operation}) failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  return read;
}

/** The account's lasting acts as the page shows them, once the last change the page sent has come back, or after two seconds. */
async function settledAccount(page: Page, expected: unknown): Promise<string> {
  const element = page.getByTestId(ACCOUNT_CHANGES_SUBJECT);
  let text = (await element.textContent()) ?? "";
  for (let waited = 0; text !== expected && waited < 2000; waited += 100) {
    await page.waitForTimeout(100);
    text = (await element.textContent()) ?? "";
  }
  return text;
}

const datasetOf = (workflow: ScenarioWorkflow) => workflow.expected.extracted![0]!;
const finalAccount = (workflow: ScenarioWorkflow) => workflow.expected.finalState!.find(({ subject }) => subject === ACCOUNT_CHANGES_SUBJECT)!.value;
const asRows = (workflow: ScenarioWorkflow) => (datasetOf(workflow).records ?? []) as Row[];
const without = (script: readonly ScenarioStep[], ids: readonly string[]) => script.filter(({ id }) => !ids.includes(id));
const unit = (position: number) => `[role="feed"] > [aria-posinset="${position}"]`;

/** Runs `script` in a fresh lab and hands back its reads, the account it left, and any page error. */
async function walk(script: readonly ScenarioStep[], expectedAccount: unknown, more?: (page: Page) => Promise<void>) {
  const s = await session();
  try {
    const read = await run(s.page, script);
    if (more) await more(s.page);
    return { read, account: await settledAccount(s.page, expectedAccount), errors: s.errors };
  } finally { await s.close(); }
}

before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser?.close(); });

describe("breadth tasks: each recording reaches its oracle", { concurrency: true, timeout: 300_000 }, () => {
  for (const workflow of [recentGroupPostsWorkflow, hideSuggestedPostsWorkflow, deleteStrangerRequestsWorkflow, claimFoundKeyWorkflow]) {
    it(`${workflow.id}: the recording reads the expected table and leaves the expected account`, async () => {
      const { read, account, errors } = await walk(workflow.recordingScript, finalAccount(workflow));
      assert.deepEqual(read.get(datasetOf(workflow).step), asRows(workflow));
      assert.equal(account, finalAccount(workflow));
      assert.deepEqual(errors, []);
    });
  }
});

describe("breadth tasks: a careless path misses the oracle", { concurrency: true, timeout: 300_000 }, () => {
  it("recent group posts: every group post in the feed, unfiltered by date, is a different table", async () => {
    const step = recentGroupPostsWorkflow.recordingScript.find(({ id }) => id === "extract-recent-group-posts")!;
    const unfiltered = { ...step, target: [3, 12, 18, 23, 29].map(unit).join(", ") };
    const script = recentGroupPostsWorkflow.recordingScript.map((entry) => (entry.id === step.id ? unfiltered : entry));
    const { read } = await walk(script, finalAccount(recentGroupPostsWorkflow));
    const rows = read.get(step.id) ?? [];
    assert.equal(rows.length, 5);
    assert.deepEqual(rows.slice(-2).map(({ author }) => author), ["Tom Becker", "Dev Patel"]);
    assert.notDeepEqual(rows, asRows(recentGroupPostsWorkflow));
  });

  it("recent group posts: a read that never opens See more has the long posts cut short", async () => {
    const script = without(recentGroupPostsWorkflow.recordingScript, ["recent-see-more-3", "recent-see-more-18"]);
    const { read } = await walk(script, finalAccount(recentGroupPostsWorkflow));
    const rows = read.get("extract-recent-group-posts") ?? [];
    assert.equal(rows.length, 3);
    assert.ok(rows[0]?.text?.endsWith("See more"));
    assert.notDeepEqual(rows, asRows(recentGroupPostsWorkflow));
  });

  it("hide suggested posts: hiding a friend's share as well leaves a different account", async () => {
    const expected = finalAccount(hideSuggestedPostsWorkflow);
    const { read, account } = await walk(hideSuggestedPostsWorkflow.recordingScript, expected, async (page) => {
      await page.locator(`${unit(8)} [aria-label="Hide post"]`).click();
      await page.locator(`${unit(8)}:not(:has([aria-label="Hide post"]))`).waitFor({ state: "visible", timeout: 3000 });
    });
    assert.deepEqual(read.get("extract-hidden-suggestions"), asRows(hideSuggestedPostsWorkflow), "the table alone cannot tell");
    assert.notEqual(account, expected);
    assert.match(account, /"hidden":\["g_3a5e17","g_d40f52","h_b71d09"\]/u);
  });

  it("delete stranger requests: deleting the second Tom Becker too reads him back and leaves a different account", async () => {
    const script = deleteStrangerRequestsWorkflow.recordingScript;
    const at = script.findIndex(({ id }) => id === "extract-removed-requests");
    const card = "[role=\"listitem\"]:has(a[href$=\"/people/tom.becker.9/\"])";
    const extra: ScenarioStep[] = [
      { id: "also-delete-tom", operation: "click", target: `${card} [aria-label="Delete"]` },
      { id: "tom-removed", operation: "waitForState", target: `${card}:not(:has([role="button"]))`, timeoutMs: 3000 },
    ];
    const { read, account } = await walk([...script.slice(0, at), ...extra, ...script.slice(at)], finalAccount(deleteStrangerRequestsWorkflow));
    assert.deepEqual(read.get("extract-removed-requests")?.map(({ name }) => name), ["Tom Becker", "Diego Alvarez"]);
    assert.notEqual(account, finalAccount(deleteStrangerRequestsWorkflow));
  });

  it("claim found key: the same post in the Riverside Allotment Society names the wrong group", async () => {
    const script = claimFoundKeyWorkflow.recordingScript.map((step) => (step.id === "claim-open-group" ? { ...step, target: "nav[aria-label=\"Shortcuts\"] a[href$=\"/groups/riverside-allotments/\"]" } : step))
      .filter(({ id }) => id !== "extract-found-items-post");
    const { account } = await walk(script, finalAccount(claimFoundKeyWorkflow));
    assert.match(account, /"group":"riverside-allotments"/u);
    assert.notEqual(account, finalAccount(claimFoundKeyWorkflow));
  });

  it("claim found key: pressing Post once is swallowed and nothing waits for the admins", async () => {
    const script = without(claimFoundKeyWorkflow.recordingScript, ["claim-post-ready-again", "claim-press-post-again", "claim-post-pending"]);
    const { read, account } = await walk(script, finalAccount(claimFoundKeyWorkflow), (page) => page.waitForTimeout(1500));
    assert.deepEqual(read.get("extract-found-items-post"), asRows(claimFoundKeyWorkflow), "the table alone cannot tell");
    assert.match(account, /"pending":\[\]/u);
    assert.notEqual(account, finalAccount(claimFoundKeyWorkflow));
  });
});
