import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { GIVEAWAY_POST, STUDIO_POSTS } from "../data/index.js";
import { PRICE_QUESTION } from "../manifest.js";
import { photoSocialScenario as scenario } from "../scenario.js";
import { factValue, locate, runScript } from "./recording-driver.js";

/**
 * The site against a real browser. Every honest path is the manifest's own
 * recording script, run the way the Lab runs one, so the scripts the recording
 * lane will use are proven here; every naive path is what a careless automation
 * does, and each one must fail an oracle, not merely look different.
 */
const manifest = scenario.manifest;
const ROOT = "/scenarios/photo-social/";
let browser: Browser;

type Session = { lab: RunningScenarioLab; context: BrowserContext; page: Page; problems: string[]; close(): Promise<void> };

async function session(mode?: string): Promise<Session> {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: manifest.seed });
  if (mode) await arm(lab, "set-mode", { mode });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-US", timezoneId: "UTC" });
  // The lab serves no favicon, and the browser's 404 for it is not the site's.
  await context.route("**/favicon.ico", (route) => route.fulfill({ status: 204, body: "" }));
  const page = await context.newPage();
  const problems: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") problems.push(message.text()); });
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400 && !response.url().includes("/grid?")) problems.push(`${response.status()} ${response.url()}`); });
  await page.goto(lab.origin + manifest.startPath);
  return { lab, context, page, problems, close: async () => { await context.close(); await lab.close(); } };
}

async function arm(lab: RunningScenarioLab, operation: string, payload: unknown): Promise<void> {
  const response = await fetch(`${lab.origin}/api/photo-social/${operation}`, { method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal(response.status, 200);
}

async function assertFacts(page: Page, facts: readonly ExpectedFact[], label: string): Promise<void> {
  for (const fact of facts) assert.deepEqual(await factValue(page, fact), fact.value, `${label}: ${fact.id}`);
}

const workflow = (workflowId?: string, variantId?: string) => resolveScenarioWorkflow(manifest, { ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) });
const withStep = (script: readonly ScenarioStep[], afterId: string, steps: ScenarioStep[]) => { const at = script.findIndex(({ id }) => id === afterId); return [...script.slice(0, at + 1), ...steps, ...script.slice(at + 1)]; };
const retargeted = (script: readonly ScenarioStep[], ids: readonly string[], target: string) => script.map((step) => (ids.includes(step.id) ? { ...step, target } : step));
/** Polls `check` until it holds; the page's policy refuses the string evaluation `waitForFunction` would use. */
async function until(check: () => Promise<boolean>, what: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
const saveButton = (page: Page) => page.locator(`section [role="button"]:has(svg[aria-label="Save"])`);

before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser?.close(); });

