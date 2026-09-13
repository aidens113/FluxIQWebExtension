// Every interaction with the running panel goes through one of these. They
// exist so that a locator is proved unambiguous before it is used and a
// review dialog is always driven the same way: `exactVisible` fails on a
// second match rather than picking one, and the virtualized hierarchy is
// scrolled until the exact tree item is on screen instead of being assumed.

import type { Locator, Page, Response } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { fail } from "./runner-fail.js";

export async function exactVisible(locator: Locator, label: string, timeout = 10_000): Promise<void> {
  await locator.first().waitFor({ state: "visible", timeout });
  if (await locator.count() !== 1) fail(`${label} is unavailable or ambiguous`);
}

export async function exactVirtualizedHierarchyObject(page: Page, hierarchy: Locator, itemId: string, label: string, rowSelector = ".tree-row-main.type-flow-object"): Promise<Locator> {
  const viewport = hierarchy.locator(".automation-project-tree");
  await exactVisible(viewport, "the project hierarchy viewport");
  const item = hierarchy.locator(`.automation-tree-item[data-tree-item-id="${escapeCss(itemId)}"]`);
  const deadline = Date.now() + 10_000;
  let offset = 0;
  while (Date.now() < deadline) {
    if (await item.count() === 1 && await item.isVisible().catch(() => false)) return item.locator(rowSelector);
    const metrics = await viewport.evaluate((element) => ({ height: element.clientHeight, maximum: Math.max(0, element.scrollHeight - element.clientHeight) }));
    offset = Math.min(metrics.maximum, offset + Math.max(36, metrics.height - 36));
    await viewport.evaluate((element, next) => { element.scrollTop = next; }, offset);
    await page.waitForTimeout(75);
  }
  fail(`${label} is unavailable in the virtualized hierarchy`);
}

export async function setSelect(root: Locator, label: string, value: string, page: Page, evidence: BrowserEvidenceRecorder): Promise<void> {
  const field = root.getByLabel(label, { exact: true });
  await exactVisible(field, `the exact ${label} setting`);
  if (await field.inputValue() !== value) await evidence.step("panel", `create-settings-${slug(label)}`, `Set ${label}`, () => field.selectOption(value));
}

export async function waitForEndpoint(page: Page, endpoint: string, dispatch: () => Promise<void>, timeout = 60_000): Promise<Response> {
  const response = page.waitForResponse(candidate => candidate.request().method() === "POST" && candidate.url().includes(`/api/programs/automation-studio/${endpoint}`), { timeout });
  await dispatch();
  return response;
}

export async function review(page: Page, evidence: BrowserEvidenceRecorder, pin: string, title: string, action: string, step: string): Promise<Response> {
  const button = page.getByRole("button", { name: action, exact: true });
  await exactVisible(button, `the ${action} Adaptation action`, 30_000);
  await evidence.step("panel", step + "-open", `Open ${title}`, () => button.click());
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await exactVisible(dialog, `the ${title} dialog`);
  const pinField = dialog.locator('label.field').filter({ hasText: /^PIN(?:\s|$)/u }).locator(":scope > input");
  await exactVisible(pinField, `the ${title} PIN field`);
  await evidence.step("panel", step + "-pin", `Authorize ${action}`, () => pinField.fill(pin), { sensitive: true });
  const response = await evidence.step("panel", step + "-submit", action, () => waitForEndpoint(page, "review-flow-adaptation", () => dialog.getByRole("button", { name: action, exact: true }).click()), { sensitive: true });
  await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  if (!response.ok()) fail(`${action} Adaptation request failed`);
  return response;
}

export function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, ""); }
function escapeCss(value: string): string { return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"'); }
export function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); }
