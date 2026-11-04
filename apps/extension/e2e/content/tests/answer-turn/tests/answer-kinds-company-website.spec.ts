// Headed, provider-free look at the answer turn on the company-website scenario: every kind of result, the
// second-attempt line, Show all, CSV and JSON, a 360 px panel and the keyboard. The chat is the real one over a
// scripted background and a scripted results port; nothing reaches a provider or Core.
import { expect, test } from "../../../index.js";
import { buildAnswerChatBundle, mountNamed, openChatRail, type AnswerBundle } from "../answer-chat-page.js";

let bundle: AnswerBundle;
test.beforeAll(async () => {
  bundle = await buildAnswerChatBundle();
});

type Win = { __mount(config: unknown): Promise<void>; __outcomes(names: string[], site: string): unknown[]; __downloads: Array<{ fileName: string; contentType: string; body: string }> };

type Patch = "unverified" | "refuted" | undefined;
const KINDS: ReadonlyArray<{ name: string; patch?: Patch; kind: string; headline: RegExp; state: string }> = [
  { name: "rowsChecked", kind: "rows", headline: /^Found 10 of 10$/, state: "confirmed" },
  { name: "rowsChecked", patch: "unverified", kind: "rows", headline: /^Found 10 rows$/, state: "unverified" },
  { name: "rowsChecked", patch: "refuted", kind: "rows", headline: /^Found 10 rows$/, state: "refuted" },
  { name: "rowsNotSure", kind: "budget_out", headline: /budget/, state: "unverified" },
  { name: "rowsRefuted", kind: "budget_out", headline: /budget/, state: "refuted" },
  // One of its acts may have happened, so there is no tick even though the check said yes.
  { name: "doneOnSite", kind: "done_on_site", headline: /./, state: "unverified" },
  { name: "plainAnswerChecked", kind: "plain_answer", headline: /./, state: "confirmed" },
  { name: "budgetOutPartial", kind: "budget_out", headline: /budget/, state: "unverified" },
  { name: "secondAttemptFromSaved", kind: "rows", headline: /^Found 10 of 10$/, state: "confirmed" }
];

test("company-website: every kind of answer turn, drawn and looked at", async ({ openHarness, page }, testInfo) => {
  await openHarness("company-website");
  const site = (await page.title()) || "the company site";
  const { frame, locator } = await openChatRail(page, bundle, { width: 420, height: 720 });
  for (const kind of KINDS) {
    await frame.evaluate(async ({ name, site, patch }) => {
      const win = window as unknown as Win;
      const outcomes = win.__outcomes([name], site) as Array<{ result: { label: string; timesChecked: number; checkedWhat?: string } }>;
      if (patch) {
        outcomes[0]!.result.label = patch;
        outcomes[0]!.result.timesChecked = patch === "unverified" ? 0 : 2;
        if (patch === "unverified") delete outcomes[0]!.result.checkedWhat;
        else outcomes[0]!.result.checkedWhat = "They are not sorted cheapest first";
      }
      await win.__mount({ outcomes, request: "Collect the team page" });
    }, { name: kind.name, site, patch: kind.patch });
    const turn = locator.locator(".answer-turn");
    await expect(turn).toHaveCount(1);
    await expect(turn.first()).toHaveAttribute("data-kind", kind.kind);
    await expect(locator.locator(".answer-headline").first()).toHaveText(kind.headline);
    if (kind.state === "confirmed" || kind.state === "unverified" || kind.state === "refuted") {
      const check = locator.locator(".answer-check").first();
      if (await check.count()) await expect(check).toHaveAttribute("data-state", kind.state);
    }
    const ticks = await locator.locator(".answer-turn").evaluate((element) => element.textContent?.includes("✓") ?? false);
    if (kind.state !== "confirmed") expect(ticks, `${kind.name}: no tick`).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`kind-${kind.name}${kind.patch ? `-${kind.patch}` : ""}.png`) });
    await locator.locator(".answer-turn").first().screenshot({ path: testInfo.outputPath(`kind-${kind.name}${kind.patch ? `-${kind.patch}` : ""}-card.png`) });
  }
  // The second-attempt line.
  await mountNamed(frame, site, "secondAttemptFromSaved");
  await expect(locator.locator(".answer-line", { hasText: "This time 18s and $0.00. First time 3m 14s and $1.12." })).toHaveCount(1);
  // The unverified rows say why; the model's words are labelled.
  await mountNamed(frame, site, "rowsNotSure");
  await expect(locator.locator(".answer-check-words").first()).toContainText("please look to be sure");
  await mountNamed(frame, site, "plainAnswerChecked");
  await expect(locator.locator(".answer-text-label")).toHaveText("In the model's words");
  await mountNamed(frame, site, "doneOnSite");
  await expect(locator.locator(".answer-check-words").first()).toContainText("may have happened");
  await expect(locator.locator("[data-action=run-again]")).toHaveCount(1);
  await expect(locator.locator(".answer-again-note")).toHaveText("Running this again may repeat what was done on the site.");
});

