// A Next page step's press above humanness 0 (`../pager-press.ts`, t908): the
// pager's control pressed as the click verb presses, with the click verb's own
// aim (`../aim-press.ts`, whose safety lines its own tests prove) and misclick
// (`../misclick/before.ts`), here stood in so each decision shows. What is
// proven: a press is aimed only where the aim accepts the point, otherwise it is
// `control.click()` and says so; a misclick only on a command Core marked, at
// most once a step and before the first press; the mark says what the press
// that follows does; and a document a press loaded records the press its mark
// brought, never `aimed: false` for an aimed press.

import assert from "node:assert/strict";
import test from "node:test";
import type { ActionabilityReport } from "../../actionability";
import { commandHumanness, type CommandHumanness } from "../command-humanness";
import { humanPagerPress } from "../pager-press";

const HUMAN = commandHumanness({ commandId: "cmd-next-page", humanness: 100 }) as CommandHumanness;
const ACTIONABLE = { actionable: true, point: { x: 50, y: 20 }, detail: "reachable" } satisfies ActionabilityReport;
const REFUSED = { actionable: false, code: "covered", detail: "covered", point: { x: 50, y: 20 } } satisfies ActionabilityReport;

/** A control that counts `click()` calls, the press made at humanness 0. */
function control(): HTMLElement & { clicks: number } {
  const made = { clicks: 0, click: () => { made.clicks += 1; } };
  return made as unknown as HTMLElement & { clicks: number };
}

/** The press with every part stood in, logging what each part was asked. */
function pressing(options: { marked?: boolean; aimAt?: { x: number; y: number } | undefined; gate?: ActionabilityReport; misclickAt?: { x: number; y: number } } = {}) {
  const log: string[] = [];
  const gestures: { x: number; y: number }[] = [];
  const action = { commandId: "cmd-next-page", humanness: 100, ...(options.marked === true ? { humannessMisclick: true as const } : {}) };
  const press = humanPagerPress(action, HUMAN, 0, () => options.gate ?? ACTIONABLE, {
    aim: () => {
      log.push("aim");
      return options.aimAt === undefined ? undefined : ({ ...ACTIONABLE, point: options.aimAt });
    },
    gesture: (_element, point) => {
      log.push("gesture");
      gestures.push(point);
      return true;
    },
    valid: () => true,
    misclick: async (_target, _action, _startedAt, onMisclick) => {
      log.push("misclick");
      if (options.misclickAt === undefined) return "none";
      onMisclick?.(options.misclickAt);
      return "made";
    }
  });
  return { press, log, gestures };
}

test("an aimed press is the gesture at the aimed point, never control.click(), and records aimed", async () => {
  const { press, log, gestures } = pressing({ aimAt: { x: 47, y: 22 } });
  const next = control();
  await press.prepare(next);
  press.press(next);
  assert.deepEqual(log, ["aim", "gesture"]);
  assert.deepEqual(gestures, [{ x: 47, y: 22 }]);
  assert.equal(next.clicks, 0);
  assert.deepEqual(press.record(), { aimed: true });
});

test("where the aim refuses the point, the press is control.click() and records not aimed", async () => {
  const { press, log } = pressing({ aimAt: undefined });
  const next = control();
  await press.prepare(next);
  press.press(next);
  assert.deepEqual(log, ["aim"]);
  assert.equal(next.clicks, 1);
  assert.deepEqual(press.record(), { aimed: false });
});

test("a control the gate refuses is never aimed: control.click(), as at humanness 0", async () => {
  const { press, log } = pressing({ aimAt: { x: 47, y: 22 }, gate: REFUSED });
  const next = control();
  await press.prepare(next);
  press.press(next);
  assert.deepEqual(log, [], "the aim is not asked of a refused control");
  assert.equal(next.clicks, 1);
  assert.deepEqual(press.record(), { aimed: false });
});

test("an unmarked step never misclicks, even when one would be drawn", async () => {
  const { press, log } = pressing({ aimAt: { x: 47, y: 22 }, misclickAt: { x: 5, y: 5 } });
  await press.prepare(control());
  assert.equal(log.includes("misclick"), false);
});

test("a marked step may misclick once, before the aim and the first press, and records its point", async () => {
  const { press, log } = pressing({ marked: true, aimAt: { x: 47, y: 22 }, misclickAt: { x: 5, y: 5 } });
  const next = control();
  await press.prepare(next);
  await press.prepare(next);
  press.press(next);
  press.press(next);
  assert.deepEqual(log, ["misclick", "aim", "gesture", "aim", "gesture"], "one misclick a step; a press made once more is aimed afresh");
  assert.deepEqual(press.record(), { aimed: true, misclick: { x: 5, y: 5 } });
});

