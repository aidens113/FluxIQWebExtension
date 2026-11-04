// Headed, provider-free look at the subflow library on the professional-network scenario at 360 px: the tree by
// site, search that keeps the path to each match, one subflow in plain words, opening what it calls and coming back,
// running with inputs, every refusal, a run that stops, allowing a lasting act once, and all of it by mouse and by
// keyboard. The screen is the package's own over its fake port: no Core, no provider, no real site. Pictures go to the
// run's output folder.
import { expect, test } from "../../../index.js";
import type { FrameLocator, Page, TestInfo } from "@playwright/test";
import { bundlePanel, mountPanelFrame } from "../panel-frame.js";

/** The library alone in the frame, with the search the Automations tab will own: a box, and the count it shows. */
const ENTRY = `
  import { createLibraryScreen } from "@fluxiq/ui-components";
  import { createFakeSubflowLibraryPort } from "@fluxiq/ui-components/testing";
  import "@fluxiq/ui-components/styles/library.css";
  const port = createFakeSubflowLibraryPort();
  window.__fake = port;
  window.__asked = [];
  const screen = createLibraryScreen({ port, host: { askAbout: (text) => window.__asked.push(text) } });
  const shell = document.createElement("div");
  Object.assign(shell.style, { display: "flex", flexDirection: "column", height: "100%", background: "var(--surface)", color: "var(--text)", font: "13px system-ui, sans-serif" });
  const bar = document.createElement("div");
  Object.assign(bar.style, { display: "flex", gap: "8px", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--divider)" });
  const box = document.createElement("input");
  box.type = "search";
  box.setAttribute("aria-label", "Search subflows");
  box.placeholder = "Search subflows";
  Object.assign(box.style, { flex: "1", minHeight: "32px", padding: "4px 8px" });
  const count = document.createElement("span");
  count.id = "matches";
  bar.append(box, count);
  box.addEventListener("input", () => screen.search(box.value));
  screen.onMatches((matches) => { count.textContent = matches === null ? "" : matches + (matches === 1 ? " match" : " matches"); });
  shell.append(bar, screen.element);
  document.querySelector("#app").append(shell);
  screen.render("project-1");
  screen.setActive(true);
`;

async function open(page: Page, testInfo: TestInfo): Promise<FrameLocator> {
  void testInfo;
  const { frame } = await mountPanelFrame(page, await bundlePanel(ENTRY), { width: 360, height: 720 });
  await expect(frame.getByText("paperworks.example")).toBeVisible();
  return frame;
}

const picture = (frame: FrameLocator, testInfo: TestInfo, name: string) => frame.locator("#app").screenshot({ path: testInfo.outputPath(`${name}.png`) });
const button = (frame: FrameLocator, name: string | RegExp) => frame.getByRole("button", typeof name === "string" ? { name, exact: true } : { name });
const inFrame = (page: Page) => page.frame({ name: "panel-frame" })!;
const fits = (page: Page) =>
  inFrame(page).evaluate(() => {
    const screen = document.querySelector(".library-screen")!;
    return document.documentElement.scrollWidth <= innerWidth && screen.scrollWidth <= screen.clientWidth;
  });
const focused = (frame: FrameLocator) => frame.locator(":focus").evaluate((element) => element.textContent ?? "");
const scrollToEnd = (page: Page) =>
  inFrame(page).evaluate(() => {
    const screen = document.querySelector(".library-screen")!;
    screen.scrollTop = screen.scrollHeight;
  });
const scrollToStart = (page: Page) => inFrame(page).evaluate(() => { document.querySelector(".library-screen")!.scrollTop = 0; });
const fake = (page: Page, script: string) => inFrame(page).evaluate((body) => new Function("port", body)((window as unknown as { __fake: unknown }).__fake), script);
const asked = (page: Page) => inFrame(page).evaluate(() => (window as unknown as { __asked: string[] }).__asked);
const runs = (page: Page) => inFrame(page).evaluate(() => (window as unknown as { __fake: { calls: Array<{ method: string; query: unknown }> } }).__fake.calls.filter((call) => call.method === "run").map((call) => call.query));