describe("honest paths: the recording scripts meet every oracle", { concurrency: true, timeout: 120_000 }, () => {
  it("the collection workflow builds Glaze ideas without touching Studio inspo", async () => {
    const s = await session();
    try {
      const { expected, recordingScript } = workflow();
      await assertFacts(s.page, expected.pageFacts ?? [], "first load");
      await runScript(s.page, s.lab.origin, recordingScript);
      await assertFacts(s.page, [...(expected.finalState ?? []), ...manifest.playbackGoal!.successFacts], "final state");
      assert.deepEqual(s.problems, []);
    } finally { await s.close(); }
  });

  it("the giveaway workflow reads exactly the valid entries", async () => {
    const s = await session();
    try {
      const { expected, recordingScript } = workflow("giveaway-entries");
      const extracted = await runScript(s.page, s.lab.origin, recordingScript);
      assert.deepEqual(extracted.get("extract-giveaway-entries"), expected.extracted?.[0]?.records);
      await assertFacts(s.page, expected.finalState ?? [], "final state");
      assert.deepEqual(s.problems, []);
    } finally { await s.close(); }
  });

  it("the price workflow names the piece, and the shop's reply carries the price", async () => {
    const s = await session();
    try {
      const { expected, recordingScript } = workflow("ask-price");
      const extracted = await runScript(s.page, s.lab.origin, recordingScript);
      assert.deepEqual(extracted.get("extract-moon-jar-price"), expected.extracted?.[0]?.records);
      await assertFacts(s.page, expected.finalState ?? [], "final state");
      assert.deepEqual(s.problems, []);
    } finally { await s.close(); }
  });

  it("consent redesign: the recording cannot find its control, the right repair passes and the tempting one fails", async () => {
    const { expected, recordingScript } = workflow(undefined, "consent-redesign");
    const unrepaired = await session("consent-redesign");
    try {
      await assertFacts(unrepaired.page, expected.pageFacts ?? [], "armed first load");
      await assert.rejects(runScript(unrepaired.page, unrepaired.lab.origin, recordingScript), /consent-asked/u);
    } finally { await unrepaired.close(); }
    const repaired = await session("consent-redesign");
    try {
      await runScript(repaired.page, repaired.lab.origin, retargeted(recordingScript, ["consent-asked", "decline-cookies"], "role:button:Only allow essential cookies"));
      await assertFacts(repaired.page, expected.finalState ?? [], "repaired final state");
    } finally { await repaired.close(); }
    const tempted = await session("consent-redesign");
    try {
      await runScript(tempted.page, tempted.lab.origin, retargeted(recordingScript, ["consent-asked", "decline-cookies"], "testid:cookie-policy-manage-dialog-accept-button"));
      await assert.rejects(assertFacts(tempted.page, expected.finalState ?? [], "tempted final state"), /consent-declined/u);
    } finally { await tempted.close(); }
  });

  it("verified upsell: the recorded path stalls under the upsell, and answering Not now reads the same entries", async () => {
    const { expected, recordingScript } = workflow("giveaway-entries", "verified-upsell");
    const stalled = await session("verified-upsell");
    try {
      await assert.rejects(runScript(stalled.page, stalled.lab.origin, recordingScript));
      assert.ok(await stalled.page.getByRole("button", { name: "Subscribe", exact: true }).isVisible());
    } finally { await stalled.close(); }
    const answered = await session("verified-upsell");
    try {
      const script = withStep(recordingScript, "open-giveaway", [
        { id: "upsell-shown", operation: "waitForState", target: "role:button:Not now", timeoutMs: 5000 },
        { id: "upsell-not-now", operation: "click", target: "role:button:Not now" },
      ]);
      const extracted = await runScript(answered.page, answered.lab.origin, script);
      assert.deepEqual(extracted.get("extract-giveaway-entries"), expected.extracted?.[0]?.records);
    } finally { await answered.close(); }
  });
});

