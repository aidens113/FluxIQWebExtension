import { expect } from "@playwright/test";
import { readFinalState, test } from "./lab-fixture.js";

test("basic form executes validation, selection, submission, and result state", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/basic-form/`);
  await page.getByTestId("name").fill("Ada"); await page.getByTestId("plan").selectOption("team"); await page.getByTestId("notes").fill("deterministic"); await page.getByTestId("submit").click();
  await expect(page.getByTestId("result")).toHaveText("Submitted");
  expect(await readFinalState(lab, "basic-form")).toMatchObject({ submitted: true, values: { name: "Ada", plan: "team", notes: "deterministic" } });
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
  expect(await readFinalState(lab, "iframe-checkout")).toEqual({ sameOriginClicks: 1, crossOriginClicks: 1 });
});

test("ambiguous labels remain semantically scoped", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/ambiguous-targets/`); await page.getByRole("region", { name: "Secondary" }).getByRole("button", { name: "Continue" }).click(); await expect(page.getByTestId("result")).toHaveText("secondary"); expect(await readFinalState(lab, "ambiguous-targets")).toEqual({ selected: "secondary" });
});

test("delayed UI reveals and executes its late action", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/delayed-ui/`); await page.getByTestId("begin-delay").click(); await expect(page.getByTestId("late-action")).toBeVisible(); await page.getByTestId("late-action").click(); expect(await readFinalState<{ revealed: boolean }>(lab, "delayed-ui")).toMatchObject({ revealed: true });
});

test("failure surfaces expose disabled, detached, blocked, and closure states without outbound traffic", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/failure-surfaces/`); await expect(page.getByTestId("disabled-target")).toBeDisabled(); await page.getByTestId("detach-target").click(); await expect(page.getByTestId("detach-target")).toHaveCount(0);
  await page.getByTestId("dead-link").click(); await expect(page).toHaveURL(`${lab.origin}/scenarios/failure-surfaces/`); await page.getByTestId("close-surface").click(); await expect(page.getByTestId("result")).toHaveText("Closure requested");
});

test("reconnect UI orders disconnect, queued, reconnect, and replay events", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/reconnect/`); await page.getByRole("button", { name: "Disconnect" }).click(); await page.getByRole("button", { name: "Queue event" }).click(); await page.getByRole("button", { name: "Reconnect" }).click();
  await expect(page.getByTestId("events").getByRole("listitem")).toHaveText(["disconnect", "queued", "reconnect", "replayed"]); expect(await readFinalState<{ connected: boolean }>(lab, "reconnect")).toMatchObject({ connected: true });
});

test("LLM target drift fixture succeeds, fails repeatably while missing, renames, and restores", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}/scenarios/llm-target-drift/`);
  await expect(page.getByTestId("seed-marker")).toHaveText("target-drift-seed-42");
  await page.getByTestId("diagnosis-target").click();
  await expect(page.getByTestId("result")).toHaveText("Completed: 1");
  expect(await readFinalState(lab, "llm-target-drift")).toMatchObject({ mode: "baseline", activationCount: 1, oracle: { targetPresent: true, expectedResult: "Completed: 1" } });

  await page.getByTestId("introduce-missing-target").click();
  await expect(page.getByTestId("drift-mode")).toHaveText("Mode: missing");
  await expect(page.getByTestId("diagnosis-target")).toHaveCount(0);
  await expect(page.getByTestId("result")).toHaveText("Target missing: deterministic failure armed");
  const firstMissing = await readFinalState(lab, "llm-target-drift");
  await page.reload();
  await expect(page.getByTestId("diagnosis-target")).toHaveCount(0);
  const secondMissing = await readFinalState(lab, "llm-target-drift");
  expect(secondMissing).toEqual(firstMissing);
  expect(secondMissing).toMatchObject({ mode: "missing", activationCount: 0, oracle: { recordedTargetTestId: "diagnosis-target", renderedTargetTestId: null, targetPresent: false } });

  await page.getByTestId("introduce-renamed-target").click();
  await expect(page.getByTestId("drift-mode")).toHaveText("Mode: renamed");
  await expect(page.getByTestId("diagnosis-target")).toHaveCount(0);
  await expect(page.getByTestId("diagnosis-target-v2")).toHaveText("Replacement control");
  await expect(page.getByTestId("result")).toHaveText("Target renamed: deterministic failure armed");

  await page.getByTestId("restore-target").click();
  await expect(page.getByTestId("drift-mode")).toHaveText("Mode: baseline");
  await expect(page.getByTestId("diagnosis-target")).toBeVisible();
  await expect(page.getByTestId("result")).toHaveText("Ready");
  expect(await readFinalState(lab, "llm-target-drift")).toMatchObject({ mode: "baseline", activationCount: 0, lastOperation: "restored", oracle: { targetPresent: true, expectedResult: "Ready" } });
});
test("sensitive UI submits synthetic input without retaining entered secrets", async ({ page, lab, networkGuard: _guard }) => {
  const password = "SYNTHETIC_BROWSER_PASSWORD"; const payment = "4242424242424242"; await page.goto(`${lab.origin}/scenarios/sensitive-input/`);
  await page.getByTestId("password").fill(password); await page.getByTestId("payment").fill(payment); await page.getByRole("button", { name: "Submit synthetic values" }).click(); await expect(page.getByTestId("result")).toHaveText("Submitted with secrets discarded");
  const stored = await readFinalState(lab, "sensitive-input"); expect(JSON.stringify(stored)).not.toContain(password); expect(JSON.stringify(stored)).not.toContain(payment); expect(stored).toMatchObject({ submitted: true, passwordStored: false, paymentStored: false });
});
