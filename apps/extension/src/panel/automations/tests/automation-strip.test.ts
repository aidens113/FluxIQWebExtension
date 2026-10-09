import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelStore } from "../../state";
import type { AutomationsController, AutomationsState } from "../controller";
import { createAutomationStrip } from "../automation-strip";

async function focused(body: (doc: { activeElement: FakeElement; focusCalls: number }) => void | Promise<void>) {
  await withFakeDocument(async () => {
    const doc = document as unknown as { createElement(tag: string): FakeElement; activeElement: FakeElement; focusCalls: number };
    const make = doc.createElement;
    const idle = new FakeElement("body");
    doc.activeElement = idle;
    doc.focusCalls = 0;
    Object.assign(doc, { hasFocus: () => true });
    doc.createElement = (tag) => {
      const el = make(tag);
      Object.defineProperty(el, "ownerDocument", { value: doc });
      Object.defineProperty(el, "parentElement", { get: () => el.parentNode });
      Object.assign(el, {
        querySelectorAll: (selector: string) => el.descendants().filter((node) => node.tagName.toLowerCase() === selector),
        querySelector: (selector: string) => el.descendants().find((node) => node.tagName.toLowerCase() === selector) ?? null
      });
      el.focus = () => { if (!el.disabled) { doc.activeElement = el; doc.focusCalls++; } };
      const remove = el.removeChild.bind(el);
      el.removeChild = (node) => {
        if (node === doc.activeElement || (node instanceof FakeElement && node.descendants().includes(doc.activeElement))) doc.activeElement = idle;
        remove(node);
      };
      return el;
    };
    await body(doc);
  });
}

function setup() {
  let state: AutomationsState = { ownerRevision: 0, mode: "list", working: false, runInFlight: false, rows: [{ flowId: "f", name: "Orders", runId: "r", lines: ["Done"], running: false, stoppable: false, exporting: false, datasets: [{ datasetId: "a", label: "Alpha" }, { datasetId: "b", label: "Beta" }] }] };
  const calls: unknown[][] = [];
  const controller: AutomationsController = {
    state: () => state, observe: () => false, setWorking: () => {}, refresh: async () => {}, focus: async () => {}, run: async () => {}, stop: async () => {},
    exportDataset: async (...args) => { calls.push(args.slice(0, 4)); state = { ...state, rows: state.rows.map((row) => ({ ...row, exporting: true })) }; strip.draw(); }
  };
  let requestCalls = 0;
  const request: PanelStore["request"] = async () => { requestCalls++; return { ok: false, sentence: "Failed", detail: "Try later" }; };
  const strip = createAutomationStrip(request, controller);
  strip.show({ flowId: "f", name: "Orders" });
  const root = fake(strip.element);
  const exports = () => root.byClass("strip-exports")[0]!.descendants().filter((el) => el.tagName === "BUTTON");
  const update = (patch: Partial<AutomationsState["rows"][number]>) => { state = { ...state, rows: [{ ...state.rows[0]!, ...patch }] }; strip.draw(); };
  return { strip, root, exports, calls, update, setState: (next: AutomationsState) => { state = next; strip.draw(); }, working: () => { state = { ...state, working: true }; strip.draw(); }, requestCalls: () => requestCalls };
}

test("polls, label changes and export pending preserve controls and current activation", async () => focused((doc) => {
  const view = setup();
  const buttons = view.exports();
  buttons[0]!.focus();
  view.strip.draw();
  view.working();
  view.update({ datasets: [{ datasetId: "a", label: "New alpha", recordCount: 2 }, { datasetId: "b", label: "Beta" }] });
  assert.deepEqual(view.exports(), buttons);
  assert.equal(doc.activeElement, buttons[0]);
  assert.equal(doc.focusCalls, 1);
  assert.equal(buttons[0]!.getAttribute("aria-label"), "Export New alpha as CSV");
  assert.match(view.root.textContent, /New alpha \(2 rows\)/u);
  buttons[0]!.dispatch("click");
  assert.deepEqual(view.calls, [["f", "r", "a", "csv"]]);
  assert.equal(view.exports()[0], buttons[0]);
  assert.equal(buttons[0]!.disabled, true);
  view.update({ exporting: false });
  assert.equal(view.exports()[0], buttons[0]);
  assert.equal(buttons[0]!.disabled, false);
}));

test("reordering retains focused controls and removing them picks next then previous", async () => focused((doc) => {
  const view = setup();
  const [a, aj, b, bj] = view.exports();
  a!.focus();
  view.update({ datasets: [{ datasetId: "b" }, { datasetId: "a" }] });
  assert.deepEqual(view.exports(), [b, bj, a, aj]);
  assert.equal(doc.activeElement, a);
  view.update({ datasets: [{ datasetId: "b" }] });
  assert.equal(doc.activeElement, bj, "previous surviving control when no later one remains");
  view.update({ datasets: [] });
  assert.equal(doc.activeElement, view.root.byClass("strip-run")[0]);
}));

test("new run identity gets current arguments and removal selects next surviving control", async () => focused((doc) => {
  const view = setup();
  const old = view.exports()[0]!;
  old.focus();
  view.update({ datasets: [{ datasetId: "b" }] });
  assert.equal(doc.activeElement, view.exports()[0]);
  view.update({ runId: "new", datasets: [{ datasetId: "new-data" }] });
  assert.notEqual(view.exports()[0], old);
  view.exports()[1]!.dispatch("click");
  assert.deepEqual(view.calls, [["f", "new", "new-data", "json"]]);
}));

