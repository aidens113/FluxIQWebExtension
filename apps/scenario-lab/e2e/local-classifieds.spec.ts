import { expect, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import {
  bikeRecords, CONTACT_INTERVAL_MS, listingByKey, localClassifiedsScenario, OFFER_AMOUNT, OFFER_LISTING_KEY, SAVED_TABLE_KEYS, savedRecords, type ClassifiedsState,
} from "../src/scenarios/local-classifieds/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test as labTest } from "./lab-fixture.js";

/**
 * The local-classifieds site driven the way a person drives it, and the ways
 * a careless automation gets it wrong, each judged by the manifest's own
 * oracle. The honest paths are the manifest's recording scripts, run step by
 * step; the naive paths are what the site's traps exist to catch: pressing
 * under the chat window, filling the honeypot, taking the sponsored card,
 * reading past the end of the results, keeping a card the feed sent twice,
 * and pressing what now stands where Save used to.
 */
const test = labTest.extend<{ pageErrors: string[] }>({
  // The manifest allows no console errors; the browser's own favicon request answering 404 is not a script error.
  pageErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text()); });
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

const { manifest } = localClassifiedsScenario;
const ROOT = manifest.startPath;
const RESULTS = `section[aria-label="Collection of Marketplace items"]`;
const listingPath = (key: string) => `${ROOT}item/${listingByKey(key).id}/`;

test.use({ labSeed: manifest.seed });
test.describe.configure({ timeout: 90_000 });

const finalState = (lab: RunningScenarioLab) => readFinalState<ClassifiedsState>(lab, "local-classifieds");

function locate(page: Page, target: string | undefined): Locator {
  if (!target) throw new Error("step has no target");
  if (target.startsWith("testid:")) return page.getByTestId(target.slice("testid:".length));
  if (target.startsWith("role:")) {
    const [, role, ...name] = target.split(":");
    return page.getByRole(role as Parameters<Page["getByRole"]>[0], { name: name.join(":"), exact: true });
  }
  return page.locator(target);
}

type Extracted = Array<Record<string, string>>;

/** Reads an extract step the way the Lab's reference reader does: every item, each field's text or attribute, whitespace collapsed. */
async function extract(page: Page, step: ScenarioStep): Promise<Extracted> {
  const records: Extracted = [];
  for (const item of await locate(page, step.target).all()) {
    const record: Record<string, string> = {};
    for (const [name, spec] of Object.entries(step.fields ?? {})) {
      const at = spec.lastIndexOf("@");
      const selector = at < 0 ? spec : spec.slice(0, at);
      const element = selector ? item.locator(selector).first() : item;
      if (!await element.count()) continue;
      const value = at < 0 ? await element.textContent() : await element.getAttribute(spec.slice(at + 1));
      if (value !== null) record[name] = at < 0 ? value.replace(/\s+/gu, " ").trim() : value;
    }
    records.push(record);
  }
  return records;
}

/** Runs recording-script steps as a person with Playwright would, returning what each extract step read. */
async function runScript(page: Page, lab: RunningScenarioLab, steps: readonly ScenarioStep[]): Promise<Map<string, Extracted>> {
  const extracted = new Map<string, Extracted>();
  for (const step of steps) {
    const timeout = step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs };
    switch (step.operation) {
      case "click": await locate(page, step.target).click(timeout); break;
      case "type": await locate(page, step.target).fill(String(step.value), timeout); break;
      case "press": await locate(page, step.target).press(String(step.value), timeout); break;
      case "select": await locate(page, step.target).selectOption(String(step.value), timeout); break;
      case "check": await locate(page, step.target).setChecked(step.value === true, timeout); break;
      case "scroll": await page.mouse.wheel(0, Number(step.value)); await page.waitForTimeout(500); break;
      case "navigate": await page.goto(`${lab.origin}${step.path}`); break;
      case "waitForState": await locate(page, step.target).waitFor({ state: "visible", ...timeout }); break;
      case "extract": extracted.set(step.id, await extract(page, step)); break;
      case "checkpoint": break;
      default: throw new Error(`Unsupported step operation ${step.operation}`);
    }
  }
  return extracted;
}

