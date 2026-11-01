import assert from "node:assert/strict";
import test from "node:test";
import { listGrowth, loadMoreContinuations, loaderSettlement } from "..";
import { pressLoadMore } from "../../load-more";
import { PaginationFault } from "../../pagination-fault";
import { asElements, el, page } from "../../../tests/selector-page";
import type { PressSignal } from "../../../../action-runtime/ignored-press";

function catalogue() {
  const rows = [el("article", { class: "record" }, "Archive A"), el("article", { class: "record" }, "Archive B")];
  const list = el("div", { id: "records" }, rows);
  const button = el("button", { id: "loader", type: "button" }, "Show more records");
  const matches = button.matches.bind(button);
  button.matches = (selector) => selector === ":disabled" ? false : matches(selector);
  const stood = page(el("body", {}, [el("section", {}, [list, button])]));
  const control = asElements([button])[0]!;
  const binding = loadMoreContinuations.bind(control, "#records > article.record", asElements(rows));
  const state: { work: "unknown" | "pending" | "idle"; healthy: boolean; requested: boolean; restored: boolean | "announced" } = {
    work: "idle", healthy: true, requested: false, restored: "announced"
  };
  let note: ((signal: PressSignal) => void) | undefined;
  let stops = 0;
  const observers: NonNullable<Parameters<typeof loaderSettlement.watch>[3]> = {
    request: () => ({ begunSince: () => state.requested, healthy: () => state.healthy }),
    work: () => ({ state: () => state.work, stop: () => { stops += 1; } }),
    listen: (_control, report) => {
      note = report;
      return { flush: () => undefined, stop: () => { stops += 1; } };
    },
    look: () => ({ settle: async () => state.restored, stop: () => { stops += 1; } }),
    uncovered: () => true
  };
  return {
    control, binding, state, observers, rows: asElements(rows), restore: stood.restore, stops: () => stops,
    note: (signal: PressSignal) => note?.(signal),
    append(attributes: Record<string, string> = { class: "record" }) {
      const row = el("article", attributes, "Archive C");
      row.parentElement = list;
      list.children.push(row);
    },
    detach() {
      const parent = button.parentElement;
      if (parent) parent.children.splice(parent.children.indexOf(button), 1);
      button.parentElement = null;
    }
  };
}

const MARKERS: ReadonlyArray<Record<string, string>> = [{ "data-skeleton": "" }, { "aria-busy": "true" }, { role: "progressbar" }];
for (const marker of MARKERS) test(`matching ${Object.keys(marker)[0]} loading markers cannot become fallback list progress`, () => {
  const fixture = catalogue();
  try {
    fixture.append(Object.assign({ class: "record" }, marker));
    assert.equal(listGrowth.added("#records > article.record", fixture.rows), false);
    assert.equal(loadMoreContinuations.state(fixture.binding), "unknown");
    fixture.append();
    assert.equal(listGrowth.added("#records > article.record", fixture.rows), true);
    assert.equal(loadMoreContinuations.state(fixture.binding), "unknown", "an unresolved loading marker still prevents a completed page");
  } finally { fixture.restore(); }
});

for (const stopped of ["placeholder", "detached"] as const) test(`the real loader fallback does not return advanced for ${stopped}`, async () => {
  const fixture = catalogue();
  fixture.state.work = "unknown";
  let presses = 0;
  Object.defineProperty(fixture.control, "click", { value: () => {
    presses += 1;
    if (stopped === "placeholder") fixture.append({ class: "record", "data-skeleton": "", "aria-hidden": "true" });
    else fixture.detach();
  } });
  try {
    const result = await pressLoadMore({ mode: "loadMore", control: "#loader" }, {
      item: "#records > article.record", shown: fixture.rows, pagesRead: 1, scrolls: 0, deadline: Date.now() + 80,
      hasUnreadItem: () => true
    }, undefined, (binding, control, deadline) => loaderSettlement.watch(binding, control, deadline, fixture.observers));
    assert.equal(result.outcome, "timed_out");
    assert.equal(presses, 1);
  } finally { fixture.restore(); }
});

test("only genuine unchanged status-only settlement transfers a private single-use no-effect proof", async () => {
  const fixture = catalogue();
  const watch = loaderSettlement.watch(fixture.binding, fixture.control, undefined, fixture.observers);
  try {
    fixture.note("change");
    const fault = await watch.settle();
    assert.ok(fault instanceof PaginationFault);
    const request = { item: "#records > article.record" };
    const answer = { outcome: "failed", stop: "list_unchanged" };
    loaderSettlement.transfer(new PaginationFault("list_unchanged", fault.message), answer, request);
    assert.equal(loaderSettlement.consume(answer, request), false, "a matching error message carries no proof");
    loaderSettlement.transfer(fault, answer, request);
    assert.equal(loaderSettlement.consume({ outcome: "failed", stop: "list_unchanged" }, request), false, "a copied answer carries no proof");
    assert.equal(loaderSettlement.consume(answer, request), true);
    assert.equal(loaderSettlement.consume(answer, request), false, "the original proof is consumed exactly once");
  } finally {
    watch.stop();
    watch.stop();
    assert.equal(fixture.stops(), 3, "all watches stop exactly once");
    fixture.restore();
  }
});

test("a late observed move settles the original checkpoint without authorizing another advance", async () => {
  const fixture = catalogue();
  fixture.state.work = "pending";
  const watch = loaderSettlement.watch(fixture.binding, fixture.control, Date.now() + 1000, fixture.observers);
  const timer = setTimeout(() => fixture.append(), 30);
  try {
    assert.equal(await watch.settle(), "advanced");
    assert.equal(loadMoreContinuations.current(fixture.binding), undefined);
  } finally {
    clearTimeout(timer);
    watch.stop();
    fixture.restore();
  }
});

test("unknown work, started requests, unhealthy hooks and non-status effects never issue no-effect", async () => {
  for (const refusal of ["unknown", "request", "unhealthy", "navigation", "focus", "pending"] as const) {
    const fixture = catalogue();
    if (refusal === "unknown" || refusal === "pending") fixture.state.work = refusal;
    if (refusal === "request") fixture.state.requested = true;
    if (refusal === "unhealthy") fixture.state.healthy = false;
    const watch = loaderSettlement.watch(fixture.binding, fixture.control, Date.now() + 60, fixture.observers);
    if (refusal === "navigation" || refusal === "focus") fixture.note(refusal);
    try { assert.equal(await watch.settle(), undefined, refusal); }
    finally {
      watch.stop();
      fixture.restore();
    }
  }
});

test("a changed original list invalidates an issued outcome before action consumption", async () => {
  const fixture = catalogue();
  const watch = loaderSettlement.watch(fixture.binding, fixture.control, undefined, fixture.observers);
  try {
    const fault = await watch.settle();
    assert.ok(fault instanceof PaginationFault);
    const request = { item: "#records > article.record" };
    const answer = { outcome: "failed" };
    loaderSettlement.transfer(fault, answer, request);
    fixture.append();
    assert.equal(loaderSettlement.consume(answer, request), false);
  } finally {
    watch.stop();
    fixture.restore();
  }
});
