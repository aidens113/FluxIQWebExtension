import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import { formatMoney } from "./format.js";
import { adminRecords, SHORT_BOOK_SIZE } from "./records.js";
import { LIST_OVERSCAN_ROWS, LIST_ROW_HEIGHT_PX, LIST_VIEWPORT_HEIGHT_PX } from "./styles.js";
import type { AdminRecord } from "./types.js";

/** The customer every workflow acts on: unique by company name, and row 128 of 240 -- far outside the render window. */
export const ADMIN_CONSOLE_TARGET = "CUS-0128";
const targetRecord = requireRecord(ADMIN_CONSOLE_TARGET);
const NEW_MRR_INPUT = "5400.00";
const NEW_MRR_TEXT = "$5,400.00";

/**
 * How far `browse-to-customer` scrolls the customer list. Row 128 begins at
 * 5,588px, so 5,500px puts it inside the mounted band with rows to spare on
 * both sides.
 */
const BROWSE_SCROLL_PX = 5_500;
/** Rows mounted with the list at rest, from the geometry in `styles.ts`: the band, plus one overscan below it. */
const ROWS_MOUNTED_AT_REST = Math.ceil(LIST_VIEWPORT_HEIGHT_PX / LIST_ROW_HEIGHT_PX) + LIST_OVERSCAN_ROWS;
/** A raw CSS target, because the row carries its id in a data attribute and not in a test id. */
const FAR_ROW = `[data-record-id="${ADMIN_CONSOLE_TARGET}"]`;

/**
 * The console as a run first meets it: the customer screen, nothing selected,
 * the whole book counted. Declared on each rendering that actually looks like
 * this rather than inherited, because a page fact describes the rendering it is
 * written on at the moment that rendering is first presented, and a variant
 * never inherits one. `read-only` and `short-book` change what the first
 * rendering says, so each states its own set below.
 */
const CONSOLE_START_FACTS: ExpectedFact[] = [
  { id: "whole-book-counted", subject: "list-summary", predicate: "text", value: `${adminRecords.length} records` },
  { id: "nothing-selected", subject: "detail-empty", predicate: "visible", value: true },
  { id: "settings-hidden", subject: "settings-view", predicate: "visible", value: false },
  { id: "workspace-named", subject: "workspace-name", predicate: "text", value: "Atlas Admin" },
];

const rowFields = {
  company: "testid:row-company",
  reference: "testid:row-contact",
  plan: "testid:row-plan",
  mrr: "testid:row-mrr",
};

/**
 * A CRM console: a virtualised customer list, a detail pane edited in place, and
 * a settings screen with tabs. Four workflows, each aimed at one property no
 * other fixture in this corpus has.
 *
 * **The primary workflow** searches the book down to one customer, opens it,
 * edits its revenue in place and saves. Opening the customer changes
 * `document.location` through `pushState`, so `on-record-route` in `finalState`
 * is an assertion about a URL that changed with no request and no document swap.
 * Its `read-only` variant removes the editor and keeps everything else, so the
 * typing step has nothing to resolve.
 *
 * **`extract-customer-list`** reads the whole book off the list. Its expected
 * record set is all ${adminRecords.length} customers, which is what the list
 * holds and not what it renders: only ${ROWS_MOUNTED_AT_REST} rows are mounted
 * at rest, and an extractor that reads the document sees those. The expectation
 * is written as the correct answer on purpose. `short-book` is its control --
 * twelve customers, every one of them mounted -- so a run that returns twelve
 * there and ${ROWS_MOUNTED_AT_REST} here has measured the virtualiser and not
 * the extractor.
 *
 * **`browse-to-customer`** reaches row 128 by scrolling instead of searching.
 * The list scrolls inside its own pane, not the document, which is what a
 * console with a fixed shell does; whether the scroll verb can move it is the
 * question the workflow asks.
 *
 * **`switch-settings-tab`** changes a tab -- `replaceState`, no navigation --
 * and then flips a switch that lives inside `<fx-toggle>`'s open shadow root.
 * `light-dom-toggle` is its control: the same test id, role and accessible name
 * on an ordinary button in the light DOM, and nothing else changed.
 */
