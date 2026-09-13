// The store checkout, proven at the fixture level: a page with a payment
// iframe, a consent dialog that owns every click until it is answered, a chat
// widget that never leaves, two reveals that arrive late, and card fields
// marked the way real card fields are -- including the one that is not marked
// at all.
//
// What is pinned here is what the *page* does. What the extension records,
// what it redacts, and what a run reports need the extension and Core; this
// spec exists so that when those answers come back, the page underneath them
// is known to behave.
//
// Every value typed into a card, security-code, gift-card or password field is
// synthetic and belongs to the fixture (`syntheticCheckoutValues`). The card
// numbers are reserved test PANs: they are not accounts and they open nothing.

import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import type { RunningScenarioLab } from "../src/server.js";
import { storefrontCheckoutScenario, syntheticCheckoutValues, type StorefrontCheckoutState } from "../src/scenarios/storefront-checkout/index.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = storefrontCheckoutScenario.manifest;
const startUrl = (lab: RunningScenarioLab) => `${lab.origin}${manifest.startPath}`;
const finalState = (lab: RunningScenarioLab) => readFinalState<StorefrontCheckoutState>(lab, manifest.id);
const CARD_FRAME_TITLE = "Secure card payment";
const cardFrame = (page: Page): FrameLocator => page.frameLocator(`[title="${CARD_FRAME_TITLE}"]`);

/** A manifest target, resolved as the recording lane resolves it: test ids, optionally inside a frame. */
function locate(page: Page, target: string | undefined): Locator {
  const framePrefix = `frame:${CARD_FRAME_TITLE}/`;
  if (target?.startsWith(framePrefix)) return cardFrame(page).getByTestId(target.slice(framePrefix.length + "testid:".length));
  if (target?.startsWith("testid:")) return page.getByTestId(target.slice("testid:".length));
  throw new Error(`This spec drives test ids and card-frame test ids; ${String(target)} is neither`);
}

/** One manifest step, driven the way the recording lane drives it. */
async function perform(page: Page, step: ScenarioStep): Promise<void> {
  if (step.operation === "checkpoint") return;
  const locator = locate(page, step.target);
  switch (step.operation) {
    case "click": return locator.click();
    case "type": return locator.fill(String(step.value));
    case "check": return locator.setChecked(step.value === true);
    case "waitForState": return locator.waitFor({ state: "visible", timeout: step.timeoutMs ?? 3_000 });
    default: throw new Error(`The storefront-checkout spec does not drive ${step.operation}`);
  }
}

/** The manifest's own facts, with the runner's predicate meanings (`scenario-assertions.ts`). */
async function expectFacts(page: Page, facts: ExpectedFact[]): Promise<void> {
  expect(facts.length, "a rendering that asserts nothing proves nothing").toBeGreaterThan(0);
  for (const fact of facts) {
    if (fact.subject === "document" && fact.predicate === "iframe-count") {
      await expect(page.locator("iframe"), fact.id).toHaveCount(Number(fact.value));
      continue;
    }
    const subject = page.getByTestId(fact.subject);
    if (fact.predicate === "text") await expect(subject, fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "contains") await expect(subject, fact.id).toContainText(String(fact.value));
    else if (fact.predicate === "visible") await (fact.value ? expect(subject, fact.id).toBeVisible() : expect(subject, fact.id).toBeHidden());
    else if (fact.predicate === "exists") await expect(subject, fact.id).toHaveCount(fact.value ? 1 : 0);
    else throw new Error(`Fact predicate ${fact.predicate} is not used by this fixture`);
  }
}

/** What sits at the centre of an element: the element itself, or whatever covers it. */
async function coveredBy(locator: Locator): Promise<string> {
  return locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = element.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (hit === null) return "nothing";
    if (hit === element || element.contains(hit)) return "itself";
    const owner = hit.closest("[data-testid]");
    return owner?.getAttribute("data-testid") ?? hit.tagName.toLowerCase();
  });
}