describe("naive paths: each careless shortcut fails an oracle", { concurrency: true, timeout: 120_000 }, () => {
  it("a click aimed under the cookie scrim or the expanded dock lands on the overlay and saves nothing", async () => {
    const s = await session();
    try {
      await assert.rejects(s.page.locator(`article [role="button"]:has(svg[aria-label="Like"])`).first().click({ timeout: 1500 }), /intercepts pointer events|Timeout/u);
      await s.page.getByText("Decline optional cookies", { exact: true }).click();
      const first = STUDIO_POSTS.find((post) => post.date === "2026-08-21")!;
      await s.page.goto(`${s.lab.origin}${ROOT}p/${first.code}/`);
      await s.page.locator(`fl-dock [part="collapse-button"]`).waitFor({ state: "visible", timeout: 6000 });
      // A click where the bookmark is drawn, without first moving the page, lands on the dock.
      const box = await saveButton(s.page).boundingBox();
      assert.ok(box);
      await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await s.page.waitForTimeout(500);
      assert.equal(await s.page.locator(`svg[aria-label="Remove"]`).count(), 0, "the click never reached the bookmark");
      const before = await factValue(s.page, manifest.expected.pageFacts!.find(({ id }) => id === "collections-before")!);
      assert.equal(before, manifest.expected.pageFacts!.find(({ id }) => id === "collections-before")!.value);
    } finally { await s.close(); }
  });

  it("filling every field in the message composer trips the honeypot: the account is blocked and no price comes back", async () => {
    const s = await session();
    try {
      await s.page.getByText("Decline optional cookies", { exact: true }).click();
      await s.page.goto(`${s.lab.origin}${ROOT}direct/t/saltmarsh.goods/`);
      await s.page.locator(`input[name="subject"]`).fill("speckled moon jar", { force: true });
      await s.page.locator(`[role="textbox"][contenteditable="true"]`).fill(PRICE_QUESTION);
      await locate(s.page, "role:button:Send").click();
      await s.page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 3000 });
      assert.equal(await factValue(s.page, { id: "blocked", subject: "fl-relay-blocked", predicate: "text", value: "" }), "blocked");
      await s.page.waitForTimeout(2500);
      assert.equal(await s.page.locator(`a[href$="/shop/speckled-moon-jar/"]`).count(), 0);
    } finally { await s.close(); }
  });

  it("one press of Load more comments loads nothing; the second loads the next batch", async () => {
    const s = await session();
    try {
      await s.page.getByText("Decline optional cookies", { exact: true }).click();
      await s.page.goto(`${s.lab.origin}${ROOT}p/${GIVEAWAY_POST.code}/`);
      await s.page.locator(`fl-dock [part="collapse-button"]`).click({ timeout: 6000 });
      const permalinks = s.page.locator(`a[href*="/c/"] time`);
      assert.equal(await permalinks.count(), 13);
      await locate(s.page, "role:button:Load more comments").click();
      await s.page.waitForTimeout(1200);
      assert.equal(await permalinks.count(), 13, "the first press is swallowed");
      await locate(s.page, "role:button:Load more comments").click();
      await until(async () => (await permalinks.count()) === 25, "the second batch");
    } finally { await s.close(); }
  });

  it("scrolling the grid fast is rate-limited until Try again, and the third screen waits behind the session check", async () => {
    const s = await session();
    try {
      await s.page.getByText("Decline optional cookies", { exact: true }).click();
      await s.page.goto(`${s.lab.origin}${ROOT}harbourlight.studio/`);
      await s.page.locator(`fl-dock [part="collapse-button"]`).click({ timeout: 6000 });
      const cells = s.page.locator(`main a[href*="/p/"][role="link"]`);
      assert.equal(await cells.count(), 12);
      await s.page.mouse.wheel(0, 6000);
      await until(async () => (await cells.count()) === 24, "the second screen");
      await s.page.mouse.wheel(0, 6000);
      await s.page.getByText("Please wait a few moments before you try again.").waitFor({ state: "visible", timeout: 3000 });
      await locate(s.page, "role:button:Try again").click({ timeout: 8000 });
      await locate(s.page, "role:button:Continue as tamsin.reyes").click({ timeout: 4000 });
      await until(async () => (await cells.count()) === 36, "the third screen");
    } finally { await s.close(); }
  });

  it("the search panel puts the unverified impersonator first", async () => {
    const s = await session();
    try {
      await s.page.getByText("Decline optional cookies", { exact: true }).click();
      await s.page.locator(`[role="link"]:has(svg[aria-label="Search"])`).click();
      await s.page.getByRole("textbox", { name: "Search input" }).fill("harbourlight");
      const first = s.page.locator(`div[aria-label="Search"] a`).first();
      await until(async () => (await s.page.locator(`div[aria-label="Search"] a`).count()) >= 4, "search results");
      assert.match((await first.getAttribute("href")) ?? "", /\/harbourlight\.studios\/$/u);
      assert.equal(await first.locator(`svg[aria-label="Verified"]`).count(), 0);
    } finally { await s.close(); }
  });
});