async function factsHold(page: Page, facts: readonly ExpectedFact[]): Promise<void> {
  for (const fact of facts) {
    if (fact.predicate === "text") await expect(page.getByTestId(fact.subject), fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "exists") await expect(page.getByTestId(fact.subject), fact.id).toHaveCount(fact.value ? 1 : 0);
    else if (fact.predicate === "path") expect(new URL(page.url()).pathname, fact.id).toBe(fact.value);
    else if (fact.predicate === "iframe-count") expect(page.frames().length - 1, fact.id).toBe(fact.value);
    else throw new Error(`Unsupported fact predicate ${fact.predicate}`);
  }
}

async function factFails(page: Page, fact: ExpectedFact): Promise<void> {
  const subject = page.getByTestId(fact.subject);
  if (await subject.count() === 0) return;
  expect(await subject.first().textContent(), `${fact.id} must not hold`).not.toBe(fact.value);
}

const open = (page: Page, lab: RunningScenarioLab) => page.goto(`${lab.origin}${ROOT}`);

/** Scrolls the results the way a person does, with the pointer over them, pressing Try again when a batch fails, until the real results end. */
async function scrollToEnd(page: Page): Promise<void> {
  const end = page.getByText("Results outside your search");
  const retry = page.getByText("Try again", { exact: true });
  const heading = page.locator(`${RESULTS}`);
  for (let turn = 0; turn < 40 && !await end.isVisible(); turn += 1) {
    if (await retry.isVisible()) await retry.click();
    const box = await heading.boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, Math.max(box.y, 0) + 80);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(400);
  }
  await expect(end).toBeVisible();
}
const offerGoal = manifest.playbackGoal!.successFacts;
const unique = (records: Extracted) => records.filter((record, index) => records.findIndex((other) => other.url === record.url) === index);

/** A person's way to the offer listing: cookies, the search, the filters, and the listing itself, but nothing done about the chat yet. */
async function reachOfferListing(page: Page, lab: RunningScenarioLab): Promise<void> {
  const script = manifest.recordingScript;
  await runScript(page, lab, script.slice(0, script.findIndex((step) => step.id === "open-folding-bike") + 1));
  await page.getByRole("button", { name: "Close chat" }).waitFor({ timeout: 6000 });
  await page.getByRole("button", { name: "Make offer" }).waitFor();
}

