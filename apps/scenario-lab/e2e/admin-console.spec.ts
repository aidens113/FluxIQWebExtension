import { expect, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import {
  adminConsoleScenario, adminRecords, formatMoney,
  FULL_BOOK_SIZE, LIST_OVERSCAN_ROWS, LIST_ROW_HEIGHT_PX, LIST_VIEWPORT_HEIGHT_PX, SHORT_BOOK_SIZE,
  type AdminConsoleState,
} from "../src/scenarios/admin-console/index.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

/**
 * The admin console fixture, and what today's implementation does to it.
 *
 * Several assertions here record a *defect*, not the intended behaviour, and
 * say so. The fixture was built to meet three shapes nothing in this repository
 * had met -- a virtualised list, an open shadow root, and routing with no
 * navigation -- and the point of a test that pins the wrong answer is that the
 * day the product is fixed, this file fails and someone reads why. Each one
 * names the manifest expectation it contradicts.
 */

const CONSOLE_PATH = "/scenarios/admin-console/";
const TARGET_ID = "CUS-0128";
const TARGET_COMPANY = "Quarrow Robotics";
/** Rows the list mounts with the viewport at rest: the visible band plus one overscan below it. */
const ROWS_AT_REST = Math.ceil(LIST_VIEWPORT_HEIGHT_PX / LIST_ROW_HEIGHT_PX) + LIST_OVERSCAN_ROWS;
/** The `scroll` step the `browse-to-customer` workflow declares. */
const BROWSE_SCROLL_PX = 5_500;

const manifest = adminConsoleScenario.manifest;
const variantOf = (selection: { workflowId?: string; variantId: string }) => resolveScenarioWorkflow(manifest, selection).variant;
const targetRecord = adminRecords[127];

/** Every `record-row` currently in the document, read the way `extractRecords` reads an extract step. */
async function readMountedRows(page: Page): Promise<Array<Record<string, string>>> {
  const rows = await page.getByTestId("record-row").all();
  const records: Array<Record<string, string>> = [];
  for (const row of rows) {
    records.push({
      company: await cellText(row, "row-company"),
      reference: await cellText(row, "row-contact"),
      plan: await cellText(row, "row-plan"),
      mrr: await cellText(row, "row-mrr"),
    });
  }
  return records;
}

async function cellText(row: Locator, testId: string): Promise<string> {
  return ((await row.getByTestId(testId).first().textContent()) ?? "").replace(/\s+/gu, " ").trim();
}

/** A token that survives only as long as this document does; a full navigation wipes it. */
async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => { (window as unknown as { __documentMark?: string }).__documentMark = "same-document"; });
}

async function documentSurvived(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __documentMark?: string }).__documentMark === "same-document");
}

async function openConsole(page: Page, origin: string, path = CONSOLE_PATH): Promise<void> {
  await page.goto(`${origin}${path}`);
  await expect(page.getByTestId("app-root")).toHaveAttribute("data-booted", "true");
}

test("the console renders a customer book, a detail pane, and a settings screen", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  await expect(page.getByTestId("workspace-name")).toHaveText("Atlas Admin");
  await expect(page.getByTestId("list-summary")).toHaveText(`${FULL_BOOK_SIZE} records`);
  await expect(page.getByTestId("list-viewport")).toHaveAttribute("aria-rowcount", String(FULL_BOOK_SIZE));
  await expect(page.getByTestId("detail-empty")).toBeVisible();
  await expect(page.getByTestId("settings-view")).toBeHidden();
  await expect(page.getByTestId("record-row").first().getByTestId("row-company")).toHaveText(adminRecords[0]?.company ?? "");
  // Several controls, one accessible name, told apart only by the row they sit in.
  expect(await page.getByRole("button", { name: "Row actions", exact: true }).count()).toBe(ROWS_AT_REST);
  // The list's own geometry, which every window calculation below depends on.
  expect(await page.getByTestId("list-viewport").evaluate((element) => element.clientHeight)).toBe(LIST_VIEWPORT_HEIGHT_PX);
});

/**
 * The property the fixture exists for. Fifteen of 240 rows are in the document
 * at rest; scrolling replaces them, and the row that was there before is not
 * merely hidden, it is gone.
 */
