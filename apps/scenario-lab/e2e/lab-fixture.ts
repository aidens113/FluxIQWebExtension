import { randomBytes } from "node:crypto";
import { expect, test as base } from "@playwright/test";
import type { ScenarioVariant } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../src/server.js";
import { assertRealisticScenarios } from "../../../packages/test-runner/src/realistic-scenarios/index.js";
import { installDeterministicNetworkGuard, type DeterministicNetworkGuard } from "./network-policy.js";
import { installRealisticScenarioGuard, type RealisticScenarioGuard } from "./realistic-scenario-guard/index.js";

/** The launch entry the realistic-scenarios refusals name. */
const ENTRY = "Scenario Lab Playwright spec";

type LabFixtures = {
  /**
   * The seed the lab starts on, 42 unless a spec sets it once with
   * `test.use({ labSeed })`; the realistic specs set their manifest's seed.
   */
  labSeed: number;
  /** An in-process Scenario Lab with a fresh random run token, closed after the test. */
  lab: RunningScenarioLab;
  /** The loopback-only network guard on the test's browser context; any other destination fails the test. */
  networkGuard: DeterministicNetworkGuard;
  /**
   * Automatic on every test: refuses any request for a scenario outside the
   * ten realistic ones, so the page never loads, and fails the test naming
   * the rule (AGENTS.md, "Lab and browser test runs use only the ten
   * realistic scenarios").
   */
  realisticScenarioGuard: RealisticScenarioGuard;
  /**
   * The console errors the scenario's manifest allows
   * (`expected.allowedConsoleErrors`); none by default. A spec sets it once
   * with `test.use({ allowedConsoleErrors })`.
   */
  allowedConsoleErrors: string[];
  /**
   * Every console error and uncaught page error during the test. Afterwards
   * the list must equal `allowedConsoleErrors`, as the runner requires of a run.
   */
  consoleErrors: string[];
};

/**
 * Playwright's `test` with the fixtures every Scenario Lab page spec shares.
 * A spec that needs a fixture of its own extends this object.
 */
export const test = base.extend<LabFixtures>({
  labSeed: [42, { option: true }],
  lab: async ({ labSeed }, use) => {
    const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: labSeed });
    try { await use(lab); } finally { await lab.close(); }
  },
  networkGuard: async ({ context }, use) => {
    const guard = await installDeterministicNetworkGuard(context);
    await use(guard);
    guard.assertClean();
  },
  realisticScenarioGuard: [async ({ context }, use) => {
    const guard = await installRealisticScenarioGuard(context, ENTRY);
    await use(guard);
    guard.assertClean();
  }, { auto: true }],
  allowedConsoleErrors: [[], { option: true }],
  consoleErrors: async ({ page, allowedConsoleErrors }, use) => {
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await use(errors);
    expect(errors).toEqual(allowedConsoleErrors);
  },
});

/** A scenario's server-side state from the lab's `/__control/final-state` oracle. */
export async function readFinalState<TState>(lab: RunningScenarioLab, scenarioId: string): Promise<TState> {
  assertRealisticScenarios([scenarioId], ENTRY);
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=${scenarioId}`, { headers: { authorization: `Bearer ${lab.runToken}` } });
  expect(response.ok).toBe(true);
  return (await response.json() as { state: TState }).state;
}

/**
 * Arms a variant as the Testing Lab does between recording and the run: one
 * POST of the variant's `arm` to the fixture's `/api/<scenarioId>/<operation>`
 * mutation endpoint, authorized by the run token. Pass the `variant` that
 * `resolveScenarioWorkflow` returned; a workflow resolved without one fails here.
 */
export async function armVariant(lab: RunningScenarioLab, scenarioId: string, variant: ScenarioVariant | undefined): Promise<void> {
  assertRealisticScenarios([scenarioId], ENTRY);
  if (!variant) throw new Error(`${scenarioId}: the resolved workflow has no variant to arm`);
  const response = await fetch(`${lab.origin}/api/${scenarioId}/${variant.arm.operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(variant.arm.payload ?? {}),
  });
  expect(response.status, `arming ${scenarioId} variant ${variant.id}`).toBe(200);
}
