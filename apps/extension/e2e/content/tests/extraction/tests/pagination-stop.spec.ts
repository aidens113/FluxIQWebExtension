// Why a paginated `web.dom.extract_list` stopped paging, for the stops a page
// can show without loading a new document (the ones that load one are
// `job-board-listing.spec.ts`).
//
// Each row injects a two-person list and a control into basic-form, runs a read
// that asks for five pages, and checks the one closed word the read reports as
// `paginationStop` and the phrase the model reads in the result's `actual`.

import type { Page } from "@playwright/test";
import { expect, test } from "../../../index.js";

type ControlBehaviour = "same-page" | "disabled" | "ignored";

/** A two-person list and a Next that redraws the same people, is disabled, or does nothing at all. */
async function injectList(page: Page, behaviour: ControlBehaviour): Promise<{ item: string; next: string }> {
  await page.evaluate((mode) => {
    const main = document.querySelector("main");
    if (!main) throw new Error("basic-form has no main");
    const people = '<li class="spec-person"><span class="name">Ada</span></li><li class="spec-person"><span class="name">Grace</span></li>';
    main.insertAdjacentHTML("beforeend", `<ul id="spec-people">${people}</ul><button type="button" id="spec-next"${mode === "disabled" ? " disabled" : ""}>Next</button>`);
    const next = document.getElementById("spec-next");
    const list = document.getElementById("spec-people");
    if (!next || !list) throw new Error("the injected list is missing");
    // A redraw of the same people as new elements, as a Next that leads back to
    // its own page draws them.
    if (mode === "same-page") next.addEventListener("click", () => { list.innerHTML = people; });
  }, behaviour);
  return { item: "#spec-people > li.spec-person", next: "#spec-next" };
}

test("a Next that redraws the page it was on stops the read on page_repeated rather than reading it again", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const list = await injectList(page, "same-page");
  const reply = await harness.runAction({
    commandId: "extract-same-page",
    actionType: "web.dom.extract_list",
    timeoutMs: 30_000,
    extractList: { item: list.item, fields: { name: ".name" }, paginate: { next: list.next, maxPages: 5 } }
  });
  expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: 2, pagesRead: 2, truncated: false, paginationStop: "page_repeated" } });
  expect(reply.validation).toMatchObject({ actual: expect.stringContaining("paging stopped because the page the control led to held only records earlier pages already had") });
});

test("a disabled Next is the list ending, said as control_disabled, without pressing it", async ({ openHarness, page }) => {
  const harness = await openHarness("basic-form");
  const list = await injectList(page, "disabled");
  const startedAt = Date.now();
  const reply = await harness.runAction({
    commandId: "extract-disabled-next",
    actionType: "web.dom.extract_list",
    timeoutMs: 30_000,
    extractList: { item: list.item, fields: { name: ".name" }, paginate: { next: list.next, maxPages: 5 } }
  });
  expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: 2, pagesRead: 1, truncated: false, paginationStop: "control_disabled" } });
  // A disabled control used to be pressed and waited on for the page's whole change window.
  expect(Date.now() - startedAt).toBeLessThan(8_000);
});

test("a Next the page ignores ends the read with its rows and list_unchanged", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("basic-form");
  const list = await injectList(page, "ignored");
  const reply = await harness.runAction({
    commandId: "extract-ignored-next",
    actionType: "web.dom.extract_list",
    timeoutMs: 30_000,
    extractList: { item: list.item, fields: { name: ".name" }, paginate: { next: list.next, maxPages: 5 } }
  });
  expect(reply).toMatchObject({ status: "succeeded", extraction: { recordCount: 2, pagesRead: 1, paginationStop: "list_unchanged" } });
  expect(reply.extracted).toEqual([{ name: "Ada" }, { name: "Grace" }]);
  expect(reply.validation).toMatchObject({ actual: expect.stringContaining("the page ignored its pagination control") });
});
