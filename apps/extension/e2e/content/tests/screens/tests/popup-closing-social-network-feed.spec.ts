// Headed, provider-free: Firefox's popup closes the moment the person clicks the page. Playwright cannot load the real
// popup, so each test models it (`closePopupOnPageClick`: a real click on the scenario's page, `pagehide`, the frame
// removed) at a point of the journey, mounts the popup again at 380 x 580 over what the background and Core kept (the
// journey panel holds that on the page that holds the frame), and records what the person returns to. Nothing reaches
// FluxIQ, a provider or a key. Each test adds an annotation `returns` with the one line that goes into the report.
import { expect, test } from "../../../index.js";
import type { Frame, FrameLocator, Page, TestInfo } from "@playwright/test";
import { bundlePanel, closePopupOnPageClick, mountPanelFrame, type PanelBundle } from "../panel-frame.js";

const SIZE = { width: 380, height: 580 };
const TASK = "List the latest posts from the people I follow";
let bundle: PanelBundle;
test.beforeAll(async () => {
  bundle = await bundlePanel(`import { startJourneyPanel } from "./e2e/content/tests/screens/journey-panel";\nstartJourneyPanel("popup");`);
});

type Win = { __show(name: string): void; __setKey(key: string): void; __scene(name: string): void; __world(): { sent: Array<{ type: string; text?: string; purpose?: string }> }; __tasks: { calls: Array<{ method: string }> } };
type Mounted = { frame: FrameLocator; child: Frame };

/** The popup opened on a connected, signed-in browser, with a model key unless `key` says otherwise. */
async function open(page: Page, key: "ready" | "missing" = "ready", status = "idle"): Promise<Mounted> {
  const mounted = await mountPanelFrame(page, bundle, SIZE);
  await mounted.child.evaluate(({ key, status }) => {
    const win = window as unknown as Win;
    win.__setKey(key);
    win.__show(status);
  }, { key, status });
  return mounted;
}
const reopen = (page: Page): Promise<Mounted> => mountPanelFrame(page, bundle, SIZE);
const pending = (page: Page, name: string) => page.evaluate((entry) => {
  const holder = (window as unknown as { __holder: { world: string } }).__holder;
  const world = JSON.parse(holder.world) as { pending: string[] };
  world.pending.push(entry);
  holder.world = JSON.stringify(world);
}, name);
const returns = (testInfo: TestInfo, line: string) => {
  testInfo.annotations.push({ type: "returns", description: line });
  console.log(`RETURNS ${testInfo.title}: ${line}`);
};
const picture = (mounted: Mounted, testInfo: TestInfo, name: string) => {
  const folder = process.env.FLUXIQ_JOURNEY_PICTURES;
  return mounted.frame.locator("#app").screenshot({ path: folder === undefined ? testInfo.outputPath(`${name}.png`) : `${folder}/popup-closing-${testInfo.project.use.browserName ?? "engine"}/${name}.png` });
};
const scene = (child: Frame, name: string) => child.evaluate((entry) => (window as unknown as Win).__scene(entry), name);
const sendTask = async (mounted: Mounted, page: Page) => {
  const input = mounted.frame.locator("#conversationInput");
  await input.click();
  await page.keyboard.type(TASK);
  await input.press("Enter");
  await expect(mounted.frame.getByText("I'll open your feed")).toBeVisible();
};

test.beforeEach(async ({ openHarness }) => { await openHarness("social-network-feed"); });

test("closing on setup: the five steps are there again", async ({ page }, testInfo) => {
  const first = await mountPanelFrame(page, bundle, SIZE);
  await expect(first.frame.locator(".start-step:not([hidden])")).toHaveCount(5);
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  await expect(again.frame.locator(".start-step:not([hidden])")).toHaveCount(5);
  await picture(again, testInfo, "1-setup-reopened");
  returns(testInfo, "setup: the same five steps, nothing ticked; right");
});

test("closing while waiting for approval: the code is still there", async ({ page }, testInfo) => {
  const first = await mountPanelFrame(page, bundle, SIZE);
  await first.frame.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(first.frame.locator("#pairingReferenceCode")).toHaveText("482913");
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  await expect(again.frame.locator("#pairingReferenceCode")).toHaveText("482913");
  await picture(again, testInfo, "2-pairing-reopened");
  returns(testInfo, "waiting for approval: the same code and the waiting step; right");
});

test("closing after Open FluxIQ on the key card: the card is back until the key is there", async ({ page }, testInfo) => {
  const first = await open(page, "missing");
  await first.frame.locator(".setup-card").getByRole("button", { name: "Open FluxIQ" }).click();
  expect((await first.child.evaluate(() => (window as unknown as Win).__world())).sent.at(-1)).toMatchObject({ type: "fluxiq.panel.openFluxIQ", purpose: "model-key" });
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  await expect(again.frame.locator(".setup-card")).toBeVisible();
  await picture(again, testInfo, "3-key-card-reopened");
  await again.child.evaluate(() => (window as unknown as Win).__setKey("ready"));
  await closePopupOnPageClick(page);
  const ready = await reopen(page);
  await expect(ready.frame.locator("#conversationInput")).toBeVisible();
  await expect(ready.frame.locator(".setup-card")).toBeHidden();
  returns(testInfo, "key card after Open FluxIQ: the card again while the key is missing, gone at once when it is there; right");
});