test("the mark says what the press that follows does: nothing before the aim, then its aim and misclick", async () => {
  const aimed = pressing({ marked: true, aimAt: { x: 47, y: 22 }, misclickAt: { x: 5, y: 5 } });
  assert.equal(aimed.press.marked(), undefined);
  await aimed.press.prepare(control());
  assert.deepEqual(aimed.press.marked(), { aimed: true, misclick: { x: 5, y: 5 } });
  const plain = pressing({ aimAt: undefined });
  await plain.press.prepare(control());
  assert.deepEqual(plain.press.marked(), { aimed: false });
});

test("any press that falls back to control.click() makes the step's record not aimed", async () => {
  let accepts = true;
  const log: string[] = [];
  const press = humanPagerPress({ commandId: "c", humanness: 100 }, HUMAN, 0, () => ACTIONABLE, {
    aim: () => (accepts ? ({ ...ACTIONABLE, point: { x: 1, y: 1 } }) : undefined),
    gesture: () => log.push("gesture"),
    valid: () => true,
    misclick: async () => "none"
  });
  const next = control();
  await press.prepare(next);
  press.press(next);
  accepts = false;
  press.press(next);
  assert.deepEqual(log, ["gesture"]);
  assert.equal(next.clicks, 1);
  assert.deepEqual(press.record(), { aimed: false });
});

test("a document a press loaded records the press its mark brought: an aimed press stays aimed", () => {
  const { press } = pressing();
  press.resumed({ aimed: true, misclick: { x: 5, y: 5 } });
  assert.deepEqual(press.record(), { aimed: true, misclick: { x: 5, y: 5 } });
});

test("a step that made no press records not aimed", () => {
  const { press } = pressing();
  assert.deepEqual(press.record(), { aimed: false });
});


test("a later press refreshes its mark for the current control and preserves an earlier unaimed press", async () => {
  let accepts = true;
  const press = humanPagerPress({ commandId: "c", humanness: 100, humannessMisclick: true }, HUMAN, 0, () => ACTIONABLE, {
    aim: () => (accepts ? ({ ...ACTIONABLE, point: { x: 1, y: 1 } }) : undefined),
    gesture: () => undefined,
    valid: () => true,
    misclick: async () => "none"
  });
  const first = control();
  await press.prepare(first);
  assert.deepEqual(press.marked(), { aimed: true });
  press.press(first);
  accepts = false;
  const replacement = control();
  await press.prepare(replacement);
  assert.deepEqual(press.marked(), { aimed: false }, "a navigation must carry this press's fallback, not the previous aim");
  press.press(replacement);
  accepts = true;
  await press.prepare(replacement);
  assert.deepEqual(press.marked(), { aimed: false }, "a later aim cannot erase an earlier fallback");
  press.press(replacement);
  assert.deepEqual(press.record(), { aimed: false });
});


test("a resumed fallback and misclick remain part of any later press", async () => {
  const { press, log } = pressing({ marked: true, aimAt: { x: 47, y: 22 }, misclickAt: { x: 9, y: 9 } });
  press.resumed({ aimed: false, misclick: { x: 5, y: 5 } });
  const next = control();
  await press.prepare(next);
  assert.deepEqual(log, ["aim"], "the resumed step already considered its one misclick");
  assert.deepEqual(press.marked(), { aimed: false, misclick: { x: 5, y: 5 } });
  press.press(next);
  assert.deepEqual(press.record(), { aimed: false, misclick: { x: 5, y: 5 } });
});


test("a point that goes stale while its mark is acknowledged is prepared again before dispatch", async () => {
  let valid = true;
  let aims = 0;
  const gestures: { x: number; y: number }[] = [];
  const press = humanPagerPress({ commandId: "c", humanness: 100 }, HUMAN, 0, () => ACTIONABLE, {
    aim: () => ({ ...ACTIONABLE, point: { x: ++aims, y: 1 } }),
    gesture: (_control, point) => gestures.push(point),
    valid: () => valid,
    misclick: async () => "none"
  });
  const next = control();
  await press.prepare(next);
  valid = false;
  assert.equal(press.ready?.(next), false);
  assert.deepEqual(gestures, [], "the stale point never dispatches");
  await press.prepare(next);
  valid = true;
  assert.equal(press.ready?.(next), true);
  assert.deepEqual(press.marked(), { aimed: true });
  press.press(next);
  assert.deepEqual(gestures, [{ x: 2, y: 1 }]);
});
