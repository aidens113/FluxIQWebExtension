import assert from "node:assert/strict";
import { after, test } from "node:test";
import { QUOTE_INPUT } from "../expectations.js";
import { quoteDrawerIds } from "../pages/index.js";
import { companyWebsiteScenario } from "../scenario.js";
import { createCompanyWebsiteState, mutateCompanyWebsiteState } from "../state.js";
import { siteClasses } from "../styles.js";
import type { SiteMode } from "../types.js";
import { closeBrowser, mutate, serverState, withSite } from "./site-driver.js";

/**
 * Three redeploys the identity-veto specs arm:
 * - `quotes-paused`: the quote drawer's last step can only save a draft, and
 *   that button wears the primary style Send request wore.
 * - `phone-quotes`: the header's and the hero's "Get a free quote" are gone,
 *   and a call button with no words, drawn by the header's button component,
 *   stands in the top strip.
 * - `quote-footer-redesign`: the drawer's footer puts Continue ahead of Back,
 *   and its submit has moved to a new UI kit: new classes, no analytics test
 *   id, and the text "Send", but the same generated id.
 * The default site is unchanged by each.
 */
after(closeBrowser);

const SEED = 4519;
const context = { runToken: "company-website-token", seed: SEED };
const c = siteClasses(SEED);
const ids = quoteDrawerIds(SEED);
const home = (mode: SiteMode) => companyWebsiteScenario.render(mutateCompanyWebsiteState(createCompanyWebsiteState(), "set-mode", { mode }), context);
const attr = (id: string) => `id="${id}"`;

test("quotes-paused: Send request's slot holds a primary Save and finish later, and nothing on the step sends", () => {
  const paused = home("quotes-paused");
  assert.ok(paused.includes(`<button type="button" class="${c.buttonPrimary}" ${attr(ids.draft)} hidden>Save and finish later</button>`));
  assert.ok(!paused.includes(attr(ids.send)) && !paused.includes(attr(ids.headerSend)) && !paused.includes(attr(ids.restyledSend)), "no control on the step sends");
  assert.doesNotMatch(paused, /data-testid="quote-submit"/u);
  assert.match(paused, /new quote requests are paused until 3 November/u);
  assert.ok(paused.includes(attr(ids.back)), "Back stays beside it");

  const baseline = companyWebsiteScenario.render(createCompanyWebsiteState(), context);
  assert.ok(baseline.includes(`<button type="button" class="${c.buttonPrimary}" ${attr(ids.send)} data-testid="quote-submit" hidden>Send request</button>`));
  assert.doesNotMatch(baseline, /quote requests are paused/u);
});

test("phone-quotes: the header and hero lose their quote buttons, and the top strip gains a wordless call button in the header's style", () => {
  const phone = home("phone-quotes");
  const header = /<header[\s\S]*?<\/header>/u.exec(phone)![0];
  assert.doesNotMatch(header, /<button/u, "the header has no button left");
  assert.doesNotMatch(/<section class="[^"]+">\s*<h1[\s\S]*?<\/section>/u.exec(phone)![0], /data-open-quote/u, "nor does the hero");
  const strip = new RegExp(`<div class="${c.topBar}">[\\s\\S]*?</div>`, "u").exec(phone)![0];
  const call = /<button[^>]*>[\s\S]*?<\/button>/u.exec(strip)?.[0] ?? "";
  assert.match(call, new RegExp(`^<button type="button" class="${c.headerCta}" data-call-office><svg aria-hidden="true"`, "u"));
  assert.equal(call.replace(/<[^>]+>/gu, "").trim(), "", "the call button carries no words");
  assert.doesNotMatch(call, /\s(?:id|aria-label|title|name|data-testid)=/u, "and no name or identifier");
  assert.match(phone, /data-open-quote>Request a quote</u, "the footer's old link still opens the drawer");

  const baseline = companyWebsiteScenario.render(createCompanyWebsiteState(), context);
  assert.ok(baseline.includes(`<button type="button" class="${c.headerCta}" data-open-quote>Get a free quote</button>`));
  assert.doesNotMatch(baseline, /\sdata-call-office>/u, "no call button on the default site");
});

test("quotes-paused in a browser: the step's only action files a draft, and no quote is sent", async () => withSite(async ({ lab, page }) => {
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
  const visible = page.locator(`section[role=dialog] button.${c.buttonPrimary}:visible`);
  assert.deepEqual(await visible.allTextContents(), ["Save and finish later"]);
  await visible.click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  const state = await serverState(lab);
  assert.deepEqual({ drafts: state.drafts, quotes: state.quotes.length, mode: state.mode }, { drafts: 1, quotes: 0, mode: "quotes-paused" });
}, { arm: { operation: "set-mode", payload: { mode: "quotes-paused" } } }));

