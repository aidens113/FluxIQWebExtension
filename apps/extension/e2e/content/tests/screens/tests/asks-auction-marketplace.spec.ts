// Headed, provider-free look at every question a person can be asked, on the auction-marketplace scenario at
// 360 px, by mouse and by keyboard: a permission ask for a money act (one press of Allow, no PIN), a person-only
// check, a text question, a panel confirmation sent to FluxIQ, the answered states, and the popup's wording at
// 380 x 580. The panel is the real one over a scripted background. No provider, no real site.
import { expect, test } from "../../../index.js";
import type { FrameLocator, Page, TestInfo } from "@playwright/test";
import { bundlePanel, mountPanelFrame } from "../panel-frame.js";

// The extension's words for a wait (`src/background/activity/host-words.ts`), written out because a spec reads them as a person does.
const QUESTION_WORDS = "Waiting for you: a question in the FluxIQ panel";
const CHECK_WORDS = "Waiting for you: finish the check on the page, then press Continue";
const PLACE_BID = 'FluxIQ needs to press "Place bid" (button) to build this Flow. That would spend, refund or move money, and that always needs your permission, even when your instruction asks for it.';
const CHECK = "FluxIQ needs you: complete the check on this page, then press Continue.";
const CHECK_TITLE = "Asked the person to complete a check";
const OPEN_TITLE = "Asked a question (open)";
const OPEN_QUESTION = "Which auction do you mean: the lamp or the clock?";
const PANEL_COMMAND = 'You asked me to "Delete the automation". That would delete or remove something, and it cannot be undone, so confirm it here with your PIN, or cancel.';

const permissionAsk = { askId: "request.1", kind: "permission", status: "pending", parks: true, options: null, answer: null, missing: ["move_money"], consequences: ["move_money"],
  control: { name: "Place bid", kind: "button" }, permissionRequest: { action: { kind: "exploration", verb: "press" }, control: { name: "Place bid", kind: "button" }, missing: ["move_money"] } };
const personAsk = { askId: "person-needed.1", kind: "choice", status: "pending", parks: true, answer: null, consequences: [], missing: null,
  options: [{ id: "person_done", label: "Continue", route: null }, { id: "person_stop", label: "Stop", route: "failed" }], control: { name: "robot check", kind: "person_check" } };
const openAsk = { askId: "ask.open", kind: "open", status: "pending", parks: true, options: null, answer: null, consequences: [], missing: null, control: null };
const commandAsk = { askId: "panel-command.1", kind: "confirm", status: "pending", parks: false, options: null, answer: null, consequences: ["delete"], missing: null, control: { name: "Delete the automation", kind: "panel action" } };

/** The chat's words `{ text, ask }` and, while the work waits, the display: Core's own wait row for the ask (`automation-activity/ask/ask.ts`), through the extension's words. */
type Scene = { text: string; ask: { askId: string }; headline?: string; detail?: string; title?: string };

function waitingState(scene: Scene): unknown {
  if (scene.headline === undefined) return { current: null, display: null, recent: [], history: [], overlay: "expanded", live: true };
  const subject = { kind: "build", id: "b1", projectId: "project-1", flowId: "flow-7" };
  const event = { activityId: "build:b1", sequence: 1, subject, conversationId: "conv-latest", phase: "waiting_permission", label: scene.detail ?? "Waiting for an answer before going on", at: new Date().toISOString(),
    detail: { kind: "ask", title: scene.title ?? "Asked a question (permission)", status: "started", ref: scene.ask.askId } };
  return { current: event, display: display(scene), recent: [event], history: [event], overlay: "expanded", live: true };
}

function display(scene: Scene): unknown {
  return { activityId: "build:b1", subjectKind: "build", phase: "waiting_permission", headline: scene.headline, detail: scene.detail ?? null, step: null, working: false, outcome: "waiting", sequence: 1 };
}

/** The panel as both browsers mount it. `window.__messages` holds every message it sent the background. */
function panelEntry(scene: Scene, surface: "sidepanel" | "popup"): string {
  return `
    import { startScriptedPanel } from "./e2e/content/tests/screens/scripted-panel";
    let state = ${JSON.stringify(waitingState(scene))};
    window.__messages = [];
    // Core settling the wait, once it holds the answer: the work goes on, and the header stops waiting.
    window.__workGoesOn = () => {
      state = { current: null, display: null, recent: [], history: [], overlay: "expanded", live: true };
      window.__push({ type: "fluxiq.activity.changed", state });
    };
    startScriptedPanel({
      surface: ${JSON.stringify(surface)},
      threads: [{ conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [
        { turnId: "t1", author: "person", text: "Bid on the lamp", createdAt: Date.now() - 60000 },
        { turnId: "t2", author: "automation", text: ${JSON.stringify(scene.text)}, createdAt: Date.now() - 5000, ask: ${JSON.stringify(scene.ask)} }
      ] }],
      answer: (message) => {
        window.__messages.push(message);
        if (message.type === "fluxiq.panel.activityRead") return Promise.resolve({ ok: true, state });
        if (message.type === "fluxiq.panel.stopRun" || message.type === "fluxiq.panel.openFluxIQ") return Promise.resolve({ ok: true, payload: {} });
        return undefined;
      }
    });
  `;
}

