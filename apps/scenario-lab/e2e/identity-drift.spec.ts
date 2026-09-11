import { expect, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { identityDriftScenario, type IdentityDriftMode, type IdentityDriftState } from "../src/scenarios/identity-drift/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = identityDriftScenario.manifest;
const startPath = manifest.startPath;
const workspaceName = String(manifest.recordingScript.find((step) => step.operation === "type")?.value);

type Box = { x: number; y: number; width: number; height: number };
type DriftCase = {
  /** Finds the drifted Save action as a person would: by role and its current name. */
  control(page: Page): Locator;
  /** Asserts the drift the variant's corpus row describes, against the recorded button's box. */
  assertDrift(page: Page, save: Locator, recorded: Box): Promise<void>;
};

const driftCases: Record<Exclude<IdentityDriftMode, "baseline">, DriftCase> = {
  "selector-only": {
    control: (page) => page.getByRole("button", { name: "Save changes", exact: true }),
    async assertDrift(page, save, recorded) {
      await expect(save).toHaveAttribute("id", "workspace-settings-submit");
      await expect(save).toHaveAttribute("class", "ui-button ui-button--accent");
      await expect(save).toHaveAttribute("data-testid", "settings-submit");
      await expect(page.getByTestId("primary-actions").getByRole("button")).toHaveText(["Save changes", "Discard changes"]);
      expect(await save.boundingBox()).toEqual(recorded);
    },
  },
  "text-only": {
    control: (page) => page.getByRole("button", { name: "Apply changes", exact: true }),
    async assertDrift(page, save, recorded) {
      await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
      await expect(save).toHaveAttribute("id", "save-settings");
      await expect(save).toHaveAttribute("class", "btn btn-primary");
      await expect(save).not.toHaveAttribute("data-testid");
      await expect(page.getByTestId("primary-actions").getByRole("button")).toHaveText(["Apply changes", "Discard changes"]);
      const box = await save.boundingBox();
      expect({ x: box?.x, y: box?.y }).toEqual({ x: recorded.x, y: recorded.y });
    },
  },
  moved: {
    control: (page) => page.getByRole("button", { name: "Save changes", exact: true }),
    async assertDrift(page, save, recorded) {
      await expect(page.getByTestId("footer-actions").getByRole("button", { name: "Save changes", exact: true })).toHaveCount(1);
      await expect(page.getByTestId("primary-actions").getByRole("button")).toHaveText(["Discard changes"]);
      await expect(save).toHaveAttribute("id", "save-settings");
      await expect(save).toHaveAttribute("class", "btn btn-primary");
      await expect(save).not.toBeInViewport();
      const box = await save.boundingBox();
      expect(box?.y ?? 0).toBeGreaterThan(Math.max(recorded.y, page.viewportSize()?.height ?? 0));
    },
  },
  "wrapped-aria": {
    control: (page) => page.getByRole("button", { name: "Save changes", exact: true }),
    async assertDrift(page, save) {
      await expect(save).toHaveAttribute("aria-labelledby", "save-settings-label");
      await expect(page.locator("#save-settings-label")).toHaveText("Save changes");
      await expect(save).toHaveAccessibleName("Save changes");
      await expect(save).toHaveAttribute("id", "save-settings");
      expect(await wrapperDepth(save)).toBe(2);
    },
  },
};

const state = (lab: RunningScenarioLab) => readFinalState<IdentityDriftState>(lab, "identity-drift");

/** Probes the manifest's facts the way the runner does: by `data-testid` subject. */
async function expectFacts(page: Page, facts: ExpectedFact[] | undefined): Promise<void> {
  expect(facts?.length ?? 0).toBeGreaterThan(0);
  for (const fact of facts ?? []) {
    const subject = page.getByTestId(fact.subject);
    if (fact.predicate === "text") await expect(subject).toHaveText(String(fact.value));
    else if (fact.predicate === "visible") await (fact.value ? expect(subject).toBeVisible() : expect(subject).toBeHidden());
    else throw new Error(`identity-drift spec does not probe predicate ${fact.predicate}`);
  }
}

/** Elements between the Save button and its actions group. */
async function wrapperDepth(save: Locator): Promise<number> {
  return save.evaluate((element) => {
    let depth = 0;
    for (let node = element.parentElement; node && node.dataset.testid !== "primary-actions"; node = node.parentElement) depth += 1;
    return depth;
  });
}

test("primary workflow types the workspace name and saves through the recorded control", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${startPath}`);
  await expectFacts(page, manifest.expected.pageFacts);
  await expect(page.getByTestId("display-name")).toHaveValue("Workspace 42");
  const save = page.getByTestId("save-changes");
  await expect(save).toBeInViewport();
  await expect(save).toHaveAccessibleName("Save changes");
  expect(await wrapperDepth(save)).toBe(0);

  await page.getByTestId("display-name").fill(workspaceName);
  await save.click();
  await expectFacts(page, manifest.expected.finalState);
  expect(await state(lab)).toMatchObject({ mode: "baseline", savedDisplayName: workspaceName, saveCount: 1, savedInMode: "baseline", discardCount: 0 });

  await page.goto(`${lab.origin}${startPath}`);
  await expect(page.getByTestId("display-name")).toHaveValue(workspaceName);
  await expectFacts(page, manifest.expected.finalState);
});

test("Discard restores the field and is recorded without saving", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${startPath}`);
  await page.getByTestId("display-name").fill("Scratch name");
  await page.getByTestId("discard-changes").click();
  await expect(page.getByTestId("display-name")).toHaveValue("Workspace 42");
  await expect(page.getByTestId("save-status")).toHaveText("Changes discarded");
  expect(await state(lab)).toMatchObject({ savedDisplayName: null, saveCount: 0, discardCount: 1, lastOperation: "discarded" });
});

