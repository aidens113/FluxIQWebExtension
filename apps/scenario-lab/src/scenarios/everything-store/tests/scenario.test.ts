import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { CATALOG, EARBUD_ADS, EARBUDS, FEATURED_BRANDS, HOUSEHOLD, SEARCH_PARAMS, STORE_PATHS, TIDEWELL_KETTLES, resultsPage, searchCatalog, type SearchFilters } from "../catalog/index.js";
import { EVERYTHING_STORE_LIVE_TASKS } from "../live-tasks.js";
import { EVERYTHING_STORE_REPAIR_TASKS } from "../repair-tasks.js";
import { routeStore } from "../route.js";
import { everythingStoreScenario as scenario } from "../scenario.js";
import { STORE_THROTTLE, createStoreState, robotCode, type StoreState } from "../state/index.js";
import { storeClasses, storeIds } from "../style/index.js";

const manifest = scenario.manifest;
const context = { runToken: "everything-store-unit-token", seed: 241 };
const NONE: SearchFilters = { plus: false, stars4: false, band: null, low: null, high: null, brands: [] };
const apply = (state: StoreState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
const fresh = () => scenario.createState(scenario.seed);
const request = (subpath: string, query = "") => ({ subpath, query: new URLSearchParams(query), method: "GET" as const });
const route = (state: StoreState, subpath: string, query = "", now = 1_000_000) => routeStore(state, request(subpath, query), context, now);
const markupOf = (html: string) => html.slice(0, html.indexOf("<script"));
const dataset = (workflowId: string, step: string) => resolveScenarioWorkflow(manifest, { workflowId }).expected.extracted?.find((entry) => entry.step === step);
const earbudSearch = (filters: SearchFilters = NONE) => searchCatalog({ keywords: "wireless earbuds", department: "all", filters, sort: "featured", page: 1 });
const passed = () => apply(fresh(), "pass-soft-check");

test("the manifest is valid, with four workflows, three variants, and a goal on the purchase", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["add-to-cart", "first-page-earbuds", "plus-under-fifty"]);
  assert.deepEqual(manifest.workflows?.flatMap((workflow) => (workflow.variants ?? []).map(({ id, arm }) => `${workflow.id}/${id}/${JSON.stringify(arm.payload)}`)), [
    `add-to-cart/redesigned-header/{"mode":"redesigned-header"}`,
    `first-page-earbuds/deal-wheel/{"mode":"deal-wheel"}`,
    `first-page-earbuds/robot-check/{"mode":"robot-check"}`,
  ]);
  assert.equal(manifest.playbackGoal?.id, "buy-one-kettle");
  const robot = resolveScenarioWorkflow(manifest, { workflowId: "first-page-earbuds", variantId: "robot-check" }).expected;
  assert.deepEqual(robot.failure, { category: "user_intervention_required" }, "the hard challenge's right outcome is asking a person");
});

test("the catalogue is authored, fixed, and independent of the lab seed", () => {
  assert.equal(EARBUDS.length, 70);
  assert.equal(new Set(CATALOG.all.map(({ sku }) => sku)).size, CATALOG.all.length);
  const [one, other] = [createStoreState(1), createStoreState(999)];
  assert.deepEqual({ ...one, challengeSeed: 0 }, { ...other, challengeSeed: 0 });
  assert.notEqual(robotCode(1, 0), robotCode(999, 0));
  assert.notEqual(storeClasses(1).card, storeClasses(2).card, "a different seed renames every class");
  assert.notEqual(storeIds(1).searchInput, storeIds(2).searchInput, "and every generated id");
  assert.equal(new Set(Object.values(storeIds(241))).size, Object.keys(storeIds(241)).length);
});