export const adminConsoleManifest = createScenarioManifest({
  id: "admin-console",
  title: "Admin console",
  tags: ["crm", "virtualised-list", "shadow-dom", "client-routing", "inline-edit", "extraction"],
  seed: 112,
  startPath: "/scenarios/admin-console/",
  capabilities: ["forms", "scroll", "mutation"],
  recordingScript: [
    { id: "search-customers", operation: "type", target: "testid:record-search", value: targetRecord.company },
    { id: "match-listed", operation: "waitForState", target: "testid:record-row", timeoutMs: 3000 },
    { id: "open-customer", operation: "click", target: "testid:record-row" },
    { id: "detail-open", operation: "waitForState", target: "testid:detail-heading", timeoutMs: 3000 },
    { id: "open-mrr-editor", operation: "click", target: "testid:field-mrr" },
    { id: "type-new-mrr", operation: "type", target: "testid:field-mrr-input", value: NEW_MRR_INPUT },
    { id: "commit-mrr", operation: "press", target: "testid:field-mrr-input", value: "Enter" },
    { id: "save-customer", operation: "click", target: "testid:save-record" },
    { id: "change-saved", operation: "waitForState", target: "testid:saved-marker", timeoutMs: 3000 },
    { id: "account-updated", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: CONSOLE_START_FACTS,
    recordingEvents: [{ type: "web.element.input_changed" }, { type: "web.element.clicked" }, { type: "web.keyboard.pressed" }],
    actions: [
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.click", outcome: "succeeded" },
      { action: "web.dom.keypress", outcome: "succeeded" },
    ],
    finalState: [
      { id: "on-record-route", subject: "document", predicate: "path", value: `/scenarios/admin-console/records/${ADMIN_CONSOLE_TARGET}` },
      { id: "detail-shows-customer", subject: "detail-heading", predicate: "text", value: targetRecord.company },
      { id: "revenue-committed", subject: "field-mrr", predicate: "text", value: NEW_MRR_TEXT },
      { id: "row-shows-new-revenue", subject: "row-mrr", predicate: "text", value: NEW_MRR_TEXT },
      { id: "one-change-saved", subject: "save-status", predicate: "text", value: "Saved 1 change" },
      { id: "nothing-left-unsaved", subject: "unsaved-badge", predicate: "exists", value: false },
    ],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "read-only",
    description: "The workspace grants read access only: the revenue cell renders as text with no editor behind it, so the step that types into the editor has no target to resolve.",
    arm: { operation: "set-variant", payload: { variant: "read-only" } },
    expected: {
      pageFacts: [
        { id: "read-only-declared", subject: "read-only-banner", predicate: "visible", value: true },
        { id: "whole-book-still-counted", subject: "list-summary", predicate: "text", value: `${adminRecords.length} records` },
        { id: "nothing-selected-yet", subject: "detail-empty", predicate: "visible", value: true },
      ],
      finalState: [
        { id: "revenue-unchanged", subject: "field-mrr", predicate: "text", value: formatMoney(targetRecord.mrrCents) },
        { id: "no-editor-opened", subject: "field-mrr-input", predicate: "exists", value: false },
        { id: "nothing-unsaved", subject: "unsaved-badge", predicate: "exists", value: false },
      ],
      failure: { category: "target_not_found" },
    },
  }],
  workflows: [
    {
      id: "extract-customer-list",
      description: `Read every customer off the list: company, reference, plan, and revenue for all ${adminRecords.length} of them.`,
      recordingScript: [
        { id: "read-customer-book", operation: "extract", target: "testid:record-row", fields: rowFields },
        { id: "book-read", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: CONSOLE_START_FACTS,
        extracted: [{ step: "read-customer-book", count: adminRecords.length, records: rowRecords(adminRecords) }],
        finalState: [{ id: "book-count-unchanged", subject: "list-summary", predicate: "text", value: `${adminRecords.length} records` }],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "short-book",
        description: `The book shrinks to ${SHORT_BOOK_SIZE} customers, which is fewer than the list's render window, so every row is mounted and the same extraction returns all of them.`,
        arm: { operation: "set-variant", payload: { variant: "short-book" } },
        expected: {
          pageFacts: [
            { id: "short-book-counted", subject: "list-summary", predicate: "text", value: `${SHORT_BOOK_SIZE} records` },
            { id: "short-book-nothing-selected", subject: "detail-empty", predicate: "visible", value: true },
          ],
          extracted: [{ step: "read-customer-book", count: SHORT_BOOK_SIZE, records: rowRecords(adminRecords.slice(0, SHORT_BOOK_SIZE)) }],
          finalState: [{ id: "short-book-count", subject: "list-summary", predicate: "text", value: `${SHORT_BOOK_SIZE} records` }],
        },
      }],
    },
    {
      id: "browse-to-customer",
      description: "Reach customer 128 by scrolling the list rather than searching for it, then open it. The list scrolls inside its own pane, not the document.",
      recordingScript: [
        { id: "scroll-customer-list", operation: "scroll", value: BROWSE_SCROLL_PX },
        { id: "far-row-mounted", operation: "waitForState", target: FAR_ROW, timeoutMs: 5000 },
        { id: "open-far-customer", operation: "click", target: FAR_ROW },
        { id: "far-detail-open", operation: "waitForState", target: "testid:detail-heading", timeoutMs: 3000 },
        { id: "far-customer-open", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: CONSOLE_START_FACTS,
        recordingEvents: [{ type: "web.scroll.changed" }],
        actions: [{ action: "web.dom.scroll", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
        finalState: [
          { id: "browsed-to-record-route", subject: "document", predicate: "path", value: `/scenarios/admin-console/records/${ADMIN_CONSOLE_TARGET}` },
          { id: "browsed-detail-shows-customer", subject: "detail-heading", predicate: "text", value: targetRecord.company },
        ],
        allowedConsoleErrors: [],
      },
    },
    {
      id: "switch-settings-tab",
      description: "Open settings, switch to the Notifications tab, and turn the weekly digest on. Both route changes are same-document; the switch lives inside a web component's shadow root.",
      recordingScript: [
        { id: "open-settings", operation: "click", target: "testid:nav-settings" },
        { id: "settings-shown", operation: "waitForState", target: "testid:settings-view", timeoutMs: 3000 },
        { id: "choose-notifications", operation: "click", target: "testid:tab-notifications" },
        { id: "notifications-shown", operation: "waitForState", target: "testid:notifications-panel", timeoutMs: 3000 },
        { id: "turn-digest-on", operation: "click", target: "testid:digest-toggle" },
        { id: "digest-confirmed", operation: "waitForState", target: "testid:digest-status", timeoutMs: 3000 },
        { id: "preference-changed", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: CONSOLE_START_FACTS,
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }],
        finalState: [
          { id: "on-settings-route", subject: "document", predicate: "path", value: "/scenarios/admin-console/settings" },
          { id: "notifications-tab-open", subject: "notifications-panel", predicate: "visible", value: true },
          { id: "digest-on", subject: "digest-status", predicate: "text", value: "Weekly digest: on" },
        ],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "light-dom-toggle",
        description: "The same switch, with the same test id, role and accessible name, rendered as an ordinary button in the light DOM instead of inside the shadow root. Nothing else about the page changes.",
        arm: { operation: "set-variant", payload: { variant: "light-dom-toggle" } },
        expected: {
          pageFacts: [
            ...CONSOLE_START_FACTS,
            { id: "digest-off-at-load", subject: "digest-status", predicate: "text", value: "Weekly digest: off" },
            { id: "switch-in-light-dom", subject: "digest-toggle", predicate: "exists", value: true },
          ],
          finalState: [
            { id: "light-dom-settings-route", subject: "document", predicate: "path", value: "/scenarios/admin-console/settings" },
            { id: "light-dom-digest-on", subject: "digest-status", predicate: "text", value: "Weekly digest: on" },
          ],
        },
      }],
    },
  ],
  evidencePolicy: { screenshots: "events", trace: "failure", video: "failure", sampleFps: 0, reviewRequired: false },
});

/** What one list row reads as: the row's own text, formatted exactly as the page writes it. */
function rowRecords(records: readonly AdminRecord[]): Array<Record<string, string>> {
  return records.map((record) => ({
    company: record.company,
    reference: `${record.id} · ${record.contact}`,
    plan: record.plan,
    mrr: formatMoney(record.mrrCents),
  }));
}

function requireRecord(id: string): AdminRecord {
  const found = adminRecords.find((record) => record.id === id);
  if (!found) throw new Error(`admin-console manifest names an unknown record: ${id}`);
  return found;
}
