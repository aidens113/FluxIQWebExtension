import assert from "node:assert/strict";
import test from "node:test";
import { trackingFreeLinkIdentity } from "..";

test("explicit identity folds known tracking while preserving meaningful query bytes, duplicates and fragment", () => {
  const url = new URL("https://records.example/entry/7?id=A%20B&__cft__%5B0%5D=one&filter=%7Eraw&__tn__=source&id=C#section");
  assert.equal(trackingFreeLinkIdentity(url), "https://records.example/entry/7?id=A%20B&filter=%7Eraw&id=C#section");
  assert.match(url.href, /__tn__/u, "the caller's raw URL is never mutated");
  const other = new URL(url.href.replace("=one", "=another"));
  assert.equal(trackingFreeLinkIdentity(other), trackingFreeLinkIdentity(url));
});

test("unknown or item-identifying parameters and fragment never collapse distinct records", () => {
  for (const key of ["id", "page", "q", "src", "fbid", "token", "utm_custom", "__cft__other"]) {
    const left = trackingFreeLinkIdentity(new URL(`https://records.example/entry?${key}=one&fbclid=tracking#first`));
    const right = trackingFreeLinkIdentity(new URL(`https://records.example/entry?${key}=two&fbclid=tracking#first`));
    assert.notEqual(left, right, key);
  }
  assert.notEqual(trackingFreeLinkIdentity(new URL("https://records.example/entry#first")), trackingFreeLinkIdentity(new URL("https://records.example/entry#second")));
});

test("ordinary URLs retain their original query encoding and order exactly", () => {
  const url = new URL("https://records.example/entry?b=%20&a=%7e&&a=2#part");
  assert.equal(trackingFreeLinkIdentity(url), url.href);
  assert.equal(trackingFreeLinkIdentity(new URL("https://records.example/entry?utm_source=mail&gclid=click")), "https://records.example/entry");
});
