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
    removeOrigin() {
      const row = rows[0];
      assert.ok(row);
      list.children.splice(list.children.indexOf(row), 1);
      row.parentElement = null;
    },
    detach() {
      const parent = button.parentElement;
      if (parent) parent.children.splice(parent.children.indexOf(button), 1);
      button.parentElement = null;
    }
  };
}

/** A clock that runs fast, so the settlement's observation window passes in a few real milliseconds. */
function fastClock(context: { mock: { method: (object: DateConstructor, name: "now", implementation: () => number) => unknown } }) {
  let clock = 0;
  context.mock.method(Date, "now", () => clock);
  const timer = setInterval(() => { clock += 100; }, 1);
  return { stop: () => clearInterval(timer) };
}

/** The loader pressed through `pressLoadMore` with the fixture's observers; `onPress` is the page's answer to press `n`. */
function pressThrough(fixture: ReturnType<typeof catalogue>, onPress: (press: number) => void) {
  let presses = 0;
  const click = (): void => {
    presses += 1;
    onPress(presses);
  };
  Object.defineProperty(fixture.control, "click", { value: click });
  const result = pressLoadMore({ mode: "loadMore", control: "#loader" }, {
    item: "#records > article.record", shown: fixture.rows, pagesRead: 1, scrolls: 0, deadline: undefined,
    hasUnreadItem: () => true
  }, undefined, (binding, control, deadline) => loaderSettlement.watch(binding, control, deadline, fixture.observers));
  return { result, presses: () => presses };
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
    assert.equal(watch.rejection(), undefined, "a genuine no-effect receipt has no rejection diagnostic");
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

test("started requests, unhealthy hooks, non-status effects and work still running never issue no-effect", async () => {
  const reasons = {
    request: "request_started", unhealthy: "request_probe_unhealthy",
    navigation: "non_change_signal", focus: "non_change_signal", pending: "work_pending"
  };
  for (const refusal of ["request", "unhealthy", "navigation", "focus", "pending"] as const) {
    const fixture = catalogue();
    if (refusal === "pending") fixture.state.work = refusal;
    if (refusal === "request") fixture.state.requested = true;
    if (refusal === "unhealthy") fixture.state.healthy = false;
    const watch = loaderSettlement.watch(fixture.binding, fixture.control, Date.now() + 60, fixture.observers);
    if (refusal === "navigation" || refusal === "focus") fixture.note(refusal);
    try {
      assert.equal(await watch.settle(), undefined, refusal);
      assert.equal(watch.rejection(), reasons[refusal]);
    }
    finally {
      watch.stop();
      assert.equal(watch.rejection(), reasons[refusal], "cleanup retains the actual refusal, including pending at deadline");
      fixture.restore();
    }
  }
});

// photo-social's giveaway thread (t904 2a): its Load more handler is `async`, which the press-work
// tracker cannot follow, so before t903 the proof never came and the thread could not be paged.
test("a press whose handler the tracker cannot follow is judged by the list: unchanged and settled, it issues the proof", async (context) => {
  const clock = fastClock(context);
  const fixture = catalogue();
  fixture.state.work = "unknown";
  const watch = loaderSettlement.watch(fixture.binding, fixture.control, undefined, fixture.observers);
  try {
    const fault = await watch.settle();
    assert.ok(fault instanceof PaginationFault);
    assert.equal(watch.rejection(), undefined);
  } finally {
    watch.stop();
    clock.stop();
    fixture.restore();
  }
});

test("unrecognized bindings and missing probes remain uncertain with closed diagnostics", async () => {
  for (const refusal of ["binding", "request", "work", "look", "health"] as const) {
    const fixture = catalogue();
    const observers = { ...fixture.observers };
    if (refusal === "request") observers.request = () => undefined;
    if (refusal === "work") observers.work = () => undefined;
    if (refusal === "look") observers.look = () => undefined;
    if (refusal === "health") observers.request = () => ({ begunSince: () => false });
    const binding = refusal === "binding" ? { control: fixture.control } : fixture.binding;
    const expected = {
      binding: "binding_unknown", request: "request_probe_missing", work: "work_probe_missing",
      look: "look_unavailable", health: "request_probe_unhealthy"
    };
    const watch = loaderSettlement.watch(binding, fixture.control, undefined, observers);
    try {
      assert.equal(await watch.settle(), undefined);
      assert.equal(JSON.stringify({ rejection: watch.rejection() }), JSON.stringify({ rejection: expected[refusal] }), "only a fixed code is exposed, without list or control data");
    } finally {
      watch.stop();
      fixture.restore();
    }
  }
});

test("changed origins and unsafe current controls retain their uncertainty at the command deadline", async (context) => {
  let clock = 0;
  context.mock.method(Date, "now", () => clock);
  for (const refusal of ["origin", "control"] as const) {
    const fixture = catalogue();
    const observers = { ...fixture.observers, uncovered: () => refusal !== "control" };
    const watch = loaderSettlement.watch(fixture.binding, fixture.control, clock + 1_000, observers);
    if (refusal === "origin") fixture.removeOrigin();
    clock += 900;
    const timer = setTimeout(() => { clock += 101; }, 5);
    try {
      assert.equal(await watch.settle(), undefined);
      assert.equal(watch.rejection(), refusal === "origin" ? "origin_changed" : "control_unsafe");
    } finally {
      clearTimeout(timer);
      watch.stop();
      fixture.restore();
    }
  }
});

test("a rejected settled-page look exposes its closed reason without issuing a private no-effect proof", async (context) => {
  let clock = 0;
  context.mock.method(Date, "now", () => clock);
  for (const reason of ["outside_change", "new_shadow", "unreadable", "not_restored", "deadline"] as const) {
    const fixture = catalogue();
    const observers = { ...fixture.observers, look: () => ({
      settle: async () => false,
      rejection: () => reason,
      stop: () => undefined
    }) };
    const watch = loaderSettlement.watch(fixture.binding, fixture.control, undefined, observers);
    clock += 900;
    try {
      assert.equal(await watch.settle(), undefined);
      assert.equal(watch.rejection(), `look_${reason}`);
      const request = { item: "#records > article.record" };
      const answer = { outcome: "failed", stop: "list_unchanged" };
      loaderSettlement.transfer(new PaginationFault("list_unchanged", `[loader-settlement:${watch.rejection()}]`), answer, request);
      assert.equal(loaderSettlement.consume(answer, request), false, "a diagnostic string cannot mint the private proof");
    } finally {
      watch.stop();
      assert.equal(watch.rejection(), `look_${reason}`);
      fixture.restore();
    }
  }
});

test("the actual unchanged fallback reports a fixed reason after one physical press", async (context) => {
  // Work the tracker still sees running holds the proof back, so the press is never made again.
  const clock = fastClock(context);
  const fixture = catalogue();
  fixture.state.work = "pending";
  let presses = 0;
  Object.defineProperty(fixture.control, "click", { value: () => { presses += 1; } });
  try {
    await assert.rejects(pressLoadMore({ mode: "loadMore", control: "#loader" }, {
      item: "#records > article.record", shown: fixture.rows, pagesRead: 1, scrolls: 0, deadline: undefined,
      hasUnreadItem: () => false
    }, undefined, (binding, control, deadline) => loaderSettlement.watch(binding, control, deadline, fixture.observers)), (error) => {
      assert.ok(error instanceof PaginationFault);
      assert.equal(error.stop, "list_unchanged");
      assert.match(error.message, /\[loader-settlement:work_pending\]$/u);
      return true;
    });
    assert.equal(presses, 1);
  } finally {
    clock.stop();
    fixture.restore();
  }
});

test("a loader that ignored its first press (an async handler) is pressed once more, and the second press's rows advance the list", async (context) => {
  const clock = fastClock(context);
  const fixture = catalogue();
  fixture.state.work = "unknown";
  try {
    const pressed = pressThrough(fixture, (press) => { if (press === 2) fixture.append(); });
    assert.deepEqual(await pressed.result, { outcome: "advanced", by: "loadMore" });
    assert.equal(pressed.presses(), 2);
  } finally {
    clock.stop();
    fixture.restore();
  }
});

test("a press that advanced the list is never pressed again: no page is skipped", async (context) => {
  const clock = fastClock(context);
  const fixture = catalogue();
  fixture.state.work = "unknown";
  try {
    const pressed = pressThrough(fixture, () => fixture.append());
    assert.deepEqual(await pressed.result, { outcome: "advanced", by: "loadMore" });
    assert.equal(pressed.presses(), 1);
  } finally {
    clock.stop();
    fixture.restore();
  }
});

test("a loader that ignores both presses fails with the private no-effect proof after the second, never a third", async (context) => {
  const clock = fastClock(context);
  const fixture = catalogue();
  fixture.state.work = "unknown";
  try {
    const pressed = pressThrough(fixture, () => undefined);
    const error = await pressed.result.then(() => undefined, (thrown: unknown) => thrown);
    assert.ok(error instanceof PaginationFault);
    assert.equal(error.stop, "list_unchanged");
    assert.doesNotMatch(error.message, /loader-settlement/u, "a proof, not a diagnostic");
    assert.equal(pressed.presses(), 2);
    const request = { item: "#records > article.record" };
    const answer = { outcome: "failed", stop: "list_unchanged" };
    loaderSettlement.transfer(error, answer, request);
    assert.equal(loaderSettlement.consume(answer, request), true, "Core is told the press certainly did nothing");
  } finally {
    clock.stop();
    fixture.restore();
  }
});

test("a press whose effect is unsure is not pressed again", async (context) => {
  const clock = fastClock(context);
  const fixture = catalogue();
  fixture.state.work = "unknown";
  fixture.state.requested = true;
  try {
    const pressed = pressThrough(fixture, () => undefined);
    await assert.rejects(pressed.result, (error) => error instanceof PaginationFault && /\[loader-settlement:request_started\]$/u.test(error.message));
    assert.equal(pressed.presses(), 1);
  } finally {
    clock.stop();
    fixture.restore();
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