test("the planted listings sit where the traps need them", () => {
  const at = (rank: number) => EARBUDS[rank]!;
  assert.deepEqual([at(1).priceCents, at(1).rating, at(1).plus], [4999, 4.1, true], "a pair at $49.99 that qualifies");
  assert.deepEqual([at(4).priceCents, at(4).plus], [5000, true], "a pair at exactly $50.00 that does not");
  assert.deepEqual([at(6).rating, at(9).rating], [3.8, 3.9], "ratings the review filter rounds up to four stars");
  assert.deepEqual([at(10).kind, at(22).kind], ["accessory", "accessory"]);
  assert.ok(at(10).plus && at(10).rating >= 4 && at(10).priceCents < 5000, "an accessory meets every number");
  assert.notEqual(at(27).title, at(41).title, "the lookalikes are two listings with two titles");
  assert.ok(at(41).title.startsWith(at(27).title), "that begin the same way");
  assert.ok(FEATURED_BRANDS.includes(at(12)), "one carousel product is also an organic result");
});

test("the first-page dataset is the sixteen organic results of a Plus-only search, in order", () => {
  const entry = dataset("first-page-earbuds", "extract-first-page");
  const plus = earbudSearch({ ...NONE, plus: true });
  assert.equal(plus.organic.length, 43);
  assert.equal(entry?.count, 16);
  assert.deepEqual(entry?.records?.map(({ url }) => url), plus.organic.slice(0, 16).map((product) => STORE_PATHS.product(product)));
  assert.deepEqual(entry?.records?.[0], { name: plus.organic[0]!.title, price: "$79.99", rating: "3.7", url: STORE_PATHS.product(plus.organic[0]!) });
});

test("the hard dataset keeps exactly the pairs a careful reader keeps", () => {
  const entry = dataset("plus-under-fifty", "extract-plus-under-fifty");
  const urls = new Set(entry?.records?.map(({ url }) => url));
  const kept = (rank: number) => urls.has(STORE_PATHS.product(EARBUDS[rank]!));
  assert.equal(entry?.count, 13);
  assert.ok(kept(1) && kept(12) && kept(15) && kept(27) && kept(41), "the $49.99 pair, the house brand's organic result, the page-boundary pair, and both lookalikes");
  assert.ok(!kept(4) && !kept(6) && !kept(9) && !kept(10) && !kept(22), "not the $50.00 pair, the 3.8, the 3.9, or either accessory");
  for (const ad of EARBUD_ADS) if (!EARBUDS.includes(ad.product)) assert.ok(!urls.has(STORE_PATHS.product(ad.product)), `sponsored-only ${ad.product.brand}`);
  for (const record of entry?.records ?? []) {
    assert.ok(Number(record.rating) >= 4 && Number(record.price?.slice(1)) < 50, JSON.stringify(record));
  }
  assert.equal(urls.size, entry?.records?.length, "each pair once");
});

test("every shortcut the filter rail offers gives the wrong answer to the hard task", () => {
  const rated = earbudSearch({ ...NONE, plus: true, stars4: true, high: 4999 }).organic;
  assert.ok(rated.includes(EARBUDS[6]!) && rated.includes(EARBUDS[9]!), "four stars and up admits the 3.8 and the 3.9");
  const band = earbudSearch({ ...NONE, plus: true, band: "25-50" }).organic;
  assert.ok(band.includes(EARBUDS[4]!), "$25 to $50 admits exactly $50.00");
  assert.ok(!band.includes(EARBUDS[12]!), "and leaves out a qualifying pair under $25");
  assert.equal(earbudSearch().total, "over 1,000", "the unnarrowed count is the store's boast, not the truth");
});

test("every later page opens with the last result of the page before, and only page one's Next is honest", () => {
  const outcome = earbudSearch();
  const [one, two, three] = [1, 2, 3].map((page) => resultsPage(outcome, page));
  assert.equal(one?.pageCount, 5);
  assert.equal(two?.organic[0], one?.organic.at(-1));
  assert.equal(three?.organic[0], two?.organic.at(-1));
  assert.deepEqual([one?.eager.length, one?.lazy.length, two?.eager.length, two?.lazy.length], [12, 4, 12, 5]);
  const query = { keywords: "wireless earbuds", department: "all", filters: NONE, sort: "featured" as const };
  const pageTwo = markupOf(route(passed(), "s", "k=wireless+earbuds&page=2")?.body ?? "");
  const next = /<a [^>]*href="([^"]+)"[^>]*aria-label="Go to next page, page 3"/u.exec(pageTwo)?.[1]?.replaceAll("&amp;", "&");
  assert.equal(next, SEARCH_PARAMS.href({ ...query, page: 2 }), "page two's Next leads back to page two");
});