test("company-website: Show all expands, CSV and JSON hand over the rows as files", async ({ openHarness, page }, testInfo) => {
  await openHarness("company-website");
  const site = (await page.title()) || "the company site";
  const { frame, locator } = await openChatRail(page, bundle, { width: 420, height: 720 });
  await frame.evaluate(async (site) => {
    const win = window as unknown as Win;
    const outcomes = win.__outcomes(["rowsChecked"], site) as Array<{ result: { rows: { totalRows: number; previewRows: unknown[] } } }>;
    outcomes[0]!.result.rows.previewRows = Array.from({ length: 10 }, (_, index) => ({ title: `Team member ${index + 1}, "quoted", role`, price: index + 0.5 }));
    await win.__mount({ outcomes });
  }, site);
  await expect(locator.locator(".answer-row")).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath("rows-first-five.png") });
  await locator.locator('[data-action="toggle-rows"]').click();
  await expect(locator.locator(".answer-row")).toHaveCount(10);
  await locator.locator(".answer-turn").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("rows-show-all.png") });
  await locator.locator('[data-action="toggle-rows"]').click();
  await expect(locator.locator(".answer-row")).toHaveCount(5);

  await locator.locator('[data-action="export-csv"]').click();
  await expect(locator.locator(".answer-status")).toContainText("Saved");
  await locator.locator('[data-action="export-json"]').click();
  await expect.poll(() => frame.evaluate(() => (window as unknown as Win).__downloads.length)).toBe(2);
  const files = await frame.evaluate(() => (window as unknown as Win).__downloads);
  const expected = Array.from({ length: 10 }, (_, index) => ({ title: `Team member ${index + 1}, "quoted", role`, price: index + 0.5 }));
  const json = files.find((file) => file.fileName.endsWith(".json"))!;
  expect(json.contentType).toBe("application/json");
  expect(JSON.parse(json.body), "the JSON file holds the rows").toEqual(expected);
  const csv = files.find((file) => file.fileName.endsWith(".csv"))!;
  expect(csv.contentType).toBe("text/csv");
  const lines = csv.body.split("\n");
  expect(lines[0]).toBe("Title,Price");
  expect(lines).toHaveLength(11);
  expect(lines[1]).toBe('"Team member 1, ""quoted"", role",0.5');
  await page.screenshot({ path: testInfo.outputPath("rows-exported.png") });
});

