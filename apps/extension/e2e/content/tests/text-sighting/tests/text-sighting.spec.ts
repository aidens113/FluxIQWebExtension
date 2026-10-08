// A failed wait for text, and a failed text assertion, on the real
// crossborder-marketplace page say whether the text is hidden or absent and
// what the page shows near it (t369).
//
// Lane A round 7's qualifying run 2 waited for "Cart (3)", which this page
// holds only in the header's mini-cart flyout -- `display: none` until hovered
// (`scenario-lab/.../markup/flyouts.ts`) -- and the failure said only that the
// text did not appear. On a first visit the flyout reads "Cart (0)", so that is
// the hidden text here, and "Cart (3)" is absent.

import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";

function expectBoundedNear(reply: BrowserActionResult): string[] {
  const near = reply.visibleNear ?? [];
  expect(Array.isArray(near)).toBe(true);
  expect(near.length).toBeLessThanOrEqual(3);
  for (const snippet of near) expect(snippet.length).toBeLessThanOrEqual(80);
  return near;
}

test("a wait for text held only in the closed mini-cart reports it hidden, with shown text near it", async ({ openHarness, page }) => {
  const harness = await openHarness("crossborder-marketplace");
  await expect(page.getByTestId("mini-cart-count")).toBeHidden();
  await expect(page.getByTestId("mini-cart-count")).toHaveText("Cart (0)");
  const reply = await harness.runAction({ commandId: "hidden", actionType: "web.dom.wait_for_text", text: "Cart (0)", timeoutMs: 300 });
  expect(reply).toMatchObject({ status: "timed_out", textPresence: "hidden", failure: { code: "web.action.timeout" } });
  const near = expectBoundedNear(reply);
  expect(near.length).toBeGreaterThan(0);
  // Every snippet is text the page shows.
  const shown = await page.evaluate(() => document.body.innerText.replace(/\s+/gu, " "));
  for (const snippet of near) expect(shown).toContain(snippet.replace(/^…|…$/gu, ""));
});

test("a wait for text the page does not hold reports it absent", async ({ openHarness }) => {
  const harness = await openHarness("crossborder-marketplace");
  const reply = await harness.runAction({ commandId: "absent", actionType: "web.dom.wait_for_text", text: "Cart (3)", timeoutMs: 300 });
  expect(reply).toMatchObject({ status: "timed_out", textPresence: "absent" });
  expectBoundedNear(reply);
});

test("text in a sensitive control never appears in the shown text near a failed wait", async ({ openHarness, page }) => {
  const harness = await openHarness("crossborder-marketplace");
  await page.evaluate(() => {
    const box = document.createElement("section");
    box.innerHTML = '<p>Cart total <span data-sensitive="true">Cart (4) secret-77</span> due</p>'
      + '<p data-sensitive="true">Cart (4) secret-78</p>'
      + '<label>Cart (4) code <input type="password" value="secret-79"></label>'
      + "<p>Cart (4)</p>";
    document.querySelector("main")?.prepend(box);
  });
  const reply = await harness.runAction({ commandId: "sensitive", actionType: "web.dom.wait_for_text", text: "Cart (5)", timeoutMs: 300 });
  expect(reply).toMatchObject({ status: "timed_out", textPresence: "absent" });
  const near = expectBoundedNear(reply);
  expect(near[0]).toBe("Cart (4)");
  expect(JSON.stringify(near)).not.toContain("secret-");
});

test("a wait that succeeds is unchanged: no presence and no snippets", async ({ openHarness, page }) => {
  const harness = await openHarness("crossborder-marketplace");
  await page.evaluate(() => {
    const note = document.createElement("p");
    note.textContent = "Ready for checkout";
    document.querySelector("main")?.prepend(note);
  });
  const reply = await harness.runAction({ commandId: "found", actionType: "web.dom.wait_for_text", text: "Ready for checkout", timeoutMs: 1_000 });
  expect(reply).toMatchObject({ status: "succeeded", message: "Text found." });
  expect("textPresence" in reply).toBe(false);
  expect("visibleNear" in reply).toBe(false);
});

test("a page text assertion that did not hold reports the hidden text too", async ({ openHarness }) => {
  const harness = await openHarness("crossborder-marketplace");
  const reply = await harness.runAction({ commandId: "assert", actionType: "web.dom.assert", assert: { kind: "text", expected: "Cart (0)", timeoutMs: 200 } });
  expect(reply.status).not.toBe("succeeded");
  expect(reply).toMatchObject({ textPresence: "hidden" });
  expectBoundedNear(reply);
});