test("a results page arrives as placeholders, a template, and a sentinel, with adverts wearing the same container", () => {
  const body = route(passed(), "s", "k=wireless+earbuds&rh=plus")?.body ?? "";
  const markup = markupOf(body);
  const template = markup.slice(markup.indexOf("<template"), markup.indexOf("</template>"));
  const outside = markup.replace(template, "");
  assert.equal((outside.match(/data-component="search-result"/gu) ?? []).length, 8, "eight placeholders");
  assert.ok(!/data-component="search-result" data-sku/u.test(outside), "none of them a listing");
  assert.equal((template.match(/data-component="search-result" data-sku="[^"]+" data-index="\d+" data-ad-id/gu) ?? []).length, 3, "three adverts arrive with the page");
  assert.equal((template.match(/data-component="search-result" data-sku="[^"]+" data-index="\d+">/gu) ?? []).length, 12, "and twelve results");
  assert.ok(template.includes("sspa/click?"), "adverts link through the ad server");
  assert.match(template, /Featured from our brands <span[^>]*>Sponsored<\/span>/u);
  assert.match(template, /<span class="[^"]+">(\$\d+\.\d\d)<\/span><span aria-hidden="true"><span class="[^"]+">\$<\/span>/u, "a price is written twice");
  const more = route(passed(), "s/more", "k=wireless+earbuds&rh=plus")?.body ?? "";
  assert.equal((more.match(/data-ad-id/gu) ?? []).length, 1, "the fetched rest holds the last advert");
  assert.equal((more.match(/data-index="1[3-6]"/gu) ?? []).length, 4, "and the last four results");
});

test("the only test id on a control is the search button, and the redesign takes it away", () => {
  const home = markupOf(scenario.render(fresh(), context));
  const form = home.slice(home.indexOf("<form"), home.indexOf("</form>"));
  assert.ok(form.indexOf(`name="field-keywords"`) < form.indexOf(`name="k"`), "the honeypot comes before the search box");
  assert.match(form, /<input class="[^"]+" type="text" name="field-keywords" value="" tabindex="-1" autocomplete="off" aria-hidden="true">/u);
  const controls = [...home.matchAll(/<(button|input|select|a)\b[^>]*data-testid="([^"]+)"/gu)].map((match) => match[2]);
  assert.deepEqual(controls, ["nav-search-submit"]);
  const redesigned = markupOf(scenario.render(apply(fresh(), "set-mode", { mode: "redesigned-header" }), context));
  assert.ok(!redesigned.includes("nav-search-submit"));
  assert.ok(redesigned.indexOf(`aria-label="Search Brightaisle"`) < redesigned.indexOf(`aria-label="Search with your camera"`), "the camera stands where the button stood");
});

test("a filled honeypot flags the session and answers with the robot check at once", () => {
  const response = route(passed(), "s", "k=wireless+earbuds&field-keywords=wireless+earbuds");
  assert.equal(response?.status, 200);
  assert.ok(response?.body?.includes(`data-testid="robot-check"`));
  assert.deepEqual(response?.mutation, { operation: "search-request", payload: { at: 1_000_000, honeypot: true } });
  const flagged = apply(passed(), "search-request", { at: 1, honeypot: true });
  assert.equal(flagged.guard.flagged, "honeypot");
  for (const subpath of ["s", "cart", "checkout", `dp/${TIDEWELL_KETTLES[0]!.sku}`]) assert.ok(route(flagged, subpath, "k=kettle")?.body?.includes(`data-testid="robot-check"`), subpath);
  assert.ok(scenario.render(flagged, context).includes(`data-testid="robot-check"`), "the home page too");
  assert.equal(route(flagged, "s/more", "k=kettle")?.status, 403);
  assert.equal(route(flagged, `img/${EARBUDS[0]!.sku}.svg`)?.status, 200, "photos are still served");
  assert.deepEqual(apply(flagged, "add-to-cart", { sku: HOUSEHOLD.batteries.sku, quantity: 1 }).cart, flagged.cart, "nothing gets through while it stands");
});

test("the rate limiter refuses the sixth results page in eight seconds, counts the refusal, and lets a patient retry through", () => {
  let state = passed();
  for (const at of [0, 500, 1000, 1500, 2000]) state = apply(state, "search-request", { at, honeypot: false });
  const refused = route(state, "s", "k=earbuds", 2500);
  assert.equal(refused?.status, 429);
  assert.equal(refused?.headers?.["retry-after"], "6");
  assert.deepEqual(refused?.mutation, { operation: "throttled", payload: { at: 2500 } });
  assert.equal(STORE_THROTTLE.decide(state.guard.searchLoads, 2500 + 6000).allowed, true, "waiting as asked works");
  state = apply(apply(state, "throttled", { at: 2500 }), "throttled", { at: 2600 });
  assert.equal(state.guard.flagged, null);
  assert.equal(apply(state, "throttled", { at: 2700 }).guard.flagged, "rate-limit", "the third refusal flags the session");
});

test("the session's first search meets the soft check, which a click or a wait passes", () => {
  const first = route(fresh(), "s", "k=wireless+earbuds");
  assert.ok(first?.body?.includes(`data-testid="soft-check"`));
  assert.match(first?.body ?? "", /data-continue disabled>Checking your browser/u);
  assert.equal(route(passed(), "s", "k=wireless+earbuds")?.body?.includes(`data-testid="soft-check"`), false);
});

test("the robot check takes only the right characters, and a wrong guess leaves its mark", () => {
  const armed = apply(fresh(), "set-mode", { mode: "robot-check" });
  assert.ok(scenario.render(armed, context).includes(`data-testid="robot-check"`));
  assert.ok(!scenario.render(armed, context).includes(robotCode(armed.challengeSeed, 0)), "the characters are never text on the page");
  const wrong = apply(armed, "solve-robot-check", { answer: "WRONG1" });
  assert.deepEqual(wrong.guard.robot, { image: 1, wrong: 1, solved: false });
  assert.ok(scenario.render(wrong, context).includes(`data-testid="robot-check-error"`));
  const right = apply(wrong, "solve-robot-check", { answer: robotCode(wrong.challengeSeed, 1).toLowerCase() });
  assert.equal(right.guard.robot.solved, true);
  assert.ok(scenario.render(right, context).includes(`data-testid="cart-count"`), "a person's answer gives the store back");
});

test("the cart adds, merges, refuses what cannot be bought, and fails its first Save for later", () => {
  const sage = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.7 L")!;
  const unavailable = TIDEWELL_KETTLES.find((child) => !child.available)!;
  let state = apply(fresh(), "add-to-cart", { sku: sage.sku, quantity: 1 });
  state = apply(state, "add-to-cart", { sku: sage.sku, quantity: 1 });
  assert.deepEqual(state.cart.map(({ sku, quantity }) => [sku, quantity]), [[sage.sku, 2], [HOUSEHOLD.phoneCase.sku, 1], [HOUSEHOLD.batteries.sku, 1]]);
  assert.deepEqual(apply(state, "add-to-cart", { sku: unavailable.sku, quantity: 1 }), state);
  assert.deepEqual(apply(state, "add-to-cart", { sku: sage.sku, quantity: 1, offerId: "ofr-kw-mb17" }), state, "an offer is only for its own listing");
  const withPlan = apply(fresh(), "add-to-cart", { sku: sage.sku, quantity: 2, protection: true });
  assert.ok(withPlan.cart.some((line) => line.sku === HOUSEHOLD.protectionPlan.sku && line.quantity === 2));
  const failed = apply(state, "save-for-later", { lineId: "L2" });
  assert.equal(failed.cart.length, 3, "the first Save for later changes nothing");
  const saved = apply(failed, "save-for-later", { lineId: "L2" });
  assert.deepEqual(saved.cart.map(({ sku }) => sku), [sage.sku, HOUSEHOLD.batteries.sku]);
  assert.equal(saved.saved[0]?.sku, HOUSEHOLD.phoneCase.sku);
  const cart = route(saved, "cart", "part=main")?.body ?? "";
  assert.match(cart, /data-testid="cart-subtotal">Subtotal \(3 items\): \$107\.47</u);
});

test("checkout opens on the store's preferences, and only the asked-for order meets the goal", () => {
  const matte = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Matte Black" && child.variant.capacity === "1.7 L")!;
  const bought = apply(fresh(), "start-checkout", { pipeline: "buy-now", sku: matte.sku, quantity: 1 });
  assert.deepEqual([bought.checkout?.delivery, bought.checkout?.plusTrial, bought.checkout?.paymentId], ["brightaisle-day", true, "visa-4417"]);
  const honest = apply(apply(apply(bought, "set-delivery", { option: "standard" }), "set-plus-trial", { enabled: false }), "place-order");
  assert.equal(honest.orders[0]?.totalCents, 4499);
  assert.equal(honest.cart.length, 2, "Buy Now leaves the cart alone");
  const page = markupOf(route(honest, "thankyou", `orderId=${honest.orders[0]!.orderId}`)?.body ?? "");
  for (const fact of manifest.playbackGoal?.successFacts ?? []) {
    const shown = new RegExp(`data-testid="${fact.subject}"[^>]*>([^<]*)<`, "u").exec(page)?.[1]?.replaceAll("&amp;", "&");
    if (fact.predicate === "text") assert.equal(shown, fact.value, fact.id);
    else assert.equal(shown !== undefined, fact.value, fact.id);
  }
  const lazy = apply(apply(apply(fresh(), "add-to-cart", { sku: matte.sku, quantity: 1 }), "start-checkout", { pipeline: "cart" }), "place-order");
  const defaults = markupOf(route(lazy, "thankyou", `orderId=${lazy.orders[0]!.orderId}`)?.body ?? "");
  assert.match(defaults, /data-testid="order-line-3"/u, "checking out the whole cart orders the case and the batteries too");
  assert.match(defaults, /data-testid="plus-trial"/u, "and keeps the trial the store ticked");
  assert.equal(lazy.cart.length, 0);
});

test("arming starts the account over, and anything unknown changes nothing", () => {
  const busy = apply(passed(), "add-to-cart", { sku: HOUSEHOLD.batteries.sku, quantity: 3 });
  const armed = apply(busy, "set-mode", { mode: "deal-wheel" });
  assert.deepEqual({ ...armed, mode: "baseline" }, fresh());
  assert.deepEqual(apply(busy, "set-mode", { mode: "no-such-mode" }), busy);
  assert.deepEqual(apply(busy, "no-such-operation", {}), busy);
  assert.deepEqual(apply(busy, "add-to-cart", "not an object"), busy);
});

test("the sponsored redirect sends only to the store's own product pages", () => {
  const ad = EARBUD_ADS[0]!;
  const redirect = route(passed(), "sspa/click", new URL(`http://x${STORE_PATHS.sponsored(ad)}`).search.slice(1));
  assert.deepEqual([redirect?.status, redirect?.headers?.location], [302, STORE_PATHS.product(ad.product)]);
  assert.equal(route(passed(), "sspa/click", "url=https%3A%2F%2Fexample.com%2F"), undefined);
});

test("the catalogue's tasks name only this scenario, and its repairs name its drift and its challenge", () => {
  assert.deepEqual(EVERYTHING_STORE_LIVE_TASKS.map(({ scenarioId }) => scenarioId), Array(EVERYTHING_STORE_LIVE_TASKS.length).fill("everything-store"));
  assert.deepEqual(EVERYTHING_STORE_LIVE_TASKS.map(({ judgeBy, expectedDatasetId }) => expectedDatasetId ?? judgeBy), ["extract-plus-under-fifty", "extract-first-page", "extract-first-page", "extract-cart", "playback-goal"]);
  assert.deepEqual(EVERYTHING_STORE_REPAIR_TASKS.map(({ variantId, expect }) => `${variantId}:${expect}`), ["redesigned-header:repair", "robot-check:refusal"]);
});
