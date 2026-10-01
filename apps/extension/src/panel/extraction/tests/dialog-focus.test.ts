import assert from "node:assert/strict";
import test from "node:test";
import { createExtractionDialogFocus } from "../dialog-focus";
import { withDialogDom } from "./dialog-dom";

function setup(world: Parameters<Parameters<typeof withDialogDom>[0]>[0]) {
  const entry = world.document.createElement("button");
  const panel = world.document.createElement("section"); panel.tabIndex = -1; panel.hidden = true;
  const first = world.document.createElement("button");
  const hidden = world.document.createElement("div"); hidden.hidden = true; hidden.append(world.document.createElement("button"));
  const disabled = world.document.createElement("button"); disabled.disabled = true;
  const hint = world.document.createElement("span"); hint.tabIndex = 0;
  const last = world.document.createElement("button");
  panel.append(first, hidden, disabled, hint, last);
  world.host.append(entry, panel);
  let busy = false; let dismissed = 0;
  const dialog = createExtractionDialogFocus(world.native(panel), { initial: () => world.native(first.disabled ? panel : first), returnTo: () => world.native(entry), busy: () => busy, dismiss: () => dismissed++ });
  return { entry, panel, first, last, hint, disabled, dialog, busy: (value: boolean) => { busy = value; }, dismissed: () => dismissed };
}

test("open portals only sheet, preserves all inert values, tracks new body roots and cleans listeners", async () => withDialogDom((world) => {
  const prior = world.document.createElement("div"); prior.inert = true; world.document.body.append(prior);
  const view = setup(world);
  view.entry.focus(); view.dialog.open(); view.dialog.open();
  assert.equal(view.panel.parentElement, world.document.body);
  assert.equal(world.host.inert, true);
  assert.equal(world.document.activeElement, view.first);
  const later = world.document.createElement("div"); world.document.body.append(later);
  assert.equal(later.inert, true);
  view.dialog.close(); view.dialog.close();
  assert.equal(prior.inert, true);
  assert.equal(world.host.inert, false);
  assert.equal(later.inert, false);
  assert.equal(view.panel.parentElement, world.host);
  assert.equal(world.document.activeElement, view.entry);
  assert.equal(world.document.observers.size, 0);
  assert.equal(world.document.listeners.get("keydown")?.length, 0);
  assert.equal(world.document.listeners.get("focusin")?.length, 0);
}));

test("Tab wraps visible enabled boundary controls and handles no available controls", async () => withDialogDom((world) => {
  const view = setup(world); view.dialog.open();
  view.first.focus();
  assert.equal(world.document.emit("keydown", { key: "Tab", shiftKey: true }).defaultPrevented, true);
  assert.equal(world.document.activeElement, view.last);
  assert.equal(world.document.emit("keydown", { key: "Tab" }).defaultPrevented, true);
  assert.equal(world.document.activeElement, view.first);
  view.hint.focus();
  assert.equal(world.document.emit("keydown", { key: "Tab" }).defaultPrevented, false, "middle focus uses normal browser order");
  view.first.disabled = true; view.last.disabled = true; view.hint.tabIndex = -1;
  view.panel.focus(); world.document.emit("keydown", { key: "Tab" });
  assert.equal(world.document.activeElement, view.panel);
  view.dialog.close();
}));

test("IME Escape and browser shortcuts untouched; busy Escape consumes without dismissing", async () => withDialogDom((world) => {
  const view = setup(world); view.dialog.open();
  assert.equal(world.document.emit("keydown", { key: "Escape", isComposing: true }).defaultPrevented, false);
  assert.equal(world.document.emit("keydown", { key: "Escape", keyCode: 229 }).defaultPrevented, false);
  assert.equal(world.document.emit("keydown", { key: "Tab", ctrlKey: true }).defaultPrevented, false);
  view.busy(true);
  const busy = world.document.emit("keydown", { key: "Escape" });
  assert.equal(busy.defaultPrevented, true); assert.equal(busy.stopped, true); assert.equal(view.dismissed(), 0);
  view.busy(false); world.document.emit("keydown", { key: "Escape" });
  assert.equal(view.dismissed(), 1); view.dialog.close();
}));

test("extension-only focus guard never pulls focus from the real page or hidden document", async () => withDialogDom((world) => {
  const view = setup(world); view.dialog.open();
  world.document.activeElement = view.entry; world.document.emit("focusin", { target: view.entry });
  assert.equal(world.document.activeElement, view.first);
  world.document.focused = false;
  const count = world.document.focusCalls.length;
  world.document.emit("focusin", { target: view.entry }); view.dialog.render(() => undefined);
  assert.equal(world.document.focusCalls.length, count);
  view.dialog.close();
  assert.equal(world.document.focusCalls.length, count);
  world.document.visibilityState = "hidden"; world.document.focused = true;
  view.dialog.open(); assert.equal(world.document.focusCalls.length, count); view.dialog.close();
}));

test("host can reparent while open and detached parent is never resurrected on close", async () => withDialogDom((world) => {
  const view = setup(world); view.entry.focus(); view.dialog.open();
  const destination = world.document.createElement("div"); world.document.body.append(destination); destination.append(world.host);
  assert.equal(view.panel.parentElement, world.document.body);
  view.dialog.close();
  assert.equal(view.panel.parentElement, world.host);
  assert.equal(world.document.activeElement, view.entry);
  view.dialog.open(); world.host.remove(); view.dialog.close();
  assert.equal(view.panel.isConnected, false);
  assert.equal(world.host.isConnected, false);
  assert.equal(world.document.observers.size, 0);
}));