test("phone-quotes in a browser: the call button is in view with a box, and the footer link still opens the drawer", async () => withSite(async ({ lab, page, consoleErrors }) => {
  await mutate(lab, "set-consent", { choice: "essential" });
  await mutate(lab, "dismiss-newsletter", {});
  await mutate(lab, "dismiss-chat-greeting", {});
  await page.goto(`${lab.origin}/scenarios/company-website/`);
  const box = await page.locator("[data-call-office]").boundingBox();
  assert.ok(box && box.width >= 24 && box.height >= 24 && box.y >= 0 && box.y < 120, `the call button sits in the top strip: ${JSON.stringify(box)}`);
  assert.equal(await page.locator(`button.${c.headerCta}`).count(), 1, "the only control in the header's style");
  await page.locator("footer [data-open-quote]").click();
  await page.getByRole("dialog", { name: "Get a free quote" }).waitFor();
  assert.deepEqual(consoleErrors, []);
}, { arm: { operation: "set-mode", payload: { mode: "phone-quotes" } } }));

/** The quote drawer's footer, as rendered: the buttons in their order. */
const footerButtons = (html: string) => {
  const footer = new RegExp(`<div class="${c.drawerFoot}">([\\s\\S]*?)</div>`, "u").exec(html)![1]!;
  return [...footer.matchAll(/<button[^>]*>[^<]*<\/button>/gu)].map(([button]) => button);
};

test("quote-footer-redesign: Continue moves ahead of Back, and Send request keeps only its id", () => {
  const redesigned = footerButtons(home("quote-footer-redesign"));
  assert.deepEqual(redesigned, [
    `<button type="button" class="${c.buttonPrimary}" ${attr(ids.next)}>Continue</button>`,
    `<button type="button" class="${c.button}" ${attr(ids.back)} disabled>Back</button>`,
    `<button type="button" class="ui-button ui-button--accent" ${attr(ids.send)} hidden>Send</button>`,
  ]);

  const baseline = footerButtons(companyWebsiteScenario.render(createCompanyWebsiteState(), context));
  assert.deepEqual(baseline, [
    `<button type="button" class="${c.button}" ${attr(ids.back)} disabled>Back</button>`,
    `<button type="button" class="${c.buttonPrimary}" ${attr(ids.next)}>Continue</button>`,
    `<button type="button" class="${c.buttonPrimary}" ${attr(ids.send)} data-testid="quote-submit" hidden>Send request</button>`,
  ]);
  assert.doesNotMatch(companyWebsiteScenario.render(createCompanyWebsiteState(), context), /class="ui-button/u, "no element on the default site wears the new kit");
});

test("quote-footer-redesign in a browser: the reordered Continue still steps on, and Send still sends through the human check", async () => withSite(async ({ lab, page, consoleErrors }) => {
  await mutate(lab, "set-consent", { choice: "essential" });
  await mutate(lab, "dismiss-newsletter", {});
  await mutate(lab, "dismiss-chat-greeting", {});
  await page.goto(`${lab.origin}/scenarios/company-website/`);
  const byId = (id: string) => page.locator(`[id="${id}"]`);
  await page.click("header button[data-open-quote]");
  for (const name of ["fullName", "email", "phone", "postcode"] as const) await byId(ids.fields[name]!).fill(QUOTE_INPUT[name]);
  await page.locator("section[role=dialog] > div:last-child > button:first-of-type").click();
  await byId(ids.steps[1]).waitFor();
  await byId(ids.select).click();
  await page.click(`[data-value="${QUOTE_INPUT.service}"]`);
  await byId(ids.next).click();
  await byId(ids.fields.privacy!).check();
  const send = page.getByRole("button", { name: "Send", exact: true });
  assert.equal(await send.getAttribute("id"), ids.send);
  const box = await send.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, "the new kit draws the button");
  await send.click();
  await page.getByText("Confirm you are human", { exact: true }).click({ timeout: 10_000 });
  await page.waitForURL(/\/quote\/received\?ref=/u);
  const state = await serverState(lab);
  assert.deepEqual({ quotes: state.quotes.length, drafts: state.drafts, mode: state.mode }, { quotes: 1, drafts: 0, mode: "quote-footer-redesign" });
  assert.deepEqual(consoleErrors, []);
}, { arm: { operation: "set-mode", payload: { mode: "quote-footer-redesign" } } }));
