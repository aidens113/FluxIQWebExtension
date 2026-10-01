// The whole path on a realistic capture: a raw snapshot shaped as the
// extension sends it (W2: `ownText`, `parent`, `hidden`, `viewport`) through
// the sanitizer into the published page. The page is the top of Everything
// Store's results for "wireless earbuds", the page the approved format example
// (`docs/working/language-driven-flow-loop-plan/reports/t223-format-example.md`)
// shows, with its honeypot, its screen-reader prices, a card below the fold, a
// cookie wall, and two hidden elements a search capture added.
//
// Each lesson of the example is asserted on the result: the title once, the
// price once with no `$`/`39.`/`99` fragments, the label not repeated, no
// honeypot, `same href` for a card's repeated target, nothing hidden.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { publishedWebLlmPage } from "../published-page";

const ORIGIN = "http://127.0.0.1:58717";
const STORE = "/scenarios/everything-store";
const AD = `${STORE}/sspa/click?adId=sp-7Q2K91&url=%2Fdp%2FB0DPN4ANC7`;
const TITLE = "Pulsebud Neo ANC Wireless Earbuds, Hybrid Active Noise Cancelling, Black";

type Raw = Record<string, unknown>;

/** One raw element: `box` is its document box, also its viewport box (the page is not scrolled); `on` is whether it is on screen. */
function raw(tagName: string, selector: string, box: [number, number, number, number] | undefined, fields: Raw = {}, context: Raw = {}): Raw {
  const bounds = box === undefined ? undefined : { x: box[0], y: box[1], width: box[2], height: box[3] };
  return { tagName, selector, documentBounds: bounds, bounds, isVisibleOnViewport: box !== undefined && box[1] < 720 && box[0] + box[2] > 0, context, ...fields };
}

const card1 = { landmark: "main", listPosition: { index: 1, total: 2 } };
const card2 = { landmark: "main", listPosition: { index: 2, total: 2 } };
const search = { landmark: "search" };

