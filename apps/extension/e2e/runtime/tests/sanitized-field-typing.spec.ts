// Typing into native fields through the real extension's worker runner, on
// realistic Scenario Lab pages only.
//
// The first test uses the job board's `extended-application` mode, armed
// through the site's own `set-mode`: Talentloom's application form adds
// "A few more questions" with number, date, time, month, week and
// datetime-local fields, answers the form holds to (a whole-number count that
// refuses ".", fixed hours put back on input, an assessment day whose
// beforeinput is cancelled, a read-only requisition number, referral and agency
// codes put back after a timer and after a microtask), a profile widget that
// re-renders its field as a new element, and a dialog covering the form right
// after "Current employer" changes. The form is opened at Talentloom's own
// address rather than inside the careers page's frame, so the worker's
// selectors reach it in the top document. The two tests after it prove the
// rest on other sites: the everything store's search box, whose suggestions
// the page opens from the input events typing sends, and photo-social's login
// password.

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { startScenarioLab, type RunningScenarioLab } from "../../../../scenario-lab/src/server.js";
import type { ExtensionSession } from "../../fixtures/extension-context.js";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";

/** What the test's passive listeners saw; none of them changes what the page does. */
type TypingProof = { submits: number; textInputs: string[]; numberInputs: string[]; detachedEnters: number; coveredEnters: number };

