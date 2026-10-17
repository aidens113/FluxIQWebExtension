import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { closeLabSession } from "../../tests/close-lab-session.js";

/** One lab, one browser context, one page on the store's home page: a shopper's session. */
export type StoreSession = { lab: RunningScenarioLab; page: Page; close(): Promise<void> };

/** A card on a results page, read the way a person reads it. */
export type ReadCard = { sponsored: boolean; plus: boolean; name: string; price: string; rating: string; url: string };

const RUN_TOKEN = "everything-store-browser-token";
/** Far beyond any answer the in-process fixture gives, which is a few milliseconds even on a saturated machine. */
const CONTROL_TIMEOUT_MS = 15_000;

/**
 * Reads every listing card on a results page. What makes a card sponsored is
 * what a person sees: the word "Sponsored" above it. What makes it Plus is
 * the badge. The price is the one the card prints, the rating the number
 * beside the stars, the url where the title goes.
 */
const READ_CARDS = String.raw`[...document.querySelectorAll('[data-component="search-result"][data-sku]')].map((card) => {
  const title = card.querySelector('h2 a');
  const offers = card.querySelector('[itemprop="offers"]');
  const rating = card.querySelector('h2 + div span[aria-hidden="true"]');
  return {
    sponsored: [...card.children].some((child) => child.textContent.trim().startsWith('Sponsored')),
    plus: Boolean(card.querySelector('[aria-label="Brightaisle Plus"]')),
    name: title ? title.textContent.trim() : '',
    price: offers ? offers.querySelector('a > span > span').textContent.trim() : '',
    rating: rating ? rating.textContent.trim() : '',
    url: title ? title.getAttribute('href') : '',
  };
})`;

const READ_CART = String.raw`[...document.querySelectorAll('[data-name="Active Items"] [data-line]')].map((row) => ({
  item: row.querySelector('a[href*="/dp/"] > span').textContent.trim(),
  quantity: row.querySelector('[aria-live="polite"]').textContent.trim(),
  price: row.querySelector(':scope > p > span').textContent.trim(),
}))`;

/** One browser for every session, launched once however many sessions start at the same moment. */
let launching: Promise<Browser> | undefined;

/**
 * Opens a session. The lab is closed whatever fails after it starts, opening
 * or closing: a lab left open keeps the test file from ever exiting
 * (`closeLabSession`).
 */
async function openStore(mode?: string): Promise<StoreSession> {
  launching ??= chromium.launch({ channel: "chromium", headless: true });
  const browser = await launching;
  const lab = await startScenarioLab({ runToken: RUN_TOKEN, seed: 241 });
  let context: BrowserContext | undefined;
  try {
    if (mode) await control(lab, "/api/everything-store/set-mode", { mode });
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-US", timezoneId: "UTC" });
    const page = await context.newPage();
    await page.goto(`${lab.origin}/scenarios/everything-store/`);
    const opened = context;
    return { lab, page, close: () => closeLabSession(lab, opened) };
  } catch (error) {
    // The opening failure is the one to report; the lab is closed either way.
    await closeLabSession(lab, context).catch(() => undefined);
    throw error;
  }
}

/** A control or store API request. It is bounded, so a fixture that stops answering fails naming the request. */
async function control(lab: RunningScenarioLab, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${lab.origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${RUN_TOKEN}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }).catch((error: unknown) => { throw new Error(`${path} did not answer: ${String(error)}`, { cause: error }); });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
}

/** The store's state as the oracle endpoint reports it. */
async function storeState(lab: RunningScenarioLab): Promise<{ cart: Array<{ sku: string; quantity: number }>; orders: unknown[]; guard: { flagged: string | null } }> {
  const snapshot = await control(lab, "/__control/final-state?scenario=everything-store") as { state: never };
  return snapshot.state;
}

/** Each fact, checked the way the lanes check it: by test id, text trimmed, on the page as it stands. */
async function factFailures(page: Page, facts: readonly ExpectedFact[]): Promise<string[]> {
  const failures: string[] = [];
  for (const fact of facts) {
    const subject = page.locator(`[data-testid="${fact.subject}"]`).first();
    const count = await subject.count();
    const actual = fact.predicate === "text" ? (count ? (await subject.textContent())?.trim() ?? null : null)
      : fact.predicate === "exists" ? count > 0
        : fact.predicate === "visible" ? count > 0 && await subject.isVisible()
          : undefined;
    if (actual !== fact.value) failures.push(`${fact.id}: expected ${JSON.stringify(fact.value)}, found ${JSON.stringify(actual)}`);
  }
  return failures;
}

/**
 * What a patient shopper does first, in the recording's order
 * (`SHARED_STEPS.openStore`): turn down the notifications prompt when it
 * arrives, whose backdrop covers the page, cookie banner and all, until it is
 * answered; then accept cookies. Accepting first races the prompt, which a
 * loaded machine loses.
 */
