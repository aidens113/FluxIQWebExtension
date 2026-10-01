// The interference defence never clears the layer an action's own target sits
// in, through the real content-script bundle on company-website (T2 harness:
// no background worker, no Core, no model). The oracle is the Scenario Lab's
// own state and the page itself, never the reply alone.
//
// The quote drawer and the consent wall are both painted `aria-modal` layers,
// and until 2026-10-01 the defence and the classifier took the first painted
// modal for the obstacle whatever the step was doing inside it (lane A,
// `t174-w35`): a press on the wall's "Accept all" under the chat greeting had
// the wall declined and reported the button missing; Continue under the
// greeting, or a field typed under the newsletter offer, closed the drawer the
// step was filling; and an option the drawer had not shown yet was put down to
// the drawer, which was then closed. Sibling layers -- the greeting, the offer,
// a consent wall over a target not drawn yet -- are still cleared.

import type { Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type SiteState = {
  consent: string;
  newsletter: { dismissed: boolean; subscribers: string[] };
  chat: { greetingDismissed: boolean };
};

const CONTINUE = "[data-quote-drawer] section > div:last-child > button:nth-of-type(2)";
const FAUX_SELECT = '[data-quote-drawer] fieldset:nth-of-type(2) div[tabindex="0"]';
const COMBI = '[data-value="Combi boiler replacement"]';

const actualOf = (reply: BrowserActionResult): string => (reply.validation.status === "none" ? "" : reply.validation.actual);

/** One site operation, as the page's own scripts send it. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

async function reload(harness: ContentHarness): Promise<void> {
  await harness.page.goto(harness.url);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

const siteState = async (harness: ContentHarness): Promise<SiteState> => (await harness.finalState()).state as unknown as SiteState;

const drawerOpen = (page: Page): Promise<boolean> => page.locator("[data-quote-drawer]").evaluate((element) => !(element as HTMLElement).hidden);

async function fillStepOne(page: Page): Promise<void> {
  await page.fill('input[name="fullName"]', "Ada Synthetic");
  await page.fill('input[name="email"]', "ada.synthetic@example.test");
  await page.fill('input[name="phone"]', "07700 900123");
  await page.fill('input[name="postcode"]', "KL6 2RN");
}

test.describe("company-website: the defence spares the layer the step is working in", () => {
  test.setTimeout(90_000);

  test("Accept all on the consent wall, under the chat greeting: the greeting is closed, the press lands, consent is all", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await expect(page.locator('[title="Close"]'), "the greeting opens on its timer, over the wall's buttons").toBeVisible({ timeout: 10_000 });
    const reply = await harness.runAction({ commandId: "accept-all", actionType: "web.dom.click", selector: 'button[data-choice="all"]' });
    const state = await siteState(harness);
    expect(reply.status, `${reply.message} | ${actualOf(reply)}`).toBe("succeeded");
    expect(state.consent, "the step's own answer, never the defence's decline").toBe("all");
    expect(state.chat.greetingDismissed, "the greeting over the wall was what got cleared").toBe(true);
  });

  test("Continue under the chat greeting, drawer open on step 1: the greeting is closed, the drawer stays, step 2 shows", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await apply(harness, "set-consent", { choice: "essential" });
    await apply(harness, "dismiss-newsletter");
    await reload(harness);
    await expect(page.locator('[title="Close"]')).toBeVisible({ timeout: 10_000 });
    await page.locator("header [data-open-quote]").click();
    await fillStepOne(page);
    const reply = await harness.runAction({ commandId: "continue", actionType: "web.dom.click", selector: CONTINUE });
    expect(await drawerOpen(page), "the form the step is filling is never closed").toBe(true);
    expect(reply.status, `${reply.message} | ${actualOf(reply)}`).toBe("succeeded");
    await expect(page.locator(FAUX_SELECT)).toBeVisible();
  });

  test("the newsletter offer opens over the open drawer: typing step 1 closes the offer, not the drawer", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await apply(harness, "set-consent", { choice: "essential" });
    await apply(harness, "dismiss-chat-greeting");
    await reload(harness);
    await page.locator("header [data-open-quote]").click();
    await expect(page.getByRole("dialog", { name: "Newsletter" })).toBeVisible({ timeout: 10_000 });
    const reply = await harness.runAction({ commandId: "type-name", actionType: "web.dom.type", selector: 'input[name="fullName"]', text: "Ada Synthetic" });
    expect(await drawerOpen(page), "the defence closed the offer, not the drawer").toBe(true);
    expect(reply.status, `${reply.message} | ${actualOf(reply)}`).toBe("succeeded");
    expect(await page.locator('input[name="fullName"]').inputValue()).toBe("Ada Synthetic");
    expect((await siteState(harness)).newsletter).toMatchObject({ dismissed: true, subscribers: [] });
  });

  test("an option the open drawer holds but has not shown is refused as hidden, and the drawer stays open", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await apply(harness, "set-consent", { choice: "essential" });
    await apply(harness, "dismiss-newsletter");
    await apply(harness, "dismiss-chat-greeting");
    await reload(harness);
    await page.locator("header [data-open-quote]").click();
    await fillStepOne(page);
    await page.locator(CONTINUE).click();
    await expect(page.locator(FAUX_SELECT)).toBeVisible();
    const reply = await harness.runAction({ commandId: "option-hidden", actionType: "web.dom.click", selector: COMBI });
    expect(reply.status).toBe("failed");
    expect(reply.failure?.code, "the drawer the option sits in is not a dialog in its way").toBe("web.action.rejected");
    expect(await drawerOpen(page), "a refused press inside the form leaves the form open").toBe(true);
  });

  test("a wall over a target not drawn yet is still cleared: a fresh visitor's newsletter decline behind the consent wall", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    const command = { commandId: "decline-1", actionType: "web.dom.click", selector: '[data-act="decline"]' } as const;
    const first = await harness.runAction(command);
    expect((await siteState(harness)).consent, "the defence declined the wall, never accepted it").toBe("essential");
    // One in-page attempt cannot outlast the offer's 4 s delay after consent; Core's node retry sends the same command.
    const second = first.status === "succeeded" ? first : await harness.runAction({ ...command, commandId: "decline-2" });
    expect(second.status, second.message).toBe("succeeded");
    expect((await siteState(harness)).newsletter).toMatchObject({ dismissed: true, subscribers: [] });
  });
});
