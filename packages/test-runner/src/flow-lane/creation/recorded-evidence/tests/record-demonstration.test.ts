import assert from "node:assert/strict";
import test from "node:test";
import type { ScenarioDemonstration } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../../failure.js";
import type { PanelControls } from "../../../../extension-chat-check/index.js";
import { recordDemonstration, type DemonstrationRecordingDeps } from "../record-demonstration.js";

const demonstration: ScenarioDemonstration = { id: "d", scenarioId: "s", taskId: "t", description: "  I search, tick a filter and untick it.  ", steps: [{ id: "one", operation: "click", target: "x" }], detours: [] };

/** A run where each seam logs its call; `after` is what Core lists once the person has pressed Stop. */
function harness(options: { after?: Array<Record<string, unknown>>; description?: string } = {}) {
  const log: string[] = [];
  let stopped = false;
  const stored = { recordingId: "rec.new", endedAt: 10, entryCount: 4, description: options.description ?? "I search, tick a filter and untick it." };
  const panel: PanelControls = {
    async pressNamed(name) {
      log.push(`press ${name}`);
      if (name === "Stop recording") stopped = true;
    },
    async fillLabelled(label, text) { log.push(`fill ${label}=${text}`); },
    async pressInGroup(group, name) { log.push(`group ${group}/${name}`); },
    async text() { return ""; },
  };
  const deps: DemonstrationRecordingDeps = {
    demonstration, projectId: "p1", panel,
    core: {
      async listRecordings() { return { payload: { recordings: stopped ? [{ recordingId: "rec.old" }, ...(options.after ?? [stored])] : [{ recordingId: "rec.old" }] } }; },
      async automationStudioCall() { return { payload: { recordings: [{ recordingId: "rec.new", endedAt: 10, entryCount: 4 }] } }; },
    },
    async selectProject(id) { log.push(`select ${id}`); },
    async focusScenario() { log.push("focus"); },
    async untilRecording() { log.push("recording"); },
    async untilStopped() { log.push("stopped"); },
    async playSteps(steps) {
      log.push(`play ${steps.length}`);
      return new Map();
    },
    async afterRecording() { log.push("judge"); },
    async returnToStart() { log.push("reset"); },
    async picture(moment) { log.push(`picture ${moment}`); },
    wait: { appearMs: 50 },
  };
  return { deps, log };
}

test("records through the panel in a person's order, then resets the site, and never attaches or sends", async () => {
  const { deps, log } = harness();
  const recorded = await recordDemonstration(deps);
  assert.deepEqual(log, [
    "select p1", "focus", "press Start recording", "fill Recording description=I search, tick a filter and untick it.", "press Start described recording",
    "recording", "picture recording", "play 1", "press Stop recording", "stopped", "picture stopped", "judge", "reset", "picture returned",
  ]);
  assert.equal(recorded.recordingId, "rec.new");
  assert.equal(recorded.description, "I search, tick a filter and untick it.");
  assert.deepEqual([...recorded.before], ["rec.old"]);
});

test("fails recording.set when two recordings appear for one demonstration", async () => {
  const { deps } = harness({ after: [{ recordingId: "rec.new" }, { recordingId: "rec.second" }] });
  await assert.rejects(() => recordDemonstration(deps), (error: unknown) => error instanceof RunnerFailure && error.details?.fact === "recording.set");
});

test("fails recording.set when no recording appears after Stop", async () => {
  const { deps } = harness({ after: [] });
  await assert.rejects(() => recordDemonstration(deps), (error: unknown) => error instanceof RunnerFailure && error.details?.fact === "recording.set");
});

test("fails recording.described, without resetting the site, when Core holds another description", async () => {
  const { deps, log } = harness({ description: "Something else" });
  await assert.rejects(() => recordDemonstration(deps), (error: unknown) => error instanceof RunnerFailure && error.details?.fact === "recording.described");
  assert.ok(!log.includes("reset"));
});
