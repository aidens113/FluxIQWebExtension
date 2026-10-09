// The strip's Stop run: shown only while the shown automation's run is in
// progress, pressed through the controller under the owner it was drawn for.

import assert from "node:assert/strict";
import test from "node:test";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelStore } from "../../state";
import type { AutomationRowView, AutomationsController, AutomationsState } from "../controller";
import { createAutomationStrip } from "../automation-strip";

function setup() {
  const idle: AutomationRowView = { flowId: "f", name: "Orders", runId: "r", lines: ["Done"], running: false, stoppable: false, exporting: false, datasets: [] };
  let state: AutomationsState = { ownerRevision: 0, mode: "list", working: false, runInFlight: false, rows: [idle] };
  const stops: unknown[][] = [];
  const controller: AutomationsController = {
    state: () => state, observe: () => false, setWorking() {}, refresh: async () => {}, focus: async () => {}, run: async () => {},
    stop: async (...args) => { stops.push(args); }, exportDataset: async () => {}
  };
  const request: PanelStore["request"] = async () => ({ ok: false, sentence: "Synthetic" });
  const strip = createAutomationStrip(request, controller);
  strip.show({ flowId: "f", name: "Orders" });
  const root = fake(strip.element);
  const update = (patch: Partial<AutomationRowView>, owner = state.ownerRevision) => {
    state = { ...state, ownerRevision: owner, rows: [{ ...state.rows[0]!, ...patch }] }; strip.draw();
  };
  return { root, stops, update, strip, stop: () => root.byClass("strip-stop")[0]!, run: () => root.byClass("strip-run")[0]!, status: () => root.byClass("strip-stop-status")[0]! };
}

test("Stop run is shown only while the run is in progress", async () => withFakeDocument(() => {
  const view = setup();
  assert.equal(view.stop().hidden, true);
  view.update({ running: true, stoppable: true, lines: ["Running..."] });
  assert.equal(view.stop().hidden, false);
  assert.equal(view.stop().textContent, "Stop run");
  assert.equal(view.stop().getAttribute("aria-label"), "Stop Orders");
  assert.equal(view.run().disabled, true);
  view.update({ running: false, stoppable: false, lines: ["Stopped"] });
  assert.equal(view.stop().hidden, true);
  assert.equal(view.run().disabled, false);
}));

test("a run FluxIQ listed as in progress offers Stop too", async () => withFakeDocument(() => {
  const view = setup();
  view.update({ stoppable: true, lines: ["Running..."] });
  assert.equal(view.stop().hidden, false);
  assert.equal(view.run().textContent, "Running...");
}));

test("pressing Stop asks the controller for the shown automation under its owner", async () => withFakeDocument(() => {
  const view = setup();
  view.stop().dispatch("click");
  assert.deepEqual(view.stops, [], "a hidden Stop does nothing");
  view.update({ running: true, stoppable: true });
  view.stop().dispatch("click");
  assert.deepEqual(view.stops, [["f", 0]]);
}));

test("Stopping… is disabled while in flight and a failure says so politely", async () => withFakeDocument(() => {
  const view = setup();
  view.update({ running: true, stoppable: true, stop: "stopping" });
  assert.equal(view.stop().disabled, true);
  assert.equal(view.stop().textContent, "Stopping…");
  view.stop().dispatch("click");
  assert.deepEqual(view.stops, []);
  assert.equal(view.status().getAttribute("role"), "status");
  assert.equal(view.status().getAttribute("aria-live"), "polite");
  view.update({ stop: "requested" });
  assert.equal(view.stop().disabled, true);
  assert.match(view.status().textContent, /Stop requested/u);
  view.update({ stop: "failed" });
  assert.equal(view.stop().disabled, false);
  assert.equal(view.stop().textContent, "Stop run");
  assert.equal(view.status().textContent, "Couldn't stop the run. Try again.");
  view.update({ running: false, stoppable: false, stop: undefined });
  assert.equal(view.status().textContent, "");
}));

test("a press on a retired owner's Stop does nothing", async () => withFakeDocument(() => {
  const view = setup();
  view.update({ running: true, stoppable: true });
  const old = view.stop();
  view.update({}, 1);
  old.dispatch("click");
  assert.deepEqual(view.stops, []);
  assert.notEqual(view.stop(), old);
}));
