// The whole page on request (t1036, D5 and D15, `../full-view.ts`): the
// ordinary view's own lines, and between them, marked `extra`, the hidden
// elements and every element's attributes.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmFullPageView } from "../full-view";
import { webLlmPageView } from "../evidence-view";
import { fixturePacket } from "./packet-fixture";

const PACKET = fixturePacket([
  { tag: "a", href: "https://shop.test/", name: "Home", landmark: "banner", attributes: [["href", "https://shop.test/"], ["class", "logo"]] },
  { tag: "div", hidden: true, onViewport: false, box: undefined, name: "Offers menu", attributes: [["id", "mega-menu"]] },
  { tag: "a", hidden: true, onViewport: false, box: undefined, href: "https://shop.test/offer", name: "Claim offer" },
  { tag: "button", name: "Go", landmark: "main" }
]);

test("the view's own lines are the ordinary view, in order, with the same keys and texts", () => {
  const full = webLlmFullPageView(PACKET);
  assert.deepEqual(full.lines.filter((line) => line.extra !== true), webLlmPageView(PACKET).lines);
  assert.equal(full.key, webLlmPageView(PACKET).key);
});

test("hidden elements and attributes are extra lines in page order, each keyed uniquely", () => {
  const full = webLlmFullPageView(PACKET);
  const body = full.lines.slice(full.lines.findIndex((line) => line.key === "-") + 1);
  assert.deepEqual(body, [
    { key: "^t1", text: "[banner]" },
    { key: "t1", text: "t1 link \"Home\" ~/" },
    { key: "t1.attributes", text: "t1 attributes: href=\"https://shop.test/\" class=\"logo\"", extra: true },
    { key: "t2", text: "t2 hidden <div> \"Offers menu\"", extra: true },
    { key: "t2.attributes", text: "t2 attributes: id=\"mega-menu\"", extra: true },
    { key: "t3", text: "t3 hidden link \"Claim offer\"", extra: true },
    { key: "^t4", text: "[main]" },
    { key: "t4", text: "t4 button \"Go\"" }
  ]);
  assert.equal(new Set(full.lines.map((line) => line.key)).size, full.lines.length);
  assert.deepEqual(full.lines.find((line) => line.key === "FULL"), { key: "FULL", text: "FULL also lists the hidden elements and each element's attributes", extra: true });
});

test("a page with nothing hidden and no attributes shows only the FULL note beyond the ordinary view", () => {
  const plain = fixturePacket([{ tag: "button", name: "Go" }]);
  const extras = webLlmFullPageView(plain).lines.filter((line) => line.extra === true);
  assert.deepEqual(extras.map((line) => line.key), ["FULL"]);
});