test("disabled Run falls back to Open and external/hidden focus is untouched", async () => focused((doc) => {
  const view = setup();
  view.exports()[0]!.focus();
  view.update({ running: true, stoppable: true });
  assert.equal(doc.activeElement, view.root.byClass("open-fluxiq")[0]!.children[0]);
  const outside = fake(document.createElement("input"));
  outside.focus();
  view.update({ running: false, stoppable: false });
  assert.equal(doc.activeElement, outside);
  const button = view.exports()[0]!;
  button.focus();
  Object.assign(document, { visibilityState: "hidden" });
  const calls = doc.focusCalls;
  view.update({ datasets: [] });
  assert.equal(doc.focusCalls, calls, "hidden surface never restores focus");
}));

test("notice opener and failed request survive unchanged strip refresh", async () => focused(async (doc) => {
  const view = setup();
  view.update({ notice: { sentence: "Open for details", openFluxIQ: true } });
  const opener = view.root.byClass("open-fluxiq")[1]!.children[0]!;
  opener.focus();
  opener.dispatch("click");
  view.update({ name: "Pending rename" });
  assert.equal(view.root.byClass("open-fluxiq")[1]!.children[0], opener);
  assert.equal(opener.disabled, true, "pending request remains the same disabled button");
  await Promise.resolve();
  view.update({ name: "After-error rename", notice: { sentence: "Updated details", detail: "More", openFluxIQ: true } });
  assert.equal(view.root.byClass("open-fluxiq")[1]!.children[0], opener);
  assert.equal(doc.activeElement, opener);
  assert.match(view.root.textContent, /Couldn't open FluxIQ/u);
  assert.equal(view.requestCalls(), 1);
  view.update({ notice: undefined });
  assert.equal(doc.activeElement, view.exports().at(-1), "nearest previous surviving control");
}));

test("flow identity changes remount exports and handlers send current flow", async () => focused(() => {
  const view = setup();
  const old = view.exports()[0];
  view.update({ flowId: "second", name: "Other" });
  view.strip.show({ flowId: "second", name: "Other" });
  assert.notEqual(view.exports()[0], old);
  view.exports()[0]!.dispatch("click");
  assert.deepEqual(view.calls, [["second", "r", "a", "csv"]]);
}));

test("removed focus skips disabled exports and hidden ancestor does not claim focus", async () => focused((doc) => {
  const view = setup();
  view.exports()[0]!.focus();
  view.update({ exporting: true, datasets: [{ datasetId: "b" }] });
  assert.equal(doc.activeElement, view.root.byClass("strip-run")[0]);
  view.update({ exporting: false });
  view.exports()[0]!.focus();
  const host = fake(document.createElement("div"));
  host.append(view.root);
  host.hidden = true;
  const calls = doc.focusCalls;
  view.update({ datasets: [] });
  assert.equal(doc.focusCalls, calls);
}));

test("visible panel with remembered active control never claims browser-page focus", async () => focused((doc) => {
  const view = setup();
  view.exports()[0]!.focus();
  Object.assign(document, { hasFocus: () => false });
  const calls = doc.focusCalls;
  view.update({ datasets: [{ datasetId: "b" }, { datasetId: "a" }] });
  assert.equal(doc.focusCalls, calls, "reordering cannot reclaim document focus");
  view.update({ datasets: [] });
  assert.equal(doc.focusCalls, calls, "removal cannot reclaim document focus");
}));

test("only confirmed complete list absence explains unavailable automation", async () => focused(() => {
  const view = setup();
  for (const mode of ["list", "empty", "loading", "offline", "fallback"] as const) {
    view.setState({ ownerRevision: 0, mode, rows: [], working: false, runInFlight: false });
    const text = view.root.byClass("strip-lines")[0]!.textContent;
    if (mode === "list" || mode === "empty") assert.match(text, /unavailable in the current list/u);
    else assert.doesNotMatch(text, /unavailable/u);
    assert.equal(view.root.byClass("strip-run")[0]!.disabled, true);
  }
  view.setState({ ownerRevision: 0, mode: "list", rows: [], working: false, runInFlight: false, readError: { sentence: "Could not read" } });
  assert.doesNotMatch(view.root.byClass("strip-lines")[0]!.textContent, /unavailable/u);
}));

test("passive matching-flow names emit once after draw, keep controls, and unsubscribe", async () => focused((doc) => {
  const view = setup();
  const heard: Array<{ flowId: string; name: string }> = [];
  const buttons = view.exports(); buttons[0]!.focus();
  const stop = view.strip.onNameChange((automation) => {
    assert.equal(view.root.byClass("strip-run")[0]!.getAttribute("aria-label"), `Run ${automation.name}`);
    heard.push(automation);
    view.strip.show(automation);
  });
  view.update({ name: "<New orders>" });
  view.strip.draw();
  assert.deepEqual(heard, [{ flowId: "f", name: "<New orders>" }]);
  assert.deepEqual(view.exports(), buttons);
  assert.ok(doc.activeElement === buttons[0]);
  assert.equal(doc.focusCalls, 1);
  stop(); view.update({ name: "Another" });
  assert.equal(heard.length, 1);
}));
