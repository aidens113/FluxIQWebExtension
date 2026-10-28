import assert from "node:assert/strict";
import test from "node:test";
import type { PanelControls } from "../../../../extension-chat-check/index.js";
import { attachRecordedDemonstration } from "../attach-recorded-demonstration.js";

function panel(shown: () => string, log: string[]): PanelControls {
  return {
    async pressNamed(name) { log.push(`press ${name}`); },
    async fillLabelled() { throw new Error("attaching types nothing"); },
    async pressInGroup(group, name) { log.push(`group ${group}/${name}`); },
    async text() { return shown(); },
  };
}

test("opens Chat, presses Attach a recording, then the item named by the description, then reads the chip", async () => {
  const log: string[] = [];
  await attachRecordedDemonstration(panel(() => "Message to FluxIQ  Recording: I show it. Remove attached recording", log), " I show it. ");
  assert.deepEqual(log, ["press Chat", "press Attach a recording", "group Attach a recording/I show it."]);
});

test("fails, saying what the panel showed, when the chip never appears", async () => {
  await assert.rejects(() => attachRecordedDemonstration(panel(() => "no chip here", []), "I show it.", { pressMs: 50 }), /showed no chip.*no chip here/su);
});