test("native numeric/date values survive sanitization; malformed and refused edits stay truthful", async ({ extensionSession }, info) => {
  // This one test owns its extension session's launch and close (a
  // test-scoped fixture, counted inside this budget), its own Lab, and about
  // thirty worker round trips. t730-b9 measured 46.5 s for the body alone on
  // the old page and 30 s timeouts under load, so the config's default cannot
  // cover it.
  test.setTimeout(150_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    await mutate(lab, "job-board", "set-mode", { mode: "extended-application" });
    const { page, tabId } = await openScenario(extensionSession, lab, "/scenarios/job-board/embed/job_app?for=quillmark&token=QM-4471");
    await expect(page.getByRole("heading", { name: "A few more questions from Quillmark" })).toBeVisible();
    const expected = JSON.parse(await readFile(path.join(extensionSession.metadata.artifactPath, "build-info.json"), "utf8")).identity;
    const running = await extensionSession.extensionPage.evaluate(id => chrome.runtime.sendMessage({ type: "fluxiq.buildIdentity", tabId: id }), tabId);
    expect(running).toMatchObject({ ok: true, background: expected, content: expected });
    await info.attach("identity", { contentType: "application/json", body: JSON.stringify({ expected, running, browser: await page.evaluate(() => navigator.userAgent) }) });
    // Passive records of what typing reached: submits, per-key values, and any
    // Enter on the covered field or on the two fields the profile widget
    // re-renders (on the elements first rendered, which the widget detaches,
    // and on whatever is in the document now).
    await page.evaluate(() => {
      const proof: TypingProof = { submits: 0, textInputs: [], numberInputs: [], detachedEnters: 0, coveredEnters: 0 };
      (globalThis as unknown as { proof: TypingProof }).proof = proof;
      const named = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;
      const rerendered = ["preferred_name", "office_days"];
      const countDetachedEnter = (event: Event) => {
        if ((event as KeyboardEvent).key === "Enter") proof.detachedEnters += 1;
      };
      document.querySelector("form")!.addEventListener("submit", () => {
        proof.submits += 1;
      });
      named("first_name").addEventListener("input", () => proof.textInputs.push(named("first_name").value));
      named("years_experience").addEventListener("input", () => proof.numberInputs.push(named("years_experience").value));
      named("current_employer").addEventListener("keydown", (event) => {
        if (event.key === "Enter") proof.coveredEnters += 1;
      });
      for (const name of rerendered) named(name).addEventListener("keydown", countDetachedEnter);
      document.addEventListener("keydown", (event) => {
        const target = event.target as HTMLInputElement | null;
        if (target && rerendered.includes(target.name)) countDetachedEnter(event);
      }, { capture: true, passive: true });
    });
    const readProof = () => page.evaluate(() => (globalThis as unknown as { proof: TypingProof }).proof);
    let commandOrdinal = 0;
    const act = (selector: string, text: string) => runWorkerAction(extensionSession.extensionPage, { commandId: `type-${++commandOrdinal}`, actionType: "web.dom.type", selector, text }, { activeTabId: tabId });
    const delayed = await act("#referral_code", "new");
    const microtask = await act("#agency_reference", "new");
    const covered = await runWorkerAction(extensionSession.extensionPage, { commandId: "covered-after-submit", actionType: "web.dom.type", selector: "#current_employer", text: "new", submit: true }, { activeTabId: tabId });
    await page.getByRole("dialog").getByRole("button", { name: "No thanks" }).click();
    expect([delayed.result.status, microtask.result.status]).toEqual(["failed", "failed"]);
    expect(covered.result.status).not.toBe("succeeded");
    expect((await readProof()).coveredEnters).toBe(0);
    const detachedText = await act("#preferred_name", "xy");
    const detachedNumber = await runWorkerAction(extensionSession.extensionPage, { commandId: "detached-number-submit", actionType: "web.dom.type", selector: "#office_days", text: "1.5", submit: true }, { activeTabId: tabId });
    const detachProof = { enters: (await readProof()).detachedEnters, text: await page.locator("#preferred_name").inputValue(), number: await page.locator("#office_days").inputValue() };
    await info.attach("detached-control-result", { contentType: "application/json", body: JSON.stringify({ statuses: [detachedText.result.status, detachedNumber.result.status], ...detachProof }) });
    expect([detachedText.result.status, detachedNumber.result.status]).toEqual(["failed", "failed"]);
    // The saved profile answers the widget re-renders: "Sam" and 3 days.
    expect(detachProof).toEqual({ enters: 0, text: "Sam", number: "3" });
    for (const value of ["1.5", "-3"]) {
      const result = await act("#years_experience", value);
      expect(result.result.status, result.result.message).toBe("succeeded");
      await expect(page.locator("#years_experience")).toHaveValue(value);
    }
    expect((await act("#start_date", "2026-10-07")).result.status).toBe("succeeded");
    await expect(page.locator("#start_date")).toHaveValue("2026-10-07");
    for (const [selector, value] of [["#call_time", "10:30"], ["#qualification_month", "2026-10"], ["#interview_week", "2026-W41"], ["#interview_slot", "2026-10-07T10:30"]]) {
      const answer = await act(selector!, value!);
      expect(answer.result.status, answer.result.message).toBe("succeeded");
      await expect(page.locator(selector!)).toHaveValue(value!);
    }
    expect((await act("#reports_count", "1.5")).result.status).toBe("failed");
    await expect(page.locator("#reports_count")).toHaveValue("4");
    const before = (await readProof()).numberInputs.length;
    expect((await act("#years_experience", "1.5oops")).result.status).toBe("failed");
    await expect(page.locator("#years_experience")).toHaveValue("-3");
    expect((await readProof()).numberInputs.length).toBe(before);
    expect((await act("#start_date", "2026-02-30")).result.status).toBe("failed");
    await expect(page.locator("#start_date")).toHaveValue("2026-10-07");
    expect((await act("#hours_per_day", "1.5")).result.status).toBe("failed");
    await expect(page.locator("#hours_per_day")).toHaveValue("8");
    expect((await act("#assessment_day", "2026-10-07")).result.status).toBe("failed");
    await expect(page.locator("#assessment_day")).toHaveValue("2026-09-01");
    expect((await act("#requisition_number", "1.5")).result.status).toBe("failed");
    await expect(page.locator("#requisition_number")).toHaveValue("4471");
    expect((await act("#first_name", "abc")).result.status).toBe("succeeded");
    expect((await readProof()).textInputs).toEqual(["a", "ab", "abc"]);
    const sensitive = await act("#account_password", "synthetic-secret-123");
    expect(sensitive.result.status).toBe("succeeded");
    expect(JSON.stringify(sensitive.result)).not.toContain("synthetic-secret-123");
    expect((await readProof()).submits).toBe(0);
  } finally {
    await lab.close();
  }
});