const snapshot = {
  url: `${ORIGIN}${STORE}/s?k=wireless+earbuds`,
  title: "Brightaisle.com : wireless earbuds",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 4000, devicePixelRatio: 1 },
  evidence: {
    dialogs: { open: [{ selector: "#consent", role: "dialog", label: "Cookie preferences", modal: true, kind: "consent", bounds: { x: 340, y: 560, width: 600, height: 140 } }] },
    overlays: { blockers: [{ selector: "#consent", label: "Cookie preferences", blocks: 1, blocked: ["#add-1"], kind: "consent" }] }
  },
  interactiveElements: [
    /* 0 */ raw("header", "header", [0, 0, 1263, 60], {}, { landmark: "banner" }),
    /* 1 */ raw("a", "#logo", [12, 15, 106, 31], { accessibleName: "Brightaisle", visibleText: "brightaisle", href: `${ORIGIN}${STORE}/`, parent: 0 }, { landmark: "banner" }),
    /* 2 */ raw("div", "#deliver", [132, 16, 85, 29], { visibleText: "Deliver to DanaPortland 97214", ownText: "Deliver to Dana", parent: 0 }, { landmark: "banner" }),
    /* 3 */ raw("b", "#deliver > b", [132, 30, 85, 14], { visibleText: "Portland 97214", parent: 2 }, { landmark: "banner" }),
    /* 4 */ raw("form", "#nav-search", [231, 10, 753, 40], { role: "search", parent: 0 }, search),
    /* 5 */ raw("label", "#nav-search > label", [231, 11, 59, 16], { accessibleName: "Search in", visibleText: "Search in", parent: 4 }, search),
    /* 6 */ raw("select", "select[name=\"i\"]", [231, 27, 60, 20], {
      accessibleName: "Search in", visibleText: "AllElectronics", selectedValue: "all",
      options: [{ value: "all", label: "All" }, { value: "electronics", label: "Electronics" }], parent: 4
    }, search),
    // The honeypot: a text field parked far off the page for bots to fill.
    /* 7 */ raw("input", "input[name=\"field-keywords\"]", [-9768, 10, 9, 7], { inputType: "text", label: "Search in", hasValue: false, value: "", attributes: { name: "field-keywords", tabindex: "-1", "aria-hidden": "true" }, parent: 4 }, search),
    /* 8 */ raw("input", "input[name=\"k\"]", [295, 10, 643, 40], { inputType: "text", accessibleName: "Search Brightaisle", hasValue: true, value: "wireless earbuds", parent: 4 }, search),
    /* 9 */ raw("button", "#nav-go", [938, 10, 46, 40], { accessibleName: "Go", controlType: "submit", parent: 4 }, search),
    /* 10 */ raw("main", "main", [0, 98, 1263, 3000], {}, { landmark: "main" }),
    /* 11 */ raw("div", "#card-1", [18, 160, 236, 420], { role: "listitem", accessibleName: `Sponsored Pulsebud${TITLE} 4.5 out of 5 stars(8,214) $39.99$39.99 FREE delivery Thu, Sep 24Add to cart`, parent: 10 }, card1),
    /* 12 */ raw("span", "#card-1 .sponsored", [24, 160, 60, 16], { visibleText: "Sponsored", parent: 11 }, card1),
    /* 13 */ raw("a", "#card-1 a.image", [24, 180, 216, 200], { href: `${ORIGIN}${AD}`, parent: 11 }, card1),
    /* 14 */ raw("img", "#card-1 img", [24, 180, 216, 200], { accessibleName: TITLE, parent: 13 }, card1),
    /* 15 */ raw("div", "#card-1 .brand", [24, 385, 216, 18], { visibleText: "Pulsebud", parent: 11 }, card1),
    /* 16 */ raw("h2", "#card-1 h2", [24, 405, 216, 40], { accessibleName: TITLE, visibleText: TITLE, ownText: "", parent: 11 }, card1),
    /* 17 */ raw("a", "#card-1 h2 > a", [24, 405, 216, 40], { accessibleName: TITLE, visibleText: TITLE, ownText: "", href: `${ORIGIN}${AD}`, parent: 16 }, card1),
    /* 18 */ raw("span", "#card-1 h2 span", [24, 405, 216, 40], { visibleText: TITLE, parent: 17 }, card1),
    /* 19 */ raw("span", "#card-1 .rating", [24, 450, 97, 15], { visibleText: "4.5 out of 5 stars", parent: 11 }, card1),
    /* 20 */ raw("a", "#card-1 a.ratings", [125, 450, 41, 18], { accessibleName: "8,214 ratings", visibleText: "(8,214)", ownText: "", href: `${ORIGIN}${AD}#customer-reviews`, parent: 11 }, card1),
    /* 21 */ raw("span", "#card-1 a.ratings > span", [125, 450, 41, 15], { visibleText: "(8,214)", parent: 20 }, card1),
    /* 22 */ raw("a", "#card-1 a.price", [24, 470, 43, 16], { accessibleName: "$39.99$39.99", ownText: "", href: `${ORIGIN}${AD}`, parent: 11 }, card1),
    /* 23 */ raw("span", "#card-1 .a-price", [24, 470, 43, 23], { visibleText: "$39.99$39.99", ownText: "", parent: 22 }, card1),
    /* 24 */ raw("span", "#card-1 .a-offscreen", [24, 470, 1, 1], { visibleText: "$39.99", parent: 23 }, card1),
    /* 25 */ raw("span", "#card-1 .a-price > span", [24, 470, 43, 23], { visibleText: "$39.99", ownText: "", parent: 23 }, card1),
    /* 26 */ raw("span", "#card-1 .a-price-symbol", [24, 470, 7, 14], { visibleText: "$", parent: 25 }, card1),
    /* 27 */ raw("span", "#card-1 .a-price-whole", [31, 470, 23, 23], { visibleText: "39.", parent: 25 }, card1),
    /* 28 */ raw("span", "#card-1 .a-price-fraction", [54, 470, 13, 14], { visibleText: "99", parent: 25 }, card1),
    /* 29 */ raw("div", "#card-1 .delivery", [24, 500, 216, 17], { visibleText: "FREE delivery Thu, Sep 24", ownText: "FREE delivery", parent: 11 }, card1),
    /* 30 */ raw("i", "#card-1 .delivery > i", [24, 502, 42, 12], { role: "img", accessibleName: "Brightaisle Plus", parent: 29 }, card1),
    /* 31 */ raw("b", "#card-1 .delivery > b", [150, 500, 67, 14], { visibleText: "Thu, Sep 24", parent: 29 }, card1),
    /* 32 */ raw("button", "#add-1", [24, 525, 80, 25], { accessibleName: "Add to cart", parent: 11 }, card1),
    /* 33 */ raw("div", "#card-2", [18, 900, 236, 420], { role: "listitem", parent: 10 }, card2),
    /* 34 */ raw("a", "#card-2 h2 > a", [24, 905, 216, 40], { accessibleName: "Lumo Audio Drift Wireless Earbuds", href: `${ORIGIN}${STORE}/Lumo-Audio-Drift/dp/B0CKQQT8ZC`, parent: 33 }, card2),
    /* 35 */ raw("button", "#add-2", [24, 1260, 80, 25], { accessibleName: "Add to cart", parent: 33 }, card2),
    // Two elements only a search capture lists.
    /* 36 */ raw("div", "#mega-menu", undefined, { hidden: true, parent: 0 }, { landmark: "banner" }),
    /* 37 */ raw("a", "#mega-menu a", [0, 0, 80, 20], { hidden: true, accessibleName: "Claim offer", href: `${ORIGIN}${STORE}/offer`, parent: 36 }, { landmark: "banner" }),
    // The cookie wall, a modal dialog in front of the page.
    /* 38 */ raw("div", "#consent", [340, 560, 600, 140], { role: "dialog", accessibleName: "Cookie preferences" }),
    /* 39 */ raw("p", "#consent p", [380, 580, 400, 20], { visibleText: "We use cookies.", parent: 38 }),
    /* 40 */ raw("button", "#consent .accept", [380, 620, 80, 30], { accessibleName: "Accept", parent: 38 })
  ]
};