test("every manifest variant has a drift case in this spec", () => {
  expect(Object.keys(driftCases).sort()).toEqual((manifest.variants ?? []).map((variant) => variant.id).sort());
});

for (const variant of manifest.variants ?? []) {
  test(`${variant.id} variant: the drifted Save action is recoverable and the save succeeds`, async ({ page, lab, networkGuard: _guard }) => {
    const drift = driftCases[variant.id as keyof typeof driftCases];
    if (!drift) throw new Error(`no drift case for variant ${variant.id}`);
    const expected = resolveScenarioWorkflow(manifest, { variantId: variant.id }).expected;
    expect(expected.failure).toBeUndefined();

    // Record in the baseline, as the recording lane does, then arm the variant.
    await page.goto(`${lab.origin}${startPath}`);
    const recorded = page.getByTestId("save-changes");
    const recordedBox = await recorded.boundingBox();
    if (!recordedBox) throw new Error("the recorded Save action has no box");
    await page.getByTestId("display-name").fill(workspaceName);
    await recorded.click();
    await expectFacts(page, manifest.expected.finalState);
    await armVariant(lab, "identity-drift", variant);
    expect(await state(lab)).toMatchObject({ mode: variant.id, savedDisplayName: null, saveCount: 0, savedInMode: null });

    await page.goto(`${lab.origin}${startPath}`);
    await expect(page.getByTestId("save-changes")).toHaveCount(0);
    await expect(page.getByTestId("save-status")).toHaveText("");
    await expect(page.getByTestId("display-name")).toHaveValue("Workspace 42");
    const save = drift.control(page);
    await expect(save).toHaveCount(1);
    await drift.assertDrift(page, save, recordedBox);

    await page.getByTestId("display-name").fill(workspaceName);
    await save.click();
    await expectFacts(page, expected.finalState);
    expect(await state(lab)).toMatchObject({ mode: variant.id, savedDisplayName: workspaceName, saveCount: 1, savedInMode: variant.id, discardCount: 0 });
  });
}
