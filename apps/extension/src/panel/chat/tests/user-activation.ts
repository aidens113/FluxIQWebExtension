// Test support: `navigator.userActivation` in a given state for one test, as
// the browser reports it after (or without) a person's press in the panel.

import type { TestContext } from "node:test";

/** Puts `navigator.userActivation` in `activation` for this test (absent when undefined), and the old navigator back after it. */
export function userActivation(t: TestContext, activation: { isActive: boolean; hasBeenActive: boolean } | undefined): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const base = previous && "value" in previous ? previous.value as object | undefined : (globalThis as { navigator?: object }).navigator;
  const navigator = Object.create(base ?? null, activation === undefined ? {} : { userActivation: { value: activation, enumerable: true } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: navigator });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "navigator", previous);
    else Reflect.deleteProperty(globalThis, "navigator");
  });
}