test("a realistic capture becomes the approved compact page", () => {
  const binding = sanitizeWebLlmSnapshotWithBindings(snapshot);
  const published = publishedWebLlmPage(binding.evidence);
  assert.equal(published.page, [
    "PAGE \"Brightaisle.com : wireless earbuds\"",
    "URL ~/s?k=wireless+earbuds   (~ = http://127.0.0.1:58717/scenarios/everything-store)",
    "VIEW 1280x720 at the top · 22 elements with visible words or a control, in page order · find_on_page searches the rest",
    "COVERING t37 \"Cookie preferences\" consent covers 1",
    "DIALOG t37 \"Cookie preferences\" modal consent",
    "",
    "[banner]",
    "t2 link \"Brightaisle\" ~/",
    "t3 \"Deliver to Dana\"",
    "t4 \"Portland 97214\"",
    "[search]",
    "t7 select \"Search in\" =\"All\" [All|Electronics]",
    "t9 field \"Search Brightaisle\" =\"wireless earbuds\"",
    "t10 button \"Go\"",
    "[main]",
    "- 1/2",
    "t13 \"Sponsored\"",
    "t14 link ~/sspa/click?adId=sp-7Q2K91&url=%2Fdp%2FB0DPN4ANC7",
    "t16 \"Pulsebud\"",
    `t18 h2 link "${TITLE}" same href`,
    "t20 \"4.5 out of 5 stars\"",
    "t21 link \"8,214 ratings\" same href#customer-reviews",
    "t23 link \"$39.99\" same href",
    "t30 \"FREE delivery\"",
    "t31 img \"Brightaisle Plus\"",
    "t32 \"Thu, Sep 24\"",
    "t33 button \"Add to cart\" covered-by t37",
    "--- below the fold ---",
    "- 2/2",
    "t35 link \"Lumo Audio Drift Wireless Earbuds\" ~/Lumo-Audio-Drift/dp/B0CKQQT8ZC",
    "t36 button \"Add to cart\"",
    "--- on screen ---",
    "[page]",
    "t37 dialog \"Cookie preferences\" modal consent covers 1",
    "[dialog t37]",
    "t38 \"We use cookies.\"",
    "t39 button \"Accept\""
  ].join("\n"));
});

test("each lesson of the format example holds", () => {
  const page = publishedWebLlmPage(sanitizeWebLlmSnapshotWithBindings(snapshot).evidence).page;
  assert.equal(page.split(TITLE).length - 1, 1, "the title once: not as the image's alt, the heading and the link");
  assert.equal(page.split("$39.99").length - 1, 1, "the price once");
  assert.doesNotMatch(page, /"\$"|"39\."|"99"/u, "no price fragments");
  assert.equal(page.split("\"Search in\"").length - 1, 1, "the label is not repeated beside its select");
  assert.doesNotMatch(page, /t8 /u, "no honeypot");
  assert.doesNotMatch(page, /Claim offer|t40|t41/u, "nothing a search capture added as hidden");
});

test("the hidden elements did not move a visible element's handle", () => {
  const withoutHidden = { ...snapshot, interactiveElements: snapshot.interactiveElements.filter((element) => element.hidden !== true) };
  // Parents past the two hidden elements point at the same elements as before, so only the hidden ones are removed.
  const shifted = withoutHidden.interactiveElements.map((element) => typeof element.parent === "number" && element.parent > 36 ? { ...element, parent: element.parent - 2 } : element);
  const plain = publishedWebLlmPage(sanitizeWebLlmSnapshotWithBindings({ ...withoutHidden, interactiveElements: shifted }).evidence).page;
  const searched = publishedWebLlmPage(sanitizeWebLlmSnapshotWithBindings(snapshot).evidence).page;
  assert.equal(searched, plain);
});