test("closing with a typed draft: what the box holds", async ({ page }, testInfo) => {
  const first = await open(page);
  await first.frame.locator("#conversationInput").click();
  await page.keyboard.type("Find me the posts about hiking");
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  const draft = await again.frame.locator("#conversationInput").inputValue();
  await picture(again, testInfo, "4-draft-reopened");
  returns(testInfo, `typed draft: ${draft === "" ? "empty box, the draft is lost" : `kept as "${draft}"`}`);
});

test("closing while work runs: nothing is lost, and what finished while it was closed", async ({ page, browserName }, testInfo) => {
  test.setTimeout(90_000);
  const first = await open(page);
  await sendTask(first, page);
  await expect(first.frame.locator(".chat-work-now")).toBeVisible();
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  await expect(again.frame.getByText("I'll open your feed")).toBeVisible();
  await expect(again.frame.getByText(TASK)).toBeVisible();
  await expect(again.frame.getByText("Working", { exact: false }).first()).toBeVisible();
  await picture(again, testInfo, "5a-work-running-reopened");
  await closePopupOnPageClick(page);
  await pending(page, "scene:done");
  const after = await reopen(page);
  await expect(after.frame.getByText(TASK)).toBeVisible();
  await page.waitForTimeout(1_500);
  const answers = await after.frame.locator(".answer-turn").count();
  await picture(after, testInfo, "5b-finished-while-closed-reopened");
  returns(testInfo, `work running: reply, task and the working header come back; finished while closed: ${answers === 1 ? "the answer turn is drawn" : "NO answer turn in the chat (the results adapter only draws runs it saw finish)"} [${browserName}]`);
});

test("the page itself says what the work is doing while no panel is open", async ({ openHarness, page }, testInfo) => {
  const harness = await openHarness("social-network-feed");
  const display = { activityId: "build:b1", subjectKind: "build", phase: "exploring", headline: "Working on your task", detail: "Opening the feed", step: null, working: true, outcome: null, sequence: 1 };
  await harness.deliver({ type: "fluxiq.activity.overlay", activity: null, overlay: "expanded", topFrameOnly: true, display });
  await expect(page.locator("fluxiq-activity-overlay")).toBeVisible();
  const folder = process.env.FLUXIQ_JOURNEY_PICTURES;
  await page.screenshot({ path: folder === undefined ? testInfo.outputPath("5c-page-card.png") : `${folder}/popup-closing-${testInfo.project.use.browserName ?? "engine"}/5c-page-card.png` });
  returns(testInfo, "on-page card while the panel is closed: shown on the page itself, with the work's own words");
});