test("the whole workflow runs from the manifest, and the payment made inside the frame lands in the top document", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest);
  await page.goto(startUrl(lab));
  await expectFacts(page, workflow.expected.pageFacts ?? []);

  // The page a run meets is a real one, not a dozen elements: the count is
  // asserted so that a later simplification of this fixture has to be
  // deliberate.
  const elements = await page.evaluate(() => document.querySelectorAll("*").length);
  const frameElements = await page.frames()[1]?.evaluate(() => document.querySelectorAll("*").length);
  expect(elements, `top document elements: ${elements}`).toBeGreaterThan(180);
  expect(frameElements ?? 0, `card frame elements: ${frameElements}`).toBeGreaterThan(30);
  expect(page.frames()).toHaveLength(2);

  for (const step of workflow.recordingScript) await perform(page, step);

  await expectFacts(page, workflow.expected.finalState ?? []);
  await expect(cardFrame(page).getByTestId("card-result")).toHaveText("Payment approved");
  await expect(cardFrame(page).getByTestId("pay-now")).toBeDisabled();

  const state = await finalState(lab);
  expect(state).toMatchObject({
    step: "confirmed",
    consent: "accepted",
    payment: { gateway: "approve", attempts: 1, outcome: "approved" },
    delivery: { optionId: "express", calculations: 1 },
    address: { postcode: "97205", chosenId: "addr-9582", lookups: 1 },
    order: { placed: true },
  });
  // Nothing card-shaped, and no password, reached the fixture's own oracle.
  const stored = JSON.stringify(state);
  for (const value of [syntheticCheckoutValues.cardNumber, syntheticCheckoutValues.billingCardNumber, syntheticCheckoutValues.securityCode, syntheticCheckoutValues.password]) {
    expect(stored, `${value} must never reach the fixture state`).not.toContain(value);
  }
  await expect(page.getByTestId("order-reference")).toHaveText(state.order.reference);
});

test("the consent dialog owns every click on the page until it is answered", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  const continueButton = page.getByTestId("continue-to-address");
  await expect(continueButton, "the control is present and enabled; it is simply unreachable").toBeEnabled();
  // Scrolled into view first, as Playwright does before a click: the point the
  // click would land on has to be in the viewport for the scrim to be over it.
  await continueButton.scrollIntoViewIfNeeded();
  expect(await coveredBy(continueButton), "the scrim is over the page").toBe("cookie-consent-scrim");
  await expect(continueButton.click({ timeout: 1_500 })).rejects.toThrow(/intercepts pointer events|Timeout/u);
  expect((await finalState(lab)).step, "and nothing advanced").toBe("cart");

  await page.getByTestId("cookie-accept-all").click();
  await expect(page.getByTestId("cookie-consent")).toHaveCount(0);
  await expect(page.getByTestId("cookie-consent-scrim")).toHaveCount(0);
  expect(await coveredBy(continueButton)).toBe("itself");
  await continueButton.click();
  await expect(page.getByTestId("step-address-body")).toBeVisible();
  expect(await finalState(lab)).toMatchObject({ step: "address", consent: "accepted" });
});

test("the support widget stays in the corner for the whole session and covers what is under it", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  await page.getByTestId("cookie-accept-all").click();
  const launcher = page.getByTestId("support-chat-launcher");
  await expect(launcher).toBeVisible();

  // Fixed to the viewport, so it sits over whatever the page put in that
  // corner -- here the store's own back-to-top control, which is visible,
  // enabled, and unclickable for as long as the widget is there.
  const backToTop = page.getByTestId("back-to-top");
  await expect(backToTop).toBeVisible();
  await expect(backToTop).toBeEnabled();
  expect(await coveredBy(backToTop), "the widget covers the control beneath it").toBe("support-chat-launcher");
  await expect(backToTop.click({ timeout: 1_500 })).rejects.toThrow(/intercepts pointer events|Timeout/u);

  await launcher.click();
  await expect(page.getByTestId("support-chat-panel")).toBeVisible();
  await page.getByTestId("support-chat-input").fill("Is the pack in stock?");
  await page.getByTestId("support-chat-send").click();
  await expect(page.getByTestId("support-chat-reply")).toBeVisible();
  expect((await finalState(lab)).support.chatOpen).toBe(true);

  await page.getByTestId("support-chat-close").click();
  await expect(page.getByTestId("support-chat-panel")).toBeHidden();
  await expect(launcher, "the launcher never leaves").toBeVisible();
});

