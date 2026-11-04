// Headed, provider-free look at what was saved and at the second attempt, on the bigbox-retail scenario at
// 360 px: the first attempt and its saved line; a second working from what it saved (the header's line,
// the line at the start of its steps, each step marked where the records prove it); the second finished with
// its comparison; a repair and a part-explore path; a budget-out with its saved line; a slower second attempt.
// The chat is the real one over a scripted background and Core's fake results port. No provider, no real site.
import { expect, test } from "../../../index.js";
import type { Frame, FrameLocator } from "@playwright/test";
import { buildAnswerChatBundle, openChatRail, type AnswerBundle } from "../../answer-turn/answer-chat-page.js";

let bundle: AnswerBundle;
test.beforeAll(async () => {
  bundle = await buildAnswerChatBundle();
});

const MOUNT = { width: 360, height: 780 };

type Scene = {
  /** Which attempts the thread holds: the first, and a second on this path. */
  second?: { path: "run_flow" | "run_flow_then_repair" | "run_flow_then_explore"; working?: boolean; ms?: number; usd?: number };
  /** Steps of the second attempt: run steps only, or run steps then the model working things out again. */
  steps?: "run" | "run_then_model";
  /** A named fake outcome shown alone (the first attempt, a budget-out). */
  only?: string;
  reportsSpend?: false;
};

type Win = { __mount(config: unknown): Promise<void>; __outcomes(names: string[], site: string): unknown[]; __port: { calls: Array<{ method: string }> } };

/** Draws the scene: Core's fake outcomes moved so the first attempt is three days old and the second two. */
async function mountScene(frame: Frame, site: string, scene: Scene): Promise<void> {
  await frame.evaluate(async ({ site, scene }) => {
    const win = window as unknown as Win;
    const DAY = 86_400_000;
    const now = Date.now();
    const delta = now - 3 * DAY - 1_800_000_000_000;
    const shift = (value: Record<string, unknown>): void => {
      for (const key of Object.keys(value)) {
        const inner = value[key];
        if (/AtMs$/.test(key) && typeof inner === "number") value[key] = inner + delta;
        else if (inner !== null && typeof inner === "object") shift(inner as Record<string, unknown>);
      }
    };
    const names = scene.only !== undefined ? [scene.only] : scene.second === undefined ? ["rowsChecked"] : ["rowsChecked", "secondAttemptFromSaved"];
    const outcomes = win.__outcomes(names, site) as Array<Record<string, any>>;
    outcomes.forEach((outcome) => shift(outcome));
    let activity: unknown;
    const second = scene.second === undefined ? undefined : outcomes[1];
    if (second !== undefined && scene.second !== undefined) {
      second.attempt.path = scene.second.path;
      if (scene.second.ms !== undefined) second.attempt.spend.ms = scene.second.ms;
      if (scene.second.usd !== undefined) second.attempt.spend.usd = scene.second.usd;
      second.attempt.endedAtMs = second.attempt.startedAtMs + (scene.second.ms ?? 18_000);
      if (scene.second.working === true) {
        second.attempt.status = "working";
        second.attempt.startedAtMs = now - 25_000;
        delete second.attempt.endedAtMs;
        delete second.result;
      }
      const start = second.attempt.startedAtMs as number;
      const subject = (kind: string, id: string) => ({ kind, id, projectId: "project-1", flowId: "flow-deals" });
      const event = (activityId: string, kind: string, sequence: number, offset: number, detail: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
        activityId, sequence, subject: subject(kind, activityId), conversationId: "conv-latest", phase: kind === "run" ? "running" : "repairing",
        label: String(detail.title), at: new Date(start + offset).toISOString(), detail, ...extra
      });
      const run = (sequence: number, offset: number, title: string, index: number) =>
        event("run-2", "run", sequence, offset, { kind: "step", title, status: "succeeded", ref: `n${index}` }, { step: { index, count: 4, label: title } });
      const events: unknown[] = [run(1, 1_000, "Open the deals page", 1), run(2, 4_000, "Search for kettles", 2)];
      if (scene.steps === "run_then_model") {
        events.push(event("build-2", "build", 3, 7_000, { kind: "thought", title: "Reading the price filter", text: "The filter moved since last time, so I am finding it again.", status: "succeeded", ref: "t3" }));
      } else {
        events.push(run(3, 7_000, "Read the list", 3), run(4, 10_000, "Check the rows", 4));
      }
      const last = events.at(-1) as Record<string, any>;
      if (scene.second.working === true) {
        const display = { activityId: last.activityId, subjectKind: last.subject.kind, phase: last.phase, headline: "Working on your task", detail: "Reading the list", step: { index: 3, count: 4 },
          working: true, outcome: null, sequence: last.sequence };
        activity = { current: last, display, recent: events, history: events, overlay: "expanded", live: true };
      } else {
        last.final = true;
        activity = { current: last, display: null, recent: events, history: events, overlay: "expanded", live: true };
      }
    }
    await win.__mount({ outcomes, request: "Find the best kettle deals", ...(scene.reportsSpend === false ? { reportsSpend: false } : {}), ...(activity === undefined ? {} : { activity }) });
  }, { site, scene });
}

