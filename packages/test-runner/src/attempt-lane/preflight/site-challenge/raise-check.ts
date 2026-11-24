import type { Page } from "@playwright/test";

/** One short step a visitor takes; a step that cannot be taken fails by its own name, never by a bare timeout. */
async function step(name: string, act: () => Promise<unknown>): Promise<void> {
  try {
    await act();
  } catch {
    throw new Error(`preflight_raise_${name}`);
  }
}

/**
 * Brings a page-raised check up the way a visitor does, on the scenario's own tab. The Lab does this and never the
 * product: the run that follows opens on the check and must hand it over.
 */
export async function raiseSiteCheck(scenarioId: string, page: Page, origin: string, startPath: string): Promise<void> {
  if (scenarioId === "bigbox-retail") return raiseResultsCheck(page, origin, startPath);
  if (scenarioId === "company-website") return raiseQuoteCheck(page, origin, startPath);
  throw new Error(`preflight_no_raiser_for_${scenarioId}`);
}

/** The third results document served since a reset is replaced by the bot check, whichever search it is. */
async function raiseResultsCheck(page: Page, origin: string, startPath: string): Promise<void> {
  for (let load = 0; load < 3; load += 1) await step("results_load", () => page.goto(`${origin}${startPath}search?q=paper+towels`, { waitUntil: "domcontentloaded" }));
}

/** Sending the quote form starts the human check: fill the three steps of the drawer and press Send request. */
async function raiseQuoteCheck(page: Page, origin: string, startPath: string): Promise<void> {
  const wait = { timeout: 8_000 };
  await step("open_site", () => page.goto(`${origin}${startPath}`, { waitUntil: "domcontentloaded" }));
  // The consent banner takes every click until a visitor answers it; declining everything optional is the least a visitor does.
  const decline = page.getByRole("button", { name: "Reject non-essential" });
  if (await decline.isVisible().catch(() => false)) await step("consent", () => decline.click(wait));
  // Two things open over the page a moment after it loads: the chat widget's greeting card (1.8 s), over the drawer's footer where Send request stands, and the offers popup (4 s), which takes every click. A visitor closes both before asking for a quote.
  await page.getByTitle("Close", { exact: true }).click({ timeout: 3_000 }).catch(/* best-effort: the card is closed already or never opened */ () => undefined);
  await page.getByText("No thanks, I will pay full price").click({ timeout: 6_000 }).catch(/* best-effort: the popup is dismissed already or never opened */ () => undefined);
  await step("open_drawer", () => page.getByRole("button", { name: "Get a free quote" }).first().click(wait));
  await step("about_you", async () => {
    await page.getByLabel("Full name").fill("Preflight Visitor", wait);
    await page.getByLabel("Email address").fill("visitor@example.test", wait);
    await page.getByLabel("Phone number").fill("07700 900123", wait);
    await page.getByLabel("Postcode of the property").fill("KL6 2RN", wait);
    await page.getByRole("button", { name: "Continue" }).click(wait);
  });
  await step("your_job", async () => {
    await page.getByText("Choose a service").click(wait);
    await page.locator("[data-value]").first().click(wait);
    await page.getByRole("button", { name: "Continue" }).click(wait);
  });
  await step("send", async () => {
    await page.getByLabel("I agree to Kestrel Lane contacting me").check(wait);
    await page.getByRole("button", { name: "Send request" }).click(wait);
  });
}