test("the customer list mounts only the rows near its viewport, and unmounts the rest", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  const viewport = page.getByTestId("list-viewport");
  await expect(page.getByTestId("record-row")).toHaveCount(ROWS_AT_REST);
  expect(ROWS_AT_REST).toBe(15);

  const firstRow = page.locator('[data-record-id="CUS-0001"]');
  await expect(firstRow).toHaveCount(1);
  await expect(page.locator(`[data-record-id="${TARGET_ID}"]`)).toHaveCount(0);

  await viewport.evaluate((element, top) => { element.scrollTop = top; }, BROWSE_SCROLL_PX);
  await expect(page.locator(`[data-record-id="${TARGET_ID}"]`)).toHaveCount(1);
  // The element a recording would have captured at the top of the list is not
  // hidden or detached-but-findable. It does not exist.
  await expect(firstRow).toHaveCount(0);
  expect(await firstRow.count()).toBe(0);
  const start = Math.max(0, Math.floor(BROWSE_SCROLL_PX / LIST_ROW_HEIGHT_PX) - LIST_OVERSCAN_ROWS);
  const end = Math.min(FULL_BOOK_SIZE, Math.ceil((BROWSE_SCROLL_PX + LIST_VIEWPORT_HEIGHT_PX) / LIST_ROW_HEIGHT_PX) + LIST_OVERSCAN_ROWS);
  await expect(page.getByTestId("record-row")).toHaveCount(end - start);
  await expect(page.locator(`[data-record-id="${TARGET_ID}"]`).getByTestId("row-company")).toHaveText(TARGET_COMPANY);
});

/**
 * DEFECT, and the worst one here because it is silent.
 *
 * `extract-customer-list` declares all ${FULL_BOOK_SIZE} customers. An extract
 * step reads the document, and the document holds ${ROWS_AT_REST} rows, so the
 * step succeeds and returns 6% of the book with no error, no warning, and no
 * way for a Flow to tell a short book from a virtualised one. `short-book` is
 * the control: same page, same step, twelve rows mounted, twelve returned.
 */
test("extraction over the virtualised list silently returns the render window instead of the book", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  const declared = resolveScenarioWorkflow(manifest, { workflowId: "extract-customer-list" }).expected.extracted?.[0];
  expect(declared?.count).toBe(FULL_BOOK_SIZE);

  const read = await readMountedRows(page);
  expect(read.length).toBe(ROWS_AT_REST);
  expect(read.length).not.toBe(declared?.count);
  // What comes back is correct as far as it goes, which is what makes it dangerous.
  expect(read[0]).toEqual(declared?.records?.[0]);
  expect(read.at(-1)).toEqual(declared?.records?.[ROWS_AT_REST - 1]);
});

test("the same extraction returns the whole book when the book fits the window", async ({ page, lab, networkGuard: _guard }) => {
  await armVariant(lab, "admin-console", variantOf({ workflowId: "extract-customer-list", variantId: "short-book" }));
  await openConsole(page, lab.origin);
  await expect(page.getByTestId("list-summary")).toHaveText(`${SHORT_BOOK_SIZE} records`);
  const declared = resolveScenarioWorkflow(manifest, { workflowId: "extract-customer-list", variantId: "short-book" }).expected.extracted?.[0];
  const read = await readMountedRows(page);
  expect(read.length).toBe(SHORT_BOOK_SIZE);
  expect(read).toEqual(declared?.records);
});

/**
 * DEFECT. `browse-to-customer` declares a `scroll` step, which the step runner
 * performs as `page.mouse.wheel(0, value)` with the pointer wherever it happens
 * to be -- the top-left corner, because nothing has moved it. The console's
 * shell fills the viewport and does not scroll, and the list scrolls inside its
 * own pane, so the wheel reaches nothing. Moving the pointer over the list
 * first makes the identical wheel work, which is what identifies the cause.
 */
