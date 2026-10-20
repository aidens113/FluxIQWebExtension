// Only an http(s) address of the page's own origin is carried.

import assert from "node:assert/strict";
import test from "node:test";
import { isSameOriginAddress } from "../same-origin-address";

test("an address of the page's origin is carried; another origin, scheme or port is not", () => {
  const origin = "https://shop.test";
  assert.equal(isSameOriginAddress("https://shop.test/i/1.jpg", origin), true);
  assert.equal(isSameOriginAddress("HTTPS://shop.test/a.css", origin), true);
  assert.equal(isSameOriginAddress("https://cdn.shop.test/i/1.jpg", origin), false);
  assert.equal(isSameOriginAddress("http://shop.test/i/1.jpg", origin), false);
  assert.equal(isSameOriginAddress("https://shop.test:8443/i/1.jpg", origin), false);
  assert.equal(isSameOriginAddress("blob:https://shop.test/abc", origin), false);
  assert.equal(isSameOriginAddress("data:image/png;base64,AAAA", origin), false);
  assert.equal(isSameOriginAddress("https://", origin), false);
});
