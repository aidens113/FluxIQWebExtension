import { sendChatMessage } from "../../send-chat-message.js";
import type { ChatCheckContext } from "../../types.js";
import { chatIsQuiet, extensionReadsSince } from "./push-evidence.js";

/** How long the open chat must make no read of its own before the turn is written. A timer shorter than this would keep it from ever being quiet. */
const QUIET_MS = 8_000;
const QUIET_BOUND_MS = 60_000;
const ARRIVAL_BOUND_MS = 30_000;

/** The turn that opens the chat the panel then writes into; a page holding the same chat shows it. */
export const PUSH_PROOF_OPENING_TURN = "Push proof: this turn opens the chat the panel then writes to.";

export type PanelTurnPushObservation = { conversationId: string; quietBeforeWriteMs: number; arrivedAfterMs: number | null; readsAfterWrite: number };

/**
 * A turn the signed-in person writes from the web panel reaches the extension chat that is already open on
 * that thread, by push. The extension chat runs no read interval and re-reads only when Core says the
 * conversation changed, so the proof makes the chat quiet first (no read of its own for `QUIET_MS`), then
 * writes the turn as the person, and waits for the open chat to show it. A timer could not satisfy both
 * halves: it would keep the chat from ever being quiet, and without a push nothing would make it read.
 */
export async function provePanelTurnPush(context: ChatCheckContext, input: { writePanelTurn(conversationId: string, text: string): Promise<void> }): Promise<{ observation: PanelTurnPushObservation; checks: Record<string, boolean> }> {
  const panel = context.session.panel;
  if (!panel) throw new Error("The chat is not open, so a turn written elsewhere has nowhere to arrive.");
  const { conversationId } = await sendChatMessage(context, PUSH_PROOF_OPENING_TURN);
  await panel.markDocument();

  const floor = Date.now();
  const quietDeadline = floor + QUIET_BOUND_MS;
  while (!chatIsQuiet(context.coreCalls(), Date.now(), QUIET_MS, floor) && Date.now() < quietDeadline) await new Promise((resolve) => setTimeout(resolve, 250));
  const quiet = chatIsQuiet(context.coreCalls(), Date.now(), QUIET_MS, floor);
  const quietBeforeWriteMs = Date.now() - floor;
  context.log(`[chat-check] push proof: open chat ${quiet ? "quiet" : "never quiet"} after ${quietBeforeWriteMs} ms`);

  const text = `Written from the web panel for the push proof ${Date.now().toString(36)}`;
  const wroteAt = Date.now();
  await input.writePanelTurn(conversationId, text);
  const shown = await panel.shows(text, ARRIVAL_BOUND_MS);
  const arrivedAfterMs = shown ? Date.now() - wroteAt : null;
  const reads = extensionReadsSince(context.coreCalls(), wroteAt);
  context.log(`[chat-check] push proof: panel turn ${shown ? `shown after ${arrivedAfterMs} ms` : "never shown"}; the chat made ${reads.length} read(s) after it was written`);
  await context.evidence.shot("panel-turn-push");
  return {
    observation: { conversationId, quietBeforeWriteMs, arrivedAfterMs, readsAfterWrite: reads.length },
    checks: {
      "panelTurnPush:chatWasQuietBeforeTheWrite": quiet,
      "panelTurnPush:turnReachedTheOpenChat": shown,
      "panelTurnPush:chatReadAfterTheWrite": reads.length > 0,
      "panelTurnPush:chatWasNotReloaded": await panel.documentIsMarked(),
    },
  };
}
