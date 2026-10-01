import assert from "node:assert/strict";
import test from "node:test";
import { parsedUrl } from "../parsed-url";

test("an absolute address parses to the same URL the constructor gives", () => {
  assert.equal(parsedUrl("https://example.com/a?b=1#c")?.href, "https://example.com/a?b=1#c");
  assert.equal(parsedUrl("about:blank")?.protocol, "about:");
});

test("a relative address resolves against its base", () => {
  assert.equal(parsedUrl("../next?page=2", "https://example.com/list/page/1")?.href, "https://example.com/list/next?page=2");
  assert.equal(parsedUrl("/x", "https://example.com/a/b")?.href, "https://example.com/x");
});

test("what does not parse is undefined, not a throw", () => {
  assert.equal(parsedUrl(""), undefined);
  assert.equal(parsedUrl("not a url"), undefined);
  assert.equal(parsedUrl("/relative-without-base"), undefined);
  assert.equal(parsedUrl("x", "not a base"), undefined);
  assert.equal(parsedUrl("http://[bad"), undefined);
});

test("an empty base is a base that does not parse, not a missing one", () => {
  assert.equal(parsedUrl("https://example.com/", ""), undefined);
});

test("it does not depend on URL.canParse being present", () => {
  const descriptor = Object.getOwnPropertyDescriptor(URL, "canParse");
  Reflect.deleteProperty(URL, "canParse");
  try {
    assert.equal(parsedUrl("https://example.com/")?.host, "example.com");
    assert.equal(parsedUrl("nope"), undefined);
  } finally {
    if (descriptor) Object.defineProperty(URL, "canParse", descriptor);
  }
});
