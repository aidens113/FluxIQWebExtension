// What counts as FluxIQ working before holding, and the whole chain the shell
// wires: 20 runtime flips during one build change the record, extract and Run
// controls at most once each way.

import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityDisplay, ExtensionActivityState } from "../../../shared/activity/index";
import type { ExtensionStatus } from "../../../shared/protocol";
import { createAutomationsController } from "../../automations";
import type { ActivityFeedSnapshot } from "../../chat";
import { extractControl, recordControl } from "../../recording";
import { statusWith } from "../../tests/status-fixture";
import { createWorkingHold, WORKING_OFF_MS } from "../working-hold";
import { workingInput } from "../working-input";
import { fakeClock } from "./fake-clock";

const connected = { connectionState: "connected" as const, paired: true, activeTabUrl: "https://shop.example.com/" };
const reading = statusWith({ ...connected, runtime: { state: "running" } });
const idle = statusWith({ ...connected, runtime: { state: "idle" } });

function display(working: boolean): ActivityDisplay {
  return {
    activityId: "build:b1",
    subjectKind: "build",
    phase: "building",
    headline: working ? "Building your Flow" : "Flow ready",
    detail: null,
    step: null,
    working,
    outcome: working ? null : "done",
    sequence: 1
  };
}

function feed(shown: ActivityDisplay | null, overrides: Partial<ActivityFeedSnapshot> = {}, live = true): ActivityFeedSnapshot {
  const state: ExtensionActivityState = { current: null, display: shown, recent: [], overlay: "expanded", live };
  return { reach: "ready", state, overlaySaving: false, ...overrides };
}

test("with a live relay the paced display decides, whatever the runtime says", () => {
  assert.equal(workingInput(reading, feed(display(false))), false);
  assert.equal(workingInput(idle, feed(display(true))), true);
  assert.equal(workingInput(reading, feed(null)), false);
});

test("without a relay, or with a Core that does not stream, the runtime is the fallback", () => {
  assert.equal(workingInput(reading, undefined), true);
  assert.equal(workingInput(reading, feed(display(false), { reach: "unsupported" })), true);
  assert.equal(workingInput(reading, feed(display(false), {}, false)), true);
  assert.equal(workingInput(idle, feed(null, { reach: "failed" })), false);
  assert.equal(workingInput(undefined, undefined), false);
});

type Step = { status: ExtensionStatus; feed: ActivityFeedSnapshot | undefined; ms: number };

/** Drives the shell's chain over one build; answers each control's disabled history, repeats dropped. */
function build(steps: Step[]) {
  const clock = fakeClock();
  const controller = createAutomationsController(async () => ({ ok: false, sentence: "x" }), { onChange: () => undefined, download: () => undefined });
  const history = { record: [] as boolean[], extract: [] as boolean[], run: [] as boolean[] };
  let latest = idle;
  const push = (list: boolean[], value: boolean) => {
    if (list.at(-1) !== value) list.push(value);
  };
  const hold = createWorkingHold(clock, (working) => {
    controller.setWorking(working);
    note();
  });
  function note(): void {
    push(history.record, recordControl(latest, hold.working()).disabled);
    push(history.extract, extractControl(latest, hold.working()).disabled);
    push(history.run, controller.state().working);
  }
  for (const step of steps) {
    latest = step.status;
    controller.observe(step.status);
    hold.observe(workingInput(step.status, step.feed));
    note();
    clock.advance(step.ms);
    note();
  }
  return history;
}

/** 20 runtime flips: a 700 ms page read, then 300 ms between reads. */
function flips(feedOf: (index: number) => ActivityFeedSnapshot | undefined): Step[] {
  return Array.from({ length: 20 }, (_, index) => ({
    status: index % 2 === 0 ? reading : idle,
    feed: feedOf(index),
    ms: index % 2 === 0 ? 700 : 300
  }));
}

const once = { record: [false, true, false], extract: [false, true, false], run: [false, true, false] };

test("20 runtime flips during one build, paced display working: each control changes once each way", () => {
  const history = build([...flips(() => feed(display(true))), { status: idle, feed: feed(display(false)), ms: WORKING_OFF_MS * 2 }]);
  assert.deepEqual(history, once);
});

test("20 runtime flips with no relay: the hold still changes each control at most once each way", () => {
  const history = build([...flips(() => undefined), { status: idle, feed: undefined, ms: WORKING_OFF_MS * 2 }]);
  assert.deepEqual(history, once);
});

test("20 runtime flips outside any build, with the relay live: the controls never change", () => {
  const history = build([...flips(() => feed(null)), { status: idle, feed: feed(null), ms: WORKING_OFF_MS * 2 }]);
  assert.deepEqual(history, { record: [false], extract: [false], run: [false] });
});

test("keyed on the runtime directly, as before, the same 20 flips toggled the controls 20 times", () => {
  let toggles = 0;
  let was = false;
  for (const step of flips(() => undefined)) {
    const disabled = recordControl(step.status, step.status.runtime?.state === "running").disabled;
    if (disabled !== was) toggles += 1;
    was = disabled;
  }
  assert.equal(toggles, 20);
});
