import { randomBytes } from "node:crypto";
import { expect, test as base } from "@playwright/test";
import { startScenarioLab, type RunningScenarioLab } from "../src/server.js";
import { installDeterministicNetworkGuard, type DeterministicNetworkGuard } from "./network-policy.js";

const test = base.extend<{ lab: RunningScenarioLab; networkGuard: DeterministicNetworkGuard }>({
  lab: async ({}, use) => {
    const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: 42 });
    try { await use(lab); } finally { await lab.close(); }
  },
  networkGuard: async ({ context }, use) => {
    const guard = await installDeterministicNetworkGuard(context);
    await use(guard);
    guard.assertClean();
  },
});

async function state<T>(lab: RunningScenarioLab, scenario: string): Promise<T> {
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=${scenario}`, { headers: { authorization: `Bearer ${lab.runToken}` } });
  expect(response.ok).toBe(true);
  return (await response.json() as { state: T }).state;
}

test("basic form executes validation, selection, submission, and result state", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/basic-form/`);
  await page.getByTestId("name").fill("Ada"); await page.getByTestId("plan").selectOption("team"); await page.getByTestId("notes").fill("deterministic"); await page.getByTestId("submit").click();
  await expect(page.getByTestId("result")).toHaveText("Submitted");
  expect(await state(lab, "basic-form")).toMatchObject({ submitted: true, values: { name: "Ada", plan: "team", notes: "deterministic" } });
});

test("dynamic list preserves identity through add and reorder", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/dynamic-list/`); const original = await page.getByTestId("list-item").first().getAttribute("data-entity-id");
  await page.getByTestId("item-label").fill("Fourth"); await page.getByTestId("add-form").getByRole("button").click(); await expect(page.getByTestId("item-count")).toHaveText("4 items");
  await page.getByTestId("reverse").click(); await expect(page.getByTestId("list-item").first()).toContainText("Fourth"); expect(await page.getByTestId("list-item").last().getAttribute("data-entity-id")).toBe(original);
});

test("navigation executes full navigation and history mutation", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/navigation/start`); await page.getByTestId("full-navigation").click(); await expect(page.getByTestId("navigation-page")).toHaveText("Navigation: second");
  await page.getByTestId("history").click(); await expect(page).toHaveURL(/\/scenarios\/navigation\/history$/); await expect(page.getByTestId("history-state")).toHaveText("History updated");
});

test("long document reaches a below-fold target", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/long-document/`); const target = page.getByTestId("below-fold-target"); await target.scrollIntoViewIfNeeded(); expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0); await target.click(); await expect(page.getByTestId("result")).toHaveText("Reached");
});

test("same-origin and distinct-loopback-origin iframe actions execute", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/iframe-checkout/`); const same = page.frameLocator('[title="Same-origin checkout"]'); const cross = page.frameLocator('[title="Cross-origin checkout"]');
  await same.getByTestId("same-frame-action").click(); await cross.getByTestId("cross-frame-action").click(); await expect(same.getByTestId("frame-result")).toHaveText("Confirmed"); await expect(cross.getByTestId("frame-result")).toHaveText("Confirmed");
  expect(await state(lab, "iframe-checkout")).toEqual({ sameOriginClicks: 1, crossOriginClicks: 1 });
});

test("ambiguous labels remain semantically scoped", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/ambiguous-targets/`); await page.getByRole("region", { name: "Secondary" }).getByRole("button", { name: "Continue" }).click(); await expect(page.getByTestId("result")).toHaveText("secondary"); expect(await state(lab, "ambiguous-targets")).toEqual({ selected: "secondary" });
});

test("delayed UI reveals and executes its late action", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/delayed-ui/`); await page.getByTestId("begin-delay").click(); await expect(page.getByTestId("late-action")).toBeVisible(); await page.getByTestId("late-action").click(); expect(await state<{ revealed: boolean }>(lab, "delayed-ui")).toMatchObject({ revealed: true });
});

test("failure surfaces expose disabled, detached, blocked, and closure states without outbound traffic", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/failure-surfaces/`); await expect(page.getByTestId("disabled-target")).toBeDisabled(); await page.getByTestId("detach-target").click(); await expect(page.getByTestId("detach-target")).toHaveCount(0);
  await page.getByTestId("blocked-url").click(); await expect(page).toHaveURL(`${lab.origin}/scenarios/failure-surfaces/`); await page.getByTestId("close-surface").click(); await expect(page.getByTestId("result")).toHaveText("Closure requested");
});

test("reconnect UI orders disconnect, queued, reconnect, and replay events", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/reconnect/`); await page.getByRole("button", { name: "Disconnect" }).click(); await page.getByRole("button", { name: "Queue event" }).click(); await page.getByRole("button", { name: "Reconnect" }).click();
  await expect(page.getByTestId("events").getByRole("listitem")).toHaveText(["disconnect", "queued", "reconnect", "replayed"]); expect(await state<{ connected: boolean }>(lab, "reconnect")).toMatchObject({ connected: true });
});

test("sensitive UI submits synthetic input without retaining entered secrets", async ({ page, lab, networkGuard: _guard }) => {
  const password = "SYNTHETIC_BROWSER_PASSWORD"; const payment = "4242424242424242"; await page.goto(`${lab.origin}/scenarios/sensitive-input/`);
  await page.getByTestId("password").fill(password); await page.getByTestId("payment").fill(payment); await page.getByRole("button", { name: "Submit synthetic values" }).click(); await expect(page.getByTestId("result")).toHaveText("Submitted with secrets discarded");
  const stored = await state(lab, "sensitive-input"); expect(JSON.stringify(stored)).not.toContain(password); expect(JSON.stringify(stored)).not.toContain(payment); expect(stored).toMatchObject({ submitted: true, passwordStored: false, paymentStored: false });
});
