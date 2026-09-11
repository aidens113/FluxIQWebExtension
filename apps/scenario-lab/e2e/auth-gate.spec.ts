import { expect, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { authGateDemoCredentials, authGateScenario, type AuthGateState } from "../src/scenarios/auth-gate/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = authGateScenario.manifest;
const primary = resolveScenarioWorkflow(manifest);
const expired = resolveScenarioWorkflow(manifest, { variantId: "expired" });
const expiryNotice = "Your session expired. Sign in again to continue.";

const state = (lab: RunningScenarioLab) => readFinalState<AuthGateState>(lab, "auth-gate");

/** The Testing Lab's selector forms this fixture uses: `testid:<id>`, otherwise CSS. */
const selector = (target: string | undefined) => {
  if (!target) throw new Error("auth-gate step has no target");
  return target.startsWith("testid:") ? `[data-testid=${JSON.stringify(target.slice(7))}]` : target;
};

/** The steps up to and including `id`. */
function until(steps: ScenarioStep[], id: string): ScenarioStep[] {
  const index = steps.findIndex(step => step.id === id);
  if (index < 0) throw new Error(`auth-gate script has no step ${id}`);
  return steps.slice(0, index + 1);
}

/** Drives the manifest's own steps with plain Playwright and returns what each extract step read. */
async function drive(page: Page, steps: ScenarioStep[]): Promise<Record<string, Array<Record<string, string>>>> {
  const extracted: Record<string, Array<Record<string, string>>> = {};
  for (const step of steps) {
    if (step.operation === "type") await page.locator(selector(step.target)).fill(String(step.value));
    else if (step.operation === "click") await page.locator(selector(step.target)).click();
    else if (step.operation === "waitForState") await page.locator(selector(step.target)).waitFor({ timeout: step.timeoutMs ?? 5_000 });
    else if (step.operation === "extract") extracted[step.id] = await extract(page, step);
    else if (step.operation !== "checkpoint") throw new Error(`auth-gate spec does not drive ${step.operation}`);
  }
  return extracted;
}

async function extract(page: Page, step: ScenarioStep): Promise<Array<Record<string, string>>> {
  const items = page.locator(selector(step.target));
  const records: Array<Record<string, string>> = [];
  for (let index = 0; index < await items.count(); index += 1) {
    const record: Record<string, string> = {};
    for (const [name, field] of Object.entries(step.fields ?? {})) record[name] = ((await items.nth(index).locator(selector(field)).textContent()) ?? "").trim();
    records.push(record);
  }
  return records;
}

/** Evaluates manifest facts with the runner's meaning: the subject is a `data-testid`, `path` is the URL pathname. */
async function expectFacts(page: Page, facts: ExpectedFact[] = []): Promise<void> {
  for (const fact of facts) {
    const subject = page.locator(selector(`testid:${fact.subject}`));
    if (fact.predicate === "path") await expect.poll(() => new URL(page.url()).pathname, { message: fact.id }).toBe(fact.value);
    else if (fact.predicate === "visible") await expect(subject.first(), fact.id).toBeVisible({ visible: fact.value === true });
    else if (fact.predicate === "exists") await expect.poll(async () => await subject.count() > 0, { message: fact.id }).toBe(fact.value);
    else if (fact.predicate === "text") await expect(subject.first(), fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "contains") await expect(subject.first(), fact.id).toContainText(String(fact.value));
    else throw new Error(`auth-gate spec does not evaluate ${fact.predicate}`);
  }
}

test("W18 signs in with the stated demo credentials, reaches the account page, and reads the protected content", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${manifest.startPath}`);
  await expectFacts(page, primary.expected.pageFacts);
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByTestId("demo-password")).toHaveText(authGateDemoCredentials.password);

  const extracted = await drive(page, primary.recordingScript);
  await expectFacts(page, primary.expected.finalState);
  for (const expectation of primary.expected.extracted ?? []) {
    if (expectation.count !== undefined) expect(extracted[expectation.step]).toHaveLength(expectation.count);
    if (expectation.records) expect(extracted[expectation.step]).toEqual(expectation.records);
  }
  const final = await state(lab);
  expect(final).toMatchObject({ signInCount: 1, rejectedSignInCount: 0, accountViewCount: 1, deniedAccountCount: 0, session: { username: "demo.user", status: "active" } });
  expect(JSON.stringify(final)).not.toContain(authGateDemoCredentials.password);
});

test("wrong credentials are rejected on the sign-in page", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${manifest.startPath}`);
  await page.getByLabel("Username").fill(authGateDemoCredentials.username);
  await page.getByLabel("Password").fill("not-the-demo-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toHaveText("The username or password is incorrect.");
  await expect(page.getByLabel("Password")).toHaveValue("");
  expect(new URL(page.url()).pathname).toBe("/scenarios/auth-gate/");
  expect(await state(lab)).toMatchObject({ session: null, signInCount: 0, rejectedSignInCount: 1 });
});

test("an account visit without a session is redirected to the sign-in page, which says the session expired", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/auth-gate/account`);
  await expect(page).toHaveURL(`${lab.origin}/scenarios/auth-gate/?expired=1`);
  await expect(page.getByRole("alert")).toHaveText(expiryNotice);
  await expect(page.getByTestId("account-summary")).toHaveCount(0);
  expect(await state(lab)).toMatchObject({ accountViewCount: 0, deniedAccountCount: 1, lastDenial: "no-session" });
});

test("signing out ends the session, so the account page redirects again", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${manifest.startPath}`);
  await drive(page, until(primary.recordingScript, "account-loaded"));
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${lab.origin}/scenarios/auth-gate/`);
  expect(await state(lab)).toMatchObject({ session: null, lastOperation: "signed-out" });
  await page.goto(`${lab.origin}/scenarios/auth-gate/account`);
  await expect(page.getByRole("alert")).toHaveText(expiryNotice);
});

test("W19 expired: after arming, signing in ends back at the auth gate instead of the account page", async ({ page, lab, networkGuard: _guard }) => {
  await armVariant(lab, "auth-gate", expired.variant);
  await page.goto(`${lab.origin}${manifest.startPath}`);
  await expectFacts(page, expired.expected.pageFacts);
  await drive(page, until(expired.recordingScript, "submit-sign-in"));
  await expect(page).toHaveURL(`${lab.origin}/scenarios/auth-gate/?expired=1`);
  await expectFacts(page, expired.expected.finalState);
  // The recorded wait for the account heading can never succeed from here: a run must stop and report auth_required.
  await expect(page.getByTestId("account-heading")).toHaveCount(0);
  expect(expired.expected.failure).toEqual({ category: "auth_required" });
  expect(await state(lab)).toMatchObject({
    sessionPolicy: "expire-before-account", signInCount: 1, accountViewCount: 0, deniedAccountCount: 1, lastDenial: "expired", session: { status: "expired" },
  });
});

test("arming the expired variant expires a live session: reloading the account page lands on the sign-in page", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${manifest.startPath}`);
  await drive(page, until(primary.recordingScript, "account-loaded"));
  await armVariant(lab, "auth-gate", expired.variant);
  await page.reload();
  await expect(page).toHaveURL(`${lab.origin}/scenarios/auth-gate/?expired=1`);
  await expect(page.getByRole("alert")).toHaveText(expiryNotice);
  expect(await state(lab)).toMatchObject({ accountViewCount: 1, deniedAccountCount: 1, lastDenial: "expired", session: { status: "expired" } });
});
