import assert from "node:assert/strict";
import test from "node:test";
import { setCheckedState } from "../checkable-state";

function input(type: "checkbox" | "radio" = "checkbox") {
  const state = {
    tagName: "INPUT", type, checked: false, isConnected: true, clicks: 0,
    matches: () => false, getAttribute: () => null, focus: () => {},
    click: () => { state.clicks++; state.checked = type === "radio" ? true : !state.checked; }
  };
  return state;
}

test("check activates once and an already-held desired state activates nothing", async () => {
  const control = input();
  assert.deepEqual(await setCheckedState(control as unknown as Element, true), { ok: true, kind: "checkbox", checked: true, changed: true });
  assert.equal(control.clicks, 1);
  assert.deepEqual(await setCheckedState(control as unknown as Element, true), { ok: true, kind: "checkbox", checked: true, changed: false });
  assert.equal(control.clicks, 1);
});

test("microtask revert is read back without a second activation", async () => {
  const control = input();
  control.click = () => { control.clicks++; control.checked = true; queueMicrotask(() => { control.checked = false; }); };
  assert.deepEqual(await setCheckedState(control as unknown as Element, true), { ok: true, kind: "checkbox", checked: false, changed: true });
  assert.equal(control.clicks, 1);
});

test("detached control cannot certify the replacement's checked state", async () => {
  const control = input();
  control.click = () => { control.clicks++; control.checked = true; control.isConnected = false; };
  const outcome = await setCheckedState(control as unknown as Element, true);
  assert.equal(outcome.ok, false);
  assert.match(outcome.ok ? "" : outcome.reason, /detached/u);
  assert.equal(control.clicks, 1);
});

test("unchecking radio and disabled checking activate nothing", async () => {
  const radio = input("radio");
  assert.equal((await setCheckedState(radio as unknown as Element, false)).ok, false);
  assert.equal(radio.clicks, 0);
  const disabled = input();
  disabled.matches = () => true;
  assert.equal((await setCheckedState(disabled as unknown as Element, true)).ok, false);
  assert.equal(disabled.clicks, 0);
});