const text = async (locator: FrameLocator, selector: string): Promise<string[]> => locator.locator(selector).allInnerTexts();

test("bigbox-retail: the first attempt says what it saved, once, and nothing about a second try", async ({ openHarness, page }, testInfo) => {
  await openHarness("bigbox-retail");
  const site = (await page.title()) || "the store";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  await mountScene(frame, site, {});
  await expect(locator.locator(".answer-turn")).toHaveAttribute("data-kind", "rows");
  await expect(locator.locator(".answer-saved")).toHaveCount(1);
  await expect(locator.locator(".answer-saved")).toHaveText(/^Saved (today|yesterday|[A-Z][a-z]+day|\d+ [A-Z][a-z]{2}): the steps\. They only partly work, so next time I will fix what changed\.$/);
  await expect(locator.locator('[data-line="how"]')).toHaveCount(0);
  await expect(locator.locator('[data-line="compared"]')).toHaveCount(0);
  await expect(locator.locator(".chat-step-origin:visible")).toHaveCount(0);
  await expect(locator.locator(".chat-work-saved:visible")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("first-attempt-saved.png") });
});

test("bigbox-retail: the second attempt working from saved steps says so in the header and at the start of its steps, and marks them", async ({ openHarness, page }, testInfo) => {
  await openHarness("bigbox-retail");
  const site = (await page.title()) || "the store";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  await mountScene(frame, site, { second: { path: "run_flow", working: true }, steps: "run" });
  await expect(locator.locator(".chat-work-header")).toBeVisible();
  await expect(locator.locator(".chat-work-saved")).toHaveText(/^Using what I saved from [A-Z][a-z]+day\.$/);
  await expect(locator.locator(".chat-step-using:visible")).toHaveCount(1);
  await expect(locator.locator(".chat-step-using:visible")).toHaveText(/^Using what I saved from [A-Z][a-z]+day\.$/);
  await expect(locator.locator(".chat-step-origin:visible")).toHaveText(["From saved steps"]);
  // Each step stays in the open with its card, and the working attempt has no answer yet.
  await expect(locator.locator(".chat-card")).toHaveCount(4);
  await expect(locator.locator(".answer-turn")).toHaveCount(1);
  await expect(locator.locator(".chat-stop")).toBeVisible();
  const fits = await frame.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(fits, "nothing overflows sideways at 360 px").toBe(true);
  await page.screenshot({ path: testInfo.outputPath("second-working-run-flow.png") });
});

test("bigbox-retail: the second attempt finished says how it went and the comparison, with the keyboard reaching its buttons", async ({ openHarness, page }, testInfo) => {
  await openHarness("bigbox-retail");
  const site = (await page.title()) || "the store";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  await mountScene(frame, site, { second: { path: "run_flow" }, steps: "run" });
  const second = locator.locator('.answer-turn[data-attempt-id="attempt-deals-2"]');
  await expect(second.locator('[data-line="how"]')).toHaveText("Used what I saved. No steps had to be worked out again.");
  await expect(second.locator('[data-line="compared"]')).toHaveText("This time 18s and $0.00. First time 3m 14s and $1.12.");
  await expect(second.locator(".answer-saved")).toHaveText(/^Saved [A-Z][a-z]+day: the steps\. They worked last time\.$/);
  await expect(locator.locator(".chat-step-using:visible")).toHaveCount(1);
  await expect(locator.locator(".chat-step-origin:visible")).toHaveText(["From saved steps"]);
  await second.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("second-finished.png") });
  // Keyboard: Tab reaches each of the answer's buttons in order, each shows a focus ring, and Enter presses Run again.
  const names = ["CSV", "JSON"];
  await second.locator('[data-action="export-csv"]').focus();
  const seen: string[] = [];
  for (let step = 0; step < 4; step += 1) {
    const state = await frame.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return { action: active?.getAttribute("data-action") ?? "", outline: active ? getComputedStyle(active).outlineStyle : "none", inAnswer: active?.closest('.answer-turn[data-attempt-id="attempt-deals-2"]') !== null };
    });
    expect(state.inAnswer).toBe(true);
    expect(state.outline, `${state.action} shows where focus is`).not.toBe("none");
    seen.push(state.action);
    await page.keyboard.press("Tab");
  }
  expect(seen.slice(0, 2)).toEqual(["export-csv", "export-json"]);
  expect(names).toHaveLength(2);
  expect(seen).toContain("what-i-did");
  await second.locator('[data-action="run-again"]').focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => frame.evaluate(() => (window as unknown as Win).__port.calls.filter((call) => call.method === "runAgain").length)).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("second-finished-after-run-again.png") });
});

