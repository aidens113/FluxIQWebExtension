// A link click whose page answers it inside an open shadow root, judged by the
// click verb's in-place watch (`action-runtime/in-place-effect.ts`).
//
// On bigbox (`run-mum0ke7z-940cbd27`) the "Change store" link cancels its
// navigation and un-hides a flyout inside `vr-fulfillment-picker`'s open root.
// The document changes nowhere, so a watch of the document alone refused a
// click that worked, `output_not_observed`. These rows build that page shape on
// basic-form: a panel opened inside an existing root, a component inserted with
// its content already inside its root, and a root attached to an element
// already in place. The last row holds the line in the other direction: a
// panel opened inside a closed root cannot be seen, and the click still fails.
//
// The link rule's light-DOM rows are click.spec.ts's.

import { expect, test } from "../../../index.js";

/** A link click the page answered by changing what a reader sees, with the address left alone. */
const IN_PLACE_CONTENT = /^the page prevented the navigation and changed its content in place, \d+ ms after the press$/u;

test.describe("a link answered inside a shadow root", () => {
  test("a flyout un-hidden inside an open root passes on the content, as bigbox's Change store does", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await page.evaluate(() => {
      const host = document.createElement("div");
      host.dataset.testid = "picker";
      const root = host.attachShadow({ mode: "open" });
      const flyout = document.createElement("section");
      flyout.hidden = true;
      flyout.textContent = "Choose a store: Riverside, Northgate, Harbor";
      root.append(flyout);
      const link = document.createElement("a");
      link.dataset.testid = "change-store";
      link.href = "/stores";
      link.textContent = "Change store";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        flyout.hidden = false;
      });
      document.querySelector("main")?.append(link, host);
    });
    const reply = await harness.runAction({ commandId: "click-change-store", actionType: "web.dom.click", selector: '[data-testid="change-store"]' });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: expect.stringMatching(IN_PLACE_CONTENT) } });
    expect(reply.failure).toBeUndefined();
    expect(page.url()).toBe(harness.url);
  });

  test("a component inserted after a wait, its panel already inside its root, passes on the content", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.dataset.testid = "show-stores";
      link.href = "/stores";
      link.textContent = "Show stores";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setTimeout(() => {
          const host = document.createElement("div");
          host.attachShadow({ mode: "open" }).append(Object.assign(document.createElement("p"), { textContent: "Stores near you" }));
          document.querySelector("main")?.append(host);
        }, 150);
      });
      document.querySelector("main")?.append(link);
    });
    const reply = await harness.runAction({ commandId: "click-show-stores", actionType: "web.dom.click", selector: '[data-testid="show-stores"]' });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: expect.stringMatching(IN_PLACE_CONTENT) } });
  });

  test("a root attached to an element already in place, with no mutation to observe, passes on the content", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await page.evaluate(() => {
      const slot = document.createElement("div");
      const link = document.createElement("a");
      link.dataset.testid = "pick-store";
      link.href = "/stores";
      link.textContent = "Pick store";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setTimeout(() => {
          slot.attachShadow({ mode: "open" }).append(Object.assign(document.createElement("p"), { textContent: "Your store: Harbor" }));
        }, 150);
      });
      document.querySelector("main")?.append(link, slot);
    });
    const reply = await harness.runAction({ commandId: "click-pick-store", actionType: "web.dom.click", selector: '[data-testid="pick-store"]' });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: expect.stringMatching(IN_PLACE_CONTENT) } });
  });

  test("a panel opened inside a closed root is not seen, and the click still reports output_not_observed", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await page.evaluate(() => {
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "closed" });
      const panel = document.createElement("section");
      panel.hidden = true;
      panel.textContent = "Closed panel";
      root.append(panel);
      const link = document.createElement("a");
      link.dataset.testid = "closed-panel-link";
      link.href = "#closed";
      link.textContent = "Open closed panel";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        panel.hidden = false;
      });
      document.querySelector("main")?.append(link, host);
    });
    const reply = await harness.runAction({ commandId: "click-closed", actionType: "web.dom.click", selector: '[data-testid="closed-panel-link"]', timeoutMs: 1_000 });
    expect(reply).toMatchObject({
      status: "failed",
      validation: { status: "failed", actual: "the page prevented the navigation, and in 1000 ms neither its address nor its content changed" },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed" }
    });
  });
});
