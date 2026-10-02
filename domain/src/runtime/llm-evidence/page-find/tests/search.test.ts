import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { RecoverableToolRejection } from "../../tool-rejection";
import { webLlmFindOnPage } from "../search";
import { webLlmFindQuery } from "../query";

const BOX = { x: 10, y: 10, width: 100, height: 20 };

function page(elements: WebLlmEvidenceElement[]): WebLlmPageEvidence {
  return {
    schemaVersion: "web-llm-evidence.v2",
    trust: "untrusted-page-evidence",
    location: "https://shop.test/s?k=earbuds",
    truncated: false,
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    elements
  };
}

function lines(found: string): string[] {
  return found.split("\n");
}

test("matches words, label, value, options, address and every attribute, in page order, ignoring case", () => {
  const found = webLlmFindOnPage(page([
    { target: "t1", tag: "button", name: "Add to cart", box: BOX, onViewport: true },
    { target: "t2", tag: "input", inputType: "text", label: "Coupon", value: "SAVE10", box: BOX, onViewport: true },
    { target: "t3", tag: "select", name: "Sort", options: [{ value: "a", label: "Price: low to high" }], box: BOX, onViewport: true },
    { target: "t4", tag: "a", name: "Details", href: "https://shop.test/p/cart-thing", box: BOX, onViewport: true },
    { target: "t5", tag: "div", attributes: [["data-testid", "mini-cart"]], box: BOX, onViewport: true },
    { target: "t6", tag: "span", text: "Nothing here", box: BOX, onViewport: true }
  ]), "CART", 0);
  assert.deepEqual(lines(found.found), [
    "3 matches for \"CART\"",
    "t1 button \"Add to cart\" on screen",
    "t4 link \"Details\" (href=\"https://shop.test/p/cart-thing\") on screen",
    "t5 div (data-testid=\"mini-cart\") on screen"
  ]);
  assert.equal(found.schemaVersion, "web-llm-find.v1");
  assert.equal(found.location, "https://shop.test/s?k=earbuds");
  assert.match(webLlmFindOnPage(page([{ target: "t2", tag: "input", inputType: "text", label: "Coupon", value: "SAVE10", box: BOX }]), "save10", 0).found, /^t2 field "Coupon" \(value="SAVE10"\) on screen$/mu);
  assert.match(webLlmFindOnPage(page([{ target: "t3", tag: "select", name: "Sort", options: [{ value: "a", label: "Price: low to high" }], box: BOX }]), "low to", 0).found, /^t3 select "Sort" \(option="Price: low to high"\) on screen$/mu);
  assert.match(webLlmFindOnPage(page([{ target: "t5", tag: "input", attributes: [["aria-describedby", "x"]], box: BOX }]), "DESCRIBED", 0).found, /^t5 field \(aria-describedby="x"\) on screen$/mu, "an attribute's name matches too");
});

test("hidden, off-page and below-the-fold elements are found, each saying where it is", () => {
  const found = webLlmFindOnPage(page([
    { target: "t1", tag: "a", name: "Gift cards", href: "https://shop.test/gift", hidden: true },
    { target: "t2", tag: "input", name: "Gift code", box: { x: -9768, y: 10, width: 9, height: 7 } },
    { target: "t3", tag: "span", text: "Gift wrap available", box: { x: 10, y: 2000, width: 100, height: 20 }, onViewport: false }
  ]), "gift", 0).found;
  assert.deepEqual(lines(found), [
    "3 matches for \"gift\"",
    "t1 link \"Gift cards\" not rendered",
    "t2 field \"Gift code\" off-page",
    "t3 span \"Gift wrap available\" below"
  ]);
});

test("words are cut at eighty characters, and a long matching value is shown as a window around the match", () => {
  const long = `${"word ".repeat(30)}end`;
  const href = `https://shop.test/${"a".repeat(80)}/needle/${"b".repeat(80)}`;
  const found = webLlmFindOnPage(page([{ target: "t1", tag: "a", name: long, href, box: BOX }]), "needle", 0).found;
  const line = lines(found)[1]!;
  assert.match(line, /^t1 link "(?:word ){16}…" \(href="…a+\/needle\/b+…"\) on screen$/u);
  assert.ok(line.length < 260, line);
});

