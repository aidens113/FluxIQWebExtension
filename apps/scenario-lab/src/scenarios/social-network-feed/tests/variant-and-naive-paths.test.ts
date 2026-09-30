import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { communityBySlug, feedPlanFor, fullDateText, MAYA, personBySlug } from "../content/index.js";
import { cutText } from "../markup/index.js";
import { socialNetworkFeedScenario as scenario } from "../scenario.js";
import type { FeedMode } from "../types.js";

/**
 * Circleway against a real browser, for the live tasks the fixture-level e2e
 * spec (`apps/scenario-lab/e2e/social-network-feed.spec.ts`) does not walk to
 * their oracle: the quiet-feed digest, the app-install digest as a Flow built
 * on the baseline meets it, and the careless versions of the two state-changing
 * dataset tasks, each of which must read differently from the right answer.
 *
 * The driver restates, in miniature, how the Lab drives a recording script
 * (`packages/test-runner/src/scenario-steps/`): `role:` and `testid:` targets,
 * `scroll` as a wheel turn and a half-second settle, and an extract field whose
 * element is absent left out of its record.
 */
const manifest = scenario.manifest;
const ROOT = manifest.startPath;
let browser: Browser;

type Row = Record<string, string>;
type Session = { lab: RunningScenarioLab; page: Page; errors: string[]; close(): Promise<void> };

async function session(mode?: FeedMode): Promise<Session> {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: manifest.seed });
  if (mode) {
    const response = await fetch(`${lab.origin}/api/${manifest.id}/set-mode`, { method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify({ mode }) });
    assert.equal(response.status, 200);
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-GB", timezoneId: "UTC" });
  await context.route("**/favicon.ico", (route) => route.fulfill({ status: 204, body: "" }));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${lab.origin}${ROOT}`);
  return { lab, page, errors, close: async () => { await context.close(); await lab.close(); } };
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
  const records: Row[] = [];
  for (const item of await locate(page, step.target!).all()) {
    const record: Row = {};
    for (const [name, spec] of Object.entries(step.fields ?? {})) {
      const at = spec.lastIndexOf("@");
      const attribute = at >= 0 && /^[A-Za-z_][-A-Za-z0-9_:.]*$/u.test(spec.slice(at + 1)) ? spec.slice(at + 1) : undefined;
      const element = item.locator(attribute === undefined ? spec : spec.slice(0, at)).first();
      if (await element.count() === 0) continue;
      record[name] = attribute === undefined ? ((await element.textContent()) ?? "").replace(/\s+/gu, " ").trim() : (await element.getAttribute(attribute)) ?? "";
    }
    records.push(record);
  }
  return records;
}

async function run(page: Page, script: readonly ScenarioStep[]): Promise<Map<string, Row[]>> {
  const read = new Map<string, Row[]>();
  for (const step of script) {
    const timeout = step.timeoutMs ?? 5000;
    try {
      switch (step.operation) {
        case "click": await locate(page, step.target!).click({ timeout }); break;
        case "type": await locate(page, step.target!).fill(String(step.value ?? ""), { timeout }); break;
        case "waitForState": await locate(page, step.target!).waitFor({ state: "visible", timeout }); break;
        case "scroll": await page.mouse.wheel(0, Number(step.value ?? 500)); await page.waitForTimeout(500); break;
        case "checkpoint": break;
        case "extract": read.set(step.id, await extract(page, step)); break;
        default: throw new Error(`this driver does not run ${step.operation}`);
      }
    } catch (error) {
      throw new Error(`step ${step.id} (${step.operation}) failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  return read;
}

/** An expectation as the reference reader can meet it: an optional field expected `null` is a field the page does not draw. */
function asRead(records: ReadonlyArray<Record<string, unknown>> | undefined): Row[] {
  return (records ?? []).map((record) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null)) as Row);
}

