import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { BOOKING_RECORD, GAS_ENGINEER_RECORDS, PRICE_LIST_RECORDS } from "../expectations.js";
import { companyWebsiteManifest as manifest } from "../manifest.js";
import { closeBrowser, failedFacts, locate, mutate, runScript, serverState, withSite } from "./site-driver.js";

/**
 * What a careless automation does to this site, and that every oracle
 * catches it. Each case is the honest script with one corner cut: a field
 * no person can see filled in, a click aimed at a button the chat card is
 * covering, the human check never answered, the advert rows or the job
 * advert kept, the first free morning taken rather than the right one.
 */
after(closeBrowser);

const goal = manifest.playbackGoal!.successFacts;
const script = (workflowId?: string): ScenarioStep[] => [...resolveScenarioWorkflow(manifest, workflowId ? { workflowId } : {}).recordingScript];
const upTo = (steps: ScenarioStep[], id: string) => steps.slice(0, steps.findIndex((step) => step.id === id));
const replace = (steps: ScenarioStep[], id: string, change: Partial<ScenarioStep>) => steps.map((step) => (step.id === id ? { ...step, ...change } : step));

describe("a naive path fails the oracles", { concurrency: 4 }, () => {
  test("filling the honeypot gets a thank-you and no request", async () => withSite(async ({ lab, page }) => {
    const steps = script();
    const at = steps.findIndex(({ id }) => id === "enter-postcode") + 1;
    const filled = [...steps.slice(0, at), { id: "fill-every-field", operation: "type" as const, target: 'input[name="companyWebsite"]', value: "https://example.test" }, ...steps.slice(at, -2)];
    await runScript(page, filled);
    await page.waitForURL(/quote\/received/u);
    assert.ok((await failedFacts(page, goal)).length > 0, "the goal must not hold");
    const state = await serverState(lab);
    assert.deepEqual({ quotes: state.quotes.length, honeypot: state.discarded.honeypot }, { quotes: 0, honeypot: 1 });
  }));

  test("clicking Accept all under the chat card opens the chat and leaves consent unanswered", async () => withSite(async ({ lab, page }) => {
    await locate(page, 'div[title="Close"]').waitFor({ state: "visible", timeout: 6000 });
    const box = await locate(page, 'button:text-is("Accept all")').boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    const state = await serverState(lab);
    assert.deepEqual({ consent: state.consent, chatOpened: state.chat.opened }, { consent: "pending", chatOpened: 1 });
  }));

  test("clicking Send request under the chat card sends nothing", async () => {
    await withSite(async ({ lab, page }) => {
      await mutate(lab, "set-consent", { choice: "all" });
      await mutate(lab, "dismiss-newsletter", {});
      await page.reload();
      await locate(page, 'div[title="Close"]').waitFor({ state: "visible", timeout: 6000 });
      // Everything up to the last step without a pointer, so only the final click meets the card.
      const press = (target: string) => locate(page, target).dispatchEvent("click");
      await press('header button:text-is("Get a free quote")');
      for (const [name, value] of [["fullName", "Ada Synthetic"], ["email", "ada.synthetic@example.test"], ["phone", "07700 900123"], ["postcode", "KL6 2RN"]] as const) await locate(page, `input[name="${name}"]`).fill(value);
      await press('button:text-is("Continue")');
      await press('div:text-is("Choose a service")');
      await press('div:text-is("Combi boiler replacement")');
      await press('button:text-is("Continue")');
      await locate(page, 'input[name="privacy"]').setChecked(true);
      const box = await locate(page, "testid:quote-submit").boundingBox();
      assert.ok(box);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(2600);
      assert.equal(await locate(page, 'div:text-is("Confirm you are human")').count(), 0, "the human check never started");
      const state = await serverState(lab);
      assert.deepEqual({ quotes: state.quotes.length, chatOpened: state.chat.opened }, { quotes: 0, chatOpened: 1 });
    });
  });

  test("never answering the human check sends nothing, and posting past it is dropped", async () => withSite(async ({ lab, page }) => {
    await runScript(page, upTo(script(), "await-human-check").concat([{ id: "wait", operation: "waitForState", target: 'div:text-is("Confirm you are human")', timeoutMs: 6000 }]));
    await page.waitForTimeout(1000);
    assert.equal(new URL(page.url()).pathname, "/scenarios/company-website/");
    await mutate(lab, "submit-quote", { fullName: "Ada Synthetic", email: "ada.synthetic@example.test", phone: "07700 900123", postcode: "KL6 2RN", service: "Combi boiler replacement", contactBy: "Email", privacy: true });
    const state = await serverState(lab);
    assert.deepEqual({ quotes: state.quotes.length, unverified: state.discarded.unverified }, { quotes: 0, unverified: 1 });
  }));

  test("keeping the sponsored rows returns the wrong price list", async () => withSite(async ({ page }) => {
    const naiveTarget = 'section:has(> button:has-text("Servicing & safety checks")) tbody tr, section:has(> button:has-text("Repairs & call-outs")) tbody tr';
    const extracted = await runScript(page, replace(script("business-prices"), "extract-business-prices", { target: naiveTarget }));
    const rows = extracted["extract-business-prices"] ?? [];
    assert.equal(rows.length, PRICE_LIST_RECORDS.length + 2);
    assert.notDeepEqual(rows, PRICE_LIST_RECORDS);
  }));

  test("keeping every card with a Gas Safe line takes the job advert and the apprentices; reading every card repeats the director", async () => withSite(async ({ page }) => {
    const anyGasSafeLine = (branch: string) => `section[aria-label="Our people"] article:has(dt:text-is("Gas Safe ID")):has(dt:text-is("Branch") + dd:text-is("${branch}"))`;
    const naive = replace(script("gas-engineers"), "extract-gas-engineers", { target: `${anyGasSafeLine("Eastmoor")}, ${anyGasSafeLine("Hollins Cross")}` });
    const withEverything = [...naive, { id: "read-every-card", operation: "extract" as const, target: "article", fields: { name: "h3" } }];
    const extracted = await runScript(page, withEverything);
    const names = (extracted["extract-gas-engineers"] ?? []).map(({ name }) => name);
    assert.ok(names.includes("Could this be you?"), "the job advert is taken for a person");
    assert.ok(names.includes("Megan Ashdown") && names.includes("Ollie Pratchett"), "apprentices without a number are kept");
    assert.notDeepEqual(extracted["extract-gas-engineers"], GAS_ENGINEER_RECORDS);
    const everyCard = (extracted["read-every-card"] ?? []).map(({ name }) => name);
    assert.equal(everyCard.filter((name) => name === "Tomasz Wierzbicki").length, 2, "the leadership strip repeats him");
    assert.equal(everyCard.filter((name) => name === "James Whitlock").length, 2, "two different people share a name");
  }));

  test("taking the first free morning books the wrong visit", async () => withSite(async ({ lab, page }) => {
    const steps = script("book-service").filter((step) => step.id !== "show-next-week");
    const firstMorning = replace(steps, "choose-slot", { target: 'frame:Slotwise booking/div:has(> div:text-is("Tue 29/09")) > div:text-is("08:00")' });
    const extracted = await runScript(page, firstMorning);
    const booked = extracted["extract-booking"] ?? [];
    assert.equal(booked.length, 1);
    assert.notDeepEqual(booked, [BOOKING_RECORD]);
    assert.equal(booked[0]?.date, "Tuesday 29 September 2026");
    assert.equal((await serverState(lab)).deposits.count, 1, "and the deposit went with it");
  }));
});
