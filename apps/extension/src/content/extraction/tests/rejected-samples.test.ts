// T1 coverage of the rows a read keeps aside for the exploring model: which
// condition rejected them, only when asked, bounded, and carried across the
// documents of a multi-page read (`../rejected-samples.ts`).
//
// The page is the stand-in `list-reader.test.ts` uses: items that answer
// `getAttribute` under `.row`. A continued read is used so the reader goes
// straight to the rows rather than through the first page's waits, which need
// a real document; a `loadMore` control stands in for the move that checkpoints.

import assert from "node:assert/strict";
import test from "node:test";
import { extractList } from "../list-reader";
import type { ExtractionCheckpoint } from "../../../shared/extraction-continuation";
import type { WebAutomationExtractListRequest } from "../../types";

function fakeRow(values: Record<string, string>): Element {
  return { getAttribute: (name: string) => (name.startsWith("data-") ? values[name.slice(5)] ?? null : null), parentElement: null } as unknown as Element;
}

/** Stands the rows up under `.row`, with a `.more` control whose click adds `more`, for one test. */
function fakePage(rows: Array<Record<string, string>>, more: Array<Record<string, string>> = []): { restore(): void } {
  const saved = {
    document: (globalThis as Record<string, unknown>).document,
    element: (globalThis as Record<string, unknown>).HTMLElement,
    input: (globalThis as Record<string, unknown>).HTMLInputElement
  };
  const shown = rows.map(fakeRow);
  class FakeElement {}
  (globalThis as Record<string, unknown>).HTMLElement = FakeElement;
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  const button = Object.assign(new FakeElement(), {
    matches: () => false,
    getAttribute: () => null,
    isConnected: true,
    click: () => { shown.push(...more.splice(0).map(fakeRow)); }
  });
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    querySelectorAll: (selector: string) => (selector === ".row" ? shown : []),
    querySelector: (selector: string) => (selector === ".more" ? button : null)
  };
  return {
    restore: () => {
      (globalThis as Record<string, unknown>).document = saved.document;
      (globalThis as Record<string, unknown>).HTMLElement = saved.element;
      (globalThis as Record<string, unknown>).HTMLInputElement = saved.input;
    }
  };
}

const attribute = (name: string) => ({ kind: "attribute" as const, attribute: `data-${name}` });

/** The everything-store read of `run-munq5s8x-6d620cdf`, in small: not sponsored, and no accessories by name. */
const EARBUDS: WebAutomationExtractListRequest = {
  item: ".row",
  fields: { name: attribute("name"), price: attribute("price") },
  where: [{ read: attribute("sponsored"), is: "absent" }, { field: "name", contains: ["ear tips", "charging case"], not: true }]
};

const START: ExtractionCheckpoint = { records: [], pagesRead: 0, scrolls: 0, missingFields: [], itemsSeen: 0 };

const PAGE = [
  { name: "Basic Earbuds", price: "$19" },
  { name: "Pro Earbuds Wireless Charging Case", price: "$39" },
  { name: "Foam ear tips", price: "$9" },
  { name: "Sponsored earbuds", price: "$29", sponsored: "yes" }
];

test("a read asked for samples says which rows each condition rejected, the true earbuds among them", async () => {
  const page = fakePage(PAGE);
  try {
    const outcome = await extractList(EARBUDS, { resume: START, sampleRejected: true });
    assert.deepEqual(outcome.records, [{ name: "Basic Earbuds", price: "$19" }]);
    assert.deepEqual(outcome.rejectedSamples, [
      [{ name: "Sponsored earbuds", price: "$29" }],
      [{ name: "Pro Earbuds Wireless Charging Case", price: "$39" }, { name: "Foam ear tips", price: "$9" }]
    ]);
    // The counts are what they were; the samples sit beside them.
    assert.deepEqual(outcome.conditions?.rejected, [1, 2]);
  } finally {
    page.restore();
  }
});

test("a read nobody asked for samples keeps none, in its outcome or its checkpoint", async () => {
  const taken: ExtractionCheckpoint[] = [];
  const page = fakePage(PAGE, [{ name: "Earbuds charging case", price: "$5" }]);
  try {
    const outcome = await extractList(
      { ...EARBUDS, paginate: { mode: "loadMore", control: ".more", maxPages: 2 } },
      { resume: START, checkpoint: async (progress) => { taken.push(progress); } }
    );
    assert.equal(outcome.rejectedSamples, undefined);
    assert.ok(taken.length > 0);
    assert.equal(taken.some((progress) => progress.rejectedSamples !== undefined), false);
  } finally {
    page.restore();
  }
  // The same page, asked: the difference is the request, not the page.
  const asked = fakePage(PAGE);
  try {
    assert.notEqual((await extractList(EARBUDS, { resume: START, sampleRejected: true })).rejectedSamples, undefined);
  } finally {
    asked.restore();
  }
});

test("at most three rows per condition, each value cut to eighty characters, and a row seen twice is one sample", async () => {
  const long = (index: number) => ({ name: `Earbuds charging case ${index} ${"x".repeat(200)}`, price: "$1" });
  const page = fakePage([long(1), long(1), long(2), long(3), long(4), long(5)]);
  try {
    const outcome = await extractList(EARBUDS, { resume: START, sampleRejected: true });
    const rows = outcome.rejectedSamples?.[1] ?? [];
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((row) => row.name?.slice(0, 24)), ["Earbuds charging case 1 ", "Earbuds charging case 2 ", "Earbuds charging case 3 "]);
    assert.ok(rows.every((row) => (row.name ?? "").length === 80));
    assert.deepEqual(outcome.rejectedSamples?.[0], []);
  } finally {
    page.restore();
  }
});

test("samples survive a multi-page read: the checkpoint carries them and the next document goes on from them, still bounded", async () => {
  const taken: ExtractionCheckpoint[] = [];
  const page = fakePage(PAGE, [{ name: "Silicone ear tips", price: "$4" }]);
  try {
    await extractList(
      { ...EARBUDS, paginate: { mode: "loadMore", control: ".more", maxPages: 2 } },
      { resume: START, sampleRejected: true, checkpoint: async (progress) => { taken.push(progress); } }
    );
    // The checkpoint written before the control was followed holds page one's samples.
    assert.deepEqual(taken[0]?.rejectedSamples?.[1]?.map((row) => row.name), ["Pro Earbuds Wireless Charging Case", "Foam ear tips"]);
  } finally {
    page.restore();
  }
  // The next document: it starts from what was carried and stops at three.
  const carried: ExtractionCheckpoint = { ...START, pagesRead: 1, rejectedSamples: taken[0]?.rejectedSamples ?? [], conditions: { applied: 4, kept: 1, rejected: [1, 2] } };
  const next = fakePage([{ name: "Silicone ear tips", price: "$4" }, { name: "Earbuds charging case", price: "$5" }]);
  try {
    const outcome = await extractList(EARBUDS, { resume: carried, sampleRejected: true });
    assert.deepEqual(outcome.rejectedSamples?.[1]?.map((row) => row.name), ["Pro Earbuds Wireless Charging Case", "Foam ear tips", "Silicone ear tips"]);
    assert.deepEqual(outcome.rejectedSamples?.[0]?.map((row) => row.name), ["Sponsored earbuds"]);
  } finally {
    next.restore();
  }
});
