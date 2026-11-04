// Headed, provider-free walk of the whole product as a person would, on the social-network-feed scenario, as the
// side panel at 360 px and as Firefox's popup at 380 x 580: first open and setup, the missing key, the first task with
// its questions, the answer, Automations (Tasks and Library, one search), a subflow run, "Show me how", and Settings.
// The panel is the real one (`mountPanel`) over a scripted background and every port faked (`journey-panel.ts`).
// Pictures go to the folder named by FLUXIQ_JOURNEY_PICTURES, per engine and surface (else the run's output folder).
import { expect, test } from "../../../index.js";
import type { Frame, Page, TestInfo } from "@playwright/test";
import { bundlePanel, mountPanelFrame, type PanelBundle } from "../panel-frame.js";

const SURFACES = [
  { surface: "sidepanel", title: "side panel at 360 px", size: { width: 360, height: 720 } },
  { surface: "popup", title: "popup at 380 x 580", size: { width: 380, height: 580 } }
] as const;
const TASK = "List the latest posts from the people I follow";
const DESCRIPTION = "Open a profile and follow it";
const bundles = new Map<string, PanelBundle>();
test.beforeAll(async () => {
  for (const { surface } of SURFACES) bundles.set(surface, await bundlePanel(`import { startJourneyPanel } from "./e2e/content/tests/screens/journey-panel";\nstartJourneyPanel("${surface}");`));
});

type World = { sent: Array<{ type: string; text?: string }> };
type Win = { __show(name: string): void; __setKey(key: string): void; __scene(name: string): void; __world(): World };

const focusName = (child: Frame) => child.evaluate(() => {
  const active = document.activeElement as HTMLElement | null;
  const name = active ? (active.getAttribute("aria-label") ?? active.textContent ?? active.id).trim().replace(/\s+/g, " ") : "";
  return name.length > 40 ? `${name.slice(0, 40)}...` : name;
});
const focusKept = (child: Frame) => child.evaluate(() => document.activeElement !== null && document.activeElement !== document.body);

/** Tab from the top bar through everything and say which visible controls were never reached. */
async function sweepOf(page: Page, child: Frame): Promise<{ order: string[]; missed: string[] }> {
  await child.evaluate(() => (document.querySelector("#panelTab-chat") as HTMLElement).focus());
  const order: string[] = [];
  for (let step = 0; step < 80; step++) {
    const first = await child.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const seen = element.hasAttribute("data-reached");
      element.setAttribute("data-reached", "1");
      return seen;
    });
    if (first) break;
    order.push(await focusName(child));
    await page.keyboard.press("Tab");
  }
  const missed = await child.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("button, input, textarea, select, a[href], summary, [tabindex]"))
    .filter((element) => !element.hasAttribute("data-reached") && !(element as HTMLButtonElement).disabled && element.getAttribute("tabindex") !== "-1" && element.checkVisibility() && !element.closest("[hidden], [inert]"))
    .map((element) => element.id || (element.getAttribute("aria-label") ?? element.textContent ?? element.className).trim().replace(/\s+/g, " ").slice(0, 50)));
  await child.evaluate(() => document.querySelectorAll("[data-reached]").forEach((element) => element.removeAttribute("data-reached")));
  return { order, missed };
}