test("company-website: a 360 px panel does not scroll sideways; the table scrolls inside its own region", async ({ openHarness, page }, testInfo) => {
  await openHarness("company-website");
  const site = (await page.title()) || "the company site";
  const { frame, locator } = await openChatRail(page, bundle, { width: 360, height: 720 });
  await frame.evaluate(async (site) => {
    const win = window as unknown as Win;
    const outcomes = win.__outcomes(["rowsChecked"], site) as Array<{ result: { rows: { columns: unknown[]; previewRows: Array<Record<string, unknown>> } } }>;
    const rows = outcomes[0]!.result.rows;
    rows.columns = [{ id: "title", label: "Title" }, { id: "price", label: "Price" }, { id: "department", label: "Department of the company" }, { id: "email", label: "Email address" }, { id: "phone", label: "Telephone number" }];
    rows.previewRows = rows.previewRows.map((row, index) => ({ ...row, department: "Customer experience and partnerships", email: `person.with.a.long.address.${index}@company-example.test`, phone: "+44 20 7946 0958" }));
    await win.__mount({ outcomes });
  }, site);
  await expect(locator.locator(".answer-turn")).toHaveCount(1);
  const fits = await frame.evaluate(() => ({ page: document.documentElement.scrollWidth <= innerWidth, body: document.body.scrollWidth <= innerWidth, width: innerWidth }));
  expect(fits.width).toBe(360);
  expect(fits.page, "no horizontal page scroll in the panel").toBe(true);
  expect(fits.body).toBe(true);
  const region = await locator.locator(".answer-table-scroll").evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth, overflowX: getComputedStyle(element).overflowX }));
  expect(region.scroll, "the table is wider than its region").toBeGreaterThan(region.client);
  expect(["auto", "scroll"]).toContain(region.overflowX);
  const buttonsFit = await locator.locator(".answer-turn button").evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().right <= innerWidth));
  expect(buttonsFit, "every button is inside the panel").toBe(true);
  // Recorded, not asserted: how wide the Title column is left at 360 px (a product observation for the report).
  const titleWidth = await locator.locator("th").first().evaluate((element) => Math.round(element.getBoundingClientRect().width));
  testInfo.annotations.push({ type: "title-column-width-at-360", description: `${titleWidth}px` });
  console.log("title-column-width-at-360", titleWidth);
  await page.screenshot({ path: testInfo.outputPath("narrow-360.png") });
  await locator.locator(".answer-table-scroll").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await page.screenshot({ path: testInfo.outputPath("narrow-360-scrolled.png") });
});

test("company-website: the keyboard reaches every answer button in order and presses them", async ({ openHarness, page }, testInfo) => {
  await openHarness("company-website");
  const site = (await page.title()) || "the company site";
  const { frame, locator } = await openChatRail(page, bundle, { width: 420, height: 720 });
  await frame.evaluate(async (site) => {
    const win = window as unknown as Win;
    const outcomes = win.__outcomes(["rowsChecked"], site) as Array<{ result: { rows: { previewRows: unknown[] } } }>;
    outcomes[0]!.result.rows.previewRows = Array.from({ length: 8 }, (_, index) => ({ title: `Item ${index}`, price: index }));
    await win.__mount({ outcomes });
  }, site);
  const inDomOrder = await locator.locator(".answer-turn button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-action")));
  expect(inDomOrder.length).toBeGreaterThanOrEqual(4);
  // Start just before the card: its table region is focusable, so land there and then tab on.
  await locator.locator(".answer-table-scroll").focus();
  const reached: string[] = [];
  for (let press = 0; press < inDomOrder.length + 2; press += 1) {
    await page.keyboard.press("Tab");
    const now = await frame.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return { action: element?.getAttribute("data-action") ?? null, inside: Boolean(element?.closest(".answer-turn")) };
    });
    if (!now.inside || now.action === null) break;
    reached.push(now.action);
  }
  expect(reached, "Tab visits each answer button in page order").toEqual(inDomOrder);
  // A focus ring is visible on the focused button.
  await locator.locator('[data-action="export-csv"]').focus();
  const ring = await locator.locator('[data-action="export-csv"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), boxShadow: style.boxShadow };
  });
  expect((ring.outlineStyle !== "none" && ring.outlineWidth > 0) || ring.boxShadow !== "none", `a focus ring: ${JSON.stringify(ring)}`).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("keyboard-focus-ring.png") });
  // Enter presses CSV, Space presses JSON, Enter presses Show all.
  await locator.locator('[data-action="export-csv"]').focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => frame.evaluate(() => (window as unknown as Win).__downloads.length)).toBe(1);
  await locator.locator('[data-action="export-json"]').focus();
  await page.keyboard.press("Space");
  await expect.poll(() => frame.evaluate(() => (window as unknown as Win).__downloads.length)).toBe(2);
  await locator.locator('[data-action="toggle-rows"]').focus();
  await page.keyboard.press("Enter");
  await expect(locator.locator(".answer-row")).toHaveCount(8);
  await expect(locator.locator('[data-action="toggle-rows"]')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("keyboard-pressed.png") });
});
