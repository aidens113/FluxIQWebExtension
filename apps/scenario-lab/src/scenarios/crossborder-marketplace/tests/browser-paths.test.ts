import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { listingById, VOLTBAY_LOOKALIKE_ID, VOLTBAY_OFFICIAL_ID } from "../catalog/index.js";
import {
  CART_SCRIPT, cartCount, crossborderMarketplaceManifest as manifest, HUB_IN_CART, MARKET_SEED, NOTHING_BOUGHT, ORDER_SCRIPT, orderRecord,
  ordersShipped, SPAIN_HUBS_SCRIPT, spainHubRecords,
} from "../manifest/index.js";
import { itemHref } from "../markup/index.js";
import type { MarketState } from "../state/index.js";
import { marketClasses } from "../styles/index.js";
import { closeBrowser, locate, normalize, openSession, type Session } from "./browser-harness.js";

/**
 * The fixture's contract with a person, proved in a browser: every task has an
 * honest path that meets its oracle exactly, and the careless version of each
 * -- clicking through an overlay, taking a sponsored row, keeping a repeated
 * result, filling the field nobody can see -- does not.
 */
const c = marketClasses(MARKET_SEED, "baseline");
const ALLOWED = manifest.expected.allowedConsoleErrors ?? [];
const RATED_45 = [90, 92, 94, 96, 98, 100].map((width) => `[style="width:${width}%"]`).join(",");
const GOAL = [...NOTHING_BOUGHT, ...HUB_IN_CART];

const upTo = (script: readonly ScenarioStep[], lastId: string) => script.slice(0, script.findIndex((step) => step.id === lastId) + 1);
/** Console and page errors the manifest does not allow, judged as the Lab's console watch judges them; failed responses are kept for diagnosis only. */
const unexpectedErrors = (session: Session) => session.errors.filter((error) => !error.startsWith("http ") && !ALLOWED.some((allowed) => error.includes(allowed)));
const cartOf = async (session: Session) => ((await session.finalState()) as unknown as MarketState).cart;

async function withSession<T>(work: (session: Session) => Promise<T>): Promise<T> {
  const session = await openSession();
  try { return await work(session); } finally { await session.close(); }
}

