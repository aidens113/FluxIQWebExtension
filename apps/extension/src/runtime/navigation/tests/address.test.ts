// Coverage of navigation/address.ts: the address a navigation drives a tab to.
// A relative address handed to `chrome.tabs.update` is resolved by the browser
// against the extension's own origin, never the page (auction seller-shop run,
// F7), so it is resolved here against the web page the Flow is on, and refused
// honestly when there is none.

import assert from "node:assert/strict";
import { test } from "node:test";
import { navigationAddress } from "../index";

const LISTING = "http://h:1/a/itm/9?q=1";
const EXTENSION = "chrome-extension://ojijcpdhndjbpooecgfhaeoloheeeigk/";
const PANEL = "http://127.0.0.1:3300";

test("an absolute web address passes unchanged, whatever page the Flow is on", () => {
  for (const pages of [[LISTING], [], [undefined], ["about:blank"]]) {
    assert.deepEqual(navigationAddress("https://shop.test/str/x?y=1#z", { pages, ownOrigins: [], extensionUrl: EXTENSION }), { url: "https://shop.test/str/x?y=1#z" });
  }
});

test("a root-relative address resolves against the page's origin", () => {
  assert.deepEqual(navigationAddress("/a/str/x", { pages: [LISTING], ownOrigins: [], extensionUrl: EXTENSION }), { url: "http://h:1/a/str/x" });
});

test("a dot-relative or bare relative address resolves against the page's path", () => {
  assert.deepEqual(navigationAddress("str/x", { pages: [LISTING], ownOrigins: [] }), { url: "http://h:1/a/itm/str/x" });
  assert.deepEqual(navigationAddress("./str/x", { pages: [LISTING], ownOrigins: [] }), { url: "http://h:1/a/itm/str/x" });
  assert.deepEqual(navigationAddress("../str/x", { pages: [LISTING], ownOrigins: [] }), { url: "http://h:1/a/str/x" });
  assert.deepEqual(navigationAddress("?page=2", { pages: [LISTING], ownOrigins: [] }), { url: "http://h:1/a/itm/9?page=2" });
});

test("surrounding whitespace in a relative address is not part of it", () => {
  assert.deepEqual(navigationAddress("  /a/str/x \n", { pages: [LISTING], ownOrigins: [] }), { url: "http://h:1/a/str/x" });
});

test("the first web page among the candidates is the base; browser pages and FluxIQ's panel are passed over", () => {
  const pages = [undefined, "chrome://newtab/", `${EXTENSION}sidepanel.html`, "about:blank", `${PANEL}/flows`, LISTING, "https://other.test/"];
  assert.deepEqual(navigationAddress("/a/str/x", { pages, ownOrigins: [PANEL], extensionUrl: EXTENSION }), { url: "http://h:1/a/str/x" });
});

test("a relative address with no web page to resolve against is refused, saying why", () => {
  const bases: Array<Array<string | undefined>> = [[], [undefined], ["about:blank"], ["chrome://newtab/"], [`${EXTENSION}popup.html`], ["file:///C:/x.html"], [`${PANEL}/`]];
  for (const pages of bases) {
    const answer = navigationAddress("/scenarios/a/str/x", { pages, ownOrigins: [PANEL], extensionUrl: EXTENSION });
    assert.ok("refused" in answer, JSON.stringify(pages));
    assert.match(answer.refused, /^url "\/scenarios\/a\/str\/x" is relative and there is no web page to resolve it against/u);
    assert.doesNotMatch(answer.refused, /permission|policy|no value:/u);
  }
});

test("the extension's own address is refused, written out or reached by resolving", () => {
  for (const url of [`${EXTENSION}scenarios/a/str/x`, "chrome-extension://OJIJCPDHNDJBPOOECGFHAEOLOHEEEIGK/x"]) {
    const answer = navigationAddress(url, { pages: [LISTING], ownOrigins: [], extensionUrl: EXTENSION });
    assert.ok("refused" in answer, url);
    assert.match(answer.refused, /is the extension's own address, which a Flow never navigates to/u);
  }
  // Another extension's page is not this one's own address; the page guard judges it.
  assert.deepEqual(navigationAddress("chrome-extension://other/x", { pages: [], ownOrigins: [], extensionUrl: EXTENSION }), { url: "chrome-extension://other/x" });
});

test("with no extension address known, nothing is refused as the extension's own", () => {
  assert.deepEqual(navigationAddress(`${EXTENSION}x`, { pages: [], ownOrigins: [] }), { url: `${EXTENSION}x` });
});
