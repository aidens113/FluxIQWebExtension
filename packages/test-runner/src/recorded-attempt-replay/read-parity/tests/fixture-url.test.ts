import assert from "node:assert/strict";
import test from "node:test";
import { recordedReadFixtureUrlMatches } from "../fixture-url.js";

test("scenario path ownership requires the exact path or a slash descendant", () => {
  for (const start of ["/store", "/store/"]) {
    for (const captured of ["/store", "/store/", "/store/items?sort=price"]) {
      assert.equal(recordedReadFixtureUrlMatches(`http://127.0.0.1:1234${captured}`, start), true);
    }
    for (const captured of ["/store-other", "/stores", "/other/store", "/store%2Fother"]) {
      assert.equal(recordedReadFixtureUrlMatches(`http://127.0.0.1:1234${captured}`, start), false);
    }
  }
  assert.equal(recordedReadFixtureUrlMatches("http://localhost:1234/any/path", "/"), true);
  assert.equal(recordedReadFixtureUrlMatches("http://[::1]:1234/store/item", "/store"), true);
});

test("scenario ownership never admits external or credentialed URLs", () => {
  for (const captured of ["https://localhost/store", "http://example.test/store", "http://localhost.example.test/store", "http://user:secret@localhost/store", "not a URL"]) {
    assert.equal(recordedReadFixtureUrlMatches(captured, "/store"), false);
  }
  for (const start of ["store", "/store?other", "/store#other"]) {
    assert.equal(recordedReadFixtureUrlMatches("http://localhost/store", start), false);
  }
});
