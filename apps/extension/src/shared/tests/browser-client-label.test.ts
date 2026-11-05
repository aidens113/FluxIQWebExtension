import assert from "node:assert/strict";
import test from "node:test";
import { browserClientLabel } from "../browser";

const CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/140.0.0.0`;
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";
const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

test("names a browser the way a person does, so they can tell theirs apart", () => {
  assert.equal(browserClientLabel(CHROME_WINDOWS, "Win32"), "Chrome on Windows");
  assert.equal(browserClientLabel(EDGE_WINDOWS, "Win32"), "Edge on Windows");
  assert.equal(browserClientLabel(FIREFOX_LINUX, "Linux x86_64"), "Firefox on Linux");
  assert.equal(browserClientLabel(CHROME_MAC, "MacIntel"), "Chrome on Mac");
});

test("says less rather than guess", () => {
  assert.equal(browserClientLabel("", ""), "This browser");
  assert.equal(browserClientLabel(CHROME_WINDOWS.replace("Windows NT 10.0; Win64; x64", "Other"), "Other"), "Chrome");
});
