// Typed readiness of check and Next page through the real extension's worker
// runner, on realistic Scenario Lab pages only:
// - crossborder-marketplace's rebuilt cart (`cart-add-ons`, armed through the
//   site's own `set-mode`): a Select box the cart's state controls, so a press
//   is the state change and the box's change is set from it, and add-on boxes
//   the cart takes back as they are ticked, at once, a microtask later, or by
//   drawing a fresh unticked box in place of the ticked one;
// - professional-network's in-place pager (`in-place-paging`): Next rewrites
//   the rows already on screen with the next page's people, the same list
//   items and links with new text and addresses, and is disabled on the last
//   page;
// - company-website's quote drawer: a pre-ticked checkbox, a required one and
//   a radio group, each checked through the worker and judged by the request
//   the site files from them (the no-op and radio refusal live here);
// - everything-store's results: Next loads page five as a new document, and on
//   page five Next is a disabled span, which is the list's end;
// - photo-social's post page: "Load more comments" ignores its first press on
//   each list and offers nothing to press instead, so the press changes
//   nothing, which is not the list's end. (crossborder-marketplace's throwing
//   Next div and professional-network's stalling "Show more" do not serve:
//   the step rightly follows the pager's next number past the one, and presses
//   the page's own Retry after the other.)
//
// Each test starts its own Lab and the extension fixture launches and closes a
// browser around it, so each sets its own timeout to cover that as well as its
// steps; the config's default is sized for the content specs, not for these.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { startScenarioLab, type RunningScenarioLab } from "../../../../scenario-lab/src/server.js";
import { VOLTBAY_OFFICIAL_ID } from "../../../../scenario-lab/src/scenarios/crossborder-marketplace/catalog/index.js";
import { GIVEAWAY_POST } from "../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { ROTTERDAM_NL } from "../../../../scenario-lab/src/scenarios/professional-network/index.js";
import type { ExtensionSession } from "../../fixtures/extension-context.js";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";

async function recordIdentity(session: ExtensionSession, tabId: number, info: TestInfo): Promise<void> {
  const expected = JSON.parse(await readFile(path.join(session.metadata.artifactPath, "build-info.json"), "utf8")).identity;
  const running = await session.extensionPage.evaluate(async (id) => {
    return await chrome.runtime.sendMessage({ type: "fluxiq.buildIdentity", tabId: id });
  }, tabId);
  expect(running).toMatchObject({ ok: true, background: expected, content: expected });
  const artifact = info.outputPath("running-build-identity.json");
  await mkdir(info.outputDir, { recursive: true });
  const browser = await session.extensionPage.evaluate(() => navigator.userAgent);
  await writeFile(artifact, JSON.stringify({ browser, expected, running }, null, 2));
  await info.attach("running-build-identity.json", { contentType: "application/json", path: artifact });
}

test.beforeEach(async ({ extensionSession }) => {
  await installRuntimeHarness(extensionSession.extensionPage);
});

/** Opens `subpath` of the Lab in a tab of the extension's browser and points the worker runner at it. */
async function openScenario(session: ExtensionSession, lab: RunningScenarioLab, subpath: string): Promise<{ page: Page; tabId: number }> {
  const page = await session.context.newPage();
  await page.goto(new URL(subpath, lab.origin).href);
  const tabId = await session.extensionPage.evaluate(async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)?.id, page.url());
  if (tabId === undefined) throw new Error("Missing the scenario tab");
  await resetRuntimeHarness(session.extensionPage, tabId);
  return { page, tabId };
}

