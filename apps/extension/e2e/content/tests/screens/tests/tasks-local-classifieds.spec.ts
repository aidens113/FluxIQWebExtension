// Headed, provider-free look at tasks on the local-classifieds scenario, in a 360 px panel, by mouse and by
// keyboard: the list, the search, the details of a task in each state (done, working, interrupted with Carry on,
// out of budget with Add budget, waiting, model key locked), rename, delete, a panel that closed and opened again
// on the same task, an empty list and a failed read. The panel is the real one (`mountPanel`) over a scripted
// background; the tasks come from the package's fake port and memory, which live on the page that holds the
// frame so a second mount reads what the first left. Nothing reaches FluxIQ, a provider or a key.
import { expect, test } from "../../../index.js";
import type { Frame, FrameLocator } from "@playwright/test";
import { bundlePanel, mountPanelFrame, type PanelBundle } from "../panel-frame.js";

type Fake = { port: { failNext(method: string, failure: unknown): void; calls: Array<{ method: string }> }; memory: { open: unknown } };
type Win = { __fake: Fake };

const ENTRY = (tasks: "all" | "none") => `
  import { startScriptedPanel } from "./e2e/content/tests/screens/scripted-panel";
  import { createFakeTasksPort, fakeTasks } from "@fluxiq/ui-components/testing";
  // What the memory holds is plain data on the page that holds the frame, so a second mount reads what the first left
  // (the frame's own window is gone when it closes, and so is anything built in it).
  const host = window.parent as unknown as { __open?: { value?: { projectId: string; taskId: string } } };
  const store = (host.__open ??= {});
  const memory = { read: async () => store.value, write: async (open?: { projectId: string; taskId: string }) => { store.value = open; }, get open() { return store.value; } };
  const port = createFakeTasksPort({ tasks: ${tasks === "all" ? "Object.values(fakeTasks(Date.now()))" : "[]"} });
  (window as unknown as { __fake: unknown }).__fake = { port, memory };
  startScriptedPanel({ surface: "sidepanel", start: "connected", ports: { tasks: { port, results: port.results }, taskMemory: memory } });
`;

let bundle: PanelBundle;
let emptyBundle: PanelBundle;
test.beforeAll(async () => {
  bundle = await bundlePanel(ENTRY("all"));
  emptyBundle = await bundlePanel(ENTRY("none"));
});

const fakeOf = (child: Frame) => child.evaluate(() => {
  const fake = (window as unknown as Win).__fake;
  return { open: fake.memory.open, calls: fake.port.calls.map((call) => call.method) };
});

async function openTab(frame: FrameLocator): Promise<void> {
  await frame.locator("#panelTab-automations").click();
  await expect(frame.getByRole("searchbox", { name: "Search tasks, automations and subflows" })).toBeVisible();
}

const row = (frame: FrameLocator, title: string) => frame.locator(".task-row", { hasText: title });

