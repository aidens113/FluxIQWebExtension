import { expect, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import type { RunningScenarioLab } from "../src/server.js";
import { intermediateStateScenario } from "../src/scenarios/intermediate-state/index.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = intermediateStateScenario.manifest;
const primary = resolveScenarioWorkflow(manifest);
const unannounced = resolveScenarioWorkflow(manifest, { variantId: "unannounced" });

test.use({ labSeed: manifest.seed, allowedConsoleErrors: manifest.expected.allowedConsoleErrors ?? [] });

const fixtureState = (lab: RunningScenarioLab) => readFinalState<Record<string, unknown>>(lab, manifest.id);

/** Performs the step operations this fixture's script uses, the way the recording lane drives them. */
async function perform(page: Page, step: ScenarioStep): Promise<void> {
  if (step.operation === "checkpoint") return;
  if (!step.target?.startsWith("testid:")) throw new Error(`Step ${step.id} needs a testid target`);
  const target = page.getByTestId(step.target.slice("testid:".length));
  if (step.operation === "type") return target.fill(String(step.value));
  if (step.operation === "click") return target.click();
  if (step.operation === "waitForState") return target.waitFor({ state: "visible", ...(step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs }) });
  throw new Error(`Step operation ${step.operation} is not used by this fixture`);
}

/** Checks the manifest's own facts against the page, with the runner's predicate meanings. */
async function expectFacts(page: Page, facts: ExpectedFact[] = []): Promise<void> {
  expect(facts.length).toBeGreaterThan(0);
  for (const fact of facts) {
    const subject = page.getByTestId(fact.subject);
    if (fact.predicate === "text") await expect(subject, fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "visible") await (fact.value ? expect(subject, fact.id).toBeVisible() : expect(subject, fact.id).toBeHidden());
    else if (fact.predicate === "exists") await expect(subject, fact.id).toHaveCount(fact.value ? 1 : 0);
    else throw new Error(`Fact predicate ${fact.predicate} is not used by this fixture`);
  }
}

test("primary workflow: the claim passes through the processing interstitial to a verified result", async ({ page, lab, networkGuard: _guard, consoleErrors: _errors }) => {
  await page.goto(`${lab.origin}${manifest.startPath}`);
  await expectFacts(page, primary.expected.pageFacts);
  let submittedAt = 0;
  for (const step of primary.recordingScript) {
    await perform(page, step);
    if (step.id === "submit-claim") {
      submittedAt = Date.now();
      await expect(page.getByTestId("processing")).toBeVisible();
      await expect(page.getByTestId("processing")).toContainText("Processing your claim");
      await expect(page.getByTestId("claim-form")).toBeHidden();
      await expect(page.getByTestId("claim-result")).toHaveCount(0);
    }
  }
  expect(Date.now() - submittedAt, "the interstitial holds for its fixed delay").toBeGreaterThanOrEqual(700);
  await expect(page.getByTestId("processing")).toHaveCount(0);
  await expectFacts(page, primary.expected.finalState);
  await expect(page.getByTestId("result-reference")).toHaveText("EXP-00122");
  await expect(page.getByRole("heading", { name: "Claim submitted" })).toBeFocused();
  expect(await fixtureState(lab)).toEqual({
    reference: "EXP-00122", mode: "baseline", phase: "complete", claim: { employee: "Ada Lovelace", amount: "42.50" },
    submissionCount: 1, confirmationCount: 0, completionCount: 1,
  });
});

test("unannounced variant: the armed confirmation step blocks the recorded wait for the result", async ({ page, lab, networkGuard: _guard, consoleErrors: _errors }) => {
  const variant = unannounced.variant;
  if (!variant) throw new Error("the unannounced variant is missing");
  // Record in baseline mode: the confirmation step never appears.
  await page.goto(`${lab.origin}${manifest.startPath}`);
  for (const step of primary.recordingScript) await perform(page, step);
  await expectFacts(page, primary.expected.finalState);

  await armVariant(lab, manifest.id, variant);
  expect(await fixtureState(lab)).toMatchObject({ mode: "unannounced", phase: "idle", claim: null, submissionCount: 1, completionCount: 1 });

  // Run the recorded script again: the wait for the result exhausts its own timeout.
  await page.goto(`${lab.origin}${manifest.startPath}`);
  for (const step of unannounced.recordingScript) {
    if (step.operation === "waitForState") await expect(perform(page, step)).rejects.toThrow(/Timeout/);
    else await perform(page, step);
  }
  await expectFacts(page, unannounced.expected.finalState);
  await expect(page.getByRole("heading", { name: "Confirm your claim" })).toBeFocused();
  await expect(page.getByRole("checkbox", { name: "I confirm these details are accurate" })).not.toBeChecked();
  expect(await fixtureState(lab)).toMatchObject({ phase: "awaiting-confirmation", submissionCount: 2, confirmationCount: 0, completionCount: 1 });

  // The unrecorded step is completable: Continue needs the checkbox, then the result appears.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("confirmation-error")).toHaveText("Confirm the details to continue.");
  await expect(page.getByTestId("claim-result")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "I confirm these details are accurate" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expectFacts(page, primary.expected.finalState);
  expect(await fixtureState(lab)).toMatchObject({ mode: "unannounced", phase: "complete", submissionCount: 2, confirmationCount: 1, completionCount: 2 });
});
