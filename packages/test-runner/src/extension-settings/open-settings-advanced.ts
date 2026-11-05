import type { Page } from "@playwright/test";

/** Opens Settings' Advanced section, which holds the addresses, the capture switches, Save and Forget, unless it is open already. */
export async function openSettingsAdvanced(page: Page): Promise<void> {
  const section = page.locator("details.settings-advanced");
  if (await section.evaluate((details) => (details as HTMLDetailsElement).open)) return;
  await section.locator("summary").click();
}
