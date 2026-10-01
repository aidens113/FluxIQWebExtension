import type { ApprovalFlow } from "../approval-flow.js";
import type { ObservedCoreCall } from "../core-recording-proxy.js";
import { sendChatMessage } from "../send-chat-message.js";
import type { ThreadTurn } from "../thread-reader.js";
import type { ChatCheckContext } from "../types.js";

export type AskAnswerObservation = {
  conversationId: string;
  runMessage: { text: string; status: number; execution: unknown };
  askBefore: { askId: string; kind: string; status: string; text: string };
  answerSent: { request: unknown; status: number; ok: unknown } | null;
  askAfter: { status: string; answer: unknown };
  resultTurn: { text: string; attachment: unknown } | null;
  /** Why no result turn was read, when none was. */
  resultTurnMissing: string | null;
  scenarioShowsDeleted: boolean;
  checks: Record<string, boolean>;
};

/**
 * Claim 3: a question pending in the chat's thread, answered from the
 * extension, is settled in Core with that answer.
 *
 * The question is real and needs no model: the person asks the chat to run a
 * saved Flow whose first step is Core's approval node in front of a delete;
 * Core's `run.execute` runs it inside the thread's context, and the approval
 * parks the run on a confirm ask in that same thread. The person answers with
 * the panel's own Yes button (`panelConversationAnswer`, kind `grant`), and the
 * thread is read back from Core as the signed-in person.
 */
export async function proveAskAnswered(context: ChatCheckContext, input: { flow: ApprovalFlow; screenshot: (name: string) => Promise<unknown> }): Promise<AskAnswerObservation> {
  const text = `Run the ${input.flow.name} flow`;
  const { call, conversationId } = await sendChatMessage(context, text);
  const execution = (call.response as { payload?: { response?: { execution?: unknown } } } | null)?.payload?.response?.execution ?? null;
  context.log(`[chat-check] run message: append-turn ${call.status}, execution ${JSON.stringify(execution)}`);
  const pending = await context.reader.waitFor(conversationId, "the run's approval question pending in the thread", turns => turns.find(turn => turn.ask?.status === "pending" && turn.ask.kind === "confirm"), 120_000);
  const ask = pending.ask!;
  const panel = context.session.panel!;
  if (!await panel.shows(pending.text.slice(0, 30), 30_000)) throw new Error("The ask is pending in Core but the panel never showed it");
  await input.screenshot("ask-pending-in-panel");
  const before = context.coreCalls().length;
  await panel.press("Yes", 30_000);
  const answered = await waitForCall(context, before, "answer-ask", 30_000);
  const settled = await context.reader.waitFor(conversationId, "the ask settled in Core", turns => {
    const turn = turns.find(candidate => candidate.ask?.askId === ask.askId);
    return turn?.ask && turn.ask.status !== "pending" ? turn.ask : undefined;
  });
  const ending = await context.reader.waitFor(conversationId, "the run's result turn", turns => resultTurn(turns, pending.ordinal), 120_000).then(turn => ({ turn, reason: null }), (error: unknown) => ({ turn: null, reason: error instanceof Error ? error.message : String(error) }));
  const result = ending.turn;
  const scenarioShowsDeleted = await context.session.scenario.getByText("Request removed").first().waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false);
  const request = answered?.request as { askId?: unknown; kind?: unknown } | null | undefined;
  const started = execution as { capabilityId?: unknown; status?: unknown } | null;
  return {
    conversationId,
    runMessage: { text, status: call.status, execution },
    askBefore: { askId: ask.askId, kind: ask.kind, status: ask.status, text: pending.text },
    answerSent: answered ? { request: answered.request, status: answered.status, ok: (answered.response as { ok?: unknown } | null)?.ok } : null,
    askAfter: { status: settled.status, answer: settled.answer },
    resultTurn: result ? { text: result.text, attachment: result.attachment } : null,
    resultTurnMissing: ending.reason,
    scenarioShowsDeleted,
    checks: {
      coreStartedTheRun: started?.capabilityId === "run.execute" && started?.status === "started",
      askWasPendingInTheChatThread: ask.status === "pending",
      extensionSentTheAnswer: request?.askId === ask.askId && request?.kind === "grant" && answered?.status === 200,
      coreSettledItWithThatAnswer: settled.status === "answered" && settled.answer?.kind === "grant",
      runReportedItsEnding: result !== null,
    },
  };
}

async function waitForCall(context: ChatCheckContext, before: number, endpoint: string, timeoutMs: number): Promise<ObservedCoreCall | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const call = context.coreCalls().slice(before).find(candidate => candidate.endpoint === endpoint);
    if (call || Date.now() >= deadline) return call;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

function resultTurn(turns: ThreadTurn[], after: number): ThreadTurn | undefined {
  return turns.find(turn => turn.ordinal > after && turn.attachment?.kind === "panel-capability-result" && turn.attachment.ref === "run.execute");
}
