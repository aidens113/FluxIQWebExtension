import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { Browser } from "@playwright/test";
import { createNetworkState, mutateNetworkState, professionalNetworkScenario, ROTTERDAM_NL } from "../index.js";
import { inPlacePagingScript, type PeopleFragment } from "../search/index.js";
import type { ProfessionalNetworkState } from "../types.js";
import { closeSession, launchBrowser, openSession, postToSite, ROOT } from "./browser-session.js";

/*
 * The armable `in-place-paging` people search: the pager rewrites the rows
 * already on screen with the next page's people, keeps the address, and
 * disables Next on the last page. The baseline search is unchanged.
 */

const { route } = professionalNetworkScenario;
const context = { runToken: "professional-network-in-place-token", seed: 4303 };
const FILTERS = `keywords=data%20engineer&network=${encodeURIComponent('["S"]')}&geoUrn=${encodeURIComponent(JSON.stringify([ROTTERDAM_NL]))}&origin=FACETED_SEARCH`;
const armed = () => mutateNetworkState(createNetworkState(), "set-mode", { mode: "in-place-paging" });
const serve = (state: ProfessionalNetworkState, subpath: string, query: string) =>
  route!(state, { subpath, query: new URLSearchParams(query), method: "GET" }, context)?.body ?? "";
const fragment = (state: ProfessionalNetworkState, page: number) => JSON.parse(serve(state, "search/results/people/fragment", `${FILTERS}&page=${page}`)) as PeopleFragment;

test("arming in-place-paging starts the session over in that rendering", () => {
  const busy = mutateNetworkState(createNetworkState(), "set-consent", { choice: "accepted" });
  assert.deepEqual(mutateNetworkState(busy, "set-mode", { mode: "in-place-paging" }), { ...createNetworkState(), mode: "in-place-paging" });
});

test("only the in-place pager disables Next, and only on the last page; every other byte of the results is the baseline's", () => {
  const disabledNext = /<button class="[^"]*" type="button" disabled>Next<\/button>/u;
  for (const page of [1, 2, 3]) {
    const baseline = fragment(createNetworkState(), page);
    const inPlace = fragment(armed(), page);
    assert.equal(baseline.pageCount, 3);
    assert.equal(disabledNext.test(baseline.html), false, `baseline page ${page}`);
    assert.equal(disabledNext.test(inPlace.html), page === 3, `in-place page ${page}`);
    assert.deepEqual({ ...inPlace, html: inPlace.html.replace(" disabled>Next", ">Next") }, baseline);
  }
});

test("the in-place people page is the baseline page plus its pager script", () => {
  const baseline = serve(createNetworkState(), "search/results/people/", FILTERS);
  const inPlace = serve(armed(), "search/results/people/", FILTERS);
  assert.equal(baseline.includes("function morph("), false);
  assert.ok(inPlace.includes(inPlacePagingScript()));
  const restored = inPlace.replace(inPlacePagingScript(), "")
    .replace("return void refresh(current + 1);", "return void load(current + 1, true);")
    .replace("return void refresh(Math.max(1, current - 1));", "return void load(Math.max(1, current - 1), true);")
    .replace("if (number) refresh(number);", "if (number) load(number, true);");
  assert.equal(restored, baseline);
});

let browser: Browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { await browser?.close(); });

type Row = { urn: string | null; name: string; href: string | null };

describe("the in-place pager in a browser", { timeout: 60_000 }, () => {
  test("Next rewrites the same rows with the last page's people, keeps the address, and leaves Next disabled", async () => {
    const session = await openSession(browser, context.seed);
    try {
      await postToSite(session, "set-mode", { mode: "in-place-paging" });
      for (const operation of ["dismiss-app-prompt", "chat-bubble-seen"]) await postToSite(session, operation, {});
      await postToSite(session, "set-consent", { choice: "accepted" });
      const { page } = session;
      await page.goto(`${session.lab.origin}${ROOT}search/results/people/?${FILTERS}&page=2`);
      const results = page.locator('section[aria-label="Search results"]');
      const status = results.locator("span", { hasText: /^Page \d of \d$/u });
      await status.filter({ hasText: "Page 2 of 3" }).waitFor({ timeout: 8_000 });
      const address = page.url();
      // The first row and its name link, held in the page, so the test can tell whether they are the same nodes afterwards.
      const firstRow = (): Promise<Row> => results.locator("li[data-urn]").first().evaluate((item) => {
        const link = item.querySelector("div > div > a[href]");
        return { urn: item.getAttribute("data-urn"), name: (link?.textContent ?? "").trim(), href: link?.getAttribute("href") ?? null };
      });
      await results.locator("li[data-urn]").first().evaluate((item) => {
        (globalThis as unknown as { held: unknown[] }).held = [item, item.querySelector("div > div > a[href]")];
      });
      const before = await firstRow();
      await results.getByRole("button", { name: "Next", exact: true }).click();
      await status.filter({ hasText: "Page 3 of 3" }).waitFor({ timeout: 8_000 });
      const afterwards = await firstRow();
      assert.notEqual(afterwards.urn, before.urn);
      assert.notEqual(afterwards.name, before.name);
      assert.notEqual(afterwards.href, before.href);
      const same = await results.locator("li[data-urn]").first().evaluate((item) => {
        const [row, link] = (globalThis as unknown as { held: unknown[] }).held;
        return row === item && link === item.querySelector("div > div > a[href]");
      });
      assert.equal(same, true, "the first row and its link are the nodes that were there before");
      assert.equal(await results.getByRole("button", { name: "Next", exact: true }).isDisabled(), true);
      assert.equal(await results.getByRole("button", { name: "Previous", exact: true }).isDisabled(), false);
      assert.equal(page.url(), address, "the address did not move");
      // A press of the disabled Next does nothing: the page stays the last one.
      await results.getByRole("button", { name: "Next", exact: true }).click({ force: true });
      await delay(1_000);
      assert.equal(await status.innerText(), "Page 3 of 3");
      assert.deepEqual(session.consoleErrors, []);
      assert.deepEqual(session.offsite, []);
    } finally {
      await closeSession(session);
    }
  });
});
