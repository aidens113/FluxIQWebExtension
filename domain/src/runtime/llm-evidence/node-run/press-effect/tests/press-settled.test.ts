// A press that changed nothing is waited on, then pressed once more, before it
// is reported as having had no effect (t511, the user's rule of 2026-10-07:
// every node retries automatically, waiting for the target first). Driven with
// hand-built packets and a fake clock: which looks are taken, when the second
// press is made, and what is said.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { webRunnableNode } from "../../catalog";
import { webPressSettled } from "../settled";

const CLICK = webRunnableNode("web.output.dom-click")!;
const TYPE = webRunnableNode("web.output.dom-type")!;

function bound(elements: readonly FixtureElement[], page: Partial<WebLlmPageEvidence> = {}): WebLlmSnapshotBinding {
  return { evidence: fixturePacket(elements, page), selectors: new Map(), records: new Map(), shadowHosts: new Map() } as WebLlmSnapshotBinding;
}

const OPEN: FixtureElement[] = [
  { tag: "div", target: "t1", name: "Display settings", isDialog: { modal: false } },
  { tag: "button", target: "t2", text: "Cancel", parent: "t1" },
  { tag: "button", target: "t3", text: "Save", parent: "t1" }
];
const CLOSED: FixtureElement[] = [{ tag: "h1", target: "t4", text: "Preferences" }];

/** A page that answers looks from a script, and a clock that only moves when slept. */
function harness(looks: Array<WebLlmSnapshotBinding | undefined>, pressAgain: boolean | "never" = true) {
  let clock = 0;
  const log: string[] = [];
  const steps = {
    look: async () => {
      log.push("look");
      return looks.shift();
    },
    pressAgain: pressAgain === "never" ? undefined : async () => {
      log.push("press");
      return pressAgain;
    },
    sleep: async (ms: number) => {
      clock += ms;
    },
    now: () => clock
  };
  return { steps, log, elapsed: () => clock };
}

test("a press whose effect shows during the settle wait is a plain press: no second press, nothing said", async () => {
  const h = harness([bound(OPEN), bound(CLOSED)]);
  const settled = await webPressSettled(CLICK, bound(OPEN), bound(OPEN), "t3", h.steps);
  assert.deepEqual(h.log, ["look", "look"]);
  assert.equal(settled.presses, 1);
  assert.equal(settled.noEffect, undefined);
  assert.equal(settled.pressedAgain, undefined);
  assert.deepEqual(settled.after?.evidence.elements.map((element) => element.target), ["t4"]);
});

test("a press that changed nothing through the wait is pressed once more, and the second press's effect is said as such", async () => {
  const h = harness([bound(OPEN), bound(OPEN), bound(OPEN), bound(OPEN), bound(OPEN), bound(OPEN), bound(CLOSED)]);
  const settled = await webPressSettled(CLICK, bound(OPEN), bound(OPEN), "t3", h.steps);
  assert.equal(h.log.filter((entry) => entry === "press").length, 1);
  assert.equal(h.log[h.log.length - 1], "look");
  assert.equal(settled.presses, 2);
  assert.equal(settled.noEffect, undefined);
  assert.match(String(settled.pressedAgain), /first press of "Save" \(t3\) changed nothing/u);
  assert.deepEqual(settled.after?.evidence.elements.map((element) => element.target), ["t4"]);
});

test("a press that changed nothing after the second press either is reported as no effect, with the dialog still open", async () => {
  const h = harness(Array.from({ length: 40 }, () => bound(OPEN)));
  const settled = await webPressSettled(CLICK, bound(OPEN), bound(OPEN), "t3", h.steps);
  assert.equal(h.log.filter((entry) => entry === "press").length, 1);
  assert.equal(settled.presses, 2);
  assert.match(String(settled.noEffect), /pressed twice/u);
  assert.match(String(settled.noEffect), /dialog t1 "Display settings" it is in is still open/u);
  // Bounded: the wait never runs past its window on either side of the second press.
  assert.ok(h.elapsed() <= 2 * 1_500, String(h.elapsed()));
});

test("a press that may not be made again is waited on once and reported, never pressed twice", async () => {
  const h = harness(Array.from({ length: 40 }, () => bound(OPEN)), "never");
  const settled = await webPressSettled(CLICK, bound(OPEN), bound(OPEN), "t3", h.steps);
  assert.equal(h.log.includes("press"), false);
  assert.equal(settled.presses, 1);
  assert.match(String(settled.noEffect), /"Save" \(t3\)/u);
  assert.doesNotMatch(String(settled.noEffect), /twice/u);
});

test("a second press the page refused leaves one press, reported as no effect", async () => {
  const h = harness(Array.from({ length: 40 }, () => bound(OPEN)), false);
  const settled = await webPressSettled(CLICK, bound(OPEN), bound(OPEN), "t3", h.steps);
  assert.equal(settled.presses, 1);
  assert.doesNotMatch(String(settled.noEffect), /twice/u);
});

test("a page that changed at once, a page that could not be read, and a node that is not a press are left as they were", async () => {
  for (const [node, after] of [[CLICK, bound(CLOSED)], [CLICK, undefined], [TYPE, bound(OPEN)]] as const) {
    const h = harness([bound(OPEN)]);
    const settled = await webPressSettled(node, bound(OPEN), after, "t3", h.steps);
    assert.deepEqual(h.log, []);
    assert.equal(settled.after, after);
    assert.equal(settled.presses, 1);
    assert.equal(settled.noEffect, undefined);
  }
});

test("a look that comes back unreadable during the wait ends it: the page went somewhere, which is an effect", async () => {
  const h = harness([undefined]);
  const settled = await webPressSettled(CLICK, bound(OPEN), bound(OPEN), "t3", h.steps);
  assert.equal(settled.after, undefined);
  assert.equal(settled.noEffect, undefined);
  assert.equal(h.log.includes("press"), false);
});
