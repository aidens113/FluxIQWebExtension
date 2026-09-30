// The look after an action, taken again while the page is between documents
// and for no longer than its window (`../capture.ts`, `captureAfterAction`).
//
// Timed with a clock the test owns, so the bound is counted exactly rather than
// measured against a wall clock: `node-run/tests/reload-click.test.ts` proves
// the same thing end to end, through the node verb, at real speed.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { captureAfterAction, type WebLlmAfterActionTiming, type WebLlmEvidenceGateway } from "../capture";

const REQUEST = { projectId: "project.one", flowId: "flow.one", callId: "call.one", toolId: "core.run_node", value: {} };

function page(title: string, url = "https://bigbox.example.test/"): JsonObject {
  return {
    url,
    title,
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#store-chip", visibleText: title }]
  };
}

/** A page whose first `unreadable` looks fail, as a look into a document being torn down does. */
function between(unreadable: number, answer: () => JsonObject = () => page("Millbrook Crossing Supercenter")) {
  let looks = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async () => {
      looks += 1;
      if (looks <= unreadable) return { status: "failed", error: "The message port closed before a response was received." };
      return { status: "succeeded", payload: { snapshot: answer() } };
    }
  };
  return { gateway, looks: () => looks };
}

/** A clock that moves only when the capture waits. */
function ownClock(windowMs = 1_000, retryMs = 250): WebLlmAfterActionTiming & { waited: number[] } {
  let now = 0;
  const waited: number[] = [];
  return {
    windowMs,
    retryMs,
    waited,
    now: () => now,
    sleep: async (ms) => {
      waited.push(ms);
      now += ms;
    }
  };
}

test("a look that meets the page between documents is taken again, and returns the new document", async () => {
  const lab = between(2);
  const clock = ownClock();
  const after = await captureAfterAction(lab.gateway, "session.one", REQUEST, undefined, undefined, clock);
  assert.equal(after?.evidence.title, "Millbrook Crossing Supercenter");
  assert.equal(lab.looks(), 3);
  assert.deepEqual(clock.waited, [250, 250]);
});

test("a page readable at once is looked at once, and nothing waits", async () => {
  const lab = between(0);
  const clock = ownClock();
  const after = await captureAfterAction(lab.gateway, "session.one", REQUEST, undefined, undefined, clock);
  assert.equal(after?.evidence.location, "https://bigbox.example.test/");
  assert.equal(lab.looks(), 1);
  assert.deepEqual(clock.waited, []);
});

test("a page that never becomes readable is given up on inside the window, with nothing returned", async () => {
  const lab = between(Number.POSITIVE_INFINITY);
  const clock = ownClock(1_000, 250);
  const after = await captureAfterAction(lab.gateway, "session.one", REQUEST, undefined, undefined, clock);
  assert.equal(after, undefined);
  // Looks at 0, 250, 500 and 750 ms; one more would start at the window's end.
  assert.equal(lab.looks(), 4);
  assert.deepEqual(clock.waited, [250, 250, 250]);
});

test("a look refused for anything but an unreadable page is raised as it was, and not taken again", async () => {
  const lab = between(0, () => page("Elsewhere", "https://elsewhere.example.test/"));
  await assert.rejects(
    captureAfterAction(lab.gateway, "session.one", REQUEST, undefined, "https://bigbox.example.test", ownClock()),
    /escaped the expected origin/u
  );
  assert.equal(lab.looks(), 1);
});

test("cancellation during the wait ends it at once, with the cancellation's own reason", async () => {
  const lab = between(Number.POSITIVE_INFINITY);
  const controller = new AbortController();
  const reason = new Error("build cancelled");
  const base = ownClock();
  const clock: WebLlmAfterActionTiming = {
    ...base,
    sleep: async () => {
      controller.abort(reason);
    }
  };
  await assert.rejects(captureAfterAction(lab.gateway, "session.one", REQUEST, controller.signal, undefined, clock), (error) => error === reason);
  assert.equal(lab.looks(), 1);
});

test("the default wait is ended by cancellation without running out its interval", async () => {
  const lab = between(Number.POSITIVE_INFINITY);
  const controller = new AbortController();
  const reason = new Error("build cancelled");
  setTimeout(() => controller.abort(reason), 20);
  const startedAt = Date.now();
  await assert.rejects(captureAfterAction(lab.gateway, "session.one", REQUEST, controller.signal), (error) => error === reason);
  assert.ok(Date.now() - startedAt < 240, "the 250 ms wait was cut short");
});
