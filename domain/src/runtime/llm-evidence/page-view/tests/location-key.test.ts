// The key a page is delivered under (t1036, P-a, `../location-key.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmPageKey } from "../location-key";

test("scheme and host lower-cased, a default port dropped, another kept", () => {
  assert.equal(webLlmPageKey("HTTPS://Shop.Test:443/Cart"), "https://shop.test/Cart");
  assert.equal(webLlmPageKey("http://127.0.0.1:4173/scenarios/store"), "http://127.0.0.1:4173/scenarios/store");
  assert.equal(webLlmPageKey("http://shop.test:80/"), "http://shop.test/");
});

test("a trailing slash is dropped, except the root's", () => {
  assert.equal(webLlmPageKey("https://shop.test/store/"), "https://shop.test/store");
  assert.equal(webLlmPageKey("https://shop.test/"), "https://shop.test/");
  assert.equal(webLlmPageKey("https://shop.test"), "https://shop.test/");
});

test("the query is not part of the key (user, 2026-11-25), whatever its parameters or their order", () => {
  assert.equal(webLlmPageKey("https://shop.test/s?k=towel&b=2&a=9&b=1"), "https://shop.test/s");
  assert.equal(webLlmPageKey("https://shop.test/s?"), "https://shop.test/s");
  assert.equal(webLlmPageKey("https://shop.test/s?b=1&a=2"), webLlmPageKey("https://shop.test/s/?a=2&b=1"));
  assert.equal(webLlmPageKey("https://app.test/?tab=2#/orders/7"), "https://app.test/#/orders/7");
});

test("a fragment is dropped unless it is a route", () => {
  assert.equal(webLlmPageKey("https://shop.test/item#reviews"), "https://shop.test/item");
  assert.equal(webLlmPageKey("https://app.test/#/orders/7"), "https://app.test/#/orders/7");
  assert.equal(webLlmPageKey("https://app.test/#!/orders"), "https://app.test/#!/orders");
});

test("a filter, a sort or another page of the same list is the same key; another path is another; a location that is not a URL is its own", () => {
  assert.equal(webLlmPageKey("https://shop.test/s?k=towel"), webLlmPageKey("https://shop.test/s?k=towel&pickup=today&sort=price&page=2"));
  assert.notEqual(webLlmPageKey("https://shop.test/s?k=towel"), webLlmPageKey("https://shop.test/item/7?k=towel"));
  assert.equal(webLlmPageKey("about:blank"), "about:blank");
  assert.equal(webLlmPageKey("not a url"), "not a url");
});
