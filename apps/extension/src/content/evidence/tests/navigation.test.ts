// How this document was reached (`../navigation.ts`), and which document it is.
//
// Run `run-muw5zv4m-52d83027`: a size choice that rewrote the address in place
// (`history.replaceState`) read as a page move, because the address was all a
// reader had. `timeOrigin` is the document's identity -- `performance.timeOrigin`,
// new for every document, unchanged by `replaceState` and `pushState` -- and
// reading it must never be the reason a snapshot fails.
//
// The extension's unit runner is Node, so the page globals are stubs.

import assert from "node:assert/strict";
import test from "node:test";

type Module = typeof import("../navigation");

const PAGE_GLOBALS = ["location", "document", "history", "performance"] as const;

async function withPage(performanceStub: unknown, body: (loaded: Module) => void): Promise<void> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = new Map(PAGE_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)] as const));
  const stubs: Record<(typeof PAGE_GLOBALS)[number], unknown> = {
    location: { href: "https://shop.test/p/rolls?size=12" },
    document: { referrer: "", visibilityState: "visible" },
    history: { length: 3 },
    performance: performanceStub
  };
  for (const name of PAGE_GLOBALS) Object.defineProperty(globals, name, { value: stubs[name], configurable: true, writable: true });
  try {
    body(await import("../navigation"));
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}

test("the navigation evidence carries the document's time origin as its identity", async () => {
  await withPage({ timeOrigin: 1_759_000_000_123.4, getEntriesByType: () => [] }, ({ navigationEvidence }) => {
    const evidence = navigationEvidence();
    assert.equal(evidence.timeOrigin, 1_759_000_000_123.4);
    assert.equal(evidence.url, "https://shop.test/p/rolls?size=12");
  });
});

test("a time origin the page does not report is left out, and the snapshot still has its navigation", async () => {
  await withPage(undefined, ({ navigationEvidence }) => {
    const evidence = navigationEvidence();
    assert.equal("timeOrigin" in evidence, false);
    assert.equal(evidence.path, "/p/rolls");
  });
  await withPage({ timeOrigin: Number.NaN, getEntriesByType: () => [] }, ({ navigationEvidence }) => {
    assert.equal("timeOrigin" in navigationEvidence(), false);
  });
  await withPage({ getEntriesByType: () => [] }, ({ navigationEvidence }) => {
    assert.equal("timeOrigin" in navigationEvidence(), false);
  });
});