test("the scroll verb cannot move a list that scrolls inside its own pane", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  const viewport = page.getByTestId("list-viewport");
  const scrollTop = () => viewport.evaluate((element) => element.scrollTop);
  expect(await scrollTop()).toBe(0);

  await page.mouse.wheel(0, BROWSE_SCROLL_PX);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  expect(await scrollTop()).toBe(0);
  await expect(page.locator(`[data-record-id="${TARGET_ID}"]`)).toHaveCount(0);

  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  await page.mouse.wheel(0, BROWSE_SCROLL_PX);
  await expect.poll(scrollTop).toBeGreaterThan(0);
  await expect(page.getByTestId("record-row").first()).not.toHaveAttribute("aria-rowindex", "1");
});

/**
 * DEFECT, and the most consequential of the three shapes.
 *
 * Playwright's engine pierces an open shadow root, so the recording lane and
 * the runner's fact probe both see the switch. The extension's resolver does
 * not: `resolve-target.ts` looks it up with `document.querySelectorAll`, and
 * `identity/candidates.ts` enumerates recovery candidates the same way, so
 * neither can reach it. Worse than not finding it: `document.elementFromPoint`
 * answers the host, which is a real element of a different tag standing exactly
 * where the recorded one was.
 */
test("the shadow-rooted switch is reachable by the test engine and invisible to a document query", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  await page.getByTestId("nav-settings").click();
  await page.getByTestId("tab-notifications").click();
  await expect(page.getByTestId("notifications-panel")).toBeVisible();

  const toggle = page.getByTestId("digest-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("role", "switch");
  await expect(toggle).toHaveAccessibleName("Weekly digest email");

  const probe = await page.evaluate(() => {
    const host = document.querySelector("fx-toggle");
    const rect = host?.getBoundingClientRect();
    const point = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : { x: 0, y: 0 };
    const CANDIDATE_SELECTOR = 'a[href],button,input,select,textarea,summary,label,[role],[tabindex],[onclick],[contenteditable]';
    return {
      byDocumentQuery: document.querySelectorAll('[data-testid="digest-toggle"]').length,
      hostTag: host?.tagName ?? null,
      atPointTag: document.elementFromPoint(point.x, point.y)?.tagName ?? null,
      inShadow: host?.shadowRoot?.querySelectorAll('[data-testid="digest-toggle"]').length ?? 0,
      candidateTestIds: [...document.querySelectorAll(CANDIDATE_SELECTOR)].map((element) => element.getAttribute("data-testid")),
    };
  });
  expect(probe.hostTag).toBe("FX-TOGGLE");
  expect(probe.inShadow).toBe(1);
  // What the extension's exact-match strategy would find: nothing.
  expect(probe.byDocumentQuery).toBe(0);
  // What its coordinate strategy would find: a different element, in the right place.
  expect(probe.atPointTag).toBe("FX-TOGGLE");
  // What its scored-candidate recovery would have to choose from: not the switch.
  expect(probe.candidateTestIds).not.toContain("digest-toggle");
});

test("the light-DOM control is the same switch and a document query does find it", async ({ page, lab, networkGuard: _guard }) => {
  await armVariant(lab, "admin-console", variantOf({ workflowId: "switch-settings-tab", variantId: "light-dom-toggle" }));
  await openConsole(page, lab.origin);
  await page.getByTestId("nav-settings").click();
  await page.getByTestId("tab-notifications").click();
  const toggle = page.getByTestId("digest-toggle");
  await expect(toggle).toHaveAttribute("role", "switch");
  await expect(toggle).toHaveAccessibleName("Weekly digest email");
  const probe = await page.evaluate(() => ({
    byDocumentQuery: document.querySelectorAll('[data-testid="digest-toggle"]').length,
    hosts: document.querySelectorAll("fx-toggle").length,
  }));
  expect(probe).toEqual({ byDocumentQuery: 1, hosts: 0 });

  await toggle.click();
  await expect(page.getByTestId("digest-status")).toHaveText("Weekly digest: on");
  expect(await readFinalState<AdminConsoleState>(lab, "admin-console")).toMatchObject({ oracle: { weeklyDigest: true } });
});

/**
 * Route changes with no navigation. Opening a customer pushes a path and
 * switching a tab replaces one; the browser records neither as a navigation,
 * the document is never replaced, and a full request for the same URL would
 * have thrown away everything the client is holding.
 */