test("bigbox-retail: a run that fixed a step, and a run that worked out the rest, say only what the path proves", async ({ openHarness, page }, testInfo) => {
  await openHarness("bigbox-retail");
  const site = (await page.title()) || "the store";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  for (const [path, how] of [
    ["run_flow_then_repair", "Used what I saved, and fixed a step that had changed."],
    ["run_flow_then_explore", "Used what I saved as far as it went, then worked out the rest."]
  ] as const) {
    await mountScene(frame, site, { second: { path }, steps: "run_then_model" });
    const second = locator.locator('.answer-turn[data-attempt-id="attempt-deals-2"]');
    await expect(second.locator('[data-line="how"]')).toHaveText(how);
    expect(await text(locator, '.answer-turn[data-attempt-id="attempt-deals-2"] .answer-line')).not.toContain("fixed 1");
    await expect(locator.locator(".chat-step-origin:visible")).toHaveText(["From saved steps", "Worked out again"]);
    await expect(locator.locator(".chat-step-using:visible")).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath(`second-${path}.png`) });
  }
});

test("bigbox-retail: a budget-out says what it saved in the same words, or that nothing is saved", async ({ openHarness, page }, testInfo) => {
  await openHarness("bigbox-retail");
  const site = (await page.title()) || "the store";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  await mountScene(frame, site, { only: "budgetOutPartial" });
  await expect(locator.locator(".answer-turn")).toHaveAttribute("data-kind", "budget_out");
  await expect(locator.locator(".answer-saved")).toHaveText(/^Saved (today|yesterday|[A-Z][a-z]+day|\d+ [A-Z][a-z]{2}): the steps\. They only partly work, so next time I will fix what changed\.$/);
  await page.screenshot({ path: testInfo.outputPath("budget-out-saved.png") });
  await frame.evaluate(async (site) => {
    const win = window as unknown as Win;
    const outcomes = win.__outcomes(["budgetOutPartial"], site) as Array<Record<string, unknown>>;
    delete outcomes[0]!.saved;
    await win.__mount({ outcomes, request: "Find the best kettle deals" });
  }, site);
  await expect(locator.locator(".answer-saved")).toHaveText("Nothing saved yet.");
  await page.screenshot({ path: testInfo.outputPath("budget-out-nothing-saved.png") });
});

test("bigbox-retail: a slower, dearer second attempt is told in numbers, with no boast", async ({ openHarness, page }, testInfo) => {
  await openHarness("bigbox-retail");
  const site = (await page.title()) || "the store";
  const { frame, locator } = await openChatRail(page, bundle, MOUNT);
  await mountScene(frame, site, { second: { path: "run_flow_then_repair", ms: 400_000, usd: 2.5 }, steps: "run_then_model" });
  const second = locator.locator('.answer-turn[data-attempt-id="attempt-deals-2"]');
  await expect(second.locator('[data-line="compared"]')).toHaveText("This time 6m 40s and $2.50. First time 3m 14s and $1.12.");
  const told = [...(await text(locator, '.answer-turn[data-attempt-id="attempt-deals-2"] [data-line="how"]')), ...(await text(locator, '.answer-turn[data-attempt-id="attempt-deals-2"] [data-line="compared"]')), ...(await text(locator, '.answer-turn[data-attempt-id="attempt-deals-2"] .answer-saved'))];
  expect(told).toHaveLength(3);
  expect(told.join(" ")).not.toMatch(/faster|quicker|cheaper|better|improv/i);
  await second.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("second-slower.png") });
  // Where the port reports no spend, only time is compared.
  await mountScene(frame, site, { second: { path: "run_flow", ms: 18_000 }, steps: "run", reportsSpend: false });
  await expect(locator.locator('.answer-turn[data-attempt-id="attempt-deals-2"] [data-line="compared"]')).toHaveText("This time 18s. First time 3m 14s.");
});
