// What the content script says about an element's identity: the test id,
// accessible name, label, implicit role and page context that Phase 1.3 added
// to `DomElementDescriptor`. Each case reads one element through the read-only
// `web.dom.extract` verb, whose reply carries exactly the descriptor the
// background worker receives -- except a sensitive control, which that verb
// refuses in every mode (decision D2 of the data-extraction plan), and which is
// read from the snapshot the same `describeElement` builds.
//
// Every row reads a realistic page (AGENTS.md, user 2026-09-29). The drift rows
// are the point of the suite: four realistic sites each ship a redesign variant
// that takes a recorded control's test id away, and what each redesign leaves
// standing is visible per site -- a name and a form position on one, a class and
// an icon drawing on another, nothing but words on a third. company-website's
// two "Get a free quote" buttons pin the opposite case, two controls whose name
// signals are identical. The remaining rows cover context a quote form alone
// does not show (a landmark named by reference, a list position, a table
// position, a dressed-up control), and photo-social's sign-in and payment forms
// prove value *presence* is reported without the value.

import type { Locator } from "@playwright/test";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import { describe, labMutate, openPath, quoteDrawer, type Descriptor } from "./identity-fixtures.js";

type SnapshotDescriptor = Awaited<ReturnType<ContentHarness["capture"]>>["interactiveElements"][number];

/**
 * The descriptor for one control, taken from the snapshot instead. Extraction
 * refuses a sensitive control in every mode, so `web.dom.extract` cannot
 * describe one; the snapshot is where the background worker reads the same
 * `describeElement` output for it, so nothing about the descriptor changes.
 */
async function describeInSnapshot(harness: ContentHarness, pick: (element: SnapshotDescriptor) => boolean, what: string): Promise<SnapshotDescriptor> {
  const element = (await harness.capture()).interactiveElements.find(pick);
  if (!element) throw new Error(`the snapshot of ${harness.scenarioId} carries no descriptor for ${what}`);
  return element;
}

/**
 * A selector for one element a locator found, as a child-index path from the
 * document root. The redesigned controls below carry no test id, and their
 * classes are hashed per build, so the row finds them the way a person does --
 * by their words -- and then names them for `web.dom.extract`.
 */
async function pathTo(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    const steps: string[] = [];
    for (let current: Element | null = element; current && current !== document.documentElement; current = current.parentElement) {
      const parent: Element | null = current.parentElement;
      steps.unshift(`${current.tagName.toLowerCase()}:nth-child(${parent ? [...parent.children].indexOf(current) + 1 : 1})`);
    }
    return `html > ${steps.join(" > ")}`;
  });
}

test("company-website: the quote drawer's Send request carries test id, name, role and context", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  const ids = quoteDrawer.ids();
  await quoteDrawer.open(harness);
  await quoteDrawer.toStep(page, 3);
  const send = await describe(harness, quoteDrawer.byId(ids.send));
  expect(send).toMatchObject({
    testId: "quote-submit",
    accessibleName: "Send request",
    implicitRole: "button",
    context: { landmark: "main", dialog: "Get a free quote", heading: "Get a free quote" }
  });
  // The button has no label of its own: its name is its content.
  expect(send.label).toBeUndefined();
  // It sits in the drawer's footer, outside the drawer's <form>, so no form is
  // claimed for it; and nothing the page does not declare is invented.
  expect(send.context?.formId).toBeUndefined();
  expect(send.context?.formName).toBeUndefined();
  expect(send.context?.formAction).toBeUndefined();
});

test("company-website: a labelled field takes its name from its label, and its fieldset's legend is context", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  const ids = quoteDrawer.ids();
  await quoteDrawer.open(harness);
  await page.fill(quoteDrawer.byId(ids.fields.fullName!), "Ada Synthetic");
  const field = await describe(harness, quoteDrawer.byId(ids.fields.fullName!));
  expect(field).toMatchObject({
    label: "Full name",
    accessibleName: "Full name",
    implicitRole: "textbox",
    hasValue: true,
    attributes: { name: "fullName", autocomplete: "name" },
    context: { formId: ids.form, fieldsetLegend: "About you", dialog: "Get a free quote" }
  });
  expect(field.testId).toBeUndefined();
  const label = await describe(harness, `label[for="${ids.fields.fullName}"]`);
  expect(label.attributes?.for).toBe(ids.fields.fullName);
});

/**
 * Each realistic redesign that takes a recorded control's test id away, with
 * the control as the baseline recorded it and as the redesign draws it. The
 * expectations are what the redesigned control still says about itself;
 * `survives` names the baseline signals that came through unchanged.
 */