async function settleIn(page: Page): Promise<void> {
  await page.getByRole("dialog", { name: "Never miss a deal" }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Not now" }).click();
  await page.getByRole("button", { name: "Accept" }).click();
}

/**
 * Waits until a product page has come alive, as the recordings do: the app
 * banner arrives two seconds into the page, after the buy box has hydrated
 * (`STORE_TIMINGS.appBanner` > `productHydrate`, both timed from the same
 * page load), and is closed. A press made before then is lost, so the banner
 * is the page's own sign that a press will count.
 */
async function awaitLiveProductPage(page: Page): Promise<void> {
  await page.getByTitle("Close", { exact: true }).waitFor({ timeout: 6000 });
  await page.getByTitle("Close", { exact: true }).click();
}

/**
 * Types the words into the search box, searches, and passes the browser check
 * the first search meets. Both waits are the page's own: the check's button
 * is named "Continue shopping" `softCheckButton` after its page loads, and the
 * results render `resultsHydrate` after theirs. A fixed six seconds counted
 * the navigations too, and on a loaded machine the navigation alone took
 * longer, so they keep Playwright's default bound instead.
 */
async function search(page: Page, words: string): Promise<void> {
  await page.getByRole("textbox", { name: "Search Brightaisle" }).fill(words);
  await page.getByRole("button", { name: "Go", exact: true }).first().click();
  await page.getByRole("button", { name: "Continue shopping" }).click();
  await page.locator(`[data-component="search-result"][data-sku]`).first().waitFor();
}

/** Scrolls until the page's last result has loaded, as a reader who reaches the bottom does. */
async function readWholePage(page: Page, lastIndex: number): Promise<ReadCard[]> {
  const last = page.locator(`[data-component="search-result"][data-index="${lastIndex}"]`);
  for (let attempt = 0; attempt < 10 && await last.count() === 0; attempt += 1) {
    await page.mouse.wheel(0, 4000);
    await pause(400);
  }
  await last.waitFor({ timeout: 4000 });
  return page.evaluate(READ_CARDS) as Promise<ReadCard[]>;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A recording's target as Playwright finds it: `role:<role>:<name>`, `testid:<id>`, or a selector. */
function locate(page: Page, target: string) {
  const role = /^role:([a-z]+):(.+)$/u.exec(target);
  if (role) return page.getByRole(role[1] as Parameters<Page["getByRole"]>[0], { name: role[2] ?? "", exact: true });
  if (target.startsWith("testid:")) return page.getByTestId(target.slice("testid:".length));
  return page.locator(target);
}

/** An extract step's rows: each match of the target, each field its first match's trimmed text, or `@attribute`. */
const EXTRACT = String.raw`({ target, fields }) => [...document.querySelectorAll(target)].map((row) => Object.fromEntries(Object.entries(fields).map(([key, spec]) => {
  const at = spec.lastIndexOf('@');
  const [selector, attribute] = at > 0 ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, null];
  const node = row.querySelector(selector);
  return [key, node ? (attribute ? node.getAttribute(attribute) ?? '' : node.textContent.trim()) : ''];
})))`;

/**
 * Plays a workflow's recording in the session, step by step, as written, and
 * returns what each extract step read. Only the operations the store's
 * recordings use are known; any other fails the test naming it, so a
 * recording can never pass here by a step being skipped. A check sets the
 * box only when it differs, because checkout reloads on every change and a
 * check that verified afterwards would read the reloading page.
 */
async function playRecording(session: StoreSession, steps: readonly ScenarioStep[]): Promise<Record<string, Array<Record<string, string>>>> {
  const { page, lab } = session;
  const read: Record<string, Array<Record<string, string>>> = {};
  for (const step of steps) {
    const target = step.target === undefined ? undefined : locate(page, step.target).first();
    if (step.operation === "navigate") await page.goto(`${lab.origin}${step.path ?? ""}`);
    else if (step.operation === "waitForState") await target!.waitFor({ state: "visible", timeout: step.timeoutMs ?? 5000 });
    else if (step.operation === "click") await target!.click({ timeout: step.timeoutMs ?? CONTROL_TIMEOUT_MS });
    else if (step.operation === "type") await target!.fill(String(step.value ?? ""));
    else if (step.operation === "select") await target!.selectOption(String(step.value ?? ""));
    else if (step.operation === "check") { if (await target!.isChecked() !== (step.value === true)) await target!.click(); }
    else if (step.operation === "scroll") await page.mouse.wheel(0, Number(step.value ?? 0));
    else if (step.operation === "extract") read[step.id] = await page.evaluate(`(${EXTRACT})(${JSON.stringify({ target: step.target, fields: step.fields ?? {} })})`) as Array<Record<string, string>>;
    else if (step.operation !== "checkpoint") throw new Error(`${step.id}: the player does not know ${step.operation}`);
  }
  return read;
}

/** The browser session helpers the scenario's path tests share. */
export const BROWSER_KIT = {
  openStore,
  control,
  storeState,
  factFailures,
  settleIn,
  awaitLiveProductPage,
  search,
  readWholePage,
  readCart: (page: Page) => page.evaluate(READ_CART) as Promise<Array<Record<string, string>>>,
  playRecording,
  pause,
  closeBrowser: async () => {
    const opened = launching;
    launching = undefined;
    if (opened) await (await opened).close();
  },
};
