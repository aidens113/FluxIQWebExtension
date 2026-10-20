import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { everythingStoreScenario as scenario } from "../scenario.js";
import { storeModes, type StoreState } from "../state/index.js";
import { BROWSER_KIT as kit } from "./browser-kit.js";

const fresh = () => scenario.createState(scenario.seed);
const apply = (state: StoreState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);

describe("the notifications prompt", () => {
  it("has a rewritten rendering the store can be armed into, and arming starts the account over", () => {
    assert.ok((storeModes as readonly string[]).includes("reworded-prompt"));
    const armed = apply(fresh(), "set-mode", { mode: "reworded-prompt" });
    assert.deepEqual({ ...armed, mode: "baseline" }, fresh());
  });

  it("records which answer the shopper gave, and an answer without one as before", () => {
    const later = apply(fresh(), "dismiss-nudge", { nudge: "notifications", choice: "later" });
    const allow = apply(fresh(), "dismiss-nudge", { nudge: "notifications", choice: "allow" });
    const bare = apply(fresh(), "dismiss-nudge", { nudge: "notifications" });
    for (const state of [later, allow, bare]) assert.equal(state.nudges.notifications, "dismissed");
    assert.deepEqual([later.activity, allow.activity, bare.activity], [["declined notifications"], ["allowed notifications"], ["dismissed notifications"]]);
    assert.deepEqual(apply(fresh(), "dismiss-nudge", { nudge: "app-banner", choice: "later" }).activity, ["dismissed app-banner"], "only the prompt has answers");
  });
});

const PROMPT = { name: "Never miss a deal" } as const;

/** Each button in the open prompt: what it shows, what it is called, and its classes. */
async function promptButtons(page: import("@playwright/test").Page) {
  const prompt = page.getByRole("dialog", PROMPT);
  await prompt.waitFor({ timeout: 15_000 });
  return prompt.locator("button").evaluateAll((buttons) => buttons.map((button) => ({
    text: (button.textContent ?? "").trim(), label: button.getAttribute("aria-label"), className: button.className,
  })));
}

describe("in a real browser", { concurrency: true }, () => {
  // Suite-level, not file-level: a file-level `after` waits for the process to go idle, which an open browser never lets it do.
  after(() => kit.closeBrowser());

  it("draws Not now as Not right now and keeps its old name, and answering it declines", async () => {
    const shipped = await kit.openStore();
    const session = await kit.openStore("reworded-prompt");
    try {
      const before = await promptButtons(shipped.page);
      const after = await promptButtons(session.page);
      const declineBefore = before.find((button) => button.text === "Not now");
      const declineAfter = after.find((button) => button.text === "Not right now");
      assert.ok(declineBefore && declineAfter, JSON.stringify({ before, after }));
      assert.equal(declineBefore.label, null, "as it ships, the words are the name");
      assert.equal(declineAfter.label, "Not now", "rewritten, the name is the old words");
      assert.ok(!after.some((button) => button.text === "Not now"), "and no button shows them any more");
      assert.notEqual(declineAfter.className, declineBefore.className, "the redesign is a new component");
      assert.ok(after.some((button) => button.text === "Allow notifications"));

      await session.page.getByRole("button", { name: "Not now", exact: true }).click();
      await session.page.getByRole("dialog", PROMPT).waitFor({ state: "detached" });
      assert.equal(await session.page.locator("main").evaluate((main) => main.closest("[inert]") === null), true, "the page is live again");
      await assert.doesNotReject(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const state = await kit.storeState(session.lab) as unknown as StoreState;
          if (state.activity.includes("declined notifications")) return;
          await kit.pause(100);
        }
        throw new Error("the answer never reached the store");
      });
    } finally {
      await session.close();
      await shipped.close();
    }
  });

  it("records the shipped prompt's answers by what they were", async () => {
    const session = await kit.openStore();
    try {
      await promptButtons(session.page);
      await session.page.getByRole("button", { name: "Allow notifications" }).click();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if ((await kit.storeState(session.lab) as unknown as StoreState).activity.includes("allowed notifications")) return;
        await kit.pause(100);
      }
      assert.fail("the answer never reached the store");
    } finally { await session.close(); }
  });
});
