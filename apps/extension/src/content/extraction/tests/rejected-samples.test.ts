// T1 coverage of the rows a read keeps aside for the exploring model: which
// condition rejected them, only when asked, every one whole, and carried across
// the documents of a multi-page read (`../rejected-samples.ts`).
//
// The page is the stand-in `list-reader.test.ts` uses: items that answer
// `getAttribute` under `.row`. A continued read is used so the reader goes
// straight to the rows rather than through the first page's waits, which need
// a real document; a `loadMore` control stands in for the move that checkpoints.

import assert from "node:assert/strict";
import test from "node:test";
import { extractList } from "../list-reader";
import { rejectedSamplesFor } from "../rejected-samples";
import { readExtractionCheckpoint, type ExtractionCheckpoint } from "../../../shared/extraction-continuation";
import type { WebAutomationExtractListRequest } from "../../types";
import type { WebAutomationExtractionRejectionObservation } from "@fluxiq-web-extension/domain/client";

test("equal record fields retain contradictory helper observations from a single read", async () => {
  scoreReads = 0;
  const page = fakePage([{ name: "Record A" }, { name: "Record A", score: "" }, { name: "Record A", score: "7" }]);
  try {
    const request: WebAutomationExtractListRequest = { item: ".row", fields: { name: { kind: "attribute", attribute: "data-name" } }, where: [{ read: { kind: "attribute", attribute: "data-score" }, atLeast: 12 }] };
    const result = await extractList(request, { resume: START, sampleRejected: true });
    assert.equal(result.rejectedSamples?.[0]?.length, 3);
    assert.deepEqual(result.rejectedObservations?.[0]?.map((entry) => entry?.state), ["absent", "present", "present"]);
    assert.deepEqual(result.rejectedObservations?.[0]?.map((entry) => entry?.value), [undefined, "", "7"]);
    assert.deepEqual(result.rejectedObservations?.[0]?.map((entry) => entry?.item), [1, 2, 3]);
    assert.ok(result.rejectedObservations?.[0]?.every((entry) => entry?.page === 1 && entry.source === "read"));
    assert.equal(scoreReads, 3, "the helper is evaluated once per item, not reread for the companion");
  } finally { page.restore(); }
});

test("a throwing helper read remains an item fault and produces no absent witness", async () => {
  const page = fakePage([{ name: "Record A", score: "throw-for-test" }]);
  try {
    const result = await extractList({ item: ".row", fields: { name: { kind: "attribute", attribute: "data-name" } }, where: [{ read: { kind: "attribute", attribute: "data-score" }, is: "present" }] }, { resume: START, sampleRejected: true });
    assert.equal(result.itemFaults, 1);
    assert.deepEqual(result.rejectedSamples, [[]]);
    assert.equal(result.rejectedObservations, undefined);
  } finally { page.restore(); }
});

test("collector keeps multi-rejection observations aligned through continuation", () => {
  const make = (conditionIndex: number, value: string): WebAutomationExtractionRejectionObservation => ({ conditionIndex, state: "present", value, source: "field", readKind: "text", page: 1, item: 1 });
  const samples = rejectedSamplesFor(true, 2, undefined)!;
  samples.note([0, 1], { name: "Record A" }, [make(0, "17"), make(1, "blocked")]);
  samples.note([0], { name: "Record B" }, [make(0, "")]);
  const resumed = rejectedSamplesFor(true, 2, samples.rows(), samples.alone(), samples.observations())!;
  assert.deepEqual(resumed.rows(), samples.rows());
  assert.deepEqual(resumed.observations(), samples.observations());
  assert.deepEqual(resumed.alone(), [1, 0]);
  resumed.note([0], { name: "Record B" }, [{ ...make(0, "18"), page: 2 }]);
  assert.equal(resumed.rows()[0]?.length, 3);
  assert.equal(resumed.observations()?.[0]?.length, 3);
});

