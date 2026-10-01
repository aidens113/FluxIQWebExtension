// How a link target is written: the `~` base, paths, other origins, and repeats.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmLinkRepeats } from "../link-repeats";
import { webLlmLinkWriter } from "../link-writer";
import { bodyLines } from "./packet-fixture";

const ORIGIN = "http://127.0.0.1:58717";
const LOCATION = `${ORIGIN}/scenarios/everything-store/s?k=wireless+earbuds`;

test("~ is the origin plus the longest prefix of the page's own path that at least half the same-origin links start with", () => {
  const writer = webLlmLinkWriter(LOCATION, [
    `${ORIGIN}/scenarios/everything-store/`,
    `${ORIGIN}/scenarios/everything-store/cart`,
    `${ORIGIN}/help`,
    "https://elsewhere.test/x"
  ]);
  assert.equal(writer.base, `${ORIGIN}/scenarios/everything-store`);
  assert.equal(writer.write(LOCATION), "~/s?k=wireless+earbuds");
  assert.equal(writer.write(`${ORIGIN}/scenarios/everything-store/`), "~/");
  assert.equal(writer.write(`${ORIGIN}/scenarios/everything-store`), "~");
  assert.equal(writer.write(`${ORIGIN}/scenarios/everything-store/s?k=a#reviews`), "~/s?k=a#reviews");
  assert.equal(writer.write(`${ORIGIN}/help`), "/help", "another same-origin link prints its path");
  assert.equal(writer.write(`${ORIGIN}/scenarios/everything-storefront`), "/scenarios/everything-storefront", "a prefix is whole segments");
  assert.equal(writer.write("https://elsewhere.test/x"), "https://elsewhere.test/x", "another origin prints in full");
  assert.equal(writer.write("mailto:help@shop.test"), "mailto:help@shop.test");
});

test("when no prefix qualifies, ~ is the origin", () => {
  const writer = webLlmLinkWriter(`${ORIGIN}/a/b`, [`${ORIGIN}/x`, `${ORIGIN}/y`, `${ORIGIN}/a/z`]);
  assert.equal(writer.base, ORIGIN);
  assert.equal(writer.write(`${ORIGIN}/x?q=1`), "~/x?q=1");
  assert.equal(webLlmLinkWriter(`${ORIGIN}/a/b`, []).base, ORIGIN, "a page with no links");
});

test("repeats: same href, same href#fragment, same href as tN, and the target written out where that is shorter", () => {
  const title = `${ORIGIN}/scenarios/everything-store/sspa/click?adId=sp-7Q2K91&url=%2Fdp%2FB0DPN4ANC7`;
  const other = `${ORIGIN}/scenarios/everything-store/Lumo-Audio-Drift-Wireless-Earbuds/dp/B0CKQQT8ZC`;
  const writer = webLlmLinkWriter(LOCATION, [title, other]);
  const repeat = webLlmLinkRepeats(writer);
  assert.equal(repeat("t241", title), "~/sspa/click?adId=sp-7Q2K91&url=%2Fdp%2FB0DPN4ANC7");
  assert.equal(repeat("t246", title), "same href");
  assert.equal(repeat("t253", `${title}#customer-reviews`), "same href#customer-reviews");
  assert.equal(repeat("t256", title), "same href", "the fragment line does not move what `same href` refers to");
  assert.equal(repeat("t300", other), "~/Lumo-Audio-Drift-Wireless-Earbuds/dp/B0CKQQT8ZC");
  assert.equal(repeat("t301", title), "same href as t241");
  assert.equal(repeat("t302", title), "same href");
  assert.equal(repeat("t303", `${ORIGIN}/scenarios/everything-store/`), "~/");
  assert.equal(repeat("t304", `${ORIGIN}/scenarios/everything-store/`), "~/", "`~/` is shorter than `same href`");
});

test("in the view, each link line carries its target after its words and other state", () => {
  assert.deepEqual(bodyLines([
    { tag: "a", href: "https://shop.test/store/item", name: "Kettle", coveredBy: ["t3"] },
    { tag: "a", href: "https://shop.test/store/item#reviews", name: "Reviews" },
    { tag: "div", covers: ["t1"] }
  ]), ["t1 link \"Kettle\" ~/item covered-by t3", "t2 link \"Reviews\" ~/item#reviews", "t3 layer covers 1"]);
});
