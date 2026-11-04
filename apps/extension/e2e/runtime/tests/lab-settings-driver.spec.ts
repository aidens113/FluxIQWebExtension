// The Lab's own way through the real extension's Settings (`demo-workspace/browser-session.ts`,
// `ui-e2e/journeys/extension-project.ts`), provider-free, with a realistic scenario open: open
// Settings, open Advanced with the driver's own helper, fill the addresses and switches by the
// labels it uses, Save, and reach Forget. Advanced starts closed, so this is what proves the
// driver still reaches everything it presses.
import { randomBytes } from "node:crypto";
import { openSettingsAdvanced } from "../../../../../packages/test-runner/src/extension-settings/index.js";
import { startScenarioLab } from "../../../../scenario-lab/src/server.js";
import { expect, test } from "../../fixtures/extension-context.js";

test("the Lab's driver opens Advanced and fills Settings in the real extension", async ({ extensionSession }) => {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    const fixture = await extensionSession.context.newPage();
    await fixture.goto(new URL("/scenarios/company-website/", lab.origin).href);
    const page = extensionSession.extensionPage;
    await page.bringToFront();
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByLabel("FluxIQ connection address", { exact: true })).toBeHidden();
    await openSettingsAdvanced(page);
    await page.getByLabel("FluxIQ connection address", { exact: true }).fill("ws://127.0.0.1:4777/client");
    await page.getByLabel("FluxIQ web address", { exact: true }).fill("http://127.0.0.1:3000");
    for (const label of ["Reconnect automatically", "Record page changes", "Record what I type", "Record page snapshots"]) {
      const checkbox = page.getByLabel(label, { exact: true });
      if (!await checkbox.isChecked()) await checkbox.check();
    }
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Saved.", { exact: true }).waitFor();
    await expect(page.getByRole("button", { name: "Forget this pairing", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Chat", exact: true }).click();
    // A second visit: the helper copes with Advanced already open.
    await page.getByRole("button", { name: "Settings" }).click();
    await openSettingsAdvanced(page);
    await expect(page.getByLabel("FluxIQ connection address", { exact: true })).toBeVisible();
  } finally {
    await lab.close();
  }
});
