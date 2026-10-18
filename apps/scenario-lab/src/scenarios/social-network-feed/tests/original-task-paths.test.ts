import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { closeLabSession } from "../../tests/close-lab-session.js";
import { fullDateText } from "../content/index.js";
import { socialNetworkFeedScenario as scenario } from "../scenario.js";
import type { FeedMode } from "../types.js";

/**
 * The original live tasks walked to their oracle in this directory's own run,
 * beside the fixture-level e2e spec (`apps/scenario-lab/e2e/`) that walks them
 * under Playwright's runner: the group post as recorded, the group post on the
 * redesigned group page (the build that explores the redesign, and the Flow
 * that was made before it, both end at Create post), the feed digest as
 * recorded, and the friend requests confirmed past the rate limit. Each reaches
 * the facts or table its task row is judged by.
 *
 * It also holds the one thing a person needs to read a full date: pointing at
 * a timestamp shows the date and time the tables ask for, written as the
 * expectations write it.
 *
 * The driver restates, in miniature, how the Lab drives a recording script
 * (`packages/test-runner/src/scenario-steps/`), as the other browser tests
 * here do: `role:` and `testid:` targets, `scroll` as a wheel turn and a
 * half-second settle, and an extract field whose element is absent left out.
 */
const manifest = scenario.manifest;
let browser: Browser;

type Row = Record<string, string>;
type Session = { page: Page; errors: string[]; close(): Promise<void> };

async function session(mode?: FeedMode): Promise<Session> {
  const lab: RunningScenarioLab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: manifest.seed });
  let context: BrowserContext | undefined;
  try {
    if (mode) {
      const response = await fetch(`${lab.origin}/api/${manifest.id}/set-mode`, { method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify({ mode }) });
      assert.equal(response.status, 200);
    }
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

/** A text fact as the runner reads it: the subject's trimmed text, once the page's last change has come back, or after two seconds. */
async function factText(page: Page, fact: ExpectedFact): Promise<string> {
  const subject = page.locator(`[data-testid=${JSON.stringify(fact.subject)}]`).first();
  let text = ((await subject.textContent()) ?? "").trim();
  for (let waited = 0; text !== fact.value && waited < 2000; waited += 100) {
    await page.waitForTimeout(100);
    text = ((await subject.textContent()) ?? "").trim();
  }
  return text;
}

async function assertTextFacts(page: Page, facts: readonly ExpectedFact[]): Promise<void> {
  const text = facts.filter(({ predicate }) => predicate === "text");
  assert.ok(text.length > 0, "a goal that asserts nothing proves nothing");
  for (const fact of text) assert.equal(await factText(page, fact), fact.value, fact.id);
}

/** An expectation as the reference reader can meet it: an optional field expected `null` is a field the page does not draw. */
function asRead(records: ReadonlyArray<Record<string, unknown>> | undefined): Row[] {
  return (records ?? []).map((record) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null)) as Row);
}

const stepIndex = (script: readonly ScenarioStep[], id: string) => script.findIndex((step) => step.id === id);

before(async () => {
  browser = await chromium.launch({ channel: "chromium", headless: true });
});
after(async () => {
  await browser?.close();
});

describe("the original tasks, walked to their oracle", { concurrency: true, timeout: 300_000 }, () => {
  it("group post: the recording leaves the rhubarb notice, word for word, waiting for the admins", async () => {
    const s = await session();
    try {
      await run(s.page, manifest.recordingScript);
      await assertTextFacts(s.page, manifest.playbackGoal?.successFacts ?? []);
      assert.deepEqual(s.errors, []);
    } finally {
      await s.close();
    }
  });

  it("group post on the redesigned group page: the recorded prompt is gone, and Create post reaches the same goal", async () => {
    const workflow = resolveScenarioWorkflow(manifest, { variantId: "regrouped" });
    const script = workflow.recordingScript;
    const s = await session("regrouped");
    try {
      await assert.rejects(run(s.page, script.slice(0, stepIndex(script, "open-composer") + 1)), /group-open/u, "the Flow made before the redesign stops at the prompt it pressed");
      await s.page.getByRole("button", { name: "Create post", exact: true }).click();
      await run(s.page, script.slice(stepIndex(script, "composer-open")));
      await assertTextFacts(s.page, manifest.playbackGoal?.successFacts ?? []);
      assert.deepEqual(s.errors, []);
    } finally {
      await s.close();
    }
  });

  it("feed digest: the recording reads the sixteen posts, whole, once each, in feed order", async () => {
    const workflow = resolveScenarioWorkflow(manifest, { workflowId: "feed-digest" });
    const s = await session();
    try {
      const read = await run(s.page, workflow.recordingScript);
      assert.deepEqual(read.get("extract-feed-digest"), asRead(workflow.expected.extracted?.[0]?.records));
      assert.deepEqual(s.errors, []);
    } finally {
      await s.close();
    }
  });

  it("confirm requests: the recording waits out the rate limit, reads the four accepted, and the server holds exactly those four", async () => {
    const workflow = resolveScenarioWorkflow(manifest, { workflowId: "confirm-requests" });
    const s = await session();
    try {
      const read = await run(s.page, workflow.recordingScript);
      assert.deepEqual(read.get("extract-confirmed"), asRead(workflow.expected.extracted?.[0]?.records));
      await assertTextFacts(s.page, workflow.expected.finalState ?? []);
      assert.deepEqual(s.errors, []);
    } finally {
      await s.close();
    }
  });

  it("a person pointing at a timestamp sees the full date and time the tables ask for", async () => {
    const s = await session();
    try {
      await run(s.page, manifest.recordingScript.slice(0, 5));
      const stamp = s.page.locator("[role=\"feed\"] > [aria-posinset=\"3\"] a[href*=\"/posts/\"][aria-label]");
      await stamp.hover();
      await assert.doesNotReject(s.page.getByRole("tooltip").waitFor({ state: "visible", timeout: 3000 }));
      assert.equal(await s.page.getByRole("tooltip").textContent(), fullDateText(185));
      assert.equal(await s.page.getByRole("tooltip").textContent(), "Monday 21 September 2026 at 05:55");
      await s.page.mouse.move(0, 0);
      await s.page.getByRole("tooltip").waitFor({ state: "detached", timeout: 3000 });
      assert.deepEqual(s.errors, []);
    } finally {
      await s.close();
    }
  });
});
