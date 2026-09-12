// T1 coverage of the assert verb's wait: that it really waits, that it stops
// waiting when waiting is pointless, and that the outcome says which happened.
//
// This is the coverage the harness could not give. Five rows in
// `e2e/content/tests/check-assert.spec.ts` pass a short `timeoutMs` and assert
// the verdict, which the verb produces on its first attempt as well as its
// last -- so before the outcome carried timing, every one of them would have
// passed with the polling loop deleted outright. The rows here fail if it is:
// `attempts`, `elapsedMs` and a claim that only becomes true partway through
// the window each depend on the loop running.
//
// The `url` kind is used throughout because it is the only one that reads
// nothing but `location.href`, so the whole module runs in Node against a
// two-line stub rather than needing a DOM. What that costs is coverage of the
// per-kind verdicts, which are element-shaped; those are proven on a real page
// by the harness and in `content/actions/tests/assert.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAssertion } from "../assertion-evaluation";

const HERE = "https://example.test/orders/17";
const ELSEWHERE = "https://example.test/orders/18";

/** Installs a page address for the `url` kind to read, and returns the setter that moves it. */
function stubLocation(href: string): (next: string) => void {
  const value = { href };
  Object.defineProperty(globalThis, "location", { value, configurable: true, writable: true });
  return (next: string) => {
    value.href = next;
  };
}

test("a claim that is already true holds on the first attempt and waits for nothing", async () => {
  stubLocation(HERE);
  const outcome = await evaluateAssertion({ kind: "url", expected: "/orders/17", timeoutMs: 5_000 }, {});
  assert.equal(outcome.held, true);
  assert.equal(outcome.judged, true);
  assert.equal(outcome.waitExpired, false);
  assert.equal(outcome.attempts, 1);
  assert.ok(outcome.elapsedMs < 1_000, `a held claim must not spend its window, spent ${outcome.elapsedMs} ms`);
});

test("the wait is real: a claim that becomes true partway through the window holds", async () => {
  const move = stubLocation(HERE);
  const timer = setTimeout(() => move(ELSEWHERE), 120);
  try {
    const outcome = await evaluateAssertion({ kind: "url", expected: "/orders/18", timeoutMs: 2_000 }, {});
    // Deleting the polling loop makes every one of these fail: the first
    // attempt is taken before the address moves.
    assert.equal(outcome.held, true);
    assert.ok(outcome.attempts > 1, `the claim must be judged more than once, was judged ${outcome.attempts} time(s)`);
    assert.ok(outcome.elapsedMs >= 100, `the wait must have taken time, took ${outcome.elapsedMs} ms`);
    assert.equal(outcome.waitExpired, false);
  } finally {
    clearTimeout(timer);
  }
});

test("a claim the page contradicts is judged, and reports its window as expired", async () => {
  stubLocation(HERE);
  const outcome = await evaluateAssertion({ kind: "url", expected: "/orders/99", timeoutMs: 200 }, {});
  assert.equal(outcome.held, false);
  // Both facts, because the verb needs both: the window ran out, and the page
  // was nonetheless read. That pair is STATE_MISMATCH, not TIMEOUT.
  assert.equal(outcome.waitExpired, true);
  assert.equal(outcome.judged, true);
  assert.ok(outcome.attempts > 1, `the claim must be retried until the deadline, was judged ${outcome.attempts} time(s)`);
  assert.ok(outcome.elapsedMs >= 200, `the whole window must be spent, spent ${outcome.elapsedMs} ms`);
  assert.equal(outcome.timeoutMs, 200);
});

test("a claim given no window is judged once and never reports having run out of time", async () => {
  stubLocation(HERE);
  const outcome = await evaluateAssertion({ kind: "url", expected: "/orders/99", timeoutMs: 0 }, {});
  assert.equal(outcome.held, false);
  assert.equal(outcome.attempts, 1);
  // Nothing was waited for, so nothing expired: reporting a timeout here would
  // blame the page for a claim the Flow gave no time to come true.
  assert.equal(outcome.waitExpired, false);
});

test("a claim nothing could satisfy stops at once instead of burning the whole window", async () => {
  stubLocation(HERE);
  const started = Date.now();
  const outcome = await evaluateAssertion({ kind: "url", timeoutMs: 5_000 }, {});
  assert.equal(outcome.held, false);
  assert.equal(outcome.attempts, 1);
  assert.equal(outcome.judged, false);
  // A `url` claim naming no URL is malformed, not slow. Polling it would spend
  // five seconds to reach the same answer, and would then report a timeout for
  // a request no page could ever satisfy.
  assert.equal(outcome.waitExpired, false);
  assert.ok(Date.now() - started < 1_000, "a malformed claim must not wait");
});
