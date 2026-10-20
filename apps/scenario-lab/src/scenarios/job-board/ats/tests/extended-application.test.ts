import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type Page } from "@playwright/test";
import { postingById } from "../../catalog/index.js";
import { jobBoardScenario as scenario } from "../../scenario.js";
import { createJobBoardState, mutateJobBoardState } from "../../state.js";
import { openLabSession } from "../../tests/lab-session.js";
import { jobBoardModes, type JobBoardMode } from "../../types.js";
import { renderApplicationForm } from "../embed-pages.js";
import { extendedQuestions } from "../extended-questions.js";
import { extendedQuestionsScript } from "../extended-script.js";

/*
 * The armable `extended-application` form: Talentloom's application form adds
 * "A few more questions", with native typed fields and answers the form holds
 * to. Every other mode's form is the baseline's, byte for byte.
 */

const context = { runToken: "job-board-unit-token", seed: 42, alternateOrigin: "http://127.0.0.1:9" };
const quillmark = postingById("m1");
const FORM_PATH = "/scenarios/job-board/embed/job_app?for=quillmark&token=QM-4471";
const EXTENDED_NAMES = [
  "requisition_number", "years_experience", "reports_count", "start_date", "call_time", "qualification_month", "interview_week", "interview_slot",
  "hours_per_day", "assessment_day", "office_days", "preferred_name", "current_employer", "referral_code", "agency_reference", "account_password",
];

test("arming extended-application starts the board over in that rendering", () => {
  const busy = { ...createJobBoardState(), consent: "accepted" as const, resultsViews: 4 };
  assert.deepEqual(mutateJobBoardState(busy, "set-mode", { mode: "extended-application" }), createJobBoardState("extended-application"));
});

test("only the extended form asks the extra questions; without them it is the baseline form exactly", () => {
  const baseline = renderApplicationForm(context, quillmark, "baseline");
  for (const mode of jobBoardModes.filter((candidate): candidate is Exclude<JobBoardMode, "extended-application"> => candidate !== "extended-application")) {
    assert.equal(renderApplicationForm(context, quillmark, mode), baseline, mode);
  }
  for (const name of EXTENDED_NAMES) assert.equal(baseline.includes(`name="${name}"`), false, name);
  const extended = renderApplicationForm(context, quillmark, "extended-application");
  const types: Record<string, string> = { years_experience: "number", start_date: "date", call_time: "time", qualification_month: "month", interview_week: "week", interview_slot: "datetime-local", account_password: "password" };
  for (const [name, type] of Object.entries(types)) assert.ok(extended.includes(`<input type="${type}" id="${name}" name="${name}"`), name);
  assert.ok(extended.includes(`name="requisition_number" value="4471" readonly>`));
  assert.equal(extended.replace(extendedQuestions(quillmark), "").replace(extendedQuestionsScript(), ""), baseline);
  assert.doesNotMatch(extended, /data-testid=/u);
});

test("the route serves the extended form only once the mode is armed", () => {
  const serve = (mode: JobBoardMode) => scenario.route!(scenario.mutate(scenario.createState(42), "set-mode", { mode }), { subpath: "embed/job_app", query: new URLSearchParams("for=quillmark&token=QM-4471"), method: "GET" }, context)?.body ?? "";
  assert.match(serve("extended-application"), /A few more questions from Quillmark/u);
  assert.doesNotMatch(serve("baseline"), /A few more questions/u);
});

let browser: Browser;
before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--process-per-site"] }); });
after(async () => { await browser?.close(); });

type Field = { value: string; isConnected: boolean; readOnly: boolean };
const valueOf = (page: Page, name: string) => page.locator(`[name="${name}"]`).inputValue();

/** Polls until `name` holds `value`, or fails naming what it holds. The form's CSP refuses waitForFunction's string evaluation. */
async function settlesTo(page: Page, name: string, value: string): Promise<void> {
  for (const deadline = Date.now() + 2_000; (await valueOf(page, name)) !== value;) {
    if (Date.now() > deadline) throw new Error(`${name} holds ${JSON.stringify(await valueOf(page, name))}, not ${JSON.stringify(value)}`);
    await delay(25);
  }
}

