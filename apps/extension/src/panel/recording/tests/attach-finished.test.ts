import assert from "node:assert/strict";
import test from "node:test";
import { attachFinishedRecording, type FinishedRecordingDeps } from "../attach-finished";

const pending = { description: "Add a coffee to the cart", known: ["rec-old"], at: 1 };
const done = { id: "rec-new", description: "Add a coffee to the cart", status: "completed" };

type Listed = Awaited<ReturnType<FinishedRecordingDeps["list"]>>;

function deps(lists: Array<Listed | Error>, attach: (count: number) => boolean = () => true) {
  const waits: number[] = [];
  const attached: number[] = [];
  const reads = [...lists];
  const made: FinishedRecordingDeps = {
    list: async () => {
      const next = reads.shift();
      if (next instanceof Error) throw next;
      return next;
    },
    attach: async () => {
      attached.push(1);
      return attach(attached.length);
    },
    wait: async (ms) => {
      waits.push(ms);
    }
  };
  return { made, waits, attached };
}

test("it waits for the described recording to be saved, then attaches, never the older one", async () => {
  const { made, waits, attached } = deps([
    [{ id: "rec-old", description: "Add a coffee to the cart", status: "completed" }],
    [{ ...done, status: "recording" }],
    [{ id: "rec-old", description: "Add a coffee to the cart", status: "completed" }, done]
  ]);
  assert.equal(await attachFinishedRecording(pending, made, { tries: 5, everyMs: 10 }), true);
  assert.deepEqual(waits, [10, 10]);
  assert.equal(attached.length, 1);
});

test("a recording with another description is not the one", async () => {
  const { made, attached } = deps([[{ ...done, description: "Something else" }]]);
  assert.equal(await attachFinishedRecording(pending, made, { tries: 1, everyMs: 1 }), false);
  assert.equal(attached.length, 0);
});

test("a failed read or a refused attach is tried again until the tries run out", async () => {
  const { made, attached } = deps([new Error("read failed"), undefined, [done], [done]], (count) => count > 1);
  assert.equal(await attachFinishedRecording(pending, made, { tries: 4, everyMs: 1 }), true);
  assert.equal(attached.length, 2);
  const none = deps([[]]);
  assert.equal(await attachFinishedRecording(pending, none.made, { tries: 3, everyMs: 1 }), false);
});

test("a recording with an end time counts as saved", async () => {
  const { made } = deps([[{ id: "rec-new", description: pending.description, endedAt: 5 }]]);
  assert.equal(await attachFinishedRecording(pending, made, { tries: 1, everyMs: 1 }), true);
});
