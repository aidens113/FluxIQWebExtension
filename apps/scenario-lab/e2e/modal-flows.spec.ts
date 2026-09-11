import { expect, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { modalFlowsScenario, type ModalFlowsState } from "../src/scenarios/modal-flows/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test as labTest } from "./lab-fixture.js";

const test = labTest.extend<{ pageErrors: string[] }>({
  // The manifest allows no console errors; a resource 404 (favicon) is not a script error.
  pageErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text()); });
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

const { manifest } = modalFlowsScenario;
const DELETE_PROMPT = "confirm: Delete this draft? This cannot be undone.";

const openFixture = (page: Page, lab: RunningScenarioLab) => page.goto(`${lab.origin}${manifest.startPath}`);

const finalState = (lab: RunningScenarioLab) => readFinalState<ModalFlowsState>(lab, "modal-flows");

/** Drives a recording script with plain Playwright; this fixture's scripts use only testid targets. */
async function runScript(page: Page, steps: ScenarioStep[]) {
  for (const step of steps) {
    if (step.operation === "checkpoint") continue;
    const target = page.getByTestId(testId(step.target));
    if (step.operation === "click") await target.click();
    else if (step.operation === "type") await target.fill(String(step.value));
    else if (step.operation === "select") await target.selectOption(String(step.value));
    else throw new Error(`Unsupported step operation ${step.operation}`);
  }
}

function testId(target: string | undefined): string {
  if (!target?.startsWith("testid:")) throw new Error(`Unsupported target ${target}`);
  return target.slice("testid:".length);
}

/** Checks manifest facts on testid subjects: text, visible, and exists. */
async function expectFacts(page: Page, facts: ExpectedFact[] | undefined) {
  expect(facts?.length).toBeGreaterThan(0);
  for (const fact of facts ?? []) {
    const subject = page.getByTestId(fact.subject);
    if (fact.predicate === "text") await expect(subject).toHaveText(String(fact.value));
    else if (fact.predicate === "visible") await (fact.value ? expect(subject).toBeVisible() : expect(subject).toBeHidden());
    else if (fact.predicate === "exists") await expect(subject).toHaveCount(fact.value ? 1 : 0);
    else throw new Error(`Unsupported predicate ${fact.predicate}`);
  }
}

test("W12 invite dialog is labelled, modal, and focus-trapped; Escape cancels it", async ({ page, lab, networkGuard: _guard }) => {
  await openFixture(page, lab);
  const opener = page.getByTestId("open-invite");
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Invite a collaborator" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(page.getByTestId("page-shell")).toHaveJSProperty("inert", true);
  await expect(page.getByTestId("invite-email")).toBeFocused();
  for (const id of ["invite-role", "invite-cancel", "invite-confirm", "invite-email"]) {
    await page.keyboard.press("Tab");
    await expect(page.getByTestId(id)).toBeFocused();
  }
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByTestId("invite-confirm")).toBeFocused();
  await page.getByTestId("invite-email").fill("not-an-email");
  await page.getByTestId("invite-confirm").click();
  await expect(page.getByTestId("invite-error")).toHaveText("Enter a valid email address.");
  await expect(page.getByTestId("invite-email")).toBeFocused();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.getByTestId("page-shell")).toHaveJSProperty("inert", false);
  await expect.poll(() => finalState(lab)).toMatchObject({ invites: [], inviteCancellations: 1 });
});

test("W12 primary workflow opens the invite dialog, fills it, and confirms", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest);
  await openFixture(page, lab);
  await runScript(page, workflow.recordingScript);
  await expectFacts(page, workflow.expected.finalState);
  await expect(page.getByTestId("open-invite")).toBeFocused();
  await expect.poll(() => finalState(lab)).toMatchObject({ invites: [{ email: "ada@example.test", role: "editor" }], inviteCancellations: 0 });
  await page.reload();
  await expectFacts(page, workflow.expected.finalState);
});

test("W13 consent-then-click: the banner covers Publish draft until it is dismissed", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "consent-then-click" });
  await openFixture(page, lab);
  const publish = page.getByTestId("publish-draft");
  expect(await publish.evaluate((button) => {
    const box = button.getBoundingClientRect();
    return Boolean(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('[data-testid="consent-banner"]'));
  })).toBe(true);
  await expect(publish.click({ trial: true, timeout: 1_000 })).rejects.toThrow();
  await runScript(page, workflow.recordingScript);
  await expectFacts(page, workflow.expected.finalState);
  await expect.poll(() => finalState(lab)).toMatchObject({ consent: "accepted", publishCount: 1 });
});