test("selecting a record and switching a tab change the URL without a navigation", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  await markDocument(page);
  const navigationEntries = () => page.evaluate(() => performance.getEntriesByType("navigation").length);
  expect(await navigationEntries()).toBe(1);

  await page.getByTestId("record-search").fill(TARGET_COMPANY);
  await expect(page.getByTestId("record-row")).toHaveCount(1);
  await page.getByTestId("record-row").click();
  await expect(page).toHaveURL(`${lab.origin}${CONSOLE_PATH}records/${TARGET_ID}`);
  expect(await documentSurvived(page)).toBe(true);
  expect(await navigationEntries()).toBe(1);

  await page.getByTestId("nav-settings").click();
  await page.getByTestId("tab-notifications").click();
  await expect(page).toHaveURL(`${lab.origin}${CONSOLE_PATH}settings?tab=notifications`);
  expect(await documentSurvived(page)).toBe(true);
  expect(await navigationEntries()).toBe(1);

  // Back is a history entry for the record but not for the tab: the tab replaced.
  await page.goBack();
  await expect(page).toHaveURL(`${lab.origin}${CONSOLE_PATH}records/${TARGET_ID}`);
  await expect(page.getByTestId("detail-heading")).toHaveText(TARGET_COMPANY);
  expect(await documentSurvived(page)).toBe(true);

  // The same URL fetched as a request is a different thing wearing the same clothes.
  await page.reload();
  expect(await documentSurvived(page)).toBe(false);
  expect(await navigationEntries()).toBe(1);
  await expect(page.getByTestId("detail-heading")).toHaveText(TARGET_COMPANY);
});

/**
 * The element identity an inline edit destroys. Three elements stand in the
 * same cell during one edit and none of them survives it, so a recording that
 * captured the first cannot be replayed against the third.
 */
test("an inline edit replaces the element it was recorded against, twice", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  await page.getByTestId("record-search").fill(TARGET_COMPANY);
  await page.getByTestId("record-row").click();
  await expect(page.getByTestId("detail-heading")).toHaveText(TARGET_COMPANY);

  const cell = page.locator('[data-field-cell="mrr"]');
  const recorded = await cell.locator('[data-testid="field-mrr"]').elementHandle();
  expect(recorded).not.toBeNull();
  expect(await recorded?.evaluate((element) => element.tagName)).toBe("BUTTON");

  await page.getByTestId("field-mrr").click();
  const input = page.getByTestId("field-mrr-input");
  await expect(input).toBeFocused();
  // The recorded element is no longer in the document, and nothing named
  // `field-mrr` is either: the test id now belongs to an element that did not
  // exist when the click was recorded.
  expect(await recorded?.evaluate((element) => element.isConnected)).toBe(false);
  await expect(page.getByTestId("field-mrr")).toHaveCount(0);

  const typed = await input.elementHandle();
  await input.fill("5400.00");
  await input.press("Enter");
  await expect(page.getByTestId("field-mrr-input")).toHaveCount(0);
  expect(await typed?.evaluate((element) => element.isConnected)).toBe(false);
  await expect(page.getByTestId("field-mrr")).toHaveText("$5,400.00");
  await expect(page.getByTestId("unsaved-badge")).toHaveText("1 unsaved change");
});

test("Escape abandons an inline edit and leaves the committed value alone", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  await page.getByTestId("record-search").fill(TARGET_COMPANY);
  await page.getByTestId("record-row").click();
  const before = await page.getByTestId("field-mrr").textContent();
  await page.getByTestId("field-mrr").click();
  await page.getByTestId("field-mrr-input").fill("1.00");
  await page.getByTestId("field-mrr-input").press("Escape");
  await expect(page.getByTestId("field-mrr")).toHaveText(before ?? "");
  await expect(page.getByTestId("unsaved-badge")).toHaveCount(0);
  await expect(page.getByTestId("save-record")).toBeDisabled();
});