test.describe("the offer, the manifest's own workflow", () => {
  test("the recording script makes one delivered offer to the right seller and meets the goal", async ({ page, lab }) => {
    await open(page, lab);
    await factsHold(page, manifest.expected.pageFacts ?? []);
    await runScript(page, lab, manifest.recordingScript);
    await factsHold(page, offerGoal);
    await factsHold(page, manifest.expected.finalState ?? []);
    const state = await finalState(lab);
    expect(state.offers).toEqual([{ listingId: listingByKey(OFFER_LISTING_KEY).id, amount: OFFER_AMOUNT, note: "", delivered: true }]);
    expect(state.messages).toEqual([]);
  });

  test("pressing Make offer while the chat covers it reaches the chat, not the button", async ({ page, lab }) => {
    await open(page, lab);
    await reachOfferListing(page, lab);
    const box = (await page.getByRole("button", { name: "Make offer" }).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("dialog", { name: "Make an offer" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: /^Alex Rowe/u }).getByRole("textbox", { name: "Message" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Make offer" }).click({ timeout: 1500 })).rejects.toThrow(/intercepts pointer events|Timeout/u);
    expect((await finalState(lab)).offers).toEqual([]);
    await factFails(page, offerGoal[0]!);
  });

  test("an offer sent with the hidden website field filled is accepted and never delivered", async ({ page, lab }) => {
    await open(page, lab);
    await reachOfferListing(page, lab);
    await page.getByRole("button", { name: "Close chat" }).click();
    await page.getByRole("button", { name: "Make offer" }).click();
    const dialog = page.getByRole("dialog", { name: "Make an offer" });
    for (const input of await dialog.locator("input").all()) await input.fill(String(OFFER_AMOUNT));
    await dialog.getByRole("button", { name: "Send offer" }).click();
    await expect(page.getByTestId("marketplace_offer_receipt")).toHaveText(`Offer of £${OFFER_AMOUNT} not delivered`);
    await factFails(page, offerGoal[0]!);
    expect((await finalState(lab)).offers.map(({ delivered }) => delivered)).toEqual([false]);
  });

  test("the first card of the narrowed search is the advert, which opens a shop in a new tab and sends no offer", async ({ page, context, lab }) => {
    await open(page, lab);
    const script = manifest.recordingScript;
    await runScript(page, lab, script.slice(0, script.findIndex((step) => step.id === "open-folding-bike")));
    const first = page.locator(`${RESULTS} > div:first-child a`).first();
    await expect(first).toContainText("Folding bike, 20in, 7-speed, clearance", { timeout: 12_000 });
    const [shop] = await Promise.all([context.waitForEvent("page"), first.click()]);
    await shop.waitForLoadState();
    await expect(shop.getByText("Not a Kerbfind Marketplace listing.", { exact: false })).toBeVisible();
    expect((await finalState(lab)).offers).toEqual([]);
  });

  test("sending the ready-made message first gets the offer refused until the rate limit has passed", async ({ page, lab }) => {
    await open(page, lab);
    await reachOfferListing(page, lab);
    await page.getByRole("button", { name: "Close chat" }).click();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Message sent to Morgan Tate")).toBeVisible();
    await page.getByRole("button", { name: "Make offer" }).click();
    await page.getByRole("textbox", { name: "Your offer" }).fill(String(OFFER_AMOUNT));
    await page.getByRole("button", { name: "Send offer" }).click();
    await expect(page.getByText(/You're sending messages too quickly\. Try again in \d+ seconds?\./u)).toBeVisible();
    expect((await finalState(lab)).offers).toEqual([]);
    await page.waitForTimeout(CONTACT_INTERVAL_MS);
    await page.getByRole("button", { name: "Send offer" }).click();
    await factsHold(page, offerGoal);
    expect((await finalState(lab)).messages.map(({ text }) => text)).toEqual(["Hi, is this still available?"]);
  });
});

test.describe("bike search", () => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "bike-search" });
  const step = workflow.recordingScript.find(({ id }) => id === "extract-bike-results")!;

  test("the recording script reads the real results; only a person's de-duplication makes them the answer", async ({ page, lab }) => {
    await open(page, lab);
    const read = (await runScript(page, lab, workflow.recordingScript)).get(step.id)!;
    expect(read.length, "the feed sent one card twice, and a single read keeps both").toBe(bikeRecords().length + 1);
    expect(unique(read).map((record) => ({ ...record, url: new URL(record.url!, lab.origin).pathname }))).toEqual(bikeRecords());
    await factsHold(page, workflow.expected.finalState ?? []);
  });

  test("reading every card on the page takes the adverts and the results outside the search", async ({ page, lab }) => {
    await open(page, lab);
    await runScript(page, lab, workflow.recordingScript.filter(({ operation }) => operation !== "extract"));
    const naive = await extract(page, { ...step, target: `${RESULTS} a`, fields: { title: "div:nth-of-type(3) > span", url: "@href" } });
    expect(naive.some((record) => record.url?.includes("/ad/")), "an advert is among the cards").toBe(true);
    expect(naive.some((record) => record.title === "Cargo bike, box front, seats two children"), "a result from outside the search is among the cards").toBe(true);
    expect(naive.length).toBeGreaterThan(bikeRecords().length);
  });

  test("the list layout keeps the answer and breaks a read anchored on the card's link", async ({ page, lab }) => {
    const variant = resolveScenarioWorkflow(manifest, { workflowId: "bike-search", variantId: "list-layout" });
    await armVariant(lab, "local-classifieds", variant.variant);
    await open(page, lab);
    await factsHold(page, variant.expected.pageFacts ?? []);
    const script = variant.recordingScript;
    await runScript(page, lab, script.slice(0, script.findIndex(({ id }) => id === "point-at-results")));
    await scrollToEnd(page);
    const read = await extract(page, step);
    expect(read.length).toBeGreaterThan(0);
    expect(read.every((record) => record.price === undefined), "the recorded grid selectors find no price in a row").toBe(true);
    const rows = await extract(page, { ...step, target: `${RESULTS} > div:first-child [role="article"]:has(a[href*="/item/"])`, fields: { title: "a", price: "a + div > span:first-child", location: "a + div + div > span:first-child", url: "a@href" } });
    expect(unique(rows).map((record) => ({ ...record, url: new URL(record.url!, lab.origin).pathname }))).toEqual(bikeRecords());
  });

  test("the location question blocks the page until it is answered", async ({ page, lab }) => {
    const variant = resolveScenarioWorkflow(manifest, { workflowId: "bike-search", variantId: "location-check" });
    await armVariant(lab, "local-classifieds", variant.variant);
    await open(page, lab);
    await factsHold(page, variant.expected.pageFacts ?? []);
    await page.getByRole("button", { name: "Allow all cookies" }).click();
    await expect(page.getByRole("dialog", { name: "Are you still in Kelford?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bicycles" }).click({ timeout: 1500 })).rejects.toThrow(/intercepts pointer events|Timeout/u);
    await page.getByRole("button", { name: "Yes, that's right" }).click();
    const read = (await runScript(page, lab, variant.recordingScript.slice(1))).get(step.id)!;
    expect(unique(read).length).toBe(bikeRecords().length);
  });

  test("searching faster than a person gets a pause that clears by itself", async ({ page, lab }) => {
    await page.goto(`${lab.origin}${ROOT}category/bicycles/`);
    await page.getByRole("button", { name: "Allow all cookies" }).click();
    await page.getByRole("button", { name: "Item condition" }).click();
    for (const name of ["New", "Used – like new", "Used – good", "Used – fair"]) await page.getByRole("checkbox", { name, exact: true }).check();
    await expect(page.getByText("Checking your browser before you continue")).toBeVisible();
    await expect(page.getByText("Checking your browser before you continue")).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator(`${RESULTS} a[href*="/item/"]`).first()).toBeVisible();
  });
});

test.describe("saving dining tables", () => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "save-dining-tables" });

  test("the recording script saves the three tables and reads the saved list back as the answer", async ({ page, lab }) => {
    await open(page, lab);
    const read = (await runScript(page, lab, workflow.recordingScript)).get("extract-saved-items")!;
    expect(read.map((record) => ({ title: record.title, price: record.price, status: record.status }))).toEqual(savedRecords());
    await factsHold(page, workflow.expected.finalState ?? []);
    const state = await finalState(lab);
    expect(state.saved.slice(2)).toEqual(SAVED_TABLE_KEYS.map((key) => listingByKey(key).id));
  });

  test("saving the first three cards saves an advert-free but wrong list: legs, chairs and one table", async ({ page, lab }) => {
    await open(page, lab);
    const script = workflow.recordingScript;
    await runScript(page, lab, script.slice(0, script.findIndex((step) => step.id === "open-table-0")));
    const cards = page.locator(`${RESULTS} > div:first-child a[href*="/item/"]`);
    await cards.first().waitFor({ timeout: 12_000 });
    const hrefs = await cards.evaluateAll((links) => links.slice(0, 3).map((link) => link.getAttribute("href")));
    for (const href of hrefs) {
      await page.goto(`${lab.origin}${href}`);
      await page.getByTestId("marketplace_pdp_save").click();
      await expect(page.getByTestId("marketplace_pdp_save")).toHaveAttribute("aria-pressed", "true");
    }
    await page.goto(`${lab.origin}${ROOT}saved/`);
    await page.getByRole("combobox", { name: "Sort saved items" }).selectOption("price_ascend");
    const read = await extract(page, script.find(({ id }) => id === "extract-saved-items")!);
    expect(read.length, "the count alone cannot tell this list from the right one").toBe(savedRecords().length);
    expect(read).not.toEqual(savedRecords());
    expect(read.map(({ title }) => title)).toContain("Dining table legs x4, hairpin, 71cm");
  });

  test("pressing Save again on the card the feed repeated unsaves the table", async ({ page, lab }) => {
    await page.goto(`${lab.origin}${listingPath("industrial-table")}`);
    await page.getByRole("button", { name: "Allow all cookies" }).click();
    for (let press = 0; press < 2; press += 1) {
      const pressed = press === 0 ? "true" : "false";
      await page.getByTestId("marketplace_pdp_save").click();
      await expect(page.getByTestId("marketplace_pdp_save")).toHaveAttribute("aria-pressed", pressed);
    }
    expect((await finalState(lab)).saved).not.toContain(listingByKey("industrial-table").id);
  });

  test("after the redesign the recorded control is gone, Hide stands in its place, and only the heart saves", async ({ page, lab }) => {
    const variant = resolveScenarioWorkflow(manifest, { workflowId: "save-dining-tables", variantId: "moved-save" });
    await armVariant(lab, "local-classifieds", variant.variant);
    await open(page, lab);
    await factsHold(page, variant.expected.pageFacts ?? []);
    await page.goto(`${lab.origin}${listingPath("pine-round-table")}`);
    await page.getByRole("button", { name: "Allow all cookies" }).click();
    await page.getByRole("button", { name: "Hide" }).click();
    await expect(page.getByTestId("marketplace_pdp_save")).toHaveCount(0);
    let state = await finalState(lab);
    expect(state.hidden).toEqual([listingByKey("pine-round-table").id]);
    expect(state.saved).not.toContain(listingByKey("pine-round-table").id);
    await page.goto(`${lab.origin}${listingPath("glass-table")}`);
    await page.getByRole("button", { name: "Add to saved items" }).click();
    await expect(page.getByRole("button", { name: "Add to saved items" })).toHaveAttribute("aria-pressed", "true");
    state = await finalState(lab);
    expect(state.saved).toContain(listingByKey("glass-table").id);
  });
});

for (const labSeed of [1, 42]) {
  test.describe(`the honest paths on seed ${labSeed}, a different build`, () => {
    test.use({ labSeed });

    test("the offer script meets the goal", async ({ page, lab }) => {
      await open(page, lab);
      await runScript(page, lab, manifest.recordingScript);
      await factsHold(page, offerGoal);
    });

    test("the bike script's de-duplicated read is the answer", async ({ page, lab }) => {
      const workflow = resolveScenarioWorkflow(manifest, { workflowId: "bike-search" });
      await open(page, lab);
      const read = (await runScript(page, lab, workflow.recordingScript)).get("extract-bike-results")!;
      expect(unique(read).map((record) => ({ ...record, url: new URL(record.url!, lab.origin).pathname }))).toEqual(bikeRecords());
    });

    test("the save script's read is the answer", async ({ page, lab }) => {
      const workflow = resolveScenarioWorkflow(manifest, { workflowId: "save-dining-tables" });
      await open(page, lab);
      const read = (await runScript(page, lab, workflow.recordingScript)).get("extract-saved-items")!;
      expect(read).toEqual(savedRecords());
    });
  });
}