const workflow = (workflowId: string, variantId?: string) => resolveScenarioWorkflow(manifest, { workflowId, ...(variantId ? { variantId } : {}) });
const without = (script: readonly ScenarioStep[], ids: readonly string[]) => script.filter(({ id }) => !ids.includes(id));
const OVERLAY_STEPS = 5;

/**
 * The digest a careful reader builds for a rendering, worked out here from the
 * authored feed rather than taken from the manifest: every unit before "You're
 * all caught up" that is a post and not Maya's, once, whole, in feed order.
 * Recaps are their own kind, so a post shown twice is counted at its first place.
 */
function recomputedDigest(mode: FeedMode) {
  const plan = feedPlanFor({ mode, created: [], trashed: [], hidden: [] });
  const entries = plan.batches.slice(0, plan.caughtUpAfter + 1).flat();
  const own = entries.flatMap(({ unit, position }) => (unit.kind === "post" && unit.author !== MAYA.slug ? [{ post: unit, position }] : []));
  const records = own.map(({ post }) => ({
    author: personBySlug(post.author).name,
    group: post.group === undefined ? null : communityBySlug(post.group).name,
    posted: fullDateText(post.minutesAgo),
    text: post.text,
    reactions: post.reactions ?? null,
    comments: post.comments ?? null,
  }));
  return { positions: own.map(({ position }) => position), long: own.filter(({ post }) => cutText(post.text) !== undefined).map(({ position }) => position), records };
}

before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser?.close(); });

describe("the digest's variants, walked to their oracle", { concurrency: true, timeout: 120_000 }, () => {
  it("quiet feed: a reader who stops at You're all caught up reads exactly the seven posts the manifest expects", async () => {
    const { recordingScript, expected } = workflow("feed-digest", "quiet-feed");
    const digest = recomputedDigest("quiet-feed");
    assert.deepEqual(digest.records, expected.extracted?.[0]?.records, "the manifest's quiet-feed answer is the one the authored feed gives");
    assert.equal(digest.records.length, 7);
    const extractStep = recordingScript.find(({ operation }) => operation === "extract")!;
    const script: ScenarioStep[] = [
      ...recordingScript.slice(0, OVERLAY_STEPS),
      ...Array.from({ length: 6 }, (_unused, index): ScenarioStep => ({ id: `scroll-${index}`, operation: "scroll", value: 6000 })),
      { id: "caught-up", operation: "waitForState", target: "role:heading:You're all caught up", timeoutMs: 10_000 },
      ...digest.long.map((position): ScenarioStep => ({ id: `see-more-${position}`, operation: "click", target: `[role="feed"] > [aria-posinset="${position}"] [data-ad-comet-preview="message"] [role="button"]` })),
      { ...extractStep, target: digest.positions.map((position) => `[role="feed"] > [aria-posinset="${position}"]`).join(", ") },
    ];
    const s = await session("quiet-feed");
    try {
      const read = await run(s.page, script);
      assert.deepEqual(read.get(extractStep.id), asRead(expected.extracted?.[0]?.records));
      // A run that returns the baseline's sixteen has read somebody else's week.
      assert.notDeepEqual(recomputedDigest("baseline").records, expected.extracted?.[0]?.records);
      assert.deepEqual(s.errors, []);
    } finally { await s.close(); }
  });

  it("app install: a Flow built on the baseline feed passes the interstitial by Continue in browser and reads the baseline digest", async () => {
    const { recordingScript, expected } = workflow("feed-digest", "app-install");
    assert.deepEqual(expected.extracted?.[0]?.records, recomputedDigest("baseline").records);
    const s = await session("app-install");
    try {
      await assert.rejects(run(s.page, recordingScript.slice(0, 1)), /allow-cookies/u, "the recording meets the interstitial, not the cookie dialog");
      await s.page.getByText("Continue in browser", { exact: true }).click();
      const read = await run(s.page, recordingScript);
      assert.deepEqual(read.get("extract-feed-digest"), asRead(expected.extracted?.[0]?.records));
      assert.deepEqual(s.errors, []);
    } finally { await s.close(); }
  });
});

