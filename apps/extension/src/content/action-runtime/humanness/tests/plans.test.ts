// The plans humanness draws (`../point-near-centre.ts`, `../typing-gaps.ts`,
// `../scroll-dwell.ts`) and how they are fitted within a command's own time
// (`../fit-within-command.ts`): the point stays inside the box's inset, the
// gaps and the dwell grow with the level, the same command id draws the same
// plan, and a plan longer than the room is scaled down, never dropped.

import assert from "node:assert/strict";
import test from "node:test";
import { commandHumanness, type CommandHumanness } from "../command-humanness";
import { fitWithinCommand } from "../fit-within-command";
import { pointNearCentre } from "../point-near-centre";
import { scrollDwellMs } from "../scroll-dwell";
import { typingGaps } from "../typing-gaps";

function human(level: number, commandId = "cmd-plan"): CommandHumanness {
  const found = commandHumanness({ commandId, humanness: level });
  assert.ok(found);
  return found;
}

const BOX = { left: 100, top: 200, right: 220, bottom: 240 };
const CENTRE = { x: 160, y: 220 };

test("a point drawn at level 80 stays inside the box with a margin on every side, and near the centre", () => {
  for (let index = 0; index < 500; index += 1) {
    const point = pointNearCentre(BOX, CENTRE, human(80, `cmd-${index}`));
    // A 120 by 40 box keeps 24 px clear left and right (20%) and 8 px top and bottom.
    assert.ok(point.x >= BOX.left + 24 && point.x <= BOX.right - 24, `x ${point.x}`);
    assert.ok(point.y >= BOX.top + 8 && point.y <= BOX.bottom - 8, `y ${point.y}`);
  }
});

test("the spread of the drawn point grows with the level, and a tiny box keeps its centre", () => {
  const spread = (level: number) => {
    let total = 0;
    for (let index = 0; index < 300; index += 1) total += Math.abs(pointNearCentre(BOX, CENTRE, human(level, `cmd-${index}`)).x - CENTRE.x);
    return total / 300;
  };
  assert.ok(spread(20) < spread(80), "a higher level spreads further");
  assert.ok(spread(80) > 1, "level 80 moves the point off the centre");
  const tiny = { left: 10, top: 10, right: 14, bottom: 14 };
  assert.deepEqual(pointNearCentre(tiny, { x: 12, y: 12 }, human(100)), { x: 12, y: 12 }, "a box no wider than its margins leaves no room to move");
});

test("the same command id draws the same point, gaps and dwell", () => {
  assert.deepEqual(pointNearCentre(BOX, CENTRE, human(80, "cmd-same")), pointNearCentre(BOX, CENTRE, human(80, "cmd-same")));
  assert.deepEqual(typingGaps("hello world", human(80, "cmd-same")), typingGaps("hello world", human(80, "cmd-same")));
  assert.equal(scrollDwellMs(human(80, "cmd-same")), scrollDwellMs(human(80, "cmd-same")));
});

test("typing plans one gap before each character after the first, counting characters rather than code units", () => {
  assert.equal(typingGaps("hello", human(80)).length, 4);
  assert.equal(typingGaps("a", human(80)).length, 0);
  assert.equal(typingGaps("", human(80)).length, 0);
  assert.equal(typingGaps("café \u{1F600}", human(80)).length, 5);
  assert.ok(typingGaps("hello world", human(80)).every((gap) => gap > 0));
});

test("the mean gap and the mean dwell grow with the level", () => {
  const meanGap = (level: number) => {
    const gaps = Array.from({ length: 100 }, (_, index) => typingGaps("abcdefghij", human(level, `cmd-${index}`))).flat();
    return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  };
  const meanDwell = (level: number) => Array.from({ length: 300 }, (_, index) => scrollDwellMs(human(level, `cmd-${index}`))).reduce((sum, dwell) => sum + dwell, 0) / 300;
  assert.ok(meanGap(20) < meanGap(80));
  assert.ok(meanGap(80) > 80 && meanGap(80) < 220, `mean gap at 80 is ${meanGap(80)}`);
  assert.ok(meanDwell(20) < meanDwell(80));
  assert.ok(meanDwell(80) > 450 && meanDwell(80) < 1_100, `mean dwell at 80 is ${meanDwell(80)}`);
});

test("a plan within the room is kept, in whole milliseconds", () => {
  assert.deepEqual(fitWithinCommand([100.7, 200.2], { timeoutMs: 10_000 }, 1_000, 1_000), [100, 200]);
});

test("a plan longer than the room is scaled down to fit it, never dropped", () => {
  // 5 s of command, 1 s already spent: 4 s left, of which 40% is the pauses' room.
  const fitted = fitWithinCommand([1_000, 1_000, 2_000], { timeoutMs: 5_000 }, 1_000, 2_000);
  assert.ok(fitted.reduce((sum, ms) => sum + ms, 0) <= 1_600);
  assert.deepEqual(fitted, [400, 400, 800]);
});

test("the room is the command's time before its robot-check allowance, or Core's default when it names none", () => {
  // 20 s of which 15 s is the check allowance: 5 s is the command's own.
  assert.deepEqual(fitWithinCommand([10_000], { timeoutMs: 20_000, checkWaitMs: 15_000 }, 0, 0), [2_000]);
  assert.deepEqual(fitWithinCommand([10_000], {}, 0, 0), [2_000]);
});

test("a command whose time is already spent pauses for nothing", () => {
  assert.deepEqual(fitWithinCommand([300, 300], { timeoutMs: 1_000 }, 0, 5_000), [0, 0]);
});
