// Each detected column's readable name (t1038, D13): the key where the page named the column in words, and otherwise
// what the column's element is and what of it is read, never a page value and never another column's key.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmReadableColumnNames, type WebLlmNamedColumn } from "../column-names";

function column(key: string, pageLabel: string, shownLabel: string, spec: WebLlmNamedColumn["spec"]): WebLlmNamedColumn {
  return { key, pageLabel, shownLabel, spec };
}

test("a column the page named in words keeps its key as its name", () => {
  const names = webLlmReadableColumnNames([
    column("price", "Price", "Price", { kind: "text" }),
    column("product-image_src", "product-image src", "product-image src", { kind: "attribute", attribute: "src" })
  ]);
  assert.deepEqual(names, { price: "price", "product-image_src": "product-image_src" });
});

test("a class-path column is named by its element and what of it is read, with no page value", () => {
  const names = webLlmReadableColumnNames([
    column("ul_css-1a2b_li_1_a_css-0yntmso_span_css-0ek4plr", "ul.css-1a2b > li:1 > a.css-0yntmso > span.css-0ek4plr", "link: 'A long product title'", { kind: "text" }),
    column("ul_css-1a2b_li_1_a_css-0yntmso_url", "ul.css-1a2b > li:1 > a.css-0yntmso url", "link: '/item/7'", { kind: "link" }),
    column("ul_css-1a2b_li_1_div_css-9z8y_span_css-0ek4plr_currency_amount", "ul.css-1a2b > li:1 > div.css-9z8y > span.css-0ek4plr (currency amount)", "price: '$10.47'", { kind: "text" }),
    column("ul_css-1a2b_li_1_img_css-1lxw2mb_src", "ul.css-1a2b > li:1 > img.css-1lxw2mb src", "image: 'http://site.test/a.png'", { kind: "attribute", attribute: "src" }),
    column("ul_css-1a2b_li_1_img_css-1lxw2mb_alt", "ul.css-1a2b > li:1 > img.css-1lxw2mb alt", "image: 'A long product title'", { kind: "attribute", attribute: "alt" }),
    column("ul_css-1a2b_li_1_span_css-01zhg8r", "ul.css-1a2b > li:1 > span.css-01zhg8r", "text: 'Now'", { kind: "text" }),
    column("ul_css-1a2b_li_1_span_css-77qq1zz", "ul.css-1a2b > li:1 > span.css-77qq1zz", "text: '1.4 c/sheet'", { kind: "text" })
  ]);
  assert.deepEqual(Object.values(names), ["link", "url", "price", "image_src", "image_alt", "text", "text_2"]);
  for (const name of Object.values(names)) assert.doesNotMatch(name, /product|title|now|sheet|10|png/iu, "a name carries no page value");
});

test("a name never takes another column's key, so a key still names exactly its column", () => {
  const names = webLlmReadableColumnNames([
    column("price", "Price", "Price", { kind: "text" }),
    column("div_css-9z8y_span_css-0ek4plr", "div.css-9z8y > span.css-0ek4plr", "price: '$3'", { kind: "text" })
  ]);
  assert.deepEqual(names, { price: "price", "div_css-9z8y_span_css-0ek4plr": "price_2" });
});

test("a class-path column with no sample is named by what it reads", () => {
  const names = webLlmReadableColumnNames([
    column("div_css-9z8y_span_css-0ek4plr", "div.css-9z8y > span.css-0ek4plr", "div.css-9z8y > span.css-0ek4plr", { kind: "text" }),
    column("div_css-9z8y_a_css-1x2y_url", "div.css-9z8y > a.css-1x2y url", "div.css-9z8y > a.css-1x2y url", { kind: "link" }),
    column("div_css-9z8y_button_css-4r5t", "div.css-9z8y > button.css-4r5t (pressed)", "button: 'Save' (pressed)", { kind: "text", mark: "state" })
  ]);
  assert.deepEqual(Object.values(names), ["text", "url", "button_pressed"]);
});

test("the same columns are named the same each time", () => {
  const columns = [
    column("a_css-1x2y", "a.css-1x2y", "link: 'One'", { kind: "text" }),
    column("a_css-1x2y_url", "a.css-1x2y url", "link: '/one'", { kind: "link" })
  ];
  assert.deepEqual(webLlmReadableColumnNames(columns), webLlmReadableColumnNames(structuredClone(columns)));
});

test("plain text inside a link or heading, and an image's attribute, are named from their path's tags", () => {
  const names = webLlmReadableColumnNames([
    column("li_css-2c3d_a_css-3e4f_span_css-5g6h", "li.css-2c3d > a.css-3e4f > span.css-5g6h", "text: 'Leek soup'", { kind: "text" }),
    column("li_css-2c3d_h3_css-0a1b_span_css-9c8d", "li.css-2c3d > h3.css-0a1b > span.css-9c8d", "li.css-2c3d > h3.css-0a1b > span.css-9c8d", { kind: "text" }),
    column("li_css-2c3d_img_css-1lxw2mb_src", "li.css-2c3d > img.css-1lxw2mb src", "li.css-2c3d > img.css-1lxw2mb src", { kind: "attribute", attribute: "src" }),
    column("li_css-2c3d_div_css-7e6f_span", "li.css-2c3d > div.css-7e6f > span", "text: 'Soup'", { kind: "text" })
  ]);
  assert.deepEqual(Object.values(names), ["link_text", "heading_text", "image_src", "text"]);
});
