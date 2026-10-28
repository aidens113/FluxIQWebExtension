import type { Page } from "@playwright/test";
import type { ReadCard } from "./judge-demonstration-extract.js";

type DatasetRecord = Readonly<Record<string, string>>;

/** Enough between two results pages that a person's pace never meets the store's rate limiter. */
const READING_PACE_MS = 2200;
/** The store refuses a sixth results page within this window; the demonstration's own paged read has just used it. */
const THROTTLE_WINDOW_MS = 8500;
const PAGES = 5;
const CARD = '[data-component="search-result"][data-sku]';

/** A result card as the store renders it: title link, and the stars in the span beside the heading. */
const READ_CARDS = String.raw`[...document.querySelectorAll('[data-component="search-result"][data-sku]')].map((card) => {
  const title = card.querySelector('h2 a');
  const rating = card.querySelector('h2 + div span[aria-hidden="true"]');
  return { name: title ? title.textContent.trim() : '', rating: rating ? rating.textContent.trim() : '', url: title ? title.getAttribute('href') : '' };
})`;

/**
 * Reads every results page of the search the demonstration left open, in the order the store shows
 * them, the way `everything-store/tests/demonstrations.test.ts` does for its rating judgement: the
 * store's rate limiter drains first, then each page is scrolled until its cards stop growing and
 * read -- its cards, and its records through `readRecords` -- at a person's pace. Run after the recording
 * has stopped, so these loads are never part of it.
 */
export async function readResultsPages(
  page: Page,
  readRecords: () => Promise<readonly DatasetRecord[]>,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<{ cards: ReadCard[]; records: DatasetRecord[]; pages: Array<{ cards: number; records: number }> }> {
  await pause(THROTTLE_WINDOW_MS);
  const cards: ReadCard[] = [];
  const records: DatasetRecord[] = [];
  const pages: Array<{ cards: number; records: number }> = [];
  for (let number = 1; number <= PAGES; number += 1) {
    // The recording left the search on its first page, as the demonstration only reads that one; the rest are clicked to, at a person's pace.
    if (number > 1) {
      await pause(READING_PACE_MS);
      await page.getByRole("link", { name: `Go to page ${number}`, exact: true }).first().click();
    }
    await page.locator(CARD).first().waitFor();
    // Cards render as the page is scrolled: read only once the count has held still for three looks.
    let seen = -1;
    let held = 0;
    for (let attempt = 0; attempt < 20 && held < 3; attempt += 1) {
      const count = await page.locator(CARD).count();
      held = count === seen ? held + 1 : 0;
      seen = count;
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await page.mouse.wheel(0, 4000);
      await pause(500);
    }
    const pageRecords = await readRecords();
    const pageCards = await page.evaluate(READ_CARDS) as ReadCard[];
    records.push(...pageRecords);
    cards.push(...pageCards);
    pages.push({ cards: pageCards.length, records: pageRecords.length });
  }
  return { cards, records, pages };
}