test("professional-network: the library shows a tree by site, and search keeps the path to each match", async ({ openHarness, page }, testInfo) => {
  await openHarness("professional-network");
  const frame = await open(page, testInfo);
  await expect(frame.getByText("Order notebooks again")).toBeVisible();
  await expect(frame.getByText("Works reliably · uses 2 subflows")).toBeVisible();
  await expect(frame.getByText("Worked once · uses 1 subflow")).toBeVisible();
  await expect(frame.getByText("Last failed", { exact: false })).toBeVisible();
  await expect(frame.getByText("Not proven yet")).toBeVisible();
  await expect(frame.getByText("harbour-library.example")).toBeVisible();
  expect(await fits(page), "nothing overflows 360 px").toBe(true);
  await picture(frame, testInfo, "tree");
  await frame.getByRole("searchbox", { name: "Search subflows" }).fill("colour");
  await expect(frame.locator("#matches")).toHaveText("1 match");
  await expect(frame.getByText("Read my borrowed books")).toHaveCount(0);
  await expect(frame.getByText("Order notebooks again")).toBeVisible();
  await expect(frame.getByText("Pick the paper colour")).toBeVisible();
  await picture(frame, testInfo, "search-colour");
  await frame.getByRole("searchbox", { name: "Search subflows" }).fill("zzz");
  await expect(frame.getByText("No subflow matches “zzz”.")).toBeVisible();
  await expect(frame.locator("#matches")).toHaveText("0 matches");
  await picture(frame, testInfo, "search-none");
  await frame.getByRole("searchbox", { name: "Search subflows" }).fill("");
  await expect(frame.locator("#matches")).toHaveText("");
});

test("professional-network: one subflow in plain words, a nested one opened and left, by mouse", async ({ openHarness, page }, testInfo) => {
  await openHarness("professional-network");
  const frame = await open(page, testInfo);
  await button(frame, /^Order notebooks again/u).click();
  await expect(frame.getByRole("heading", { name: "Order notebooks again" })).toBeVisible();
  await expect(frame.getByText("Place the order (can spend money)")).toBeVisible();
  await expect(frame.getByText("1 automation uses it.")).toBeVisible();
  await expect(frame.getByText("signed in and on your order history page.")).toBeVisible();
  expect(await fits(page)).toBe(true);
  await picture(frame, testInfo, "detail-top");
  await scrollToEnd(page);
  await picture(frame, testInfo, "detail-bottom");
  await scrollToStart(page);
  await button(frame, "Add an item to the basket").click();
  await expect(frame.getByRole("heading", { name: "Add an item to the basket" })).toBeVisible();
  await expect(frame.getByText("Worked once · Last failed")).toBeVisible();
  await button(frame, "Pick the paper colour").click();
  await expect(frame.getByText("Always uses: Sea green")).toBeVisible();
  await expect(frame.getByText("Who uses it")).toBeVisible();
  await picture(frame, testInfo, "detail-fixed-value");
  await button(frame, "‹ Back").click();
  await expect(frame.getByRole("heading", { name: "Add an item to the basket" })).toBeVisible();
  await button(frame, "‹ Back").click();
  await button(frame, "‹ Back").click();
  await expect(frame.getByText("paperworks.example")).toBeVisible();
  await button(frame, /^Read my borrowed books/u).click();
  await button(frame, "Ask about it").click();
  expect(await asked(page)).toEqual(["About my “Read my borrowed books” subflow: "]);
});