/** One of a scenario's own page operations, sent as its pages send them. */
async function mutate(lab: RunningScenarioLab, scenario: string, operation: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${lab.origin}/api/${scenario}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${scenario} ${operation} answered HTTP ${response.status}`);
}

test("controlled Select reaches the cart's state once; add-ons the cart unticks, unticks a microtask later, or replaces are reported as failed", async ({ extensionSession }, info) => {
  // Lab start, extension launch and close, a cart page, and six checks.
  test.setTimeout(90_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    // The rebuilt cart is armed first, because arming starts the visit over.
    // Then a returning visitor has answered the cookie banner, the welcome
    // coupons and the notification prompt, and has one hub in the cart.
    await mutate(lab, "crossborder-marketplace", "set-mode", { mode: "cart-add-ons" });
    await mutate(lab, "crossborder-marketplace", "consent", { choice: "all" });
    await mutate(lab, "crossborder-marketplace", "welcome", { action: "close" });
    await mutate(lab, "crossborder-marketplace", "notifications", { answer: "later" });
    await mutate(lab, "crossborder-marketplace", "add-to-cart", { listingId: VOLTBAY_OFFICIAL_ID, color: "Space Grey", spec: "7-in-1", origin: "Spain", quantity: 1 });
    const { page, tabId } = await openScenario(extensionSession, lab, "/scenarios/crossborder-marketplace/cart");
    await recordIdentity(extensionSession, tabId, info);
    const select = 'input[name="select"]';
    const checkout = page.getByText(/^Checkout \(\d\)$/u);
    await expect(page.locator(select)).toBeVisible({ timeout: 10_000 });
    await expect(checkout).toHaveText("Checkout (0)");
    // A passive count of the presses that reach Select; it changes nothing on the page.
    await page.locator(select).evaluate((control) => {
      const record = globalThis as unknown as { selectPresses: number };
      record.selectPresses = 0;
      control.addEventListener("click", () => { record.selectPresses += 1; });
    });
    const presses = () => page.evaluate(() => (globalThis as unknown as { selectPresses: number }).selectPresses);
    const act = (selector: string, checked: boolean) => runWorkerAction(extensionSession.extensionPage, {
      commandId: `check-${selector}-${checked}`, actionType: "web.dom.check", selector, checked
    }, { activeTabId: tabId });

    const on = await act(select, true);
    expect(on.result.status, on.result.message).toBe("succeeded");
    await expect(page.locator(select)).toBeChecked();
    await expect(checkout).toHaveText("Checkout (1)");
    expect(await presses()).toBe(1);
    expect((await act(select, true)).result.message).toContain("already set");
    expect(await presses()).toBe(1);
    const off = await act(select, false);
    expect(off.result.status, off.result.message).toBe("succeeded");
    await expect(page.locator(select)).not.toBeChecked();
    await expect(checkout).toHaveText("Checkout (0)");
    expect(await presses()).toBe(2);

    // Gift wrap is unticked in its own change; the warranty a microtask
    // later; shipping insurance is redrawn as a fresh, unticked box.
    const giftWrap = await act('input[name="giftWrap"]', true);
    expect(giftWrap.result.status, giftWrap.result.message).toBe("failed");
    const warranty = await act('input[name="warranty"]', true);
    expect(warranty.result.status, warranty.result.message).toBe("failed");
    const insurance = await act('input[name="insurance"]', true);
    expect(insurance.result.status, insurance.result.message).toBe("failed");
    for (const name of ["giftWrap", "warranty", "insurance"]) await expect(page.locator(`input[name="${name}"]`)).not.toBeChecked();
  } finally {
    await lab.close();
  }
});

test("Next observes the rows rewritten in place once, then ends on the disabled Next", async ({ extensionSession }, info) => {
  // Lab start, extension launch and close, the results' first load, and two
  // Next steps of up to 5 s each.
  test.setTimeout(90_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    // The in-place pager is armed first, because arming starts the session
    // over. Then a returning visitor has answered the cookie banner, put off
    // the app prompt and seen the conversation bubble.
    await mutate(lab, "professional-network", "set-mode", { mode: "in-place-paging" });
    await mutate(lab, "professional-network", "set-consent", { choice: "accepted" });
    await mutate(lab, "professional-network", "dismiss-app-prompt", {});
    await mutate(lab, "professional-network", "chat-bubble-seen", {});
    const filters = `keywords=data%20engineer&network=${encodeURIComponent('["S"]')}&geoUrn=${encodeURIComponent(JSON.stringify([ROTTERDAM_NL]))}&origin=FACETED_SEARCH`;
    const { page, tabId } = await openScenario(extensionSession, lab, `/scenarios/professional-network/search/results/people/?${filters}&page=2`);
    await recordIdentity(extensionSession, tabId, info);
    const results = 'section[aria-label="Search results"]';
    const item = `${results} li[data-urn]`;
    const next = `${results} > div:last-child > button:last-child`;
    const status = page.locator(`${results} span`, { hasText: /^Page \d of \d$/u });
    await expect(status).toHaveText("Page 2 of 3", { timeout: 10_000 });
    await expect(page.locator(next)).toHaveText("Next");
    const address = page.url();
    const firstName = () => page.locator(item).first().locator("div > div > a[href]").first();
    const before = { name: await firstName().innerText(), href: await firstName().getAttribute("href") };
    // Passive records: the first row and its link, to tell afterwards whether
    // they are the same nodes, and the label of every press that reaches the
    // pager. The step may press the pager's following number in place of a
    // script's Next (extension `follow-next.ts`), which on this pager is the
    // same move, so a press of either is the one press.
    await page.locator(item).first().evaluate((row) => {
      const record = globalThis as unknown as { heldRow: unknown; heldLink: unknown; pagerPresses: string[] };
      record.heldRow = row;
      record.heldLink = row.querySelector("div > div > a[href]");
      record.pagerPresses = [];
    });
    await page.locator(next).evaluate((control) => {
      control.parentElement?.addEventListener("click", (event) => {
        const pressed = (event.target as Element | null)?.closest("button");
        if (pressed) (globalThis as unknown as { pagerPresses: string[] }).pagerPresses.push((pressed.textContent ?? "").trim());
      });
    });
    const move = (step: number) => runWorkerAction(extensionSession.extensionPage, {
      commandId: `next-${step}`, actionType: "web.dom.next_page", timeoutMs: 5_000,
      nextPage: { item, pagination: { next } }
    }, { activeTabId: tabId });

    const moved = await move(1);
    expect(moved.result.status, moved.result.message).toBe("succeeded");
    expect(moved.result.nextPage).toMatchObject({ outcome: "moved" });
    await expect(status).toHaveText("Page 3 of 3");
    await expect(firstName()).not.toHaveText(before.name);
    expect(await firstName().getAttribute("href")).not.toBe(before.href);
    expect(await page.locator(item).first().evaluate((row) => {
      const record = globalThis as unknown as { heldRow: unknown; heldLink: unknown };
      return record.heldRow === row && record.heldLink === row.querySelector("div > div > a[href]");
    }), "the first row and its link are the nodes that were there before").toBe(true);
    expect(page.url(), "the address did not move").toBe(address);
    await expect(page.locator(next)).toBeDisabled();
    const ended = await move(2);
    expect(ended.result.nextPage, ended.result.message).toMatchObject({ outcome: "ended", stop: "control_disabled" });
    const presses = await page.evaluate(() => (globalThis as unknown as { pagerPresses: string[] }).pagerPresses);
    expect(presses, "the pager was pressed once, to the last page, and not again at its end").toHaveLength(1);
    // The pager's Next is a script button with no address to check, so the step
    // presses the pager's following number instead (`by: "following"`, the
    // documented contract in src/content/extraction/page-advance/follow-next.ts).
    expect(presses[0], "the step followed the pager's following number").toBe("3");
    await expect(status).toHaveText("Page 3 of 3");
  } finally {
    await lab.close();
  }
});

test("quote drawer: check reaches the request once; no-op, radio refusal and pre-ticked box stay truthful", async ({ extensionSession }, info) => {
  // Lab start, extension launch and close, and a three-step drawer the person submits through a human check.
  test.setTimeout(90_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    // A returning visitor has answered the cookie wall, the chat greeting and
    // the newsletter offer; each would otherwise stand over the drawer.
    await mutate(lab, "company-website", "set-consent", { choice: "all" });
    await mutate(lab, "company-website", "dismiss-chat-greeting", {});
    await mutate(lab, "company-website", "dismiss-newsletter", {});
    const { page, tabId } = await openScenario(extensionSession, lab, "/scenarios/company-website/#quote");
    await recordIdentity(extensionSession, tabId, info);
    const drawer = page.getByRole("dialog", { name: "Get a free quote" });
    await expect(drawer).toBeVisible();
    const act = (selector: string, checked: boolean) => runWorkerAction(extensionSession.extensionPage, {
      commandId: `check-${selector}-${checked}`, actionType: "web.dom.check", selector, checked
    }, { activeTabId: tabId });

    // Step 1, as the person fills it.
    await drawer.getByLabel("Full name").fill("Alex Morgan");
    await drawer.getByLabel("Email address").fill("alex.morgan@example.com");
    await drawer.getByLabel("Phone number").fill("07700 900123");
    await drawer.getByLabel("Postcode of the property").fill("BS1 4DJ");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Step 2: the contact radios start on Phone.
    const email = 'input[name="contactBy"][value="Email"]';
    await expect(page.locator(email)).toBeVisible();
    const chosen = await act(email, true);
    expect(chosen.result.status, chosen.result.message).toBe("succeeded");
    await expect(page.locator(email)).toBeChecked();
    await expect(page.locator('input[name="contactBy"][value="Phone"]')).not.toBeChecked();
    expect((await act(email, true)).result.message).toContain("already set");
    expect((await act(email, false)).result.status).toBe("failed");
    await expect(page.locator(email)).toBeChecked();
    await drawer.getByText("Choose a service", { exact: true }).click();
    await drawer.getByText("Boiler service", { exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // Step 3: the offers box comes ticked; the privacy box must be ticked.
    const marketing = 'input[name="marketing"]';
    const privacy = 'input[name="privacy"]';
    await expect(page.locator(privacy)).toBeVisible();
    expect((await act(marketing, true)).result.message).toContain("already set");
    await expect(page.locator(marketing)).toBeChecked();
    const unticked = await act(marketing, false);
    expect(unticked.result.status, unticked.result.message).toBe("succeeded");
    await expect(page.locator(marketing)).not.toBeChecked();
    const agreed = await act(privacy, true);
    expect(agreed.result.status, agreed.result.message).toBe("succeeded");
    await expect(page.locator(privacy)).toBeChecked();

    // The person sends it; what the site filed is what the checks left.
    await page.getByTestId("quote-submit").click();
    await page.getByText("Confirm you are human", { exact: true }).click({ timeout: 10_000 });
    await expect(page.getByTestId("quote-contact")).toHaveText("Email", { timeout: 10_000 });
    await expect(page.getByTestId("quote-marketing")).toHaveText("No");
  } finally {
    await lab.close();
  }
});

test("Next loads the next results page as a new document, and ends on the last page's disabled Next without pressing", async ({ extensionSession }, info) => {
  // Lab start, extension launch and close, two results documents, and the store's eight-second paging guard.
  test.setTimeout(90_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    // The store's soft check stands before a session's first search, and its
    // notifications prompt makes the page inert; a returning visitor has
    // passed the one and answered the other.
    await mutate(lab, "everything-store", "consent", { choice: "accept" });
    await mutate(lab, "everything-store", "dismiss-nudge", { nudge: "notifications" });
    await mutate(lab, "everything-store", "dismiss-nudge", { nudge: "app-banner" });
    await mutate(lab, "everything-store", "pass-soft-check", {});
    const { page, tabId } = await openScenario(extensionSession, lab, "/scenarios/everything-store/s?k=wireless+earbuds&page=4");
    await recordIdentity(extensionSession, tabId, info);
    const item = '[data-component="search-result"]';
    await expect(page.locator(`${item}:not([aria-busy="true"])`).first()).toBeVisible({ timeout: 10_000 });
    const pageOf = () => Number(new URL(page.url()).searchParams.get("page") ?? "1");
    const move = (step: number) => runWorkerAction(extensionSession.extensionPage, {
      commandId: `next-${step}`, actionType: "web.dom.next_page", timeoutMs: 15_000, nextPage: { item }
    }, { activeTabId: tabId });
    const moved = await move(1);
    expect(moved.result.status, moved.result.message).toBe("succeeded");
    expect(moved.result.nextPage).toMatchObject({ outcome: "moved" });
    await expect.poll(pageOf).toBe(5);
    // The store refuses a sixth results page in eight seconds; a worker's pace spaces them.
    await page.waitForTimeout(2_000);
    const ended = await move(2);
    expect(ended.result.nextPage, ended.result.message).toMatchObject({ outcome: "ended", stop: "control_disabled" });
    expect(pageOf(), "nothing was pressed on the last page").toBe(5);
  } finally {
    await lab.close();
  }
});

test("a press the list ignores times out unchanged, is pressed once, and is not called the list's end", async ({ extensionSession }, info) => {
  // Lab start, extension launch and close, and one Next step that waits out its 3 s timeout.
  test.setTimeout(60_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    // A returning visitor has answered the cookie dialog, whose scrim takes
    // every click, and collapsed the messages dock, which covers the control.
    await mutate(lab, "photo-social", "consent", { choice: "essential" });
    await mutate(lab, "photo-social", "dock", { minimized: true });
    const { page, tabId } = await openScenario(extensionSession, lab, `/scenarios/photo-social/p/${GIVEAWAY_POST.code}/`);
    await recordIdentity(extensionSession, tabId, info);
    const item = 'li:has(a[href*="/c/"] time)';
    const more = '[role="button"]:has(> svg[aria-label="Load more comments"])';
    await expect(page.locator(more)).toBeVisible({ timeout: 10_000 });
    const rows = await page.locator(item).count();
    expect(rows, "the post shows its first comments").toBeGreaterThan(0);
    // A passive count of the presses that reach the control; it changes nothing on the page.
    await page.locator(more).evaluate((control) => {
      const record = globalThis as unknown as { morePresses: number };
      record.morePresses = 0;
      control.addEventListener("click", () => { record.morePresses += 1; });
    });
    const unchanged = await runWorkerAction(extensionSession.extensionPage, {
      commandId: "more-ignored", actionType: "web.dom.next_page", timeoutMs: 3000,
      nextPage: { item, pagination: { mode: "loadMore", control: more } }
    }, { activeTabId: tabId });
    expect(unchanged.result.status, unchanged.result.message).not.toBe("succeeded");
    expect(unchanged.result.nextPage?.outcome).not.toBe("ended");
    await expect(page.locator(item)).toHaveCount(rows);
    expect(await page.evaluate(() => (globalThis as unknown as { morePresses: number }).morePresses)).toBe(1);
  } finally {
    await lab.close();
  }
});
