// T1 coverage of a list read that meets a page the server refused
// mid-pagination, across the documents the read spans.
//
// Live run `run-munnhi5q-4867dabe` read four of the everything store's five
// results pages. The fifth advance landed on its 429 page ("going a little too
// fast", no card, no pager), and the read stopped `list_vanished` and answered
// `truncated: false`, with eight of the thirteen expected records never read.
// The store refuses more than five results pages in eight seconds, and waiting
// as asked always works (`apps/scenario-lab/src/scenarios/everything-store/
// state/throttle.ts`).
//
// Each document is stood up as the reader sees it: a `querySelectorAll` naming
// items and controls, and a host that says how the document was served and
// stands in for the timer and `location.reload()`. A reload takes the script
// with it, which the stand-in does by throwing; the worker then re-sends the
// command with the last checkpoint (`runtime/extract-list-continuation.ts`),
// which the next call here does by hand. Real pages are
// `e2e/content/tests/extract-list.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { extractList } from "../list-reader";
import type { RefusedPageHost } from "../pagination";
import type { ExtractionCheckpoint } from "../../../shared/extraction-continuation";
import type { WebAutomationExtractListRequest } from "../../types";

/** One card: it answers `getAttribute` for `data-<key>` and has no ancestor. */
function card(values: Record<string, string>): Element {
  return { getAttribute: (name: string) => (name.startsWith("data-") ? values[name.slice(5)] ?? null : null), parentElement: null } as unknown as Element;
}

/** Stands a document up for one call: `rows` under `.row`, and each control selector naming its elements. */
function page(rows: Array<Record<string, string>>, controls: Record<string, Element[]> = {}): { restore(): void } {
  const saved = {
    document: (globalThis as Record<string, unknown>).document,
    element: (globalThis as Record<string, unknown>).HTMLElement,
    input: (globalThis as Record<string, unknown>).HTMLInputElement
  };
  const shown = rows.map(card);
  (globalThis as Record<string, unknown>).HTMLElement = class {};
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    querySelectorAll: (selector: string) => (selector === ".row" ? shown : controls[selector] ?? []),
    querySelector: (selector: string) => (selector === ".row" ? shown[0] ?? null : controls[selector]?.[0] ?? null)
  };
  return {
    restore: () => {
      (globalThis as Record<string, unknown>).document = saved.document;
      (globalThis as Record<string, unknown>).HTMLElement = saved.element;
      (globalThis as Record<string, unknown>).HTMLInputElement = saved.input;
    }
  };
}

/** A document served with `status`, whose waits are recorded and whose reload takes the script with it. */
function served(status: number | undefined): RefusedPageHost & { waited: number[]; reloads: number } {
  const host = {
    waited: [] as number[],
    reloads: 0,
    status: () => status,
    pause: async (ms: number) => { host.waited.push(ms); },
    reload: async () => {
      host.reloads += 1;
      throw new Error("the document was reloaded, and this script with it");
    }
  };
  return host;
}

const attribute = (name: string) => ({ kind: "attribute" as const, attribute: `data-${name}` });

/** The store's results read, in small: a title and a link per card, following Next. */
const RESULTS: WebAutomationExtractListRequest = {
  item: ".row",
  fields: { title: attribute("title"), url: attribute("url") },
  paginate: { mode: "next", next: ".next", maxPages: 10 }
};

/** What the four documents before the refused page handed over: two records a page. */
const FOUR_PAGES: ExtractionCheckpoint = {
  records: Array.from({ length: 8 }, (_, index) => ({ title: `T${index}`, url: `/t${index}` })),
  pagesRead: 4,
  scrolls: 0,
  missingFields: [],
  itemsSeen: 8
};

/** The fifth page, the last: two cards and no Next. */
const FIFTH_PAGE = [{ title: "T8", url: "/t8" }, { title: "T9", url: "/t9" }];

/** Reads the refused document, which must checkpoint and reload rather than answer, and returns the checkpoint it reloaded from. */
async function readRefused(status: number, resume: ExtractionCheckpoint): Promise<{ host: ReturnType<typeof served>; taken: ExtractionCheckpoint[] }> {
  const refused = page([]);
  const host = served(status);
  const taken: ExtractionCheckpoint[] = [];
  try {
    await assert.rejects(
      extractList(RESULTS, { resume, timeoutMs: 60_000, pageHost: host, checkpoint: async (progress) => { taken.push(progress); } }),
      /reloaded/u,
      "a refused page is reloaded, not answered as the list ending"
    );
  } finally {
    refused.restore();
  }
  return { host, taken };
}