test("professional-network: by keyboard, rows take Tab, Enter opens, Escape returns and focus comes back to the row", async ({ openHarness, page }, testInfo) => {
  await openHarness("professional-network");
  const frame = await open(page, testInfo);
  await frame.getByRole("searchbox", { name: "Search subflows" }).focus();
  await page.keyboard.press("Tab");
  expect(await focused(frame)).toContain("Read my borrowed books");
  await page.keyboard.press("Tab");
  expect(await focused(frame)).toContain("Order notebooks again");
  await picture(frame, testInfo, "keyboard-row-focus");
  await page.keyboard.press("Enter");
  await expect(frame.getByRole("heading", { name: "Order notebooks again" })).toBeVisible();
  expect(await focused(frame)).toBe("‹ Back");
  await picture(frame, testInfo, "keyboard-detail-focus");
  await page.keyboard.press("Tab");
  expect(await focused(frame)).toBe("Run");
  await page.keyboard.press("Tab");
  expect(await focused(frame)).toBe("Ask about it");
  await page.keyboard.press("Tab");
  expect(await focused(frame), "the steps' calls come next, in reading order").toBe("Add an item to the basket");
  await page.keyboard.press("Enter");
  await expect(frame.getByRole("heading", { name: "Add an item to the basket" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(frame.getByRole("heading", { name: "Order notebooks again" })).toBeVisible();
  expect(await focused(frame), "focus returns to the call that was opened").toBe("Add an item to the basket");
  await page.keyboard.press("Escape");
  await expect(frame.getByText("paperworks.example")).toBeVisible();
  expect(await focused(frame)).toContain("Order notebooks again");
  await picture(frame, testInfo, "keyboard-back-on-row");
});

test("professional-network: run with inputs, allow a lasting act once, and see the outcome, by keyboard", async ({ openHarness, page }, testInfo) => {
  await openHarness("professional-network");
  const frame = await open(page, testInfo);
  await button(frame, /^Order notebooks again/u).click();
  await button(frame, "Run").click();
  await expect(frame.getByLabel("How many (required)")).toBeVisible();
  await expect(frame.getByLabel("Delivery note (optional)")).toBeVisible();
  await expect(frame.getByText("Running it can spend money and create new things.")).toBeVisible();
  await picture(frame, testInfo, "run-form");
  await button(frame, "Run").click();
  await expect(frame.getByText("Fill this in to run it.")).toBeVisible();
  await expect(frame.getByLabel("How many (required)")).toBeFocused();
  await picture(frame, testInfo, "run-missing-value");
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  await expect(frame.getByText("It would spend money and create new things, which needs your permission first.")).toBeVisible();
  await expect(frame.getByText(/pin/iu)).toHaveCount(0);
  await picture(frame, testInfo, "run-act-not-allowed");
  expect(await focused(frame)).toContain("It would spend money");
  await button(frame, "Allow it to spend money and create new things this once").click();
  await expect(frame.getByText("It finished.")).toBeVisible();
  await expect(frame.getByText("Order number: A-4821")).toBeVisible();
  await expect(frame.getByText("On the site it spent money and created new things.")).toBeVisible();
  await expect(frame.getByText("FluxIQ has not checked this result.")).toBeVisible();
  expect(await fits(page)).toBe(true);
  await picture(frame, testInfo, "run-finished");
  expect(await runs(page)).toEqual([
    { projectId: "project-1", partId: "restock-notebooks", version: 2, inputs: { quantity: "2" }, permitted: [], acknowledgedRepeat: false },
    { projectId: "project-1", partId: "restock-notebooks", version: 2, inputs: { quantity: "2" }, permitted: ["move_money", "create_new"], acknowledgedRepeat: false }
  ]);
  await button(frame, "Try again").click();
  await expect(frame.getByLabel("How many (required)")).toHaveValue("2");
});

test("professional-network: each refusal is told in words with its next step, and a stopped run says where", async ({ openHarness, page }, testInfo) => {
  await openHarness("professional-network");
  const frame = await open(page, testInfo);
  await button(frame, /^Read my borrowed books/u).click();
  await button(frame, "Run").click();
  const refusals: Array<[string, string]> = [
    ["part.wrong_site", "Open harbour-library.example in this browser and try again."],
    ["part.not_at_start", "Go to the page it starts from and try again."],
    ["part.input_missing", "Fill in what is marked required and try again."],
    ["part.input_unknown", "Open its details to see what it needs, then try again."],
    ["part.calls_not_available", "A smaller subflow it uses is no longer saved."],
    ["part.repeat_refused", "It would repeat something that cannot safely be done twice."],
    ["parts.unavailable", "The library cannot be read right now."],
    ["part.not_found", "That subflow is no longer saved."],
    ["parts.run_id_refused", "That run could not be started."]
  ];
  for (const [code, words] of refusals) {
    await fake(page, `port.refuseNext("run", { code: ${JSON.stringify(code)} });`);
    await button(frame, "Run").click();
    await expect(frame.getByText(words)).toBeVisible();
    await expect(frame.getByText("Nothing on the site changed.")).toBeVisible();
    await expect(frame.getByText(code)).toHaveCount(0);
    if (code === "part.wrong_site" || code === "part.repeat_refused") await picture(frame, testInfo, `refusal-${code.replace(".", "-")}`);
    await button(frame, "Try again").click();
  }
  await fake(page, `port.refuseNext("run", { code: "part.confirm_repeat", classes: ["create_new"] });`);
  await button(frame, "Run").click();
  await expect(frame.getByText("It would do its acts again: create new things.")).toBeVisible();
  await picture(frame, testInfo, "refusal-confirm-repeat");
  await button(frame, "Go ahead").click();
  await expect(frame.getByText("It finished and saved 3 rows.")).toBeVisible();
  await expect(frame.getByText("Titles: Salt Roads; The Winter Atlas; A Small Harbour")).toBeVisible();
  await picture(frame, testInfo, "run-finished-rows");
  await button(frame, "Try again").click();
  await fake(page, `port.stopNext({ stepLabel: "Apply filter", reason: "The list never loaded." });`);
  await button(frame, "Run").click();
  await expect(frame.getByText("It stopped at Apply filter: The list never loaded.")).toBeVisible();
  await expect(frame.getByText(/fail|error/iu)).toHaveCount(0);
  await picture(frame, testInfo, "run-stopped");
  await button(frame, "Ask about it").click();
  expect((await asked(page)).at(-1)).toContain("stopped at Apply filter");
  expect(await fits(page)).toBe(true);
});

test("professional-network: while it runs the button says so, and a failed read is quiet", async ({ openHarness, page }, testInfo) => {
  await openHarness("professional-network");
  const frame = await open(page, testInfo);
  await button(frame, /^Read my borrowed books/u).click();
  await button(frame, "Run").click();
  await fake(page, "window.__release = port.holdNextRun();");
  await button(frame, "Run").click();
  const running = button(frame, "Running...");
  await expect(running).toBeDisabled();
  await picture(frame, testInfo, "run-running");
  await inFrame(page).evaluate(() => (window as unknown as { __release(): void }).__release());
  await expect(frame.getByText("It finished and saved 3 rows.")).toBeVisible();
  expect(await runs(page)).toHaveLength(1);
  await frame.getByRole("button", { name: "Back" }).click();
  await frame.getByRole("button", { name: "Back" }).click();
  await fake(page, 'port.failNext("read", { ok: false, sentence: "FluxIQ is not reachable." });');
  await button(frame, /^Order notebooks again/u).click();
  await expect(frame.getByText("Could not read the steps. FluxIQ is not reachable.")).toBeVisible();
  await expect(frame.getByText("Orders more of a notebook")).toBeVisible();
  await picture(frame, testInfo, "detail-read-failed-quietly");
  await button(frame, "Try again").click();
  await expect(frame.getByText("Open the order history")).toBeVisible();
});
