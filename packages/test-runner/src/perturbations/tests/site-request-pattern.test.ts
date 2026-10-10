import assert from "node:assert/strict";
import test from "node:test";
import { siteRequestMatcher } from "../site-request-pattern.js";

const origins = ["http://127.0.0.1:4100", "http://localhost:4100"];

test("the whole path must match, on one of the run's scenario origins, query ignored", () => {
  const matches = siteRequestMatcher("/api/social-network-feed/confirm-request", origins);
  assert.equal(matches("http://127.0.0.1:4100/api/social-network-feed/confirm-request"), true);
  assert.equal(matches("http://localhost:4100/api/social-network-feed/confirm-request?x=1"), true);
  assert.equal(matches("http://127.0.0.1:4100/api/social-network-feed/confirm-request/extra"), false);
  assert.equal(matches("http://127.0.0.1:4101/api/social-network-feed/confirm-request"), false);
  assert.equal(matches("http://127.0.0.1:4100/api/social-network-feed/delete-request"), false);
  assert.equal(matches("not a url"), false);
});

test("`*` stands for any run of characters and nothing else is special", () => {
  const matches = siteRequestMatcher("/api/*/add-to-cart", origins);
  assert.equal(matches("http://127.0.0.1:4100/api/crossborder-marketplace/add-to-cart"), true);
  assert.equal(matches("http://127.0.0.1:4100/api//add-to-cart"), true);
  assert.equal(siteRequestMatcher("/a.b", origins)("http://127.0.0.1:4100/axb"), false);
});