/** Opens `subpath` of the Lab in a tab of the extension's browser and points the worker runner at it. */
async function openScenario(session: ExtensionSession, lab: RunningScenarioLab, subpath: string): Promise<{ page: Page; tabId: number }> {
  const page = await session.context.newPage();
  await page.goto(new URL(subpath, lab.origin).href);
  await installRuntimeHarness(session.extensionPage);
  const tabId = await session.extensionPage.evaluate(async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)?.id, page.url());
  if (tabId === undefined) throw new Error("Missing the scenario tab");
  await resetRuntimeHarness(session.extensionPage, tabId);
  return { page, tabId };
}

/** One of a scenario's own page operations, sent as its pages send them. */
async function mutate(lab: RunningScenarioLab, scenario: string, operation: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${lab.origin}/api/${scenario}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${scenario} ${operation} answered HTTP ${response.status}`);
}

test("typed text reaches the page key by key: the store opens its suggestions, and nothing is submitted", async ({ extensionSession }) => {
  test.setTimeout(60_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    // The store's notifications prompt makes the page inert while it stands;
    // a returning visitor has answered it, and its app banner, already.
    await mutate(lab, "everything-store", "dismiss-nudge", { nudge: "notifications" });
    await mutate(lab, "everything-store", "dismiss-nudge", { nudge: "app-banner" });
    const { page, tabId } = await openScenario(extensionSession, lab, "/scenarios/everything-store/");
    const box = page.locator('input[name="k"]');
    await expect(box).toBeVisible();
    const home = page.url();
    // A passive record of the values the page's own input listeners see; it
    // changes nothing on the page.
    await box.evaluate((field) => {
      const seen: string[] = [];
      (globalThis as unknown as { typedValues: string[] }).typedValues = seen;
      field.addEventListener("input", () => seen.push((field as HTMLInputElement).value));
    });
    const typed = await runWorkerAction(extensionSession.extensionPage, { commandId: "type-search", actionType: "web.dom.type", selector: 'input[name="k"]', text: "kettle" }, { activeTabId: tabId });
    expect(typed.result.status, typed.result.message).toBe("succeeded");
    await expect(box).toHaveValue("kettle");
    expect(await page.evaluate(() => (globalThis as unknown as { typedValues: string[] }).typedValues)).toEqual(["k", "ke", "ket", "kett", "kettl", "kettle"]);
    const suggestions = page.getByRole("listbox", { name: "Search suggestions" });
    await expect(suggestions).toBeVisible();
    await expect(suggestions.getByRole("option")).toHaveCount(5);
    expect(page.url(), "typing did not submit the search").toBe(home);
  } finally {
    await lab.close();
  }
});

test("a password is typed into the field and never echoed in the result", async ({ extensionSession }) => {
  test.setTimeout(60_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    // The cookie dialog's scrim takes every click until it is answered.
    await mutate(lab, "photo-social", "consent", { choice: "essential" });
    const { page, tabId } = await openScenario(extensionSession, lab, "/scenarios/photo-social/accounts/login/");
    const password = page.locator('input[name="password"]');
    await expect(password).toBeVisible();
    const login = page.url();
    const secret = "synthetic-secret-123";
    const sensitive = await runWorkerAction(extensionSession.extensionPage, { commandId: "type-password", actionType: "web.dom.type", selector: 'input[name="password"]', text: secret }, { activeTabId: tabId });
    expect(sensitive.result.status, sensitive.result.message).toBe("succeeded");
    await expect(password).toHaveValue(secret);
    expect(JSON.stringify(sensitive.result)).not.toContain(secret);
    expect(page.url(), "typing did not submit the login form").toBe(login);
  } finally {
    await lab.close();
  }
});
