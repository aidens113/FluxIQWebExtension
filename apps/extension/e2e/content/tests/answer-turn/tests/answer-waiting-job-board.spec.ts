// Headed, provider-free look at the budget-out turn, the waiting turns and the work header on the job-board
// scenario. The chat is the real one over a scripted background and a scripted results port.
import { expect, test } from "../../../index.js";
import { buildAnswerChatBundle, mountNamed, openChatRail, pushActivity, sentOf, type AnswerBundle } from "../answer-chat-page.js";

let bundle: AnswerBundle;
test.beforeAll(async () => {
  bundle = await buildAnswerChatBundle();
});

type Win = {
  __mount(config: unknown): Promise<void>;
  __outcomes(names: string[], site: string): unknown[];
  __work(options: unknown): unknown;
  __activity: unknown;
  __push(message: unknown): void;
  __port: { calls: Array<{ method: string; query: Record<string, unknown> }> };
};

const MOUNT = { width: 420, height: 720 };

test("job-board: budget out offers one action, Add ... and carry on, and the turn updates", async ({ openHarness, page }, testInfo) => {
  await openHarness("job-board");
  const site = (await page.title()) || "the job board";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  await mountNamed(frame, site, "budgetOutPartial", { request: "Find the newest jobs" });
  await expect(locator.locator(".answer-turn")).toHaveAttribute("data-kind", "budget_out");
  const add = locator.locator('[data-action="add-budget"]');
  await expect(add).toHaveCount(1);
  await expect(add).toHaveText("Add $5.00 and carry on");
  await page.screenshot({ path: testInfo.outputPath("budget-out.png") });
  await add.click();
  await expect.poll(() => frame.evaluate(() => (window as unknown as Win).__port.calls.filter((call) => call.method === "addBudgetAndCarryOn").map((call) => call.query))).toEqual([{ projectId: "project-1", attemptId: "attempt-listings-1", addUsd: 5 }]);
  // The attempt is working again, so the thread has no answer to show: the turn updates away.
  await expect(locator.locator(".answer-turn")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("budget-out-after-add.png") });
});

test("job-board: waiting for permission, waiting for a person-only check, stuck in a loop", async ({ openHarness, page }, testInfo) => {
  await openHarness("job-board");
  const site = (await page.title()) || "the job board";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  for (const [name, headline] of [["waitingForPermission", "Waiting for your permission"], ["waitingForPerson", "Waiting for you"]] as const) {
    await mountNamed(frame, site, name, { request: "Apply to the first job" });
    await expect(locator.locator(".answer-headline")).toHaveText(headline);
    // No action of its own to press: only the plain "What I did" may be there.
    for (const action of ["keep-going", "tell-more", "stop", "run-again", "add-budget"]) await expect(locator.locator(`[data-action="${action}"]`)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`waiting-${name}.png`) });
  }
  // Stuck in a loop: three buttons, each doing its own thing.
  await mountNamed(frame, site, "stuckInALoop", { request: "Collect every listing" });
  await expect(locator.locator(".answer-headline")).toHaveText("I keep getting stuck on this");
  await expect(locator.locator(".answer-turn button")).toHaveText(["Keep going", "Tell it more", "Stop", "What I did"]);
  await page.screenshot({ path: testInfo.outputPath("waiting-stuckInALoop.png") });

  await locator.locator('[data-action="keep-going"]').click();
  await expect.poll(async () => (await sentOf(frame, "fluxiq.panel.conversationSend")).map((message) => message.text)).toEqual(["Keep going."]);
  await expect(locator.locator(".chat-entry", { hasText: "Keep going." })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("waiting-stuck-after-keep-going.png") });

  await locator.locator('[data-action="tell-more"]').click();
  await expect(locator.locator("#conversationInput")).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("waiting-stuck-tell-it-more-focus.png") });

  await locator.locator('[data-action="stop"]').click();
  await expect.poll(async () => (await sentOf(frame, "fluxiq.panel.stopRun")).length).toBe(1);
  expect((await sentOf(frame, "fluxiq.panel.stopRun"))[0]).toMatchObject({ projectId: "project-1" });
});