test("W13 banner-absent variant: no banner, so Publish draft is clickable directly and succeeds", async ({ page, lab, networkGuard: _guard }) => {
  const { variant, expected } = resolveScenarioWorkflow(manifest, { workflowId: "consent-then-click", variantId: "banner-absent" });
  await armVariant(lab, "modal-flows", variant);
  expect(expected.failure).toBeUndefined();
  await openFixture(page, lab);
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  await expect(page.getByTestId("consent-accept")).toHaveCount(0);
  await page.getByTestId("publish-draft").click();
  await expectFacts(page, expected.finalState);
  await expect.poll(() => finalState(lab)).toMatchObject({ consent: "absent", publishCount: 1 });
});

test("W14 interstitial: two clicks add two sections while unarmed", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "interstitial" });
  await openFixture(page, lab);
  await runScript(page, workflow.recordingScript);
  await expectFacts(page, workflow.expected.finalState);
  await expect(page.getByTestId("section-item")).toHaveText(["Section 1", "Section 2"]);
  await expect.poll(() => finalState(lab)).toMatchObject({ sectionCount: 2, interstitial: "unarmed" });
});

test("W14 armed variant: an offer appears after the first click and blocks the page until closed", async ({ page, lab, networkGuard: _guard }) => {
  const { variant, expected } = resolveScenarioWorkflow(manifest, { workflowId: "interstitial", variantId: "armed" });
  await armVariant(lab, "modal-flows", variant);
  expect(expected.failure).toEqual({ category: "user_intervention_required" });
  await openFixture(page, lab);
  await expect(page.getByTestId("interstitial")).toHaveCount(0);
  const addSection = page.getByTestId("add-section");
  await addSection.click();
  const offer = page.getByRole("dialog", { name: "Unlock Premium templates" });
  await expect(offer).toBeVisible();
  await expect(offer).toHaveAttribute("aria-modal", "true");
  await expect(page.getByTestId("interstitial-close")).toBeFocused();
  await expect(addSection.click({ trial: true, timeout: 1_000 })).rejects.toThrow();
  await addSection.evaluate((button) => (button as HTMLElement).click());
  await expectFacts(page, expected.finalState);
  await expect.poll(() => finalState(lab)).toMatchObject({ sectionCount: 1, interstitial: "open" });
  await page.reload();
  await expect(offer).toBeVisible();
  await expect(page.getByTestId("page-shell")).toHaveJSProperty("inert", true);
  await page.getByTestId("interstitial-close").click();
  await expect(page.getByTestId("interstitial")).toHaveCount(0);
  await addSection.click();
  await expect(page.getByTestId("section-count")).toHaveText("2 sections");
  await expect.poll(() => finalState(lab)).toMatchObject({ sectionCount: 2, interstitial: "closed" });
});

test("Delete draft is guarded by a native confirm(): dismiss keeps the draft, accept deletes it", async ({ page, lab, networkGuard: _guard }) => {
  await openFixture(page, lab);
  const prompts: string[] = [];
  page.once("dialog", (dialog) => { prompts.push(`${dialog.type()}: ${dialog.message()}`); void dialog.dismiss(); });
  await page.getByTestId("delete-draft").click();
  await expect.poll(() => finalState(lab)).toMatchObject({ draft: "active", deletePrompts: { accepted: 0, dismissed: 1 } });
  await expect(page.getByTestId("draft-status")).toHaveText("Draft active");
  page.once("dialog", (dialog) => { prompts.push(`${dialog.type()}: ${dialog.message()}`); void dialog.accept(); });
  await page.getByTestId("delete-draft").click();
  await expect(page.getByTestId("draft-status")).toHaveText("Draft deleted");
  await expect(page.getByTestId("delete-draft")).toBeDisabled();
  expect(prompts).toEqual([DELETE_PROMPT, DELETE_PROMPT]);
  await expect.poll(() => finalState(lab)).toMatchObject({ draft: "deleted", deletePrompts: { accepted: 1, dismissed: 1 } });
});