/** The centre of a control, where a click aimed at it lands. */
async function centreOf(session: Session, target: string): Promise<{ x: number; y: number }> {
  const box = await locate(session.page, target).boundingBox();
  assert.ok(box, `${target} has no box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Which overlay, if any, is the topmost element at a point: the answer a real click gets. */
async function hitAt(session: Session, point: { x: number; y: number }): Promise<string> {
  return session.page.evaluate(`(() => {
    const hit = document.elementFromPoint(${point.x}, ${point.y});
    const roles = ${JSON.stringify({ consent: c.consent, chatPill: c.chatPill, chatPanel: c.chatPanel, addCart: c.addCart, buyNow: c.buyNow, scrim: c.scrim })};
    for (const [role, name] of Object.entries(roles)) if (hit && hit.closest('.' + name)) return role;
    return hit ? hit.tagName : 'nothing';
  })()`);
}

/** Every card on the active results page, fully loaded, as a person reads it. */
async function readResultsPage(session: Session): Promise<Array<{ title: string; store: string; price: string; rating: string | null; ad: boolean; spain: boolean; free: boolean }>> {
  const page = session.page;
  await locate(page, `.${c.grid} > .${c.card} >> nth=0`).waitFor({ state: "visible", timeout: 5000 });
  const expected = await page.locator(`.${c.grid} > *`).count();
  await page.mouse.wheel(0, 4000);
  for (const deadline = Date.now() + 6000; await page.locator(`.${c.grid} > .${c.card}`).count() < expected;) {
    assert.ok(Date.now() < deadline, "the rest of the grid never loaded");
    await page.waitForTimeout(100);
  }
  const cards = await page.locator(`.${c.grid} > .${c.card}`).all();
  const read = async (card: (typeof cards)[number], selector: string) => ((await card.locator(selector).count()) > 0 ? normalize(await card.locator(selector).first().textContent()) : null);
  const rows = [];
  for (const card of cards) {
    rows.push({
      title: (await read(card, `.${c.cardTitle}`)) ?? "",
      store: (await read(card, `.${c.storeName}`)) ?? "",
      price: (await read(card, `.${c.price}`)) ?? "",
      rating: await read(card, `.${c.ratingValue}`),
      ad: (await card.locator(`.${c.adTag}`).count()) > 0,
      spain: (await read(card, `.${c.badges}`))?.includes("Ships from Spain") ?? false,
      free: (await read(card, `.${c.shippingNote}`)) === "Free shipping",
    });
  }
  return rows;
}

after(() => closeBrowser());

describe("crossborder-marketplace in a browser", { concurrency: true }, () => {
  test("the honest cart path fills the cart with the one right line and the coupon", () => withSession(async (session) => {
    await session.run(CART_SCRIPT);
    assert.deepEqual(await session.failingFacts(GOAL), []);
    assert.equal((await cartOf(session)).length, 1);
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("a click aimed at Add to cart lands on the chat until the chat is minimised, and adds nothing", () => withSession(async (session) => {
    await session.run(upTo(CART_SCRIPT, "coupon-collected").filter((step) => step.id !== "minimize-chat"));
    const point = await centreOf(session, "testid:add-to-cart");
    assert.equal(await hitAt(session, point), "chatPill");
    await session.page.mouse.click(point.x, point.y);
    await session.page.waitForTimeout(1200);
    assert.equal(await hitAt(session, point), "chatPanel");
    assert.deepEqual(await cartOf(session), []);
    assert.notDeepEqual(await session.failingFacts(GOAL), []);
  }));

  test("the sponsored lookalike carries the same title, and buying from it fills the cart with the wrong store's line", () => withSession(async (session) => {
    const lookalikeAd = `a[href="${itemHref(VOLTBAY_LOOKALIKE_ID)}?src=ad"] >> nth=1`;
    const naive = CART_SCRIPT.flatMap((step): ScenarioStep[] => {
      if (step.id === "results-drawn") return [step, { id: "scroll-to-ads", operation: "scroll", value: 1400 }];
      if (step.id === "open-listing") return [{ ...step, target: lookalikeAd }];
      if (step.id === "listing-tab") return [{ ...step, path: itemHref(VOLTBAY_LOOKALIKE_ID) }];
      return [step];
    });
    await session.run(naive);
    const titles = await session.context.pages()[0]!.locator(`.${c.cardTitle}`).allTextContents();
    assert.ok(titles.filter((title) => title === listingById(VOLTBAY_OFFICIAL_ID)!.title).length >= 2, "the lookalike and its ad carry the official title word for word");
    assert.deepEqual((await cartOf(session)).map((line) => line.listingId), [VOLTBAY_LOOKALIKE_ID]);
    assert.notDeepEqual(await session.failingFacts(GOAL), []);
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("on a first visit the consent banner sits over the buy bar, and the welcome coupons over everything", () => withSession(async (session) => {
    await session.page.goto(`${session.lab.origin}${itemHref(VOLTBAY_OFFICIAL_ID)}`);
    await session.page.waitForTimeout(1300);
    const point = await centreOf(session, "testid:add-to-cart");
    assert.equal(await hitAt(session, point), "consent");
    await locate(session.page, 'text="Welcome back, Mara!"').waitFor({ state: "visible", timeout: 3000 });
    assert.equal(await hitAt(session, point), "scrim");
  }));

  test("the honest extraction through the site's filters reads exactly the thirteen records, and one that keeps the ads does not", () => withSession(async (session) => {
    const extracted = await session.run(SPAIN_HUBS_SCRIPT);
    assert.deepEqual(extracted["extract-spain-hubs"], spainHubRecords());
    assert.deepEqual(await session.failingFacts([cartCount(0), ordersShipped(0)]), []);
    const withAds = await session.run([{ id: "keep-ads", operation: "extract", target: `.${c.grid} > .${c.card}:has(.${c.starsFill}:is(${RATED_45}))`, fields: { title: `.${c.cardTitle}`, store: `.${c.storeName}`, price: `.${c.price}`, rating: `.${c.ratingValue}` } }]);
    assert.equal(withAds["keep-ads"]?.length, 16, "three sponsored cards on the narrowed page are rated 4.5 or more");
    assert.notDeepEqual(withAds["keep-ads"], spainHubRecords());
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("the honest extraction by paging the whole search, skipping ads and repeats, reads the same thirteen; one that keeps repeats does not", () => withSession(async (session) => {
    await session.run(upTo(SPAIN_HUBS_SCRIPT, "submit-search"));
    const pages = [await readResultsPage(session)];
    const firstUrl = session.page.url();
    await locate(session.page, `.${c.pager} >> text="Next ›"`).click();
    await session.page.waitForTimeout(800);
    assert.equal(session.page.url(), firstUrl, "Next is broken on the live site and goes nowhere");
    assert.ok(session.errors.some((error) => error.includes("reading 'current'")));
    await locate(session.page, `.${c.pager} >> text="2"`).click();
    pages.push(await readResultsPage(session));
    await locate(session.page, `.${c.pager} >> text="3"`).click();
    await locate(session.page, `text="I'm not a robot"`).click({ timeout: 6000 });
    await locate(session.page, `.${c.pager}`).waitFor({ state: "visible", timeout: 8000 });
    pages.push(await readResultsPage(session));
    assert.deepEqual(pages.map((cards) => cards.length), [20, 20, 17]);
    const wanted = pages.flat().filter((card) => !card.ad && card.spain && card.free && card.rating !== null && Number(card.rating) >= 4.5)
      .map(({ title, store, price, rating }) => ({ title, store, price, rating: rating! }));
    const seen = new Set<string>();
    const once = wanted.filter((record) => { const key = `${record.title}|${record.store}|${record.price}`; if (seen.has(key)) return false; seen.add(key); return true; });
    assert.deepEqual(once, spainHubRecords());
    assert.equal(wanted.length, 15, "two of the thirteen are repeated across pages");
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("the honest purchase reads the confirmation the dataset names and leaves one paid order", () => withSession(async (session) => {
    const extracted = await session.run(ORDER_SCRIPT);
    assert.deepEqual(extracted["extract-order"], [orderRecord()]);
    assert.deepEqual(await session.failingFacts(manifest.workflows!.find(({ id }) => id === "place-order")!.expected.finalState!), []);
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("a checkout that fills the hidden fax field is held for review and never confirmed", () => withSession(async (session) => {
    await session.run(upTo(ORDER_SCRIPT, "visa-chosen"));
    await session.page.locator('input[name="fax_number"]').fill("+49 30 1234567");
    await locate(session.page, 'text="Place order"').click();
    await locate(session.page, 'text="Your order is being reviewed"').waitFor({ state: "visible", timeout: 6000 });
    const state = (await session.finalState()) as unknown as MarketState;
    assert.deepEqual(state.orders.map((order) => order.status), ["review"]);
    assert.notDeepEqual(await session.failingFacts([ordersShipped(1)]), []);
  }));

  test("basket-redesign: the recorded control is gone, pressing its old place buys instead, and Add to basket repairs it", async () => {
    await withSession(async (session) => {
      await session.arm("basket-redesign");
      await session.page.reload();
      await session.run(upTo(CART_SCRIPT, "coupon-collected"));
      assert.equal(await locate(session.page, "testid:add-to-cart").count(), 0);
      const redesignedCss = marketClasses(MARKET_SEED, "basket-redesign");
      const rightmost = await session.page.locator(`.${redesignedCss.buyNow}`).boundingBox();
      assert.ok(rightmost);
      const viewport = session.page.viewportSize()!;
      assert.ok(rightmost.x + rightmost.width > viewport.width - 30, "Buy now now stands at the right-hand end, where Add to cart stood");
      await session.page.locator(`.${redesignedCss.buyNow}`).click();
      await session.page.waitForURL(/\/checkout$/u, { timeout: 6000 });
      assert.deepEqual(await cartOf(session), []);
    });
    await withSession(async (session) => {
      await session.arm("basket-redesign");
      await session.page.reload();
      await session.run([...upTo(CART_SCRIPT, "coupon-collected"), { id: "add-to-basket", operation: "click", target: 'text="Add to basket"' }, { id: "added", operation: "waitForState", target: 'text="Added to cart!"', timeoutMs: 5000 }]);
      assert.deepEqual(await session.failingFacts(GOAL), []);
      assert.deepEqual(unexpectedErrors(session), []);
    });
  });

  test("flash-deal: the popup blocks the recorded path, and closing it is enough", async () => {
    await withSession(async (session) => {
      await session.arm("flash-deal");
      await session.page.reload();
      await assert.rejects(session.run(CART_SCRIPT), /failed/u);
      assert.deepEqual(await cartOf(session), []);
    });
    await withSession(async (session) => {
      await session.arm("flash-deal");
      await session.page.reload();
      const at = CART_SCRIPT.findIndex((step) => step.id === "listing-tab") + 1;
      await session.run([...CART_SCRIPT.slice(0, at), { id: "flash-arrives", operation: "waitForState", target: 'text="⚡ Flash Deal"', timeoutMs: 5000 }, { id: "close-flash", operation: "click", target: '[title="Close"]' }, ...CART_SCRIPT.slice(at)]);
      assert.deepEqual(await session.failingFacts(GOAL), []);
      assert.deepEqual(unexpectedErrors(session), []);
    });
  });

  test("the home feed's rate-limited page leaves its spinner up until Retry is pressed", () => withSession(async (session) => {
    await session.run(upTo(CART_SCRIPT, "accept-cookies"));
    const page = session.page;
    const cards = page.locator(`.${c.feed} > .${c.card}`);
    assert.equal(await cards.count(), 10);
    await page.mouse.wheel(0, 6000);
    for (const deadline = Date.now() + 6000; await cards.count() < 20;) { assert.ok(Date.now() < deadline, "page 2 never loaded"); await page.waitForTimeout(100); }
    await page.mouse.wheel(0, 6000);
    await locate(page, `.${c.feedStatus} >> text="Retry"`).waitFor({ state: "visible", timeout: 8000 });
    assert.equal(await cards.count(), 20);
    assert.equal(await page.locator(`.${c.feedStatus} .${c.spinner}`).count(), 1, "the spinner is still spinning beside Retry");
    await locate(page, `.${c.feedStatus} >> text="Retry"`).click();
    for (const deadline = Date.now() + 6000; await cards.count() < 30;) { assert.ok(Date.now() < deadline, "the retry never loaded"); await page.waitForTimeout(100); }
    assert.ok(session.errors.some((error) => error.includes("status of 429")));
    assert.deepEqual(unexpectedErrors(session), []);
  }));

  test("list-layout: the grid read finds nothing, and a read of the list rows finds the same thirteen", () => withSession(async (session) => {
    await session.arm("list-layout");
    await session.page.reload();
    await session.run(upTo(SPAIN_HUBS_SCRIPT, "stars-listed"));
    const list = marketClasses(MARKET_SEED, "list-layout");
    await session.page.locator(`.${list.listView} > .${list.card} >> nth=0`).waitFor({ state: "visible", timeout: 5000 });
    await session.page.mouse.wheel(0, 6000);
    await session.page.locator(`.${list.listView} > .${list.card} >> nth=18`).waitFor({ state: "visible", timeout: 6000 });
    const recorded = SPAIN_HUBS_SCRIPT.find((step) => step.id === "extract-spain-hubs")!;
    assert.deepEqual((await session.run([recorded]))["extract-spain-hubs"], []);
    const rows = await session.run([{ ...recorded, id: "list-read", target: `.${list.listView} > .${list.card}:not(:has(.${list.adTag})):has(.${list.starsFill}:is(${RATED_45}))` }]);
    assert.deepEqual(rows["list-read"], spainHubRecords());
    assert.deepEqual(unexpectedErrors(session), []);
  }));
});
