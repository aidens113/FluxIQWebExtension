import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Browser, Page } from "@playwright/test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { MEMBERS } from "../data/index.js";
import { professionalNetworkManifest, ROTTERDAM_NL, staleConnectionRequests, STORE_AFTER_WITHDRAWAL, STORE_AT_START } from "../index.js";
import { RETRY_AFTER_SECONDS } from "../search/index.js";
import { closeSession, factText, launchBrowser, openSession, postToSite, readingPause, ROOT, textOf, type Session } from "./browser-session.js";

const search = resolveScenarioWorkflow(professionalNetworkManifest, { workflowId: "people-search" });
const extractStep = search.recordingScript.find(({ id }) => id === "extract-rotterdam-engineers")!;
const EXPECTED = search.expected.extracted![0]!.records!;
const ORGANIC = extractStep.target!;
const FIELDS = extractStep.fields!;
const FILTERED = `${ROOT}search/results/people/?keywords=data%20engineer&network=${encodeURIComponent('["S"]')}&geoUrn=${encodeURIComponent(JSON.stringify([ROTTERDAM_NL]))}&origin=FACETED_SEARCH`;
const CLOSE_CONVERSATION = { name: "Close your conversation with Priya Nair" } as const;
const pagerButton = (page: Page, label: string) => page.locator(`section[aria-label="Search results"] button`, { hasText: new RegExp(`^${label}$`, "u") });
const pageStatus = (page: Page) => page.locator(`section[aria-label="Search results"] span`, { hasText: /^Page \d of \d$/u });

let browser: Browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser.close(); });

async function session<T>(work: (session: Session) => Promise<T>, prepare?: (session: Session) => Promise<void>): Promise<T> {
  const current = await openSession(browser);
  try {
    await prepare?.(current);
    const result = await work(current);
    assert.deepEqual(current.offsite, [], "the site reached nothing off the machine");
    return result;
  } finally {
    await closeSession(current);
  }
}

/** Arms a variant the way the Lab does: one authorized POST of its `arm`. */
const arm = (current: Session, mode: string) => postToSite(current, "set-mode", { mode });

/**
 * Answers the cookie banner and opens the site at `path`, where the app prompt
 * and the conversation are still to come. The banner is answered with the
 * request its Accept sends, before any page opens: pressing Accept races the
 * app prompt, which covers the banner 2.5 seconds after a page loads, and these
 * specs are about what comes after the banner.
 */
async function arrive(current: Session, path: string): Promise<Page> {
  const { page } = current;
  await postToSite(current, "set-consent", { choice: "accepted" });
  await page.goto(`${current.lab.origin}${path}`);
  return page;
}

/**
 * Puts off the app prompt and closes the conversation, which open 2.5 and 3.5
 * seconds after the page loads, each waited for in the order it arrives. Both
 * are answered for the session, so no later page brings them back.
 */
async function clearInterruptions(page: Page): Promise<void> {
  await page.locator('div:text-is("Not now")').click({ timeout: 15_000 });
  await page.getByRole("button", CLOSE_CONVERSATION).click({ timeout: 15_000 });
}

/** The records the recording's own extract fields read off the current page's organic results. */
async function readOrganic(page: Page): Promise<Array<Record<string, string>>> {
  await page.locator(ORGANIC).first().waitFor({ timeout: 8_000 });
  const records: Array<Record<string, string>> = [];
  for (const item of await page.locator(ORGANIC).all()) {
    const record: Record<string, string> = {};
    for (const [field, selector] of Object.entries(FIELDS)) record[field] = ((await item.locator(selector).first().textContent()) ?? "").trim();
    records.push(record);
  }
  return records;
}

async function goToPage(page: Page, label: string, expectedStatus: string): Promise<void> {
  await pagerButton(page, label).click();
  await pageStatus(page).filter({ hasText: expectedStatus }).waitFor({ timeout: 8_000 });
}

function firstSeen(records: Array<Record<string, string>>): Array<Record<string, string>> {
  const seen = new Set<string>();
  return records.filter((record) => (seen.has(record.name!) ? false : (seen.add(record.name!), true)));
}

