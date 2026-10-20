import assert from "node:assert/strict";
import { after, test } from "node:test";
import { UNSUBSCRIBE_CONFIRM_TEXT } from "../client/index.js";
import { QUOTE_INPUT } from "../expectations.js";
import { quoteDrawerIds } from "../pages/index.js";
import { routeCompanyWebsite } from "../route.js";
import { companyWebsiteScenario } from "../scenario.js";
import { createCompanyWebsiteState, mutateCompanyWebsiteState } from "../state.js";
import { siteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";
import { closeBrowser, mutate, serverState, withSite } from "./site-driver.js";

/**
 * The two modes the content-harness specs arm because no realistic page
 * otherwise has the construct: `confirm-unsubscribe`, a native
 * `window.confirm` on the newsletter page's "Unsubscribe", and
 * `reworded-quote-submit`, a quote submit restyled down to its accessible
 * name. Each leaves the default site as it was.
 */
after(closeBrowser);

const SEED = 4519;
const EMAIL = "ada.synthetic@example.test";
const context = { runToken: "company-website-token", seed: SEED };
const ids = quoteDrawerIds(SEED);
const newsletterPage = (state: CompanyWebsiteState) => routeCompanyWebsite(state, { subpath: "newsletter", query: new URLSearchParams(), method: "GET" }, context)?.body ?? "";
const subscribed = (mode: CompanyWebsiteState["mode"]) => mutateCompanyWebsiteState(createCompanyWebsiteState(mode), "subscribe-newsletter", { email: EMAIL });
const attr = (id: string) => `id="${id}"`;

test("confirm-unsubscribe counts each answer, and the default site counts none", () => {
  const armed = subscribed("confirm-unsubscribe");
  assert.deepEqual(armed.newsletter.unsubscribePrompts, { accepted: 0, dismissed: 0 }, "signing up keeps the counts");
  const declined = mutateCompanyWebsiteState(armed, "unsubscribe-declined", { email: EMAIL });
  assert.deepEqual(declined.newsletter, { dismissed: true, subscribers: [EMAIL], unsubscribePrompts: { accepted: 0, dismissed: 1 } });
  const accepted = mutateCompanyWebsiteState(declined, "unsubscribe-newsletter", { email: EMAIL });
  assert.deepEqual(accepted.newsletter, { dismissed: true, subscribers: [], unsubscribePrompts: { accepted: 1, dismissed: 1 } });
  assert.equal(mutateCompanyWebsiteState(accepted, "unsubscribe-declined", { email: EMAIL }), accepted, "an address no longer on the list has nothing to decline");

  const baseline = subscribed("baseline");
  assert.equal(mutateCompanyWebsiteState(baseline, "unsubscribe-declined", { email: EMAIL }), baseline, "the default page never asks, so it never posts a no");
  assert.deepEqual(mutateCompanyWebsiteState(baseline, "unsubscribe-newsletter", { email: EMAIL }).newsletter.unsubscribePrompts, { accepted: 0, dismissed: 0 });
});

test("confirm-unsubscribe's page asks the browser before it unsubscribes; the default page does not", () => {
  const armed = newsletterPage(subscribed("confirm-unsubscribe"));
  assert.match(armed, /const confirmUnsubscribe = true;/u);
  assert.ok(armed.includes(`window.confirm(${JSON.stringify(UNSUBSCRIBE_CONFIRM_TEXT)})`));
  assert.match(armed, /role="status" data-unsubscribe-status/u);
  assert.doesNotMatch(UNSUBSCRIBE_CONFIRM_TEXT, /hook|test|fixture|variant|mode/iu, "the question reads like the site's own");

  const baseline = newsletterPage(subscribed("baseline"));
  assert.match(baseline, /const confirmUnsubscribe = false;/u);
  assert.doesNotMatch(baseline, /role="status" data-unsubscribe-status/u, "no status line on the default page");
  assert.match(baseline, /data-unsubscribe="ada\.synthetic@example\.test">Unsubscribe</u);
});

test("reworded-quote-submit keeps only the submit's accessible name; the default drawer is unchanged", () => {
  const c = siteClasses(SEED);
  const restyled = companyWebsiteScenario.render(mutateCompanyWebsiteState(createCompanyWebsiteState(), "set-mode", { mode: "reworded-quote-submit" }), context);
  assert.ok(restyled.includes(`<button type="button" class="${c.footerSubmit}" ${attr(ids.restyledSend)} aria-label="Send request" hidden>Send</button>`));
  assert.doesNotMatch(restyled, /\sdata-testid="quote-submit"/u);
  assert.ok(!restyled.includes(attr(ids.send)), "the recorded id is gone");
  assert.doesNotMatch(restyled, />Send request</u, "the recorded text is gone");
  assert.notEqual(c.footerSubmit, c.buttonPrimary);
  assert.ok(restyled.includes(attr(ids.back)) && !restyled.includes(attr(ids.draft)) && !restyled.includes(attr(ids.headerSend)), "Back stays beside it, and nothing else was redesigned");

  const baseline = companyWebsiteScenario.render(createCompanyWebsiteState(), context);
  assert.ok(baseline.includes(`<button type="button" class="${c.buttonPrimary}" ${attr(ids.send)} data-testid="quote-submit" hidden>Send request</button>`));
  assert.ok(!baseline.includes(attr(ids.restyledSend)));
  assert.doesNotMatch(baseline, /aria-label="Send request"/u);
});

test("confirm-unsubscribe in a browser: a no keeps the address, a yes removes it in place, and both are counted", async () => withSite(async ({ lab, page, consoleErrors }) => {
  await mutate(lab, "set-consent", { choice: "essential" });
  await mutate(lab, "dismiss-chat-greeting", {});
  await mutate(lab, "subscribe-newsletter", { email: EMAIL });
  await page.goto(`${lab.origin}/scenarios/company-website/newsletter`);
  const unsubscribe = page.getByRole("button", { name: "Unsubscribe" });

  const messages: string[] = [];
  page.once("dialog", (dialog) => {
    messages.push(`${dialog.type()}:${dialog.message()}`);
    void dialog.dismiss();
  });
  await unsubscribe.click();
  await waitFor(async () => (await serverState(lab)).newsletter.unsubscribePrompts.dismissed === 1);
  assert.deepEqual(messages, [`confirm:${UNSUBSCRIBE_CONFIRM_TEXT}`]);
  assert.equal(await unsubscribe.count(), 1, "the row stays");

  page.once("dialog", (dialog) => void dialog.accept());
  await unsubscribe.click();
  await page.getByRole("status").filter({ hasText: "Unsubscribed." }).waitFor();
  assert.equal(await unsubscribe.count(), 0, "the row is gone without a reload");
  assert.deepEqual((await serverState(lab)).newsletter, { dismissed: true, subscribers: [], unsubscribePrompts: { accepted: 1, dismissed: 1 } });
  assert.deepEqual(consoleErrors, []);
}, { arm: { operation: "set-mode", payload: { mode: "confirm-unsubscribe" } } }));

test("reworded-quote-submit in a browser: \"Send\" still sends the request through the human check", async () => withSite(async ({ lab, page }) => {
  await mutate(lab, "set-consent", { choice: "essential" });
  await mutate(lab, "dismiss-newsletter", {});
  await mutate(lab, "dismiss-chat-greeting", {});
  await page.goto(`${lab.origin}/scenarios/company-website/`);
  const byId = (id: string) => page.locator(`[id="${id}"]`);
  await page.click("header button[data-open-quote]");
  for (const name of ["fullName", "email", "phone", "postcode"] as const) await byId(ids.fields[name]!).fill(QUOTE_INPUT[name]);
  await byId(ids.next).click();
  await byId(ids.select).click();
  await page.click(`[data-value="${QUOTE_INPUT.service}"]`);
  await byId(ids.next).click();
  await byId(ids.fields.privacy!).check();
  const send = page.getByRole("button", { name: "Send request", exact: true });
  assert.equal(await send.textContent(), "Send");
  await send.click();
  await page.getByText("Confirm you are human", { exact: true }).click({ timeout: 10_000 });
  await page.waitForURL(/\/quote\/received\?ref=/u);
  const state = await serverState(lab);
  assert.deepEqual({ quotes: state.quotes.length, drafts: state.drafts, mode: state.mode }, { quotes: 1, drafts: 0, mode: "reworded-quote-submit" });
}, { arm: { operation: "set-mode", payload: { mode: "reworded-quote-submit" } } }));

async function waitFor(condition: () => Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error("condition not met in time");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