describe("the state-changing dataset tasks: a careless run reads differently from the right one", { concurrency: true, timeout: 120_000 }, () => {
  const AUDIENCE_STEPS = ["open-audience", "audience-open", "choose-public", "audience-done"];
  const TRASH_STEPS = ["open-post-menu", "menu-open", "move-to-trash", "trash-asked", "confirm-move"];

  it("move open day: the permitted path reads the manifest's table, and the server holds one Public post", async () => {
    const { recordingScript, expected } = workflow("move-open-day");
    const s = await session();
    try {
      const read = await run(s.page, recordingScript);
      assert.deepEqual(read.get("extract-open-day"), asRead(expected.extracted?.[0]?.records));
    } finally { await s.close(); }
  });

  it("move open day: reposting at the composer's default audience reads Friends, not Public", async () => {
    const { recordingScript, expected } = workflow("move-open-day");
    const s = await session();
    try {
      const read = await run(s.page, without(recordingScript, AUDIENCE_STEPS));
      const rows = read.get("extract-open-day") ?? [];
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.audience, "Friends");
      assert.notDeepEqual(rows, asRead(expected.extracted?.[0]?.records));
    } finally { await s.close(); }
  });

  it("move open day: posting the Sunday text without moving the Saturday post to the trash leaves two open-day posts", async () => {
    const { recordingScript, expected } = workflow("move-open-day");
    const extractStep = recordingScript.find(({ id }) => id === "extract-open-day")!;
    const s = await session();
    try {
      const upToRepost = without(recordingScript, [...TRASH_STEPS, "reposted", extractStep.id, "open-day-extracted"]);
      await run(s.page, upToRepost);
      const own = locate(s.page, extractStep.target!);
      for (let waited = 0; await own.count() < 2 && waited < 5000; waited += 100) await s.page.waitForTimeout(100);
      const rows = await extract(s.page, extractStep);
      assert.equal(rows.length, 2);
      assert.notDeepEqual(rows, asRead(expected.extracted?.[0]?.records));
    } finally { await s.close(); }
  });

  it("confirm requests: a run that also confirms Priya Nair, one mutual friend short, reads her back among the accepted", async () => {
    const { recordingScript, expected } = workflow("confirm-requests");
    const extractStep = recordingScript.find(({ id }) => id === "extract-confirmed")!;
    const s = await session();
    try {
      await run(s.page, recordingScript.slice(0, recordingScript.findIndex(({ id }) => id === "requests-open") + 1));
      for (const slug of ["priya-nair", "amara-osei", "jonas-weber", "lin-zhao", "freya-holm"]) await confirm(s.page, slug);
      const rows = await extract(s.page, extractStep);
      assert.deepEqual(rows.map(({ name }) => name), ["Amara Osei", "Priya Nair", "Jonas Weber", "Lin Zhao", "Freya Holm"]);
      assert.notDeepEqual(rows, asRead(expected.extracted?.[0]?.records));
    } finally { await s.close(); }
  });
});

/** Presses Confirm on one card as a patient person does: when the site says it is going too fast, waits for Try again. */
async function confirm(page: Page, slug: string): Promise<void> {
  const card = page.locator(`[role="listitem"]:has(a[href$="/people/${slug}/"])`);
  await card.locator(`[aria-label="Confirm"]`).click();
  const accepted = card.locator(`a[href*="/messages/t/"]`);
  const tooFast = page.getByRole("alertdialog", { name: "You're going too fast" });
  for (let waited = 0; waited < 3000; waited += 100) {
    if (await accepted.count() > 0) return;
    if (await tooFast.count() > 0) {
      await page.getByRole("button", { name: "Try again", exact: true }).click({ timeout: 17_000 });
      await accepted.waitFor({ state: "visible", timeout: 3000 });
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`${slug} was neither accepted nor refused`);
}
