import { expect, type Page } from "@playwright/test";
import { getScenario } from "../src/registry.js";
import type { RunningScenarioLab } from "../src/server.js";
import { readFinalState, test } from "./lab-fixture.js";

/**
 * The platform facts decision D5 rests on, measured in Chromium on realistic
 * pages rather than asserted: a synthetic `KeyboardEvent` reaches a page's own
 * listeners but performs no default action. The extension's keyboard
 * emulation (`apps/extension/src/content/action-runtime/keyboard/`) exists
 * because of exactly these three facts, and its content-harness rows
 * (`apps/extension/e2e/content/tests/keyboard.spec.ts`) prove what it does
 * about them. These rows prove the facts themselves, with plain Playwright and
 * no extension:
 *
 * - untrusted keystrokes drive a page's `input` listeners (everything-store's
 *   suggestion list opens and filters), but an untrusted Enter never submits
 *   the form, where a trusted one does;
 * - `form.requestSubmit()` with no argument submits but reports no submitter,
 *   where a trusted Enter reports the form's default button
 *   (company-website's newsletter form);
 * - a radio group's arrow keys move the selection only for trusted input
 *   (company-website's quote drawer, "How should we get back to you?").
 *
 * Moved here from the synthetic keyboard-forms page spec, which t730 retired.
 */

/** Posts one of a scenario's own page mutations, as its page's `mutate` does. */
async function mutate(lab: RunningScenarioLab, scenarioId: string, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${lab.origin}/api/${scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  expect(response.status, `${scenarioId} ${operation}`).toBe(200);
}

const SUGGESTIONS = '[role="listbox"][aria-label="Search suggestions"]';

// Each test opens a page on a full realistic site; on a loaded machine that
// page set-up alone has taken the config's whole 20 s, so each test gets 60 s
// to cover its own page and the site's first load, not to wait longer for an answer.
test.describe.configure({ timeout: 60_000 });

test.describe("everything-store's header search", () => {
  test.use({ labSeed: getScenario("everything-store")!.seed });

  test("D5 evidence: untrusted keystrokes drive the suggestion list, but an untrusted Enter never submits the search form", async ({ page, lab, networkGuard: _guard }) => {
    // Consent and the notifications prompt (which makes the page inert) answered, as a returning shopper finds them.
    await mutate(lab, "everything-store", "consent", { choice: "accept" });
    await mutate(lab, "everything-store", "dismiss-nudge", { nudge: "notifications" });
    const home = `${lab.origin}/scenarios/everything-store/`;
    await page.goto(home);

    const evidence = await page.evaluate((listbox) => {
      const input = document.querySelector('input[name="k"]') as HTMLInputElement;
      const form = input.form!;
      let submits = 0;
      form.addEventListener("submit", () => { submits += 1; });
      const key = (type: string, value: string) => input.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true }));
      input.focus();
      // What the extension's typing emulation does per character: keydown, value change, input, keyup.
      for (const character of "elec") {
        key("keydown", character);
        input.value += character;
        input.dispatchEvent(new InputEvent("input", { bubbles: true, data: character, inputType: "insertText" }));
        key("keyup", character);
      }
      const list = document.querySelector(listbox) as HTMLElement;
      const options = Array.from(list.querySelectorAll('[role="option"]')).map((option) => option.textContent);
      // What a bare synthetic Enter does: nothing the browser would do for a trusted one.
      key("keydown", "Enter");
      key("keyup", "Enter");
      return { openedByUntrustedInput: !list.hidden, options, submitsAfterUntrustedEnter: submits };
    }, SUGGESTIONS);
    expect(evidence).toEqual({
      openedByUntrustedInput: true,
      options: ["tidewell electric kettle", "electric kettle", "electric kettle glass"],
      submitsAfterUntrustedEnter: 0,
    });
    expect(page.url()).toBe(home);

    // The control: a trusted Enter in the same field submits the GET form natively.
    await page.locator('input[name="k"]').press("Enter");
    await page.waitForURL((url) => url.pathname.endsWith("/s") && url.searchParams.get("k") === "elec");
  });
});

test.describe("company-website", () => {
  test.use({ labSeed: getScenario("company-website")!.seed });

  /** Consent, the newsletter offer and the chat greeting answered, as a returning visitor finds them. */
  async function quiet(lab: RunningScenarioLab): Promise<void> {
    await mutate(lab, "company-website", "set-consent", { choice: "all" });
    await mutate(lab, "company-website", "dismiss-newsletter");
    await mutate(lab, "company-website", "dismiss-chat-greeting");
  }

  /**
   * Records each submit of the newsletter form's submitter in sessionStorage,
   * because the page's own handler reloads once it has posted the address.
   */
  async function recordSubmitters(page: Page): Promise<void> {
    await page.evaluate(() => {
      document.querySelector("form[data-newsletter-form]")!.addEventListener("submit", (event) => {
        const submitter = (event as SubmitEvent).submitter;
        const seen = JSON.parse(sessionStorage.getItem("d5-submitters") ?? "[]") as Array<string | null>;
        seen.push(submitter ? submitter.textContent : null);
        sessionStorage.setItem("d5-submitters", JSON.stringify(seen));
      }, { capture: true });
    });
  }

  test("D5 evidence: requestSubmit() with no argument has no submitter; a trusted Enter reports the Sign me up button", async ({ page, lab, networkGuard: _guard }) => {
    await quiet(lab);
    const newsletter = `${lab.origin}/scenarios/company-website/newsletter`;
    await page.goto(newsletter);
    const email = page.locator('form[data-newsletter-form] input[name="email"]');

    await recordSubmitters(page);
    await email.fill("ada@example.com");
    // `form.requestSubmit()`, an Enter emulation that names no button.
    await page.evaluate(() => (document.querySelector("form[data-newsletter-form]") as HTMLFormElement).requestSubmit());
    await expect(page.getByRole("region", { name: "Your subscriptions" })).toContainText("ada@example.com");

    await recordSubmitters(page);
    await email.fill("grace@example.com");
    await email.press("Enter");
    await expect(page.getByRole("region", { name: "Your subscriptions" })).toContainText("grace@example.com");

    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("d5-submitters") ?? "[]"))).toEqual([null, "Sign me up"]);
    expect((await readFinalState<{ newsletter: { subscribers: string[] } }>(lab, "company-website")).newsletter.subscribers).toEqual(["ada@example.com", "grace@example.com"]);
  });

  test("D5 evidence: the quote drawer's contact radios move on arrow keys only for trusted input", async ({ page, lab, networkGuard: _guard }) => {
    await quiet(lab);
    await page.goto(`${lab.origin}/scenarios/company-website/`);
    await page.locator('header button:text-is("Get a free quote")').click();
    const drawer = page.locator("[data-quote-drawer]");
    await drawer.locator('input[name="fullName"]').fill("Ada Lovelace");
    await drawer.locator('input[name="email"]').fill("ada@example.com");
    await drawer.locator('input[name="phone"]').fill("01632 960001");
    await drawer.locator('input[name="postcode"]').fill("BS1 4DJ");
    await drawer.locator('button:text-is("Continue")').click();

    const phone = drawer.getByRole("radio", { name: "Phone" });
    await expect(phone).toBeChecked();
    await phone.focus();
    await phone.dispatchEvent("keydown", { key: "ArrowDown" });
    await expect(phone).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(drawer.getByRole("radio", { name: "Email" })).toBeChecked();
    await expect(phone).not.toBeChecked();
  });
});
