import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { everythingStoreScenario as scenario } from "../scenario.js";
import { storeModes, type StoreState } from "../state/index.js";
import { storeIds } from "../style/index.js";
import { BROWSER_KIT as kit } from "./browser-kit.js";

const context = { runToken: "everything-store-unit-token", seed: 241 };
const fresh = () => scenario.createState(scenario.seed);
const armed = () => scenario.mutate(fresh(), "set-mode", { mode: "keyboard-suggestions" });
const searchBox = (state: StoreState) => {
  const html = scenario.render(state, context);
  return /<input[^>]*name="k"[^>]*>/u.exec(html)?.[0] ?? "";
};

describe("the header's suggestion list, redesigned to answer the arrow keys", () => {
  it("is a mode the store can be armed into, and arming starts the account over", () => {
    assert.ok((storeModes as readonly string[]).includes("keyboard-suggestions"));
    assert.deepEqual({ ...armed(), mode: "baseline" }, fresh());
    assert.equal(armed().mode, "keyboard-suggestions");
  });

  it("draws the search box as a combobox that owns the list, and the store as it ships does not", () => {
    const suggest = storeIds(scenario.seed).suggest;
    const box = searchBox(armed());
    assert.match(box, /role="combobox"/u);
    assert.match(box, /aria-autocomplete="list"/u);
    assert.match(box, /aria-expanded="false"/u);
    assert.ok(box.includes(`aria-controls="${suggest}"`), box);
    const shipped = searchBox(fresh());
    assert.doesNotMatch(shipped, /role=|aria-controls|aria-expanded|aria-autocomplete/u);
  });
});

/** The search box, by the name a person reads beside it, whatever its role. */
const SEARCH = 'input[name="k"]';
const LIST = '[role="listbox"][aria-label="Search suggestions"]';

describe("in a real browser", { concurrency: true }, () => {
  // Suite-level, not file-level: a file-level `after` waits for the process to go idle, which an open browser never lets it do.
  after(() => kit.closeBrowser());

  it("moves the highlight with the arrow keys, fills the box on Enter without searching, and searches on the next Enter", async () => {
    const session = await kit.openStore("keyboard-suggestions");
    try {
      const { page, lab } = session;
      await kit.settleIn(page);
      const home = page.url();
      const box = page.locator(SEARCH);
      await box.click();
      await box.pressSequentially("elec");
      const options = page.locator(LIST).getByRole("option");
      await assert.doesNotReject(options.first().waitFor());
      assert.deepEqual(await options.allTextContents(), ["tidewell electric kettle", "electric kettle", "electric kettle glass"]);
      assert.equal(await box.getAttribute("aria-expanded"), "true");
      assert.equal(await box.getAttribute("aria-activedescendant"), null, "nothing is highlighted until a key moves there");

      const idOf = async (index: number) => (await options.nth(index).getAttribute("id")) ?? "";
      await box.press("ArrowDown");
      assert.equal(await box.getAttribute("aria-activedescendant"), await idOf(0));
      assert.equal(await options.nth(0).getAttribute("aria-selected"), "true");
      await box.press("ArrowDown");
      assert.equal(await box.getAttribute("aria-activedescendant"), await idOf(1));
      assert.equal(await options.nth(0).getAttribute("aria-selected"), "false");
      await box.press("ArrowUp");
      await box.press("ArrowDown");
      assert.equal(await box.getAttribute("aria-activedescendant"), await idOf(1));
      assert.equal(new Set(await Promise.all([0, 1, 2].map(idOf))).size, 3, "each option has its own id");

      await box.press("Enter");
      assert.equal(await box.inputValue(), "electric kettle");
      assert.equal(await page.locator(LIST).isHidden(), true);
      assert.equal(await box.getAttribute("aria-expanded"), "false");
      assert.equal(await box.getAttribute("aria-activedescendant"), null);
      await kit.pause(300);
      assert.equal(page.url(), home, "choosing a suggestion is not a search");
      assert.deepEqual((await kit.storeState(lab) as unknown as StoreState).guard.searchLoads, []);

      await Promise.all([page.waitForURL(/\/s\?/u), box.press("Enter")]);
      assert.equal(new URL(page.url()).searchParams.get("k"), "electric kettle", "Enter with nothing highlighted searches for what the box holds");
    } finally { await session.close(); }
  });

  it("closes the list on Escape and forgets the highlight", async () => {
    const session = await kit.openStore("keyboard-suggestions");
    try {
      const { page } = session;
      await kit.settleIn(page);
      const box = page.locator(SEARCH);
      await box.click();
      await box.pressSequentially("kettle");
      await page.locator(LIST).getByRole("option").first().waitFor();
      await box.press("ArrowDown");
      await box.press("Escape");
      assert.equal(await page.locator(LIST).isHidden(), true);
      assert.equal(await box.getAttribute("aria-activedescendant"), null);
      assert.equal(await box.getAttribute("aria-expanded"), "false");
      assert.equal(await box.inputValue(), "kettle");
    } finally { await session.close(); }
  });

  it("leaves the store as it ships alone: the arrow keys highlight nothing", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      const box = page.locator(SEARCH);
      await box.click();
      await box.pressSequentially("elec");
      const options = page.locator(LIST).getByRole("option");
      await options.first().waitFor();
      await box.press("ArrowDown");
      assert.equal(await box.getAttribute("aria-activedescendant"), null);
      assert.equal(await options.first().getAttribute("id"), null);
    } finally { await session.close(); }
  });
});
