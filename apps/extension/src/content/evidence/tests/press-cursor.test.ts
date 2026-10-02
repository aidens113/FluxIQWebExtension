// Where an element's own cursor begins, on hand-built elements whose computed
// cursor the test states (t229). That Chromium computes and inherits the
// cursors these fakes state is the content harness's
// (`e2e/content/tests/evidence/tests/page-view-controls.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { ownPressCursor } from "../press-cursor";

type Fake = { cursor: string; parentElement: Fake | null; assignedSlot: Fake | null; getRootNode(): { host?: Fake } };

function fake(cursor: string, parent: Fake | null = null, host?: Fake): Fake {
  return { cursor, parentElement: parent, assignedSlot: null, getRootNode: () => (host === undefined ? {} : { host }) };
}

function withCursors<T>(body: () => T): T {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "getComputedStyle");
  globals.getComputedStyle = (element: Fake) => ({ cursor: element.cursor });
  try {
    return body();
  } finally {
    if (previous) Object.defineProperty(globals, "getComputedStyle", previous);
    else delete globals.getComputedStyle;
  }
}

const cursorOf = (element: Fake) => withCursors(() => ownPressCursor(element as unknown as Element));

test("a pointer the element sets is its own; the same pointer inherited by its insides is not", () => {
  const body = fake("auto");
  const button = fake("pointer", body);
  const glyph = fake("pointer", button);
  assert.equal(cursorOf(button), "pointer");
  assert.equal(cursorOf(glyph), undefined);
});

test("a refusing cursor is reported, inside a pressable parent too; any other cursor is not", () => {
  const body = fake("auto");
  const picker = fake("pointer", body);
  assert.equal(cursorOf(fake("not-allowed", picker)), "not-allowed");
  assert.equal(cursorOf(fake("text", body)), undefined);
  assert.equal(cursorOf(fake("auto", body)), undefined);
});

test("a shadow root's top element is compared with its host", () => {
  const host = fake("pointer", fake("auto"));
  assert.equal(cursorOf(fake("pointer", null, host)), undefined);
  assert.equal(cursorOf(fake("pointer", null, fake("auto"))), "pointer");
});