/** The primary workflow, performed exactly as the step runner performs its steps. */
test("the primary workflow meets every fact its manifest declares", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  await page.getByTestId("record-search").fill(TARGET_COMPANY);
  await page.getByTestId("record-row").waitFor({ state: "visible" });
  await page.getByTestId("record-row").click();
  await page.getByTestId("detail-heading").waitFor({ state: "visible" });
  await page.getByTestId("field-mrr").click();
  await page.getByTestId("field-mrr-input").fill("5400.00");
  await page.getByTestId("field-mrr-input").press("Enter");
  await page.getByTestId("save-record").click();
  await page.getByTestId("saved-marker").waitFor({ state: "visible" });

  for (const fact of manifest.expected.finalState ?? []) {
    if (fact.predicate === "path") expect(new URL(page.url()).pathname).toBe(fact.value);
    else if (fact.predicate === "text") expect((await page.getByTestId(fact.subject).first().textContent())?.trim()).toBe(fact.value);
    else if (fact.predicate === "exists") expect(await page.getByTestId(fact.subject).count() > 0).toBe(fact.value);
    else throw new Error(`unhandled predicate ${fact.predicate}`);
  }
  expect(await readFinalState<AdminConsoleState>(lab, "admin-console")).toMatchObject({
    openedRecordIds: [TARGET_ID],
    savedEdits: { [TARGET_ID]: [{ field: "mrr", value: "$5,400.00" }] },
    oracle: { savedCount: 1, routePath: `${CONSOLE_PATH}records/${TARGET_ID}` },
  });
});

test("read-only removes the editor and leaves the value the book holds", async ({ page, lab, networkGuard: _guard }) => {
  await armVariant(lab, "admin-console", variantOf({ variantId: "read-only" }));
  await openConsole(page, lab.origin);
  await expect(page.getByTestId("read-only-banner")).toBeVisible();
  await page.getByTestId("record-search").fill(TARGET_COMPANY);
  await page.getByTestId("record-row").click();
  await expect(page.getByTestId("detail-heading")).toHaveText(TARGET_COMPANY);

  const cell = page.getByTestId("field-mrr");
  expect(await cell.evaluate((element) => element.tagName)).toBe("SPAN");
  await cell.click();
  // The step that types has nothing to resolve, which is what `target_not_found` means here.
  await expect(page.getByTestId("field-mrr-input")).toHaveCount(0);
  await expect(page.getByTestId("save-record")).toBeDisabled();
  await expect(page.getByTestId("unsaved-badge")).toHaveCount(0);
  expect(await cell.textContent()).toBe(resolveScenarioWorkflow(manifest, { variantId: "read-only" }).expected.finalState?.[0]?.value);
});

test("the settings workflow turns the digest on through the shadow-rooted switch", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin);
  await page.getByTestId("nav-settings").click();
  await page.getByTestId("settings-view").waitFor({ state: "visible" });
  // The settings screen replaces the customer screen rather than stacking under it.
  await expect(page.getByTestId("records-screen")).toBeHidden();
  await expect(page.getByTestId("record-row").first()).toBeHidden();
  await page.getByTestId("tab-notifications").click();
  await page.getByTestId("notifications-panel").waitFor({ state: "visible" });
  await page.getByTestId("digest-toggle").click();
  await expect(page.getByTestId("digest-status")).toHaveText("Weekly digest: on");
  expect(new URL(page.url()).pathname).toBe(`${CONSOLE_PATH}settings`);
  expect(await readFinalState<AdminConsoleState>(lab, "admin-console")).toMatchObject({
    oracle: { weeklyDigest: true, routePath: `${CONSOLE_PATH}settings?tab=notifications` },
  });
});

test("a deep link serves the same console and records the one route a request produced", async ({ page, lab, networkGuard: _guard }) => {
  await openConsole(page, lab.origin, `${CONSOLE_PATH}records/${TARGET_ID}`);
  await expect(page.getByTestId("detail-heading")).toHaveText(TARGET_COMPANY);
  await expect(page.getByTestId("field-mrr")).toHaveText(formatMoney(targetRecord?.mrrCents ?? 0));
  // The list is back at the top: a request cannot carry the client state a
  // pushState kept, which is the whole difference between the two ways here.
  expect(await page.getByTestId("list-viewport").evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.locator(`[data-record-id="${TARGET_ID}"]`)).toHaveCount(0);
  expect(await readFinalState<AdminConsoleState>(lab, "admin-console")).toMatchObject({
    openedRecordIds: [TARGET_ID],
    lastOperation: "route-changed",
  });
  const missing = await page.request.get(`${lab.origin}${CONSOLE_PATH}records/CUS-9999`);
  expect(missing.status()).toBe(404);
});