const REDESIGNS: ReadonlyArray<{
  scenario: string;
  variant: string;
  path: string;
  recorded: string;
  testId: string;
  drifted: (harness: ContentHarness) => Locator;
  expected: Record<string, unknown>;
  survives: ReadonlyArray<"accessibleName" | "classNames" | "drawing" | "visibleText">;
}> = [
  {
    scenario: "company-website",
    variant: "redesigned-quote-submit",
    path: "",
    recorded: quoteDrawer.byId(quoteDrawer.ids().send),
    testId: "quote-submit",
    drifted: (harness) => harness.page.locator(quoteDrawer.byId(quoteDrawer.ids().headerSend)),
    // Moved into the form's last fieldset and renamed: the name and the place
    // are new, and the dialog it belongs to is the one thing kept.
    expected: { accessibleName: "Get my free quote", implicitRole: "button", context: { formId: quoteDrawer.ids().form, fieldsetLegend: "Almost done", dialog: "Get a free quote" } },
    survives: []
  },
  {
    scenario: "bigbox-retail",
    variant: "redesigned-buy-box",
    path: "ip/valueridge-essentials-select-a-size-paper-towels/418830127",
    recorded: '[data-testid="atc"]',
    testId: "atc",
    drifted: (harness) => harness.page.getByRole("button", { name: "Add to cart", exact: true }),
    // A new build renamed every class and moved the button up into the buy box;
    // its words, its name and its role are what it still has.
    expected: { accessibleName: "Add to cart", implicitRole: "button", context: { landmark: "main" } },
    survives: ["accessibleName", "visibleText"]
  },
  {
    scenario: "crossborder-marketplace",
    variant: "basket-redesign",
    path: "item/1005008123450",
    recorded: '[data-testid="add-to-cart"]',
    testId: "add-to-cart",
    drifted: (harness) => harness.page.getByText("Add to basket", { exact: true }),
    // A role-less div whose words changed too: nothing the recording knew it by.
    expected: { tagName: "div", visibleText: "Add to basket", context: { landmark: "main" } },
    survives: []
  },
  {
    scenario: "everything-store",
    variant: "redesigned-header",
    path: "cart",
    recorded: '[data-testid="nav-search-submit"]',
    testId: "nav-search-submit",
    drifted: (harness) => harness.page.locator('button[type="submit"][aria-label="Search Brightaisle"]'),
    // Renamed from "Go", but the same component drew it: its class and its
    // icon's drawing come through, and so does the search landmark.
    expected: { accessibleName: "Search Brightaisle", implicitRole: "button", context: { landmark: "search" } },
    survives: ["classNames", "drawing"]
  }
];

for (const redesign of REDESIGNS) {
  test(`${redesign.scenario} ${redesign.variant}: the redesigned control keeps the signals the redesign leaves`, async ({ openHarness }) => {
    const harness = await openHarness(redesign.scenario);
    if (redesign.scenario === "company-website") await quoteDrawer.open(harness);
    else await openPath(harness, redesign.path);
    if (redesign.scenario === "company-website") await quoteDrawer.toStep(harness.page, 3);
    const recorded = await describe(harness, redesign.recorded);
    expect(recorded.testId).toBe(redesign.testId);

    if (redesign.scenario === "company-website") {
      await quoteDrawer.open(harness, redesign.variant);
      await quoteDrawer.toStep(harness.page, 3);
    } else {
      await labMutate(harness, "set-mode", { mode: redesign.variant });
      await openPath(harness, redesign.path);
    }
    const drifted = redesign.drifted(harness);
    await expect(drifted).toBeVisible();
    await expect(harness.page.locator(redesign.recorded)).toHaveCount(0);
    const now: Descriptor = await describe(harness, await pathTo(drifted));
    expect(now.testId).toBeUndefined();
    expect(now).toMatchObject(redesign.expected);
    for (const signal of redesign.survives) expect(now[signal], `${signal} came through the redesign`).toEqual(recorded[signal]);
  });
}

test("local-classifieds: Sort by takes its name from the element aria-labelledby points at", async ({ openHarness }) => {
  const harness = await openHarness("local-classifieds");
  await openPath(harness, "search/?query=bike");
  const sort = await describe(harness, "[role=combobox][aria-labelledby]");
  expect(sort).toMatchObject({ tagName: "div", role: "combobox", accessibleName: "Sort by", visibleText: "Suggested" });
  // The reference is what carries the name here: the target is a plain
  // <span>, whose role takes no name from its content, so it holds the text
  // and has no accessible name of its own. Following `aria-labelledby` is the
  // only way the control is called "Sort by" rather than by the option it shows.
  const labelId = sort.attributes?.["aria-labelledby"];
  expect(labelId).toBeTruthy();
  const target = await describe(harness, `[id="${labelId}"]`);
  expect(target).toMatchObject({ tagName: "span", text: "Sort by" });
  expect(target.accessibleName).toBeUndefined();
});

