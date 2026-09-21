import assert from "node:assert/strict";
import test from "node:test";
import {
  approxText, endLabelText, endStampText, LISTINGS, listingByHandle, moneyText, pageWindow, parseSearchParams, parseTypedAmount,
  postageText, referenceStampText, searchListings, statedTotal, timeLeftText,
} from "../catalog/index.js";
import { KESTREL_AUCTIONS, WATCH_ADDITIONS, auctionMarketplaceManifest as manifest } from "../manifest.js";
import { INITIAL_WATCHLIST } from "../state.js";

const search = (query: string) => parseSearchParams(new URLSearchParams(query));
const ids = (handles: readonly string[]) => handles.map((handle) => listingByHandle(handle).id);

test("money is written in each seller's own convention, beside the site's own pound estimate", () => {
  assert.equal(moneyText("EUR", 116_500), "EUR 1.165,00");
  assert.equal(approxText("EUR", 116_500), "approx. £1,011.10");
  assert.equal(moneyText("EUR", 16_900), "EUR 169,00");
  assert.equal(approxText("EUR", 16_900), "approx. £146.68");
  assert.equal(approxText("EUR", 17_500), "approx. £151.88");
  assert.equal(approxText("EUR", 10_900), "approx. £94.60");
  assert.equal(moneyText("USD", 18_900), "US $189.00");
  assert.equal(approxText("USD", 18_900), "approx. £141.05");
  assert.equal(approxText("GBP", 6_400), "");
  assert.equal(postageText("EUR", { kind: "paid", amount: 1_450 }), "+EUR 14,50 postage");
  assert.equal(postageText("GBP", { kind: "free" }), "Free postage");
  assert.equal(postageText("GBP", { kind: "collection", place: "Sheffield" }), "Collection in person");
});

test("a typed bid is read the way a person might type it, in either decimal convention", () => {
  for (const typed of ["85", "85.00", "£85", "£ 85.00", "85,00"]) assert.equal(parseTypedAmount(typed), 8_500, typed);
  assert.equal(parseTypedAmount("1.085,50"), 108_550);
  assert.equal(parseTypedAmount("1,085.50"), 108_550);
  assert.equal(parseTypedAmount("eighty"), undefined);
  assert.equal(parseTypedAmount("85.001"), undefined);
});

test("every time is measured from the site's fixed clock and written with its date", () => {
  assert.equal(referenceStampText(), "Mon, 21 Sep 2026, 14:00 BST");
  assert.equal(timeLeftText(95), "1h 35m left");
  assert.equal(timeLeftText(42), "42m left");
  assert.equal(timeLeftText(3_162), "2d 4h left");
  assert.equal(endLabelText(95), "(Mon 21 Sep, 15:35)");
  assert.equal(endLabelText(2_011), "(Tue 22 Sep, 23:31)");
  assert.equal(endLabelText(2_045), "(Wed 23 Sep, 00:05)");
  assert.equal(endStampText(3_162), "Wed, 23 Sep 2026, 18:42 BST");
});

test("item numbers are twelve digits and unique, and two different auctions share one title", () => {
  const numbers = LISTINGS.map(({ id }) => id);
  assert.ok(numbers.every((id) => /^\d{12}$/u.test(id)));
  assert.equal(new Set(numbers).size, numbers.length);
  assert.equal(listingByHandle("m1").title, listingByHandle("m3").title);
  assert.notEqual(listingByHandle("m1").id, listingByHandle("m3").id);
});

test("a search for kestrel 35 returns fifty live listings on three overlapping pages, and the header claims fifty-two", () => {
  const params = search("_nkw=kestrel+35");
  const found = searchListings(params, []);
  assert.equal(found.length, 50);
  assert.equal(statedTotal(params, []), 52, "two ended auctions are still counted");
  assert.deepEqual(pageWindow(50, 1, 24), { start: 0, end: 24, page: 1, pages: 3 });
  assert.deepEqual(pageWindow(50, 2, 24), { start: 22, end: 46, page: 2, pages: 3 });
  assert.deepEqual(pageWindow(50, 3, 24), { start: 44, end: 50, page: 3, pages: 3 });
  assert.deepEqual(pageWindow(50, 1, 96), { start: 0, end: 50, page: 1, pages: 1 });
  assert.deepEqual([22, 23, 44, 45].map((index) => found[index]!.id), ids(["m3", "m6", "m4", "m5"]), "each page seam repeats two genuine auctions");
  assert.ok(!found.some((listing) => listing.id === listingByHandle("n1").id), "the lens nobody searched for is not a result");
});