test("local-classifieds: tasks by mouse, every state drawn and looked at at 360 px", async ({ openHarness, page }, testInfo) => {
  await openHarness("local-classifieds");
  const { frame, child } = await mountPanelFrame(page, bundle, { width: 360, height: 760 });
  const shot = (name: string) => frame.locator("#app").screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await openTab(frame);

  // The list: what needs the person first, then days; a tick only on the one confirmed result.
  await expect(frame.locator(".tasks-group-heading").first()).toHaveText("Needs you");
  await expect(frame.locator(".task-row")).toHaveCount(9);
  await expect(frame.locator(".task-row-mark")).toHaveCount(1);
  await expect(frame.locator(".tasks-screen")).not.toContainText(/failed|flow\b|build\b|judge/iu);
  await expect(frame.locator("#extractDataButton")).toHaveCount(1);
  await shot("1-list");

  // Search over the port's text, after a pause; an unmatched search says so, and clearing brings everything back.
  const search = frame.getByRole("searchbox", { name: "Search tasks, automations and subflows" });
  await search.fill("cheapest");
  await expect(frame.locator(".task-row")).toHaveCount(1);
  await shot("2-search-one");
  await search.fill("zzzz");
  await expect(frame.locator(".tasks-empty")).toHaveText("No tasks match “zzzz”.");
  await shot("3-search-none");
  await search.fill("");
  await expect(frame.locator(".task-row")).toHaveCount(9);

  // Done: where it got to, the answer turn's own card with its tick, the attempts and the comparison.
  await row(frame, "cheapest kettles").click();
  await expect(frame.locator(".task-title")).toHaveText("Find the cheapest kettles on the shop");
  await expect(frame.locator(".task-progress")).toContainText("Finished in 3 steps");
  await expect(frame.locator(".answer-card")).toHaveCount(1);
  await expect(frame.locator(".attempt-compared")).toHaveText("This time 18s and $0.00. First time 3m 14s and $1.12.");
  await expect(frame.locator("#panelTab-chat")).toBeVisible();
  await shot("4-done");
  await frame.getByRole("button", { name: /^Show the steps of the attempt Today/ }).click();
  await expect(frame.locator(".step-kind")).toHaveText(["From saved steps", "Worked out again"]);
  await frame.locator(".steps-area").first().scrollIntoViewIfNeeded();
  await shot("5-done-steps");
  await frame.getByRole("button", { name: "Back to tasks" }).click();
  await expect(row(frame, "cheapest kettles")).toBeFocused();

  // Working.
  await row(frame, "job posts").click();
  await expect(frame.locator(".task-state")).toHaveText("Working");
  await expect(frame.locator(".answer-card")).toHaveCount(0);
  await shot("6-working");
  await frame.getByRole("button", { name: "Back to tasks" }).click();

  // Interrupted: Carry on, once, and then it is working.
  await row(frame, "saved searches").click();
  await expect(frame.locator(".task-state")).toHaveText("Stopped partway. You can carry on.");
  await expect(frame.getByRole("group", { name: "Stopped partway" })).toContainText("you can carry on from there");
  await shot("7-interrupted");
  await frame.getByRole("button", { name: "Carry on" }).click();
  await expect(frame.locator(".task-state")).toHaveText("Working");
  await expect(frame.getByRole("button", { name: "Carry on" })).toHaveCount(0);
  expect((await fakeOf(child)).calls.filter((call) => call === "carryOn")).toHaveLength(1);
  await shot("8-carried-on");
  await frame.getByRole("button", { name: "Back to tasks" }).click();

  // Out of budget: Add budget, in the answer turn's own words, pressed once.
  await row(frame, "bikes category").click();
  await expect(frame.locator(".task-state")).toHaveText("Ran out of budget");
  const add = frame.getByRole("button", { name: "Add $5.00 and carry on" });
  await expect(add).toBeVisible();
  await shot("9-budget-out");
  await add.click();
  await expect(frame.locator(".task-state")).toHaveText("Working");
  expect((await fakeOf(child)).calls.filter((call) => call === "results.addBudgetAndCarryOn")).toHaveLength(1);
  await shot("10-budget-added");
  await frame.getByRole("button", { name: "Back to tasks" }).click();

  // Waiting for a permission; waiting for a locked model key.
  await row(frame, "weekly groceries").click();
  await expect(frame.locator(".task-state")).toHaveText("Needs your answer");
  await shot("11-waiting");
  await frame.getByRole("button", { name: "Back to tasks" }).click();
  await row(frame, "today's news").click();
  await expect(frame.getByRole("group", { name: "Waiting for your model key" })).toContainText("Unlock it in FluxIQ");
  await expect(frame.getByRole("button", { name: "Carry on" })).toHaveCount(0);
  await shot("12-model-key-locked");
  await frame.getByRole("button", { name: "Back to tasks" }).click();

  // Done on the site: Run again says it may repeat what was done.
  await row(frame, "blue kettle").click();
  await expect(frame.locator(".answer-again-note")).toContainText("may repeat");
  await shot("13-done-on-site");
  await frame.getByRole("button", { name: "Back to tasks" }).click();

  // Finished, not confirmed: no tick.
  await row(frame, "close on Sundays").click();
  await expect(frame.locator(".task-state")).toHaveText("Finished, not confirmed");
  await expect(frame.locator(".task-row-mark")).toHaveCount(0);
  await shot("14-not-confirmed");

  // Rename inline, then delete with its confirmation.
  await frame.getByRole("button", { name: "Rename", exact: true }).click();
  await frame.getByRole("textbox", { name: "Task name" }).fill("Shop hours on Sundays");
  await shot("15-rename");
  await frame.getByRole("button", { name: "Save", exact: true }).click();
  await expect(frame.locator(".task-title")).toHaveText("Shop hours on Sundays");
  await frame.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(frame.locator(".tasks-confirm-question")).toHaveText("Delete “Shop hours on Sundays”?");
  await expect(frame.locator(".tasks-confirm")).toContainText("automation or subflow it saved stays");
  await shot("16-delete-confirm");
  await frame.getByRole("button", { name: "Keep it" }).click();
  await expect(frame.locator(".tasks-confirm")).toHaveCount(0);
  await frame.getByRole("button", { name: "Delete", exact: true }).click();
  await frame.getByRole("button", { name: "Delete task" }).click();
  await expect(frame.locator(".task-row")).toHaveCount(8);
  await expect(frame.locator(".tasks-note")).toHaveText("Deleted “Shop hours on Sundays”.");
  await shot("17-deleted");
});