test("the address lookup and the delivery quote both add elements the page did not have", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  await page.getByTestId("cookie-accept-all").click();
  await page.getByTestId("continue-to-address").click();

  await expect(page.getByTestId("address-suggestions"), "nothing to choose from before the lookup").toHaveCount(0);
  await page.getByTestId("postcode").fill(syntheticCheckoutValues.postcode);
  await page.getByTestId("find-address").click();
  await expect(page.getByTestId("address-lookup-status")).toHaveText("Searching for addresses...");
  await expect(page.getByTestId("address-suggestions")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId("address-suggestions").getByRole("button")).toHaveCount(3);
  await expect(page.getByTestId("address-lookup-status")).toHaveText("3 addresses found for 97205");

  // A postcode the store does not deliver to answers, and answers with nothing.
  await page.getByTestId("postcode").fill("99999");
  await page.getByTestId("find-address").click();
  await expect(page.getByTestId("address-suggestions")).toHaveCount(0);
  await expect(page.getByTestId("address-lookup-status")).toHaveText("No addresses found for 99999");

  await page.getByTestId("postcode").fill(syntheticCheckoutValues.postcode);
  await page.getByTestId("find-address").click();
  await page.getByTestId("address-option-2").click();
  await expect(page.getByTestId("address-chosen")).toHaveText("1120 SW Alder St, Apt 12C, Portland, OR 97205");
  await page.getByTestId("continue-to-delivery").click();

  await expect(page.getByTestId("delivery-estimate"), "no estimate before a speed is chosen").toHaveCount(0);
  await expect(page.getByTestId("continue-to-payment")).toBeDisabled();
  await page.getByTestId("delivery-express").check();
  await expect(page.getByTestId("delivery-cost-status")).toHaveText("Working out delivery for your address...");
  await expect(page.getByTestId("delivery-estimate")).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId("delivery-cost-status")).toHaveText("Express shipping - $12.00");
  await expect(page.getByTestId("summary-total")).toHaveText("$381.00");
  await expect(page.getByTestId("continue-to-payment")).toBeEnabled();
});

test("the address step refuses to advance until an address is chosen", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  await page.getByTestId("cookie-accept-all").click();
  await page.getByTestId("continue-to-address").click();
  await page.getByTestId("continue-to-delivery").click();
  await expect(page.getByTestId("address-validation")).toBeVisible();
  await expect(page.getByTestId("step-delivery-body")).toBeHidden();
  expect((await finalState(lab)).step).toBe("address");
});

test("declined-card: the same recording, refused at the frame, and no confirmation in the top document", async ({ page, lab, networkGuard: _guard }) => {
  const resolved = resolveScenarioWorkflow(manifest, { variantId: "declined-card" });
  await armVariant(lab, manifest.id, resolved.variant);
  await page.goto(startUrl(lab));
  // The armed rendering states its own facts, and they are true of it.
  await expectFacts(page, resolved.variant?.expected.pageFacts ?? []);

  for (const step of manifest.recordingScript) {
    if (step.id === "await-confirmation") {
      // The recorded wait genuinely runs out: the page never confirms.
      await expect(perform(page, step)).rejects.toThrow(/Timeout/u);
      continue;
    }
    await perform(page, step);
  }

  await expectFacts(page, resolved.expected.finalState ?? []);
  await expect(cardFrame(page).getByTestId("card-error")).toContainText("declined");
  await expect(cardFrame(page).getByTestId("pay-now"), "the shopper can try again; the card was refused, not the button").toBeEnabled();
  expect(await finalState(lab)).toMatchObject({
    step: "payment",
    payment: { gateway: "decline", attempts: 1, outcome: "declined" },
    order: { placed: false },
  });
});

test("the card form carries the markings real card forms carry, and the one they forget", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  const marks = await page.frames()[1]?.evaluate(() => [...document.querySelectorAll("input")].map(input => ({
    testId: input.dataset.testid ?? null,
    type: input.type,
    autocomplete: input.getAttribute("autocomplete"),
    inputMode: input.getAttribute("inputmode"),
  })));
  expect(marks).toEqual([
    { testId: "card-number", type: "text", autocomplete: "cc-number", inputMode: "numeric" },
    { testId: "card-name", type: "text", autocomplete: "cc-name", inputMode: null },
    { testId: "card-expiry", type: "text", autocomplete: "cc-exp", inputMode: "numeric" },
    // No autocomplete at all. This is the field a rule keyed to the attribute
    // cannot see, and it is not labelled as a trap anywhere on the page.
    { testId: "card-security-code", type: "text", autocomplete: null, inputMode: "numeric" },
    { testId: "use-different-billing-card", type: "checkbox", autocomplete: null, inputMode: null },
    { testId: "billing-card-number", type: "text", autocomplete: "billing cc-number", inputMode: "numeric" },
    { testId: "save-card", type: "checkbox", autocomplete: null, inputMode: null },
  ]);
  const giftCard = page.getByTestId("gift-card-number");
  await expect(giftCard).toHaveAttribute("inputmode", "numeric");
  expect(await giftCard.getAttribute("autocomplete"), "a card-shaped field in the top document, unmarked as well").toBeNull();
  await expect(page.getByTestId("account-password")).toHaveAttribute("type", "password");
});