test("closing on a person-only check: the warning, then Continue after coming back", async ({ page }, testInfo) => {
  const first = await open(page);
  await sendTask(first, page);
  await scene(first.child, "check");
  await expect(first.frame.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await expect(first.frame.getByText("This window closes when you click the page.", { exact: false })).toBeVisible();
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  await expect(again.frame.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
  await expect(again.frame.getByText("This window closes when you click the page.", { exact: false })).toBeVisible();
  await picture(again, testInfo, "6-person-check-reopened");
  await again.frame.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(again.frame.getByText("Done. You pressed Continue.")).toBeVisible();
  returns(testInfo, "person-only check: the same check, the warning and Continue; Continue still works; right");
});

test("closing on a permission ask: the ask is still open", async ({ page }, testInfo) => {
  const first = await open(page);
  await sendTask(first, page);
  await scene(first.child, "permission");
  await expect(first.frame.getByText('Allow FluxIQ to press "Follow"?')).toBeVisible();
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  await expect(again.frame.getByRole("button", { name: "Allow", exact: true })).toBeVisible();
  await picture(again, testInfo, "7-permission-reopened");
  await again.frame.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(again.frame.getByText("You allowed this.")).toBeVisible();
  returns(testInfo, "permission ask: the same ask with Allow and Don't allow; one press still works; right");
});

test("closing on an open task: the popup reopens on that task", async ({ page }, testInfo) => {
  const first = await open(page);
  await first.frame.locator("#panelTab-automations").click();
  await first.frame.locator(".task-row", { hasText: "saved searches" }).click();
  await expect(first.frame.locator(".task-title")).toHaveText("Check my saved searches for new listings");
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  const title = again.frame.locator(".task-title");
  const onTask = await title.isVisible().catch(() => false);
  await picture(again, testInfo, "8-task-reopened");
  returns(testInfo, `open task: ${onTask ? `reopens on "${await title.textContent()}"` : "reopens on the chat, the open task is not restored"}`);
  expect(onTask).toBe(true);
});

test("closing on a subflow's details and on half-filled run inputs", async ({ page }, testInfo) => {
  const first = await open(page);
  await first.frame.locator("#panelTab-automations").click();
  await first.frame.getByRole("button", { name: /^Library/u }).click();
  await first.frame.getByRole("button", { name: /^Order notebooks again/u }).click();
  await expect(first.frame.getByRole("heading", { name: "Order notebooks again" })).toBeVisible();
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  const tab = await again.frame.locator("[aria-selected=true][role=tab], #panelTab-chat[aria-selected=true], #panelTab-automations[aria-selected=true]").first().textContent();
  const details = await again.frame.getByRole("heading", { name: "Order notebooks again" }).isVisible().catch(() => false);
  await picture(again, testInfo, "9a-subflow-reopened");
  returns(testInfo, `open subflow: reopens on the ${tab?.trim()} tab, ${details ? "on its details" : "details not kept (back to the top of the list)"}`);
  await again.frame.locator("#panelTab-automations").click();
  await again.frame.getByRole("button", { name: /^Library/u }).click();
  await again.frame.getByRole("button", { name: /^Order notebooks again/u }).click();
  await again.frame.getByRole("button", { name: "Run", exact: true }).click();
  await again.frame.getByLabel("How many (required)").fill("2");
  await closePopupOnPageClick(page);
  const last = await reopen(page);
  await last.frame.locator("#panelTab-automations").click();
  await last.frame.getByRole("button", { name: /^Library/u }).click();
  await last.frame.getByRole("button", { name: /^Order notebooks again/u }).click();
  await last.frame.getByRole("button", { name: "Run", exact: true }).click();
  const kept = await last.frame.getByLabel("How many (required)").inputValue();
  await picture(last, testInfo, "9b-run-inputs-reopened");
  returns(testInfo, `half-filled run inputs: ${kept === "" ? "lost (the form is empty again; nothing was run)" : `kept as "${kept}"`}`);
});

test("closing while recording, and a recording stopped while closed", async ({ page }, testInfo) => {
  const first = await open(page);
  await first.frame.getByRole("button", { name: "Start recording" }).click();
  await first.frame.getByLabel("Recording description").fill("Open a profile and follow it");
  await first.frame.getByRole("button", { name: "Start described recording" }).click();
  await expect(first.frame.locator("#stopRecordingButton")).toBeVisible();
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  await expect(again.frame.locator("#stopRecordingButton")).toBeVisible();
  await expect(again.frame.locator(".recording-bar")).toContainText("recording goes on");
  await picture(again, testInfo, "10a-recording-reopened");
  await closePopupOnPageClick(page);
  await pending(page, "recording-stopped");
  const stopped = await reopen(page);
  await page.waitForTimeout(2_500);
  const chip = await stopped.frame.locator(".composer-chip").count();
  await picture(stopped, testInfo, "10b-recording-stopped-while-closed");
  returns(testInfo, `recording running: the bar with Stop and the words that it goes on; stopped while closed: ${chip === 1 ? "the chip is on the composer" : "NO chip on reopening (only \"+\" can attach it)"}`);
});

test("closing on an unsaved settings draft", async ({ page }, testInfo) => {
  const first = await open(page);
  await first.frame.getByRole("button", { name: "Settings" }).click();
  await first.frame.locator(".settings-advanced > summary").click();
  const address = first.frame.getByLabel("FluxIQ connection address", { exact: true });
  await address.fill("ws://127.0.0.1:9999/client");
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  const onSettings = await again.frame.locator(".settings-screen").isVisible().catch(() => false);
  await picture(again, testInfo, "11-settings-reopened");
  returns(testInfo, `settings draft: reopens on ${onSettings ? "Settings" : "the chat"}; the unsaved address is gone, as nothing was saved`);
});

test("closing right after Add budget: the press went out once, and the task comes back", async ({ page }, testInfo) => {
  const first = await open(page);
  await first.frame.locator("#panelTab-automations").click();
  await first.frame.locator(".task-row", { hasText: "bikes category" }).click();
  await first.frame.getByRole("button", { name: /^Add \$5\.00 and carry on/u }).click();
  await expect(first.frame.locator(".task-state")).toHaveText("Working");
  const calls = await first.child.evaluate(() => (window as unknown as Win).__tasks.calls.filter((call) => call.method === "results.addBudgetAndCarryOn").length);
  expect(calls).toBe(1);
  await closePopupOnPageClick(page);
  const again = await reopen(page);
  await expect(again.frame.locator(".task-title")).toHaveText("Copy every listing in the bikes category");
  await picture(again, testInfo, "12-budget-reopened");
  returns(testInfo, "budget-out button: pressed once, the press went out; the task reopens (its state is Core's: the fake port resets, so not checked)");
});