test("job-board: the work header while working, with a clock, one Stop, and no cost where spend is not real", async ({ openHarness, page }, testInfo) => {
  await openHarness("job-board");
  await page.clock.install();
  const site = (await page.title()) || "the job board";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  const STEPS = [
    { kind: "thought", title: "Reading the job list", text: "I need the newest listings, so I am opening the results page first." },
    { kind: "tool", title: "Clicking “Newest first”", text: "Result: tool.ok", status: "succeeded" },
    { kind: "thought", title: "Checking the order", text: "The dates now run from newest to oldest, so I can read the rows." }
  ];
  const workingOutcome = async (reportsSpend: boolean) => {
    await frame.evaluate(async ({ site, reportsSpend, steps }) => {
      const win = window as unknown as Win;
      const outcomes = win.__outcomes(["working"], site) as Array<{ attempt: { startedAtMs: number } }>;
      outcomes[0]!.attempt.startedAtMs = Date.now() - 72_000;
      await win.__mount({ outcomes, ...(reportsSpend ? {} : { reportsSpend: false }), request: "Find the newest jobs",
        activity: win.__work({ agoMs: 72_000, steps, headline: "Working on your task", detail: "Reading the job list" }) });
    }, { site, reportsSpend, steps: STEPS });
  };
  await workingOutcome(true);
  const header = locator.locator(".chat-work-header");
  await expect(header).toBeVisible();
  await expect(locator.locator(".chat-work-label")).toHaveText("Working");
  await expect(locator.locator(".chat-work-time")).toHaveText(/^1m 1[2-9]s$/);
  await expect(locator.locator(".chat-work-cost")).toHaveText("$0.34 of $5.00");
  await expect(locator.locator(".chat-stop")).toHaveCount(1);
  await expect(locator.locator(".chat-stop")).toBeVisible();
  const wholeLine = (await header.innerText()).replace(/\s+/g, " ").trim();
  expect(wholeLine).toMatch(/^Working ·? ?1m 1\d?s? ?·? ?\$0\.34 of \$5\.00/);
  await page.screenshot({ path: testInfo.outputPath("work-header-working.png") });
  await header.screenshot({ path: testInfo.outputPath("work-header-working-strip.png") });
  // The clock moves: a minute later the time has moved on and there is still one Stop.
  await page.clock.fastForward(60_000);
  await expect(locator.locator(".chat-work-time")).toHaveText(/^2m 1[2-9]s$/);
  await expect(locator.locator(".chat-stop")).toHaveCount(1);
  // A push of the same work (a new render) keeps one Stop.
  await pushActivity(frame);
  await page.clock.fastForward(1_000);
  await expect(locator.locator(".chat-stop")).toHaveCount(1);
  // Each step message stays visible, in the open, with its reasoning.
  await expect(locator.locator(".chat-step-line")).toHaveCount(2);
  await expect(locator.locator(".chat-card")).toHaveCount(1);
  for (const text of ["I need the newest listings, so I am opening the results page first.", "The dates now run from newest to oldest, so I can read the rows."]) {
    await expect(locator.locator(".chat-step-text", { hasText: text })).toBeVisible();
  }
  const folded = await frame.evaluate(() => Array.from(document.querySelectorAll(".chat-step-line")).filter((line) => line.closest("details:not([open])") !== null).length);
  expect(folded, "no step message sits in a closed fold").toBe(0);
  await page.screenshot({ path: testInfo.outputPath("work-header-working-steps.png") });

  // Where the port's spend is not real, there is no cost segment at all.
  await workingOutcome(false);
  await expect(locator.locator(".chat-work-label")).toHaveText("Working");
  await expect(locator.locator(".chat-work-cost")).toHaveText("");
  expect(await locator.locator(".chat-work-header").innerText()).not.toContain("$");
  await expect(locator.locator(".chat-stop")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("work-header-no-cost.png") });
});

test("job-board: the work header while waiting names what it waits for and offers Show the question", async ({ openHarness, page }, testInfo) => {
  await openHarness("job-board");
  const site = (await page.title()) || "the job board";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  await frame.evaluate(async (site) => {
    const win = window as unknown as Win;
    // A run started from the Automations tab asks in its own thread, which this chat does not show.
    await win.__mount({ outcomes: win.__outcomes(["waitingForPerson"], site), request: "Apply to the first job",
      activity: win.__work({ kind: "run", flowId: "flow-7", conversationId: null, agoMs: 95_000, waiting: true, phase: "waiting_permission",
        headline: "Waiting for you: finish the check on the page", detail: "FluxIQ needs you: complete the check on this page, then press Continue.",
        steps: [{ kind: "thought", title: "Applying", text: "The page asks for a check that only a person can finish." }] }) });
  }, site);
  await expect(locator.locator(".chat-work-label")).toHaveText("Waiting for you");
  await expect(locator.locator(".chat-work-now")).toHaveText("Finish the check on the page");
  await expect(locator.locator(".chat-work-action")).toHaveText("Show the question");
  await expect(locator.locator(".chat-work-action")).toBeVisible();
  await expect(locator.locator(".chat-stop")).toHaveCount(1);
  await expect(locator.locator(".chat-stop")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("work-header-waiting.png") });
});

test("job-board: a budget-out that already did something on the site gives way to Add budget and carry on alone", async ({ openHarness, page }, testInfo) => {
  await openHarness("job-board");
  const site = (await page.title()) || "the job board";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  await frame.evaluate(async (site) => {
    const win = window as unknown as Win;
    const outcomes = win.__outcomes(["budgetOutPartial"], site) as Array<{ result: { acts: unknown[] } }>;
    outcomes[0]!.result.acts = [{ id: "act-1", what: "Saved the Rust engineer job", where: "the job board", classes: ["create_new"], state: "landed" }];
    await win.__mount({ outcomes, request: "Find the newest jobs" });
  }, site);
  await expect(locator.locator('[data-action="add-budget"]')).toHaveCount(1);
  await expect(locator.locator('[data-action="run-again"]')).toHaveCount(0);
  await expect(locator.locator(".answer-site-list")).toContainText("Saved the Rust engineer job");
  await page.screenshot({ path: testInfo.outputPath("budget-out-did-something.png") });
});
