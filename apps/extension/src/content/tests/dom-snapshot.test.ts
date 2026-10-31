import assert from "node:assert/strict";
import test from "node:test";
import { captureSnapshot } from "../dom-snapshot";
import type { SnapshotCaptureOptions } from "../../shared/snapshot-capture-options";

// This empty document exercises the real capture owner, not a requested flag
// copied onto a fixture. The rendered-elements tests own hidden subtree walks.
function withEmptyPage(body: () => void): void {
  class EmptyElement {
    readonly tagName = "HTML";
    readonly children: Element[] = [];
    readonly scrollWidth = 800;
    readonly scrollHeight = 600;
    hasAttribute(): boolean { return false; }
    getAttribute(): null { return null; }
  }
  const page = new EmptyElement();
  const viewport = {
    innerWidth: 800, innerHeight: 600, scrollX: 0, scrollY: 0,
    devicePixelRatio: 1, getSelection: () => null
  };
  const globals: Record<string, unknown> = {
    Element: EmptyElement,
    document: {
      documentElement: page, body: page, activeElement: null,
      title: "Empty page", referrer: "", visibilityState: "visible",
      readyState: "complete", querySelectorAll: () => []
    },
    window: Object.assign(viewport, { top: viewport }),
    location: { href: "https://example.test/empty" },
    history: { length: 1 },
    getComputedStyle: () => ({ display: "block", visibility: "visible" })
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    body();
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test("actual snapshot capture reports the hidden setting applied to its element walk", () => {
  withEmptyPage(() => {
    for (const [options, expected] of [
      [undefined, false], [{ includeHidden: false }, false], [{ includeHidden: true }, true],
      [{ includeHidden: "true" } as unknown as SnapshotCaptureOptions, false]
    ] as const) {
      const snapshot = captureSnapshot(options);
      assert.deepEqual(snapshot.evidence?.captureOptions, { includeHidden: expected });
      assert.deepEqual(snapshot.interactiveElements, []);
    }
  });
});