describe("the extended form in a browser", { timeout: 60_000 }, () => {
  test("typed fields accept their values and the answers the form holds to stay put", async () => {
    const run = await openLabSession(browser, "extended-application");
    try {
      const page = run.page;
      await page.goto(`${run.lab.origin}${FORM_PATH}`);
      await page.getByRole("heading", { name: "A few more questions from Quillmark" }).waitFor();
      for (const [name, value] of [["years_experience", "1.5"], ["start_date", "2026-10-07"], ["call_time", "10:30"], ["qualification_month", "2026-10"], ["interview_week", "2026-W41"], ["interview_slot", "2026-10-07T10:30"]]) {
        await page.locator(`[name="${name}"]`).fill(value!);
        assert.equal(await valueOf(page, name!), value, name);
      }
      // A refused key never reaches the field.
      await page.locator('[name="reports_count"]').fill("");
      await page.locator('[name="reports_count"]').pressSequentially("1.5");
      assert.equal(await valueOf(page, "reports_count"), "15");
      await page.locator('[name="hours_per_day"]').fill("6");
      assert.equal(await valueOf(page, "hours_per_day"), "8");
      const cancelled = await page.locator('[name="assessment_day"]').evaluate((control) => {
        const InputEventClass = (globalThis as unknown as { InputEvent: new (type: string, init: object) => unknown }).InputEvent;
        return !(control as unknown as { dispatchEvent(event: unknown): boolean }).dispatchEvent(new InputEventClass("beforeinput", { cancelable: true, bubbles: true, inputType: "insertText", data: "1" }));
      });
      assert.equal(cancelled, true);
      assert.equal(await page.locator('[name="requisition_number"]').evaluate((control) => (control as unknown as Field).readOnly), true);
      for (const [name, kept, note] of [["referral_code", "RF-58213", "referral link"], ["agency_reference", "AG-30418", "Your agency set this reference"]] as const) {
        await page.locator(`[name="${name}"]`).fill("NEW-1");
        await page.locator(`[name="${name}"]`).press("Tab");
        await settlesTo(page, name, kept);
        assert.match(await page.locator(".tl-row", { has: page.locator(`[name="${name}"]`) }).locator(".tl-note").innerText(), new RegExp(note, "u"));
      }
      // The profile widget re-renders its field: the element typed into is gone, and its replacement holds the saved answer.
      for (const [name, typed, saved, commit] of [["preferred_name", "x", "Sam", false], ["office_days", "1", "3", true]] as const) {
        const original = await page.locator(`[name="${name}"]`).elementHandle();
        await page.locator(`[name="${name}"]`).pressSequentially(typed);
        if (commit) await page.keyboard.press("Tab");
        await settlesTo(page, name, saved);
        assert.equal(await original!.evaluate((control) => (control as unknown as Field).isConnected), false, name);
      }
      await page.locator('[name="current_employer"]').fill("Northwind Analytics");
      await page.locator('[name="current_employer"]').press("Tab");
      const offer = page.getByRole("dialog", { name: "Hide this application from Northwind Analytics?" });
      await offer.waitFor();
      await offer.getByRole("button", { name: "No thanks" }).click();
      await offer.waitFor({ state: "detached" });
      assert.equal(await page.locator('[name="hide_from_employer"]').inputValue(), "no");
      assert.deepEqual(run.errors, []);
    } finally { await run.close(); }
  });

  test("baseline: the form asks none of the extra questions", async () => {
    const run = await openLabSession(browser);
    try {
      await run.page.goto(`${run.lab.origin}${FORM_PATH}`);
      await run.page.getByRole("button", { name: "Submit application" }).waitFor();
      assert.equal(await run.page.locator(EXTENDED_NAMES.map((name) => `[name="${name}"]`).join(",")).count(), 0);
      assert.deepEqual(run.errors, []);
    } finally { await run.close(); }
  });
});