test("local-classifieds: tasks by keyboard", async ({ openHarness, page }, testInfo) => {
  await openHarness("local-classifieds");
  const { frame, child } = await mountPanelFrame(page, bundle, { width: 360, height: 760 });
  const focusName = () => child.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const name = active ? (active.getAttribute("aria-label") ?? active.textContent ?? active.id).trim() : "";
    return name.length > 50 ? `${name.slice(0, 50)}...` : name;
  });
  await frame.locator("#panelTab-automations").focus();
  await page.keyboard.press("Enter");
  await expect(frame.getByRole("searchbox", { name: "Search tasks, automations and subflows" })).toBeVisible();
  // From the tab, Tab passes the top bar, reaches the search box, then the tasks in the order they are drawn.
  const seen: string[] = [];
  for (let step = 0; step < 14 && !seen.includes("Search tasks, automations and subflows"); step++) {
    await page.keyboard.press("Tab");
    seen.push(await focusName());
  }
  expect(seen.at(-1), `Tab order ${seen.join(" > ")}`).toBe("Search tasks, automations and subflows");
  await page.keyboard.press("Tab");
  expect(await focusName()).toContain("Check my saved searches");
  await page.keyboard.press("Tab");
  expect(await focusName()).toContain("Summarise today's news");
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-1-list-focus.png") });
  // Typing into the search box filters; Enter on a row opens it; Escape comes back with that row focused.
  await frame.getByRole("searchbox", { name: "Search tasks, automations and subflows" }).focus();
  await page.keyboard.type("job");
  await expect(frame.locator(".task-row")).toHaveCount(1);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(frame.locator(".task-title")).toHaveText("Collect the new job posts every morning");
  await expect(frame.locator(".task-title")).toBeFocused();
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-2-details.png") });
  await page.keyboard.press("Escape");
  await expect(frame.locator(".task-row")).toHaveCount(1);
  await expect(frame.locator(".task-row")).toBeFocused();
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-3-back-focus.png") });
  // Rename by keyboard: Enter saves, Escape leaves it as it was.
  await page.keyboard.press("Enter");
  await frame.getByRole("button", { name: "Rename", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(frame.getByRole("textbox", { name: "Task name" })).toBeFocused();
  await page.keyboard.type(" (mornings)");
  await page.keyboard.press("Enter");
  await expect(frame.locator(".task-title")).toHaveText("Collect the new job posts every morning (mornings)");
  await frame.getByRole("button", { name: "Rename", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("x");
  await page.keyboard.press("Escape");
  await expect(frame.locator(".task-title")).toHaveText("Collect the new job posts every morning (mornings)");
  await expect(frame.getByRole("textbox", { name: "Task name" })).toHaveCount(0);
  await expect(frame.getByRole("button", { name: "Rename", exact: true })).toBeFocused();
  // Delete by keyboard: the confirmation puts focus on Keep it, so a stray Enter keeps the task.
  await frame.getByRole("button", { name: "Delete", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(frame.getByRole("button", { name: "Keep it" })).toBeFocused();
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-4-delete-focus.png") });
  await page.keyboard.press("Enter");
  await expect(frame.locator(".tasks-confirm")).toHaveCount(0);
  await expect(frame.locator(".task-title")).toBeVisible();
});

test("local-classifieds: closing the panel and opening it again lands on the same task", async ({ openHarness, page }, testInfo) => {
  await openHarness("local-classifieds");
  const first = await mountPanelFrame(page, bundle, { width: 360, height: 760 });
  await openTab(first.frame);
  await row(first.frame, "saved searches").click();
  await expect(first.frame.locator(".task-title")).toHaveText("Check my saved searches for new listings");
  expect((await fakeOf(first.child)).open).toEqual({ projectId: "project-1", taskId: "task-saved-searches" });
  // The popup closes (focus left it, or Open FluxIQ was pressed) and opens again: Automations, on the same task.
  await page.evaluate(() => document.getElementById("panel-frame")?.remove());
  const again = await mountPanelFrame(page, bundle, { width: 360, height: 760 });
  await expect(again.frame.locator("#panelTab-automations")).toHaveAttribute("aria-selected", "true");
  await expect(again.frame.locator(".task-title")).toHaveText("Check my saved searches for new listings");
  await expect(again.frame.locator(".task-state")).toHaveText("Stopped partway. You can carry on.");
  await again.frame.locator("#app").screenshot({ path: testInfo.outputPath("reopened-same-task.png") });
  // Back leaves the memory empty, so the next opening lands on the list.
  await again.frame.getByRole("button", { name: "Back to tasks" }).click();
  expect((await fakeOf(again.child)).open).toBeUndefined();
});

test("local-classifieds: an empty list says what to do, and a failed read is quiet and keeps what was shown", async ({ openHarness, page }, testInfo) => {
  await openHarness("local-classifieds");
  const empty = await mountPanelFrame(page, emptyBundle, { width: 360, height: 640 });
  await openTab(empty.frame);
  await expect(empty.frame.locator(".tasks-empty")).toContainText("No tasks yet. Ask for something in the chat");
  await empty.frame.locator("#app").screenshot({ path: testInfo.outputPath("empty-list.png") });
  await page.evaluate(() => {
    document.getElementById("panel-frame")?.remove();
    delete (window as unknown as { __open?: unknown }).__open;
  });

  const { frame, child } = await mountPanelFrame(page, bundle, { width: 360, height: 760 });
  await openTab(frame);
  await expect(frame.locator(".task-row")).toHaveCount(9);
  await child.evaluate(() => (window as unknown as Win).__fake.port.failNext("list", { ok: false, sentence: "FluxIQ did not answer just now." }));
  // Coming back to the tab reads again; this read fails.
  await frame.locator("#panelTab-chat").click();
  await frame.locator("#panelTab-automations").click();
  await expect(frame.locator(".tasks-notice-text")).toHaveText("FluxIQ did not answer just now.");
  await expect(frame.locator(".task-row")).toHaveCount(9);
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("failed-read-keeps-rows.png") });
  await frame.getByRole("button", { name: "Try again" }).click();
  await expect(frame.locator(".tasks-notice")).toHaveCount(0);
  await expect(frame.locator(".task-row")).toHaveCount(9);
});