test("fifty matches to a page, in page order, and the last line says how to ask for the next fifty", () => {
  const elements = Array.from({ length: 120 }, (_, index): WebLlmEvidenceElement => ({ target: `t${index + 1}`, tag: "button", name: `Item ${index + 1}`, box: BOX }));
  const first = lines(webLlmFindOnPage(page(elements), "item", 0).found);
  assert.equal(first[0], "120 matches for \"item\"");
  assert.equal(first.length, 52);
  assert.equal(first[1], "t1 button \"Item 1\" on screen");
  assert.equal(first.at(-1), "… 70 more: web.find_on_page {\"query\":\"item\",\"after\":50}");
  const last = lines(webLlmFindOnPage(page(elements), "item", 100).found);
  assert.equal(last.length, 21);
  assert.equal(last[1], "t101 button \"Item 101\" on screen");
  assert.equal(last.at(-1), "t120 button \"Item 120\" on screen");
  assert.deepEqual(lines(webLlmFindOnPage(page(elements), "nowhere", 0).found)[0], "0 matches for \"nowhere\"");
});

test("the query is read with its whitespace collapsed, and anything else is refused with the domain's input reasons", () => {
  assert.deepEqual(webLlmFindQuery({ query: "  Add   to cart " }), { query: "Add to cart", after: 0 });
  assert.deepEqual(webLlmFindQuery({ query: "cart", after: 50 }), { query: "cart", after: 50 });
  const refused = (value: Record<string, unknown>): string | undefined => {
    try {
      webLlmFindQuery(value as never);
      return undefined;
    } catch (error) {
      assert.ok(error instanceof RecoverableToolRejection);
      assert.equal(error.code, "invalid_input");
      return error.detail?.reason;
    }
  };
  assert.equal(refused({}), "missing_input_keys");
  assert.equal(refused({ query: "x", selector: "#a" }), "unexpected_input_keys");
  assert.equal(refused({ query: "   " }), "value_not_text");
  assert.equal(refused({ query: "x".repeat(201) }), "value_not_text");
  assert.equal(refused({ query: 7 }), "value_not_text");
  assert.equal(refused({ query: "x", after: -1 }), "not_a_number");
  assert.equal(refused({ query: "x", after: 1.5 }), "not_a_number");
});

// F32 (`run-muqc07fh-eeffbc86`): twelve searches of the home page for a product,
// each answered only `0 matches`, beside the site's own search box.
test("an empty search says only this page was read, and names the site's search fields to use instead", () => {
  const found = webLlmFindOnPage(page([
    { target: "t12", tag: "a", name: "Deals", href: "https://shop.test/deals", box: BOX, onViewport: true },
    { target: "t489", tag: "input", inputType: "search", label: "Search Voltbay", box: BOX, onViewport: true },
    { target: "t490", tag: "input", inputType: "text", attributes: [["name", "q"]], box: BOX, onViewport: true }
  ]), "Voltbay Pro", 0).found;
  assert.deepEqual(lines(found), [
    "0 matches for \"Voltbay Pro\"",
    "Nothing on this page holds those words, hidden elements included; find_on_page reads only the page you are on, never the rest of the site. To look across the site, type it into the site's search field t489 or t490 and submit it, or follow a link to the page that lists it."
  ]);
});

test("an empty search on a page with no search field says only to follow a link", () => {
  const found = webLlmFindOnPage(page([
    { target: "t1", tag: "input", inputType: "text", label: "Coupon", box: BOX, onViewport: true }
  ]), "earbuds", 0).found;
  assert.deepEqual(lines(found), [
    "0 matches for \"earbuds\"",
    "Nothing on this page holds those words, hidden elements included; find_on_page reads only the page you are on, never the rest of the site. To look across the site, follow a link to the page that lists it."
  ]);
});

test("a search that matched, or a later page of one, says nothing more", () => {
  const elements: WebLlmEvidenceElement[] = [{ target: "t489", tag: "input", inputType: "search", label: "Search", box: BOX, onViewport: true }];
  assert.deepEqual(lines(webLlmFindOnPage(page(elements), "search", 0).found), ["1 match for \"search\"", "t489 field[search] \"Search\" on screen"]);
  assert.deepEqual(lines(webLlmFindOnPage(page(elements), "nothing", 50).found), ["0 matches for \"nothing\""]);
});