describe("professional-network in a browser", { concurrency: 4 }, () => {
  test("an honest person filters through the page's own controls and collects exactly the expected people", () => session(async (current) => {
    const page = await arrive(current, ROOT);
    // Answered on the first page, as they arrive, so no press later in the search can race them.
    await clearInterruptions(page);
    const box = page.getByRole("combobox", { name: "Search" });
    await box.fill("data engineer");
    await box.press("Enter");
    await page.getByRole("link", { name: "See all people results" }).click();
    await page.locator('div[tabindex="0"]:text-is("Connections ▾")').click();
    await page.getByRole("checkbox", { name: "2nd", exact: true }).check();
    await page.locator('div:text-is("Show results") >> visible=true').click();
    await page.locator(ORGANIC).first().waitFor({ timeout: 8_000 });
    await readingPause(page);
    await page.locator('div[tabindex="0"]:text-is("Locations ▾")').click();
    await page.locator('input[placeholder="Add a location"]').fill("Rotterdam");
    const suggestions = page.locator('input[placeholder="Add a location"] ~ div > div');
    await suggestions.first().waitFor();
    assert.deepEqual(await suggestions.allTextContents(), ["Rotterdam, South Holland, Netherlands", "Rotterdam, New York, United States"], "both Rotterdams are offered");
    assert.ok(await page.locator('div:text-is("Rotterdam, South Holland, Netherlands")').count() > 1, "the suggestion's words are also every Rotterdam card's location line");
    await suggestions.filter({ hasText: "Rotterdam, South Holland, Netherlands" }).click();
    assert.equal(await page.locator('div:text-is("Show results") >> visible=true').count(), 0, "choosing a suggestion closes the dropdown");
    await page.locator('div[tabindex="0"]:text-is("Locations ▾")').click();
    assert.equal(await page.getByRole("checkbox", { name: "Rotterdam, South Holland, Netherlands" }).isChecked(), true);
    await page.locator('div:text-is("Show results") >> visible=true').click();
    await page.waitForURL(/geoUrn=/u);
    const collected = await readOrganic(page);
    await readingPause(page);
    await goToPage(page, "2", "Page 2 of 3");
    collected.push(...await readOrganic(page));
    await readingPause(page);
    await goToPage(page, "3", "Page 3 of 3");
    collected.push(...await readOrganic(page));
    assert.equal(collected.length, 24, "page 3 repeats the last person of page 2");
    assert.deepEqual(firstSeen(collected), EXPECTED);
    assert.equal(await factText(page, "invitation-store"), STORE_AT_START, "searching changed nothing");
    assert.deepEqual(current.consoleErrors, []);
  }));

  test("a naive reader that follows Next and keeps every card gets the wrong people", () => session(async (current) => {
    const page = await arrive(current, FILTERED);
    await clearInterruptions(page);
    const everything = async () => {
      await page.locator("li[data-urn] a[href*='/in/']").first().waitFor({ timeout: 8_000 });
      return page.locator(`li[data-urn] ${FIELDS.name}`).allTextContents();
    };
    const names = await everything();
    for (const status of ["Page 2 of 3", "Page 2 of 3"]) {
      await readingPause(page);
      await pagerButton(page, "Next").click();
      await pageStatus(page).filter({ hasText: status }).waitFor({ timeout: 8_000 });
      names.push(...await everything());
    }
    assert.ok(names.includes("Sanne de Wit"), "a promoted profile was taken");
    assert.ok(!names.includes("Yara Haddad"), "Next never reached page 3");
    assert.notDeepEqual(firstSeen(names.map((name) => ({ name }))).map(({ name }) => name), EXPECTED.map(({ name }) => name));
  }));

  test("paging faster than a person reads -- four tabs turning the page at once -- meets the security check, which clears for someone who waits", () => session(async (current) => {
    const page = await arrive(current, FILTERED);
    await clearInterruptions(page);
    await page.locator(ORGANIC).first().waitFor({ timeout: 8_000 });
    // The search checks a fourth results request inside three seconds. One tab cannot be relied on to ask that fast:
    // each page waits 0.7 s, fetches, and renders before its pager can be pressed again, which a loaded machine
    // stretches past a second a page. Four tabs, each on its first page, pressing "2" together always ask four times
    // at once. Opening them asks only three times, and not within the window of the first tab's request.
    const tabs = [page];
    for (let index = 0; index < 3; index += 1) {
      const tab = await current.context.newPage();
      tab.on("console", (message) => { if (message.type() === "error") current.consoleErrors.push(message.text()); });
      tab.on("pageerror", (error) => current.consoleErrors.push(error.message));
      await tab.goto(`${current.lab.origin}${FILTERED}`);
      await pagerButton(tab, "2").waitFor({ timeout: 8_000 });
      tabs.push(tab);
    }
    await Promise.all(tabs.map((tab) => pagerButton(tab, "2").click()));
    const checkIn = (tab: Page) => tab.getByRole("heading", { name: "Let’s do a quick security check" });
    const checked = await Promise.any(tabs.map(async (tab) => { await checkIn(tab).waitFor({ timeout: 8_000 }); return tab; }));
    // The other tabs retry on their own and would keep the window full; the person carries on in the one tab.
    await Promise.all(tabs.filter((tab) => tab !== checked).map((tab) => tab.close()));
    await checked.getByText("I’m not a robot", { exact: true }).click();
    // The box retries two seconds later; while the burst's requests are still inside the window that retry meets the
    // check again, and the page's own retry, Retry-After seconds on, clears it. The budget covers both.
    await checked.locator(ORGANIC).first().waitFor({ timeout: (RETRY_AFTER_SECONDS + 2) * 1_000 + 8_000 });
    assert.ok(current.consoleErrors.every((error) => error.includes("status of 429")), current.consoleErrors.join("\n"));
  }));

  test("the open conversation sits over the pager, so a click there lands on it until it is closed", () => session(async (current) => {
    const page = await arrive(current, FILTERED);
    await page.locator('div:text-is("Not now")').click({ timeout: 8_000 });
    await page.getByRole("button", CLOSE_CONVERSATION).waitFor({ timeout: 8_000 });
    await pageStatus(page).waitFor({ timeout: 8_000 });
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    const three = await pagerButton(page, "3").boundingBox();
    assert.ok(three);
    const x = three.x + three.width / 2;
    const y = three.y + three.height / 2;
    const hit = await page.evaluate(`(() => { const el = document.elementFromPoint(${x}, ${y}); const section = el && el.closest('section'); return section ? section.textContent : (el ? el.tagName : ''); })()`);
    assert.match(String(hit), /Priya Nair/u, "the point the pager button occupies belongs to the conversation");
    await page.mouse.click(x, y);
    await page.waitForTimeout(1_500);
    assert.equal(await textOf(pageStatus(page)), "Page 1 of 3", "the click never reached the pager");
    await page.getByRole("button", CLOSE_CONVERSATION).click();
    await readingPause(page);
    await goToPage(page, "3", "Page 3 of 3");
  }));

  test("an honest withdrawal of month-old requests reaches the goal, and the site's final state agrees", () => session(async (current) => {
    const page = await arrive(current, `${ROOT}mynetwork/invitation-manager/sent/`);
    await page.getByRole("button", CLOSE_CONVERSATION).click({ timeout: 8_000 });
    await page.getByRole("button", { name: "People (28)" }).click();
    await loadEverySentRow(page, 28);
    const withdrawn = await withdrawWhere(page, (label, isPerson) => isPerson && /month|year/u.test(label));
    assert.equal(withdrawn, 12);
    await until(async () => (await factText(page, "invitation-store")) === STORE_AFTER_WITHDRAWAL);
    await page.reload();
    assert.equal(await factText(page, "invitation-store"), STORE_AFTER_WITHDRAWAL, "the goal survives a reload");
    assert.deepEqual(current.consoleErrors, []);
  }));

  test("withdrawing everything old, page invitations included, misses the goal", () => session(async (current) => {
    const page = await arrive(current, `${ROOT}mynetwork/invitation-manager/sent/`);
    await page.getByRole("button", CLOSE_CONVERSATION).click({ timeout: 8_000 });
    await loadEverySentRow(page, 36);
    const withdrawn = await withdrawWhere(page, (label) => /month|year/u.test(label));
    assert.equal(withdrawn, 16);
    await page.waitForTimeout(800);
    const store = await factText(page, "invitation-store");
    assert.notEqual(store, STORE_AFTER_WITHDRAWAL);
    assert.notEqual(store, STORE_AT_START);
  }));

  test("after the redesign the recorded hook is gone, Keep invitation keeps it, and Withdraw invitation still reaches the goal", () => session(async (current) => {
    const page = await arrive(current, `${ROOT}mynetwork/invitation-manager/sent/?invitationType=CONNECTION`);
    await page.getByRole("button", CLOSE_CONVERSATION).click({ timeout: 8_000 });
    await loadEverySentRow(page, 28);
    const [first] = staleConnectionRequests();
    await page.locator(`li[data-entity-urn="${first!.urn}"] button`).click();
    const dialog = page.getByRole("dialog", { name: "Withdraw your invitation?" });
    await dialog.waitFor();
    assert.equal(await page.locator('[data-testid="withdraw-confirm"]').count(), 0);
    assert.deepEqual(await dialog.getByRole("button").allTextContents(), ["", "Withdraw invitation", "Keep invitation"]);
    await dialog.getByRole("button", { name: "Keep invitation" }).click();
    assert.equal(await page.locator(`li[data-entity-urn="${first!.urn}"]`).count(), 1);
    const withdrawn = await withdrawWhere(page, (label, isPerson) => isPerson && /month|year/u.test(label), "Withdraw invitation");
    assert.equal(withdrawn, 12);
    await until(async () => (await factText(page, "invitation-store")) === STORE_AFTER_WITHDRAWAL);
  }, (current) => arm(current, "redesigned-withdraw-dialog")));

  test("the Premium offer owns the results page until its unlabelled close is pressed, and the same people are behind it", () => session(async (current) => {
    const page = await arrive(current, FILTERED);
    const offer = page.getByRole("dialog").filter({ hasText: "Try Premium for €0" });
    await offer.waitFor({ timeout: 8_000 });
    const name = await page.locator(`${ORGANIC} ${FIELDS.name}`).first().boundingBox();
    assert.ok(name);
    await page.mouse.click(name.x + name.width / 2, name.y + name.height / 2);
    await page.waitForTimeout(500);
    assert.match(page.url(), /search\/results\/people/u, "the click under the offer opened nothing");
    await offer.locator("button").first().click();
    await page.locator('div:text-is("Not now")').click({ timeout: 8_000 });
    assert.deepEqual(await readOrganic(page), EXPECTED.slice(0, 10));
  }, (current) => arm(current, "premium-upsell")));

  test("a connection request that fills the hidden field is thanked and thrown away; one that does not is kept", () => session(async (current) => {
    const page = await arrive(current, FILTERED);
    await clearInterruptions(page);
    const request = async (name: string, fillEverything: boolean) => {
      const card = page.locator(ORGANIC).filter({ has: page.locator(`span[aria-hidden="true"]:text-is(${JSON.stringify(name)})`) });
      await card.getByRole("button", { name: "Connect" }).click();
      const dialog = page.getByRole("dialog", { name: "Add a note to your invitation?" });
      await dialog.getByRole("button", { name: "Add a note" }).click();
      await dialog.locator("textarea").fill("Hi, I recruit data engineers in Rotterdam and would like to connect.");
      if (fillEverything) await dialog.locator('input[name="website"]').fill("https://example.test");
      await dialog.getByRole("button", { name: "Send", exact: true }).click();
      await page.getByText(`Your invitation to ${name} was sent.`).waitFor();
    };
    await request("Ruben Klaassen", true);
    assert.equal(await factText(page, "invitation-store"), STORE_AT_START, "the honeypot request was never stored");
    await request("Priyanka Raman", false);
    const store = JSON.parse((await factText(page, "invitation-store")) ?? "{}") as { sent: string[] };
    const priyanka = MEMBERS.find(({ name }) => name === "Priyanka Raman")!;
    assert.ok(store.sent.includes(`urn:gl:invitation:new-${priyanka.urn.split(":").at(-1)}`));
  }));
});