test("the ten auctions owed are pinned by item number and by the text a person reads", () => {
  assert.deepEqual(KESTREL_AUCTIONS.map(({ id }) => id), [
    "226148391027", "305522918734", "186907334512", "226150047781", "315018264403",
    "204431876650", "226152268190", "176624490118", "305530187266", "204438810093",
  ]);
  const workflow = manifest.workflows!.find(({ id }) => id === "kestrel-auctions")!;
  assert.deepEqual(workflow.expected.extracted![0]!.records, [
    { title: "Kestrel 35 Rangefinder Camera", price: "£64.00", bids: "11 bids", postage: "+£4.95 postage" },
    { title: "KESTREL 35 45mm f/2.8 Voss-Anastigmat — film tested, new seals", price: "EUR 109,00", bids: "6 bids", postage: "+EUR 14,50 postage" },
    { title: "Kestrel 35 Rangefinder Camera", price: "£41.00", bids: "4 bids", postage: "Free postage" },
    { title: "Kestrel 35 rangefinder camera body + original leather case", price: "£96.00", bids: "4 bids", postage: "+£6.50 postage" },
    { title: "Kestrel 35 — CLA'd 2025, shutter accurate, lovely example", price: "US $189.00", bids: "13 bids", postage: "+US $32.00 postage" },
    { title: "Vintage Kestrel 35 35mm film camera, working, light meter dead", price: "£27.50", bids: "9 bids", postage: "+£3.99 postage" },
    { title: "Kestrel 35 rangefinder, 45mm f/2.8 lens, film tested", price: "£78.00", bids: "3 bids", postage: "+£5.20 postage" },
    { title: "Kestrel 35 camera with flash & manual — refurbished by seller", price: "£122.00", bids: "7 bids", postage: "Free postage" },
    { title: "Kestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut", price: "EUR 169,00", bids: "12 bids", postage: "+EUR 19,90 postage" },
    { title: "Kestrel 35 rangefinder — collection only, Sheffield", price: "£35.00", bids: "2 bids", postage: "Collection in person" },
  ]);
});

test("the site's filters, used carefully, return exactly the ten; each careless use gets a different answer", () => {
  const careful = "_nkw=kestrel+35&LH_Auction=1&LH_ItemCondition=3000|2500&Model=Kestrel+35&Type=Rangefinder+camera|Film+camera&_udhi=150&_sop=1";
  const owed = KESTREL_AUCTIONS.map(({ id }) => id);
  assert.deepEqual(searchListings(search(careful), []).map(({ id }) => id), owed);
  const without = (from: string, to: string) => searchListings(search(careful.replace(from, to)), []).map(({ id }) => id);
  assert.ok(!without("3000|2500", "3000").includes(listingByHandle("m8").id), "Pre-owned alone drops the refurbished auction");
  assert.ok(without("&Type=Rangefinder+camera|Film+camera", "").includes(listingByHandle("o6").id), "without Type, a lens whose seller filled in the camera's model comes back");
  assert.ok(!without("|Film+camera", "").includes(listingByHandle("m10").id), "Rangefinder camera alone drops the Kestrel 35 typed as Film camera");
  assert.ok(without("&Model=Kestrel+35", "").includes(listingByHandle("l1").id), "without Model, the 35S comes back");
});

test("watching adds three auctions; the fourth that qualifies is already watched", () => {
  assert.deepEqual(WATCH_ADDITIONS.map(({ id }) => id), ids(["m1", "m2", "m4"]));
  assert.deepEqual([...INITIAL_WATCHLIST], ids(["m3", "n1"]));
  const cutoff = 2_040;
  const pounds = (listing: (typeof KESTREL_AUCTIONS)[number]) => {
    const estimate = approxText(listing.currency, listing.price).replace(/^approx\. £/u, "").replaceAll(",", "");
    return estimate === "" ? listing.price / 100 : Number(estimate);
  };
  const qualifying = KESTREL_AUCTIONS.filter((listing) => (listing.endsIn ?? 0) < cutoff && pounds(listing) < 100);
  assert.deepEqual(qualifying.map(({ id }) => id), ids(["m1", "m2", "m3", "m4"]));
  assert.equal(listingByHandle("m5").endsIn, 2_045, "the next one ends five minutes after midnight");
});
