import type { ObservedCoreCall } from "./core-recording-proxy.js";
import type { ChatCheckContext } from "./types.js";

/**
 * Types one message into the chat the person sees -- the side panel or the
 * popup -- sends it, and answers the `append-turn` the extension sent Core
 * for it, as the recording proxy received it, with the thread it went to.
 *
 * Nothing here sends a runtime message or calls Core: the panel does, the way
 * it does for a person, so what is observed is the extension's own request.
 */
export async function sendChatMessage(context: ChatCheckContext, text: string, timeoutMs = 60_000): Promise<{ call: ObservedCoreCall; conversationId: string }> {
  const panel = context.session.panel;
  if (!panel) throw new Error("The chat is not open, so there is nowhere to type");
  const before = context.coreCalls().length;
  await panel.send(text);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const call = context.coreCalls().slice(before).find(candidate => candidate.endpoint === "append-turn" && (candidate.request as { text?: unknown } | null)?.text === text);
    if (call) {
      const conversationId = (call.request as { conversationId?: unknown }).conversationId;
      if (typeof conversationId !== "string") throw new Error("The extension's append-turn named no conversation");
      return { call, conversationId };
    }
    if (Date.now() >= deadline) {
      const seen = context.coreCalls().slice(before).map(candidate => `${candidate.endpoint}:${candidate.status}`).join(", ") || "nothing";
      const shown = await panel.text().catch((error: unknown) => `(the panel could not be read: ${error instanceof Error ? error.message.split(/\r?\n/u)[0] : String(error)})`);
      throw new Error(`The panel sent no append-turn for the message within ${timeoutMs} ms; the extension called ${seen}. The panel read: ${JSON.stringify(shown.slice(-400))}`);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
