// One example per repeating control, on the page that needed it.
//
// The social scheduler is a 280-row publishing queue with one checkbox and one
// "Post actions" button per row. Before `content/repeat-exemplars.ts`, the
// evidence packet a model authors from held the three filter selects and a
// column of row checkboxes -- at rest and after "Select all posts" alike --
// and none of the page's own buttons, so a Flow whose action is the bulk bar's
// Retry button could not be written: the model had no handle for it. The rows
// below run the real content script in Chromium and the real domain sanitizer
// on what it captured, because the defect lived in the join between the two:
// each side's own suite was green while the packet was full of checkboxes.

import type { Page } from "@playwright/test";
import { sanitizeWebLlmSnapshot } from "@fluxiq-web-extension/domain";
import { expect, test } from "../index.js";
import type { DomElementDescriptor } from "../../../src/shared/protocol.js";

/** What the evidence packet describes of a snapshot at most: `WEB_LLM_EVIDENCE_BOUNDS.elements`. */
const PACKET_ELEMENTS = 40;
const QUEUE_SIZE = 280;
const SELECT_ALL = 'input[aria-label="Select all posts"]';
const ROW_CHECKBOX = /^Select the post for /u;

const nameOf = (element: DomElementDescriptor): string => element.accessibleName ?? element.visibleText ?? "";

async function selectAll(page: Page): Promise<void> {
  await page.check(SELECT_ALL);
  await page.waitForSelector('[data-testid="bulk-toolbar"]');
}

async function narrowToLastWeeksFailures(page: Page): Promise<void> {
  await page.selectOption('[data-testid="status-filter"]', "failed");
  await page.selectOption('[data-testid="range-filter"]', "last-7");
  await page.waitForSelector('[data-testid="filter-summary"]');
}

test("the head of the snapshot holds the page's own controls and one example of each row control", async ({ openHarness }) => {
  const harness = await openHarness("social-scheduler");
  const elements = (await harness.capture()).interactiveElements;
  const head = elements.slice(0, PACKET_ELEMENTS);
  const headNames = head.map(nameOf);

  // Every button the page itself offers, which the row checkboxes used to crowd out.
  for (const button of ["New post", "Import schedule", "Connect an account", "Export queue", "Notifications"]) {
    expect(headNames, button).toContain(button);
  }
  expect(head.filter((element) => element.tagName === "select")).toHaveLength(3);
  expect(headNames).toContain("Select all posts");

  // One of each row control, carrying how many rows it stands for.
  const rowCheckboxes = head.filter((element) => ROW_CHECKBOX.test(nameOf(element)));
  expect(rowCheckboxes).toHaveLength(1);
  expect(rowCheckboxes[0]?.repeatCount).toBe(QUEUE_SIZE);
  expect(rowCheckboxes[0]?.context?.tablePosition?.row, "the exemplar is the first row's").toBe(2);
  const rowActions = head.filter((element) => nameOf(element) === "Post actions");
  expect(rowActions).toHaveLength(1);
  expect(rowActions[0]?.repeatCount).toBe(QUEUE_SIZE);

  // The select-all checkbox shares the rows' column but not their rows: it is not one of them.
  expect(head.find((element) => nameOf(element) === "Select all posts")?.repeatCount).toBeUndefined();

  // The sidebar's links are distinct destinations, not a repeated control: all
  // eleven are listed and none is counted as an example of the others.
  const navigation = head.filter((element) => element.tagName === "a" && element.context?.landmark === "navigation");
  expect(navigation.map(nameOf)).toEqual(["Queue", "Calendar", "Drafts8", "Approvals3", "Library", "Reports", "Engagement", "Accounts", "Team", "Billing", "Settings"]);
  expect(navigation.filter((element) => element.repeatCount !== undefined)).toEqual([]);
});

test("the rest of a run is ranked after every distinct element, not dropped", async ({ openHarness }) => {
  const harness = await openHarness("social-scheduler");
  const elements = (await harness.capture()).interactiveElements;
  const firstFollower = elements.findIndex((element) => ROW_CHECKBOX.test(nameOf(element)) && element.repeatCount === undefined);
  expect(firstFollower, "the second row's checkbox is still in the snapshot").toBeGreaterThan(0);
  expect(elements[firstFollower]?.context?.tablePosition?.row).toBe(3);
  // Everything ahead of it is either not in a run or is a run's exemplar.
  const ahead = elements.slice(0, firstFollower);
  expect(ahead.some((element) => ROW_CHECKBOX.test(nameOf(element)) && element.repeatCount === undefined)).toBe(false);
  expect(ahead.map(nameOf)).toContain("Showing 280 of 280 posts");
});

test("after Select all, the bulk bar's Retry button reaches the packet a model is shown", async ({ openHarness }) => {
  const harness = await openHarness("social-scheduler");
  await selectAll(harness.page);
  const packet = sanitizeWebLlmSnapshot(await harness.capture());
  const described = packet.elements.map((element) => element.name ?? element.text ?? "");

  expect(described).toContain("Retry");
  expect(described).toContain("Export CSV");
  expect(packet.elements.filter((element) => ROW_CHECKBOX.test(element.name ?? ""))).toEqual([
    expect.objectContaining({ inputType: "checkbox", repeats: QUEUE_SIZE })
  ]);
});

test("a narrowed page counts what is left, and still lists Retry once rows are selected", async ({ openHarness }) => {
  const harness = await openHarness("social-scheduler");
  await narrowToLastWeeksFailures(harness.page);
  const narrowed = (await harness.capture()).interactiveElements;
  expect(narrowed.find((element) => ROW_CHECKBOX.test(nameOf(element)))?.repeatCount).toBe(10);

  await selectAll(harness.page);
  const packet = sanitizeWebLlmSnapshot(await harness.capture());
  expect(packet.elements.map((element) => element.name ?? element.text ?? "")).toContain("Retry");
});

// Nothing is recording here, so this is the runtime interaction ledger's
// case: an action checks one row's box, and the look that follows has to show
// that box -- not only row one's, the run's exemplar.
test("a row control just acted on keeps its place ahead of its run", async ({ openHarness }) => {
  const harness = await openHarness("social-scheduler");
  const fifthRow = '[data-testid="queue-rows"] > tr:nth-of-type(5) input[type="checkbox"]';
  await harness.page.check(fifthRow);
  await harness.page.waitForSelector('[data-testid="bulk-toolbar"]');
  const elements = (await harness.capture()).interactiveElements;
  const touched = elements.findIndex((element) => ROW_CHECKBOX.test(nameOf(element)) && element.context?.tablePosition?.row === 6);
  expect(touched).toBeGreaterThanOrEqual(0);
  expect(touched, "the checkbox just used is in the head, not behind the run").toBeLessThan(PACKET_ELEMENTS);
});