let scoreReads = 0;
function fakeRow(values: Record<string, string>): Element {
  return { getAttribute: (name: string) => {
    if (name === "data-score") {
      scoreReads += 1;
      if (values.score === "throw-for-test") throw new Error("Neutral read failure");
    }
    return name.startsWith("data-") ? values[name.slice(5)] ?? null : null;
  }, parentElement: null } as unknown as Element;
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

test("every rejected row is kept, every value whole, and a row seen twice is one row", async () => {
  const long = (index: number) => ({ name: `Earbuds charging case ${index} ${"x".repeat(5_000)}`, price: "$1" });
  const many = Array.from({ length: 40 }, (_unused, index) => long(index + 2));
  const page = fakePage([long(1), long(1), ...many]);
  try {
    const outcome = await extractList(EARBUDS, { resume: START, sampleRejected: true });
    const rows = outcome.rejectedSamples?.[1] ?? [];
    // Forty-one distinct rows, the duplicate said once: no count cap.
    assert.equal(rows.length, 41);
    assert.deepEqual(rows.map((row) => row.name), [long(1), ...many].map((row) => row.name));
    // No character cut.
    assert.ok(rows.every((row) => (row.name ?? "").length > 5_000));
    assert.deepEqual(outcome.rejectedSamples?.[0], []);
  } finally {
    page.restore();
  }
});

test("samples survive a multi-page read: the checkpoint carries them and the next document goes on from them, all of them", async () => {
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
  // The next document: it starts from what was carried and adds every new row.
  const carried: ExtractionCheckpoint = { ...START, pagesRead: 1, rejectedSamples: taken[0]?.rejectedSamples ?? [], rejectedSamplesAlone: taken[0]?.rejectedSamplesAlone ?? [], conditions: { applied: 4, kept: 1, rejected: [1, 2] } };
  const next = fakePage([{ name: "Silicone ear tips", price: "$4" }, { name: "Earbuds charging case", price: "$5" }]);
  try {
    const outcome = await extractList(EARBUDS, { resume: carried, sampleRejected: true });
    assert.deepEqual(outcome.rejectedSamples?.[1]?.map((row) => row.name), ["Pro Earbuds Wireless Charging Case", "Foam ear tips", "Silicone ear tips", "Earbuds charging case"]);
    assert.deepEqual(outcome.rejectedSamples?.[0]?.map((row) => row.name), ["Sponsored earbuds"]);
  } finally {
    next.restore();
  }
});

/**
 * `run-mup2u8o3-6697c4be` in small, over two documents: a row both conditions
 * reject says nothing about either, and a true pair named "... with Wireless
 * Charging Case" that only the accessory rule rejects is the row that shows the
 * rule is wrong.
 */
const PAGE_ONE = [
  { name: "Basic Earbuds", price: "$19" },
  { name: "Sponsored charging case", price: "$12", sponsored: "yes" },
  { name: "Pro Earbuds Wireless Charging Case", price: "$39" },
  { name: "Sponsored earbuds", price: "$29", sponsored: "yes" }
];
const PAGE_TWO = [
  { name: "Ultra Earbuds with Wireless Charging Case", price: "$59" },
  { name: "Sponsored ear tips", price: "$4", sponsored: "yes" }
];

test("a two-page read says which rows each condition removed alone, leads each list with them, and carries both across documents", async () => {
  const taken: ExtractionCheckpoint[] = [];
  const first = fakePage(PAGE_ONE);
  try {
    await extractList(
      { ...EARBUDS, paginate: { mode: "loadMore", control: ".more", maxPages: 2 } },
      { resume: START, sampleRejected: true, checkpoint: async (progress) => { taken.push(progress); } }
    );
  } finally {
    first.restore();
  }
  // Page one's checkpoint: the accessory rule removed one row alone, the sponsored one one.
  assert.deepEqual(taken[0]?.conditions?.alone, [1, 1]);
  assert.deepEqual(taken[0]?.rejectedSamplesAlone, [1, 1]);
  // The worker reads it back through the message boundary before the next document goes on from it.
  const carried = readExtractionCheckpoint(JSON.parse(JSON.stringify(taken[0])));
  assert.ok(carried);
  const second = fakePage(PAGE_TWO);
  try {
    const outcome = await extractList(EARBUDS, { resume: { ...carried, pagesRead: 1 }, sampleRejected: true });
    assert.deepEqual(outcome.conditions?.rejected, [3, 4]);
    assert.deepEqual(outcome.conditions?.alone, [1, 2]);
    // The alone rows lead each list, across both documents, then the rows another condition also rejected.
    assert.deepEqual(outcome.rejectedSamples?.[1]?.map((row) => row.name), [
      "Pro Earbuds Wireless Charging Case",
      "Ultra Earbuds with Wireless Charging Case",
      "Sponsored charging case",
      "Sponsored ear tips"
    ]);
    assert.deepEqual(outcome.rejectedSamplesAlone, [1, 2]);
    assert.deepEqual(outcome.rejectedSamples?.[0]?.map((row) => row.name), ["Sponsored earbuds", "Sponsored charging case", "Sponsored ear tips"]);
  } finally {
    second.restore();
  }
});

test("a read nobody asked for samples still counts the rows each condition removed alone", async () => {
  const page = fakePage(PAGE_ONE);
  try {
    const outcome = await extractList(EARBUDS, { resume: START });
    assert.equal(outcome.rejectedSamples, undefined);
    assert.equal(outcome.rejectedSamplesAlone, undefined);
    assert.deepEqual(outcome.conditions?.alone, [1, 1]);
  } finally {
    page.restore();
  }
});

test("a row said once is said in the more telling place: seen beside another condition, then alone, it moves to the alone rows", () => {
  const samples = rejectedSamplesFor(true, 2, undefined);
  const row = { name: "Pro Earbuds Wireless Charging Case" };
  samples?.note([0, 1], row);
  samples?.note([1], { name: "Foam ear tips" });
  samples?.note([1], row);
  samples?.note([0, 1], row);
  assert.deepEqual(samples?.rows()[1], [{ name: "Foam ear tips" }, row]);
  assert.deepEqual(samples?.alone(), [0, 2]);
  assert.deepEqual(samples?.rows()[0], [row]);
  // A checkpoint from a page build that did not order its rows counts none of them alone.
  const old = rejectedSamplesFor(true, 2, [[row], [row]], undefined);
  assert.deepEqual(old?.alone(), [0, 0]);
  assert.deepEqual(rejectedSamplesFor(true, 2, [[row], [row]], [1, 0])?.alone(), [1, 0]);
});
