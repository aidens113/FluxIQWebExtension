import { RunnerFailure } from "../../../failure.js";
import type { PanelControls } from "../../../extension-chat-check/index.js";

const ATTACH_LABEL = "Attach a recording";
const CHAT_TAB = "Chat";
const PRESS_MS = 30_000;

/**
 * Attaches the recording to the message the person is about to write, as a person does: press
 * "Attach a recording" beside Send, press the item named by the recording's description in the
 * list that opens, and read the chip the composer then shows, "Recording: <description>". It
 * fails, saying what the panel showed, when the item is missing or the chip does not appear: a
 * message sent without it would be an instruction-only build wearing a recorded-evidence label.
 */
export async function attachRecordedDemonstration(panel: PanelControls, description: string, bounds: { pressMs?: number } = {}): Promise<void> {
  const pressMs = bounds.pressMs ?? PRESS_MS;
  // After Stop the panel shows the recording's review on its Automations tab; the composer is on Chat.
  await panel.pressNamed(CHAT_TAB, pressMs);
  await panel.pressNamed(ATTACH_LABEL, pressMs);
  await panel.pressInGroup(ATTACH_LABEL, description.trim(), pressMs);
  const chip = `Recording: ${description.trim()}`.replace(/\s+/gu, " ");
  const deadline = Date.now() + pressMs;
  for (;;) {
    const shown = await panel.text();
    if (shown.includes(chip)) return;
    if (Date.now() >= deadline) throw new RunnerFailure("runtime.behavior", `The composer showed no chip "${chip.slice(0, 80)}..." after the recording was chosen; the panel showed ${JSON.stringify(shown.slice(-300))}`, { details: { stage: "recording.attach" } });
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}