async function open(page: Page, entry: string, size: { width: number; height: number } = { width: 360, height: 720 }): Promise<FrameLocator> {
  const { frame } = await mountPanelFrame(page, await bundlePanel(entry), size);
  await expect(frame.locator("#app")).toBeVisible();
  return frame;
}

async function picture(frame: FrameLocator, testInfo: TestInfo, name: string): Promise<void> {
  await frame.locator("#app").screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

const button = (frame: FrameLocator, name: string) => frame.getByRole("button", { name, exact: true });
const focusedText = (frame: FrameLocator) => frame.locator(":focus").textContent();
const fits = (page: Page) => page.frame({ name: "panel-frame" })!.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const workGoesOn = (page: Page) => page.frame({ name: "panel-frame" })!.evaluate(() => (window as unknown as { __workGoesOn(): void }).__workGoesOn());
const answersOf = (page: Page) => page.frame({ name: "panel-frame" })!.evaluate(() => (window as unknown as { __messages: Array<{ type: string }> }).__messages.filter((message) => message.type === "fluxiq.panel.conversationAnswer"));

test("auction-marketplace: a permission ask for a money act takes one press, no PIN, by keyboard", async ({ openHarness, page }, testInfo) => {
  await openHarness("auction-marketplace");
  const frame = await open(page, panelEntry({ text: PLACE_BID, ask: permissionAsk, headline: QUESTION_WORDS }, "sidepanel"));
  await expect(frame.getByText('Allow FluxIQ to press "Place bid"?')).toBeVisible();
  await expect(frame.getByText("spend, refund or move money", { exact: true })).toBeVisible();
  const header = frame.locator(".chat-work-now");
  await expect(header).toHaveText("The question is above.");
  await expect(frame.getByRole("button", { name: "Show the question" })).toHaveCount(0);
  expect(await fits(page), "nothing overflows 360 px").toBe(true);
  await picture(frame, testInfo, "permission-waiting");
  await button(frame, "Allow").focus();
  await page.keyboard.press("Tab");
  expect(await focusedText(frame)).toBe("Don't allow");
  await picture(frame, testInfo, "permission-focus");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(frame.getByText("You allowed this.")).toBeVisible();
  await expect(frame.getByRole("dialog")).toHaveCount(0);
  expect((await answersOf(page)).map(({ kind, authorizationPin }: any) => [kind, authorizationPin])).toEqual([["grant", undefined]]);
  await workGoesOn(page);
  await picture(frame, testInfo, "permission-answered");
});

test("auction-marketplace: a permission ask refused with the mouse says so", async ({ openHarness, page }, testInfo) => {
  await openHarness("auction-marketplace");
  const frame = await open(page, panelEntry({ text: PLACE_BID, ask: permissionAsk }, "sidepanel"));
  await button(frame, "Don't allow").click();
  await expect(frame.getByText("You didn't allow this.")).toBeVisible();
  await picture(frame, testInfo, "permission-refused");
});

test("auction-marketplace: a person-only check is told once, on the page and in the panel, and Continue is kept in the transcript", async ({ openHarness, page }, testInfo) => {
  const harness = await openHarness("auction-marketplace");
  // Core's own ask names itself a check, so the headline is `check` and Core's sentence is the detail.
  const scene = { text: CHECK, ask: personAsk, headline: CHECK_WORDS, detail: CHECK, title: CHECK_TITLE };
  const frame = await open(page, panelEntry(scene, "sidepanel"));
  await expect(button(frame, "Continue")).toBeVisible();
  await expect(frame.locator(".chat-work-now")).toHaveText("The question is above.");
  await expect(frame.getByText(/Robot check|complete a check/u)).toHaveCount(0);
  expect(await fits(page)).toBe(true);
  // "Robot check" has no card of its own, and the sentence is said once in the transcript.
  await expect(frame.getByText(CHECK, { exact: true })).toHaveCount(1);
  await expect(frame.getByRole("button", { name: "Stop", exact: true }).locator("visible=true")).toHaveCount(1);
  await expect(frame.locator(".turn-ask").getByRole("button", { name: "Stop", exact: true })).toHaveAttribute("title", "Stop the task");
  await harness.deliver({ type: "fluxiq.activity.overlay", activity: null, overlay: "expanded", topFrameOnly: true, display: display(scene) });
  const pill = page.locator("fluxiq-activity-overlay");
  await expect(pill).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("person-check-page-and-panel.png") });
  // The moment before Core's ask: the page action said only a person can pass, and the extension's words for that stand alone.
  await harness.deliver({ type: "fluxiq.activity.overlay", activity: null, overlay: "expanded", topFrameOnly: true, display: display({ text: CHECK, ask: personAsk, headline: CHECK_WORDS, detail: "Only a person can get past this page" }) });
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath("person-check-before-the-ask-on-the-page.png") });
  await picture(frame, testInfo, "person-check-waiting");
  await button(frame, "Continue").focus();
  await page.keyboard.press("Enter");
  await expect(frame.getByText("Done. You pressed Continue.")).toBeVisible();
  expect((await answersOf(page)).map(({ kind, value }: any) => [kind, value])).toEqual([["choice", "person_done"]]);
  await workGoesOn(page);
  await expect(frame.getByRole("button", { name: "Show the question" })).toHaveCount(0);
  await picture(frame, testInfo, "person-check-answered");
});