test("company-website: the header's and the hero's Get a free quote share every name signal", async ({ openHarness }) => {
  const harness = await openHarness("company-website");
  await quoteDrawer.settle(harness);
  const header = await describe(harness, "header button[data-open-quote]");
  const hero = await describe(harness, "main button[data-open-quote]");
  for (const button of [header, hero]) {
    expect(button).toMatchObject({ tagName: "button", visibleText: "Get a free quote", accessibleName: "Get a free quote", implicitRole: "button" });
    expect(button.testId).toBeUndefined();
    expect(button.id).toBeUndefined();
  }
  expect(header.xpath).not.toBe(hero.xpath);
  // Their landmarks tell them apart -- the banner and the main content -- and
  // so do the hashed classes of the two components that drew them. Neither is
  // weighed as identity: `identity-ambiguity.spec.ts` shows a selector that
  // matches both is reported as a tie.
  expect(header.context?.landmark).toBe("banner");
  expect(hero.context?.landmark).toBe("main");
  expect(header.classNames).not.toEqual(hero.classNames);
});

test("company-website: a wrapping <label> names each radio of the contact group", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  const ids = quoteDrawer.ids();
  await quoteDrawer.open(harness);
  await quoteDrawer.toStep(page, 2);
  for (const [value, checked] of [["Phone", true], ["Email", false]] as const) {
    expect(await describe(harness, `input[name="contactBy"][value="${value}"]`)).toMatchObject({
      label: value,
      accessibleName: value,
      implicitRole: "radio",
      checked,
      context: { formId: ids.form, fieldsetLegend: "Your job", dialog: "Get a free quote" }
    });
  }
});

test("a fieldset legend, a list position, a named region and a dressed-up control", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await labMutate(harness, "start-checkout", { pipeline: "cart" });
  await openPath(harness, "checkout");
  const delivery = await describe(harness, 'input[name="delivery"]:checked');
  expect(delivery).toMatchObject({
    implicitRole: "radio",
    checked: true,
    context: { fieldsetLegend: "Choose your delivery option:", landmark: "region", listPosition: { index: 1, total: 3 } }
  });
  // The region is named by reference to its heading, and the name is the heading's words.
  expect(delivery.context?.landmarkName).toMatch(/^Arriving /u);
  expect(delivery.context?.landmarkName).toBe(delivery.context?.heading);

  // The written role and the markup's own role are separate signals.
  const network = await openHarness("professional-network");
  expect(await describe(network, "input[role=combobox][aria-label=Search]")).toMatchObject({
    role: "combobox",
    implicitRole: "textbox",
    accessibleName: "Search",
    context: { landmark: "banner" }
  });
});

test("company-website prices: a cell's context is its row, its column and the column's header", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await openPath(harness, "services");
  await page.waitForSelector("table thead th");
  expect(await describe(harness, "table thead th:nth-child(3)")).toMatchObject({
    implicitRole: "columnheader",
    accessibleName: "Price",
    context: { tablePosition: { row: 1, column: 3, columnHeader: "Price" } }
  });
  const price = await describe(harness, "table tbody tr:first-child td:nth-child(3)");
  expect(price).toMatchObject({
    implicitRole: "cell",
    context: { tablePosition: { row: 2, column: 3, columnHeader: "Price" } }
  });
  expect(price.visibleText).toMatch(/^£\d/u);
});

test("photo-social: value presence is reported, the value is not part of identity", async ({ openHarness, page }) => {
  const harness = await openHarness("photo-social");
  const secret = "kiln-glaze-4417";
  await openPath(harness, "accounts/login/");
  await page.fill("input[name=username]", "maker@example.test");
  await page.fill("input[name=password]", secret);
  const password = await describeInSnapshot(harness, (element) => element.inputType === "password", "the password field");
  expect(password).toMatchObject({ accessibleName: "Password", hasValue: true });
  // A password field has no implicit ARIA role, and no identity signal may be
  // built from its value: `accessibleName` comes from the page's own label,
  // `hasValue` is a boolean, and the descriptor carries no `value` at all.
  expect(password.implicitRole).toBeUndefined();
  expect(password).not.toHaveProperty("value");
  expect(JSON.stringify(password)).not.toContain(secret);

  await openPath(harness, "verified/subscribe/");
  await page.fill('input[aria-label="Card number"]', "4242424242424242");
  const card = await describeInSnapshot(harness, (element) => element.accessibleName === "Card number", "the card number field");
  expect(card).toMatchObject({ hasValue: true, attributes: { autocomplete: "cc-number" } });
  expect(card).not.toHaveProperty("value");
  expect(JSON.stringify(card)).not.toContain("4242424242424242");
});
