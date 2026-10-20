import type { Page } from "@playwright/test";

/**
 * Opens the everything-store as a person arrives: the deal offer and cookie
 * banner answered, then the product page `detail` with its app banner closed
 * and its assistant minimised. The build's first observation knows this page;
 * the builder must still visit Cart itself before it acts.
 */
export async function openStoreDetail(page: Page, origin: string, detail: string): Promise<void> {
  await page.goto(new URL("/scenarios/everything-store", origin).href);
  await page.getByRole("dialog", { name: "Never miss a deal" }).waitFor();
  await page.getByRole("button", { name: "Not now", exact: true }).click();
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await page.goto(detail);
  await page.getByTitle("Close", { exact: true }).click();
  await page.getByRole("dialog", { name: "Brightaisle Assistant" }).waitFor({ timeout: 9000 });
  await page.getByRole("button", { name: "Minimize chat", exact: true }).click();
}
