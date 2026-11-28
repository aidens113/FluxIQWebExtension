// The extension's new single path, photographed while a journey has the extension connected: the empty
// chat with its welcome and project button, the project sheet, Settings, and the chat once a Flow ran.
// Every step is best-effort: a control that is not where it was expected skips that shot only.
import path from "node:path";
import type { Page } from "@playwright/test";
import type { JourneyShots } from "./screenshots.js";

async function press(page: Page, label: RegExp | string, role: "button" | "tab"): Promise<boolean> {
  try {
    await page.getByRole(role, { name: label }).first().click({ timeout: 3_000 });
    return true;
  } catch {
    /* best-effort: a control that is not there skips its shot only */
    return false;
  }
}

/** The directory a run's screenshots go to, inside its workspace directory. */
export function shotsDirectory(workspaceDirectory: string, journey: string): string {
  return path.join(workspaceDirectory, "ui-e2e-screenshots", journey);
}

/** (a) first open after connecting, (b) the project sheet, (d) Settings. Leaves the extension on its chat. */
export async function shootExtensionFirstOpen(shots: JourneyShots, extensionPage: Page): Promise<void> {
  await press(extensionPage, "Chat", "tab");
  await shots.shoot("extension-first-open", "extension", extensionPage);
  // The project button in the top bar names the project (or "Choose a project"); its sheet has no "+ New project".
  if (await press(extensionPage, /project/iu, "button")) {
    await shots.shoot("extension-project-sheet", "extension", extensionPage);
    await extensionPage.keyboard.press("Escape").catch(/* best-effort: closing the sheet is not asserted */ () => undefined);
  }
  if (await press(extensionPage, "Settings", "button")) {
    await shots.shoot("extension-settings", "extension", extensionPage);
    await press(extensionPage, "Chat", "tab");
  }
}

/** (c) the chat once a Flow ran, and (e) the panel as it stands, showing the same project. */
export async function shootAfterRun(shots: JourneyShots, extensionPage: Page, panelPage: Page): Promise<void> {
  await press(extensionPage, "Chat", "tab");
  await shots.shoot("extension-after-run", "extension", extensionPage);
  await shots.shoot("panel-after-run", "panel", panelPage);
}