for (const { surface, title, size } of SURFACES) {
  test(`social-network-feed: the whole journey, ${title}`, async ({ openHarness, page, browserName }, testInfo: TestInfo) => {
    test.setTimeout(240_000);
    await openHarness("social-network-feed");
    const { frame, child } = await mountPanelFrame(page, bundles.get(surface)!, size);
    let count = 0;
    const folder = process.env.FLUXIQ_JOURNEY_PICTURES;
    const shot = async (name: string) => {
      count += 1;
      const file = `${String(count).padStart(2, "0")}-${name}.png`;
      await frame.locator("#app").screenshot({ path: folder === undefined ? testInfo.outputPath(file) : `${folder}/${browserName}-${surface}/${file}` });
    };
    const fits = () => child.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const tab = (name: string) => frame.locator(`#panelTab-${name}`).click();
    const world = () => child.evaluate(() => (window as unknown as Win).__world());
    const input = frame.locator("#conversationInput");

    // 1. First open, not connected: five steps, Connect, the approval code, connected.
    await expect(frame.locator(".start-step:not([hidden])")).toHaveCount(5);
    expect(await fits(), "setup fits").toBe(true);
    await shot("setup-five-steps");
    await frame.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(frame.locator("#pairingReferenceCode")).toHaveText("482913");
    expect(await fits()).toBe(true);
    await shot("setup-waiting-for-approval");
    await child.evaluate(() => (window as unknown as Win).__show("idle"));

    // 2. Key missing: the card above the chat; Open FluxIQ; then the key arrives and the card goes by itself.
    const card = frame.locator(".setup-card");
    await expect(card).toBeVisible();
    await expect(input).toBeVisible();
    await shot("key-missing-card");
    await card.getByRole("button", { name: "Open FluxIQ" }).click();
    await child.evaluate(() => {
      (window as unknown as Win).__setKey("ready");
      window.dispatchEvent(new Event("focus"));
    });
    await expect(card).toBeHidden({ timeout: 10_000 });
    await shot("key-arrived-empty-chat");

    // 3. Type a task; the first reply and the work header; a permission (one press); a person-only check; one Stop.
    await input.click();
    await page.keyboard.type(TASK);
    await input.press("Enter");
    await expect(frame.getByText("I'll open your feed")).toBeVisible();
    await expect(frame.locator(".chat-work-now")).toBeVisible();
    await shot("task-sent-work-header");
    await child.evaluate(() => (window as unknown as Win).__scene("permission"));
    await expect(frame.getByText('Allow FluxIQ to press "Follow"?')).toBeVisible();
    await shot("permission-ask");
    await frame.getByRole("button", { name: "Allow", exact: true }).click();
    await expect(frame.getByText("You allowed this.")).toBeVisible();
    await child.evaluate(() => {
      (window as unknown as Win).__scene("work");
      (window as unknown as Win).__scene("check");
    });
    await expect(frame.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await expect(frame.getByText("FluxIQ needs you: complete the check on this page, then press Continue.", { exact: true })).toHaveCount(1);
    await expect(frame.getByRole("button", { name: "Stop", exact: true }).locator("visible=true")).toHaveCount(1);
    expect(await fits()).toBe(true);
    await shot("person-check");
    await frame.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(frame.getByText("Done. You pressed Continue.")).toBeVisible();

    // 4. The answer turn, drawn in the chat by the real adapter from a run's push.
    await child.evaluate(() => (window as unknown as Win).__scene("done"));
    await expect(frame.locator(".answer-turn")).toHaveCount(1, { timeout: 15_000 });
    await expect(frame.locator(".answer-turn")).toContainText("3 rows");
    expect(await fits()).toBe(true);
    await frame.locator(".answer-turn").scrollIntoViewIfNeeded();
    await shot("answer-turn");

    // 5. Automations: one search reaching both segments, a task interrupted, a task out of budget.
    await tab("automations");
    const search = frame.getByRole("searchbox", { name: "Search tasks, automations and subflows" });
    await expect(search).toBeVisible();
    await expect(frame.getByRole("button", { name: "Library", exact: true })).toBeVisible();
    await shot("automations-tasks");
    await search.fill("order");
    await expect(frame.getByRole("button", { name: /^Library, \d+ match/u })).toBeVisible();
    await expect(frame.locator(".task-row")).toHaveCount(1);
    await shot("search-order-reaches-both");
    await frame.getByRole("button", { name: /^Library/u }).click();
    await expect(frame.getByText("Order notebooks again")).toBeVisible();
    await shot("search-order-in-library");
    await search.fill("");
    await frame.getByRole("button", { name: /^Tasks/u }).click();
    await frame.locator(".task-row", { hasText: "saved searches" }).click();
    await expect(frame.getByRole("button", { name: "Carry on" })).toBeVisible();
    await shot("task-interrupted");
    await frame.getByRole("button", { name: "Carry on" }).click();
    await expect(frame.locator(".task-state")).toHaveText("Working");
    await frame.getByRole("button", { name: "Back to tasks" }).click();
    expect(await focusKept(child), "focus is kept coming back from a task").toBe(true);
    await frame.locator(".task-row", { hasText: "bikes category" }).click();
    await expect(frame.getByRole("button", { name: /^Add \$5\.00 and carry on/u })).toBeVisible();
    await shot("task-budget-out");
    await frame.getByRole("button", { name: /^Add \$5\.00 and carry on/u }).click();
    await expect(frame.locator(".task-state")).toHaveText("Working");
    await frame.getByRole("button", { name: "Back to tasks" }).click();

    // 6. Library: a site subflow that calls a smaller one, details, a run with inputs, Ask about it.
    await frame.getByRole("button", { name: /^Library/u }).click();
    await expect(frame.getByText("paperworks.example")).toBeVisible();
    expect(await fits()).toBe(true);
    await shot("library-tree");
    await frame.getByRole("button", { name: /^Order notebooks again/u }).click();
    await expect(frame.getByText("Add an item to the basket").first()).toBeVisible();
    await shot("library-details");
    await frame.getByRole("button", { name: "Run", exact: true }).click();
    await frame.getByLabel("How many (required)").fill("2");
    await shot("library-run-inputs");
    await frame.getByRole("button", { name: "Run", exact: true }).click();
    await frame.getByRole("button", { name: "Allow it to spend money and create new things this once" }).click();
    await expect(frame.getByText("It finished.")).toBeVisible();
    await shot("library-run-finished");
    await frame.getByRole("button", { name: "Ask about it" }).first().click();
    await expect(frame.locator("#panelTab-chat")).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveValue(/Order notebooks again/u);
    await expect(input, "the caret is in the box, ready to type").toBeFocused();
    expect((await world()).sent.filter((sent) => sent.text?.includes("Order notebooks")), "nothing is sent").toHaveLength(0);
    await shot("ask-about-it-composer");
    await input.fill("");

    // 7. Show me how: record, stop, the chip, send.
    await frame.getByRole("button", { name: "Start recording" }).click();
    await frame.getByLabel("Recording description").fill(DESCRIPTION);
    await shot("recording-question");
    await frame.getByRole("button", { name: "Start described recording" }).click();
    await expect(frame.locator("#stopRecordingButton")).toBeVisible();
    await shot("recording-running");
    await frame.locator("#stopRecordingButton").click();
    await expect(frame.locator(".composer-chip")).toContainText(DESCRIPTION, { timeout: 15_000 });
    await shot("recording-chip");
    await input.fill("Follow the accounts this recording follows");
    await input.press("Enter");
    await expect(frame.locator(".composer-chip")).toBeHidden();
    await shot("recording-sent");

    // 8. Settings, then Advanced.
    await frame.getByRole("button", { name: "Settings" }).click();
    await expect(frame.locator(".settings-screen")).toContainText("Connected to FluxIQ");
    await shot("settings-top");
    await frame.locator(".settings-advanced > summary").click();
    await frame.locator(".settings-advanced").scrollIntoViewIfNeeded();
    await expect(frame.getByLabel("FluxIQ connection address", { exact: true })).toBeVisible();
    await frame.locator(".settings-screen").evaluate((screen) => screen.scrollTo(0, screen.scrollHeight));
    expect(await fits()).toBe(true);
    await shot("settings-advanced");
  });
}

test("social-network-feed: one tab order reaches every control, and focus is kept when a screen changes", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  await openHarness("social-network-feed");
  const { frame, child } = await mountPanelFrame(page, bundles.get("sidepanel")!, { width: 360, height: 720 });
  await child.evaluate(() => {
    (window as unknown as Win).__setKey("ready");
    (window as unknown as Win).__show("idle");
  });
  await expect(frame.locator("#conversationInput")).toBeVisible();
  const report: string[] = [];
  const sweep = async (name: string) => {
    const { order, missed } = await sweepOf(page, child);
    report.push(`${name}: ${order.join(" > ")}${missed.length > 0 ? ` | NOT REACHED: ${missed.join(", ")}` : ""}`);
    expect(missed, `${name}: unreachable by Tab. ${report.join("\n")}`).toEqual([]);
  };
  await sweep("chat");
  await frame.locator("#panelTab-automations").click();
  expect(await focusKept(child), "focus kept after the tab changed").toBe(true);
  await sweep("tasks");
  await frame.getByRole("button", { name: /^Library/u }).click();
  await sweep("library");
  await frame.getByRole("button", { name: /^Order notebooks again/u }).click();
  expect(await focusKept(child), "focus kept opening a subflow").toBe(true);
  await sweep("subflow details");
  await frame.getByRole("button", { name: "Settings" }).click();
  expect(await focusKept(child), "focus kept opening settings").toBe(true);
  await sweep("settings");
  await frame.locator(".settings-advanced > summary").click();
  await sweep("settings, Advanced open");
  console.log(report.join("\n"));
});