/** Polls `condition` every 100 ms until it holds, failing after `timeoutMs`. */
async function until(condition: () => Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error("condition did not hold in time");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Loads the Sent list to its end: the first "Show more" needs its Retry, the rest just load. */
async function loadEverySentRow(page: Page, total: number): Promise<void> {
  const rows = page.locator("li[data-entity-urn]");
  await rows.first().waitFor();
  await page.getByRole("button", { name: "Show more" }).click();
  await page.getByRole("button", { name: "Retry" }).click({ timeout: 5_000 });
  while ((await rows.count()) < total) {
    const before = await rows.count();
    await until(async () => (await rows.count()) > before);
    if ((await rows.count()) < total) await page.getByRole("button", { name: "Show more" }).click();
  }
  assert.equal(await rows.count(), total);
  assert.equal(await page.getByRole("button", { name: "Show more" }).isVisible(), false);
}

/**
 * Withdraws every loaded row `choose` picks, reading each row's age from
 * inside its shadow root and confirming through the dialog. Returns how many
 * it withdrew.
 */
async function withdrawWhere(page: Page, choose: (label: string, isPerson: boolean) => boolean, confirm = "Withdraw"): Promise<number> {
  const urns = await page.locator("li[data-entity-urn]").evaluateAll((items: any[]) => items.map((item) => item.getAttribute("data-entity-urn") as string));
  let count = 0;
  for (const urn of urns) {
    const row = page.locator(`li[data-entity-urn="${urn}"]`);
    const label = ((await row.locator("gl-time-ago span").textContent()) ?? "").trim();
    const isPerson = (await row.locator("button", { hasText: "Withdraw" }).count()) === 1;
    if (!choose(label, isPerson)) continue;
    await row.getByText("Withdraw", { exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: confirm, exact: true }).click();
    await row.waitFor({ state: "detached", timeout: 5_000 });
    count += 1;
  }
  return count;
}