test("auction-marketplace: each Stop does what its words say", async ({ openHarness, page }, testInfo) => {
  await openHarness("auction-marketplace");
  const frame = await open(page, panelEntry({ text: CHECK, ask: personAsk, headline: CHECK_WORDS, detail: CHECK, title: CHECK_TITLE }, "sidepanel"));
  await frame.locator(".turn-ask").getByRole("button", { name: "Stop", exact: true }).click();
  await expect(frame.getByText("You pressed Stop.")).toBeVisible();
  expect((await answersOf(page)).map(({ kind, value }: any) => [kind, value])).toEqual([["choice", "person_stop"]]);
  await picture(frame, testInfo, "person-check-stopped");
  // The header's Stop stops the work itself.
  await frame.locator(".chat-stop").click();
  const stops = await page.frame({ name: "panel-frame" })!.evaluate(() => (window as unknown as { __messages: Array<Record<string, unknown>> }).__messages.filter((message) => message.type === "fluxiq.panel.stopRun"));
  expect(stops).toHaveLength(1);
  expect(stops[0]!.flowId).toBe("flow-7");
});

test("auction-marketplace: a text question, typed and sent with Enter", async ({ openHarness, page }, testInfo) => {
  await openHarness("auction-marketplace");
  const frame = await open(page, panelEntry({ text: OPEN_QUESTION, ask: openAsk, headline: QUESTION_WORDS, title: OPEN_TITLE }, "sidepanel"));
  // A text question is told once, by the question: no card of any kind sits beside it (the header's "Waiting for you" is the work's, not a card).
  await expect(frame.locator(".chat-card")).toHaveCount(0);
  await expect(frame.getByText(/Permission|Robot check/u)).toHaveCount(0);
  const box = frame.getByRole("textbox", { name: "Your answer" });
  await expect(box).toBeVisible();
  await box.click();
  await page.keyboard.type("The lamp");
  await picture(frame, testInfo, "text-question-typed");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("in the first row");
  await page.keyboard.press("Enter");
  await expect(frame.getByText("You answered.")).toBeVisible();
  expect((await answersOf(page)).map(({ kind, value }: any) => [kind, value])).toEqual([["text", "The lamp\nin the first row"]]);
  await workGoesOn(page);
  await picture(frame, testInfo, "text-question-answered");
});

test("auction-marketplace: a confirmation that takes a PIN says where to answer it, and is never a dead end", async ({ openHarness, page }, testInfo) => {
  await openHarness("auction-marketplace");
  const frame = await open(page, panelEntry({ text: PANEL_COMMAND, ask: commandAsk }, "sidepanel"));
  await expect(frame.getByText("Answer this in FluxIQ.", { exact: true })).toBeVisible();
  await expect(frame.getByText("This panel can't take your PIN.")).toBeVisible();
  await expect(button(frame, "Confirm")).toHaveCount(0);
  await expect(frame.getByRole("dialog")).toHaveCount(0);
  expect(await fits(page)).toBe(true);
  await picture(frame, testInfo, "confirmation-goes-to-fluxiq");
  await frame.locator(".turn-ask").getByRole("button", { name: "Open FluxIQ" }).click();
  await expect.poll(() => page.frame({ name: "panel-frame" })!.evaluate(() => (window as unknown as { __messages: Array<{ type: string }> }).__messages.filter((message) => message.type === "fluxiq.panel.openFluxIQ").length)).toBe(1);
  expect(await answersOf(page), "opening FluxIQ answers nothing").toEqual([]);
  await button(frame, "Cancel").click();
  await expect(frame.getByText("You said no.")).toBeVisible();
  await picture(frame, testInfo, "confirmation-cancelled");
});

test("auction-marketplace: on the popup at 380 x 580 a person-only check says the window closes, and reopening shows the same question", async ({ openHarness, page }, testInfo) => {
  await openHarness("auction-marketplace");
  const size = { width: 380, height: 580 };
  const entry = panelEntry({ text: CHECK, ask: personAsk, headline: CHECK_WORDS, detail: CHECK, title: CHECK_TITLE }, "popup");
  const frame = await open(page, entry, size);
  await expect(frame.getByText("This window closes when you click the page. Press the FluxIQ button to come back and press Continue.")).toBeVisible();
  await expect(button(frame, "Continue")).toBeInViewport();
  expect(await fits(page)).toBe(true);
  await picture(frame, testInfo, "popup-person-check");
  // Closing and reopening the popup is a new panel over the same question, which is Core's.
  await page.reload();
  const again = await open(page, entry, size);
  await expect(again.getByText(CHECK, { exact: true })).toBeVisible();
  await expect(button(again, "Continue")).toBeEnabled();
  await picture(again, testInfo, "popup-reopened");
});