test("a 429 mid-pagination is waited out and reloaded once, and the reloaded page completes the read", async () => {
  const { host, taken } = await readRefused(429, FOUR_PAGES);
  assert.deepEqual(host.waited, [8_500], "one wait, longer than the limiter's 8 s window");
  assert.equal(host.reloads, 1);
  assert.equal(taken.length, 1);
  // The reload goes on from exactly what this document was handed: the 429
  // page is not a page read, and it carries what the refusal spent.
  assert.deepEqual(taken[0], { ...FOUR_PAGES, refusals: { retries: 1, rateLimits: 1 } });

  const reloaded = page(FIFTH_PAGE);
  try {
    const outcome = await extractList(RESULTS, { resume: taken[0], timeoutMs: 40_000, pageHost: served(200) });
    assert.equal(outcome.records.length, 10, "every page's records");
    assert.deepEqual(outcome.records.slice(-2), FIFTH_PAGE);
    assert.equal(outcome.pagesRead, 5);
    assert.equal(outcome.truncated, false);
    assert.equal(outcome.paginationStop, "control_absent", "the list ended as lists end");
    assert.equal(outcome.pageRetries, 1, "the recovery is recorded");
    assert.equal("refusedStatus" in outcome, false);
  } finally {
    reloaded.restore();
  }
});

test("a 429 that never clears ends the read truncated, named, with every record already read and no third refusal risked", async () => {
  const { taken } = await readRefused(429, FOUR_PAGES);
  const stillRefused = page([]);
  const host = served(429);
  try {
    const outcome = await extractList(RESULTS, { resume: taken[0], timeoutMs: 40_000, pageHost: host, checkpoint: async () => {} });
    // The read's second 429: it stops rather than reload into a possible third.
    assert.equal(host.reloads, 0);
    assert.deepEqual(host.waited, []);
    assert.deepEqual(outcome.records, FOUR_PAGES.records, "the records already read are the answer");
    assert.equal(outcome.truncated, true);
    assert.equal(outcome.refusedStatus, 429);
    assert.equal(outcome.paginationStop, "list_vanished", "the domain's word until it admits rate_limited");
    assert.equal(outcome.pageRetries, 1);
    assert.equal(outcome.pagesRead, 4);
    assert.equal(outcome.itemsSeen, 8);
  } finally {
    stillRefused.restore();
  }
});

test("a 503 is retried up to the bound, waiting twice as long the second time, and then ends the read truncated", async () => {
  const { host: first, taken: once } = await readRefused(503, FOUR_PAGES);
  assert.deepEqual(first.waited, [8_500]);
  assert.deepEqual(once[0]?.refusals, { retries: 1, rateLimits: 0 });
  const { host: second, taken: twice } = await readRefused(503, once[0] as ExtractionCheckpoint);
  assert.deepEqual(second.waited, [17_000]);
  assert.deepEqual(twice[0]?.refusals, { retries: 2, rateLimits: 0 });
  const third = page([]);
  const host = served(503);
  try {
    const outcome = await extractList(RESULTS, { resume: twice[0], timeoutMs: 60_000, pageHost: host, checkpoint: async () => {} });
    assert.equal(host.reloads, 0);
    assert.equal(outcome.truncated, true);
    assert.equal(outcome.refusedStatus, 503);
    assert.equal(outcome.paginationStop, "list_vanished");
    assert.equal(outcome.records.length, 8);
  } finally {
    third.restore();
  }
});

test("a refused page the read cannot carry into a reload, or has no time to wait out, ends it truncated rather than losing it", async () => {
  for (const options of [{ timeoutMs: 60_000 }, { timeoutMs: 5_000, checkpoint: async () => {} }]) {
    const refused = page([]);
    const host = served(429);
    try {
      const outcome = await extractList(RESULTS, { resume: FOUR_PAGES, pageHost: host, ...options });
      assert.equal(host.reloads, 0, JSON.stringify(options));
      assert.equal(outcome.truncated, true);
      assert.equal(outcome.refusedStatus, 429);
      assert.equal(outcome.records.length, 8);
      assert.equal("pageRetries" in outcome, false);
    } finally {
      refused.restore();
    }
  }
});

test("where the browser gives no status, a page that lost the list is retried as a possible refusal", async () => {
  // A numbered pager with no page after the last read: the document holds still
  // on its pager (two seconds) and shows no card, which is the list lost.
  const numbered: WebAutomationExtractListRequest = { ...RESULTS, paginate: { mode: "numbered", pages: ".page", maxPages: 10 } };
  const pager = [{ getAttribute: () => null, textContent: "1" } as unknown as Element];
  const lost = page([], { ".page": pager });
  const host = served(undefined);
  const taken: ExtractionCheckpoint[] = [];
  try {
    await assert.rejects(extractList(numbered, { resume: FOUR_PAGES, timeoutMs: 60_000, pageHost: host, checkpoint: async (progress) => { taken.push(progress); } }), /reloaded/u);
    assert.deepEqual(host.waited, [8_500]);
    assert.deepEqual(taken[0], { ...FOUR_PAGES, refusals: { retries: 1, rateLimits: 1 } });
  } finally {
    lost.restore();
  }
  // And a page served whole that lost the list is not retried: it is named and truncated.
  const servedWhole = page([], { ".page": pager });
  try {
    const outcome = await extractList(numbered, { resume: FOUR_PAGES, timeoutMs: 60_000, pageHost: served(200), checkpoint: async () => {} });
    assert.equal(outcome.paginationStop, "list_vanished");
    assert.equal(outcome.truncated, true);
    assert.equal(outcome.pagesRead, 4, "a page that showed none of the list is not a page read");
    assert.equal(outcome.records.length, 8);
    assert.equal("refusedStatus" in outcome, false);
  } finally {
    servedWhole.restore();
  }
});
