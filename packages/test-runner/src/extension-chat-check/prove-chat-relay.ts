import { sendChatMessage } from "./send-chat-message.js";
import type { ChatCheckContext } from "./types.js";

/** The six capability ids `apps/extension/src/background/panel/chat-capabilities.ts` offers on every message. */
export const EXPECTED_CAPABILITY_IDS = ["flow.createHere", "flow.describe", "flow.explore", "flow.improve", "run.execute", "ask.answer"] as const;

export type ChatRelayObservation = {
  conversationId: string;
  sent: { text: string; capabilityIds: string[]; onScreen: Record<string, unknown> | null; bearer: boolean };
  /** Chrome only: whether Playwright saw the same body leave the extension's service worker. */
  workerRequestSeen?: boolean;
  core: { status: number; ok: unknown; execution: unknown; responseTurnId: unknown };
  personTurn: { ordinal: number; text: string };
  automationTurn: { ordinal: number; text: string; attachment: unknown };
  panelShowedAnswer: boolean;
  checks: Record<string, boolean>;
};

/**
 * Claims 1 and 2: a message typed in the chat reaches Core's `append-turn`
 * carrying the six capability ids and the scenario page as `onScreen.pageUrl`,
 * and Core answers it with an automation turn in the thread, which the panel
 * then shows.
 */
export async function proveChatRelay(context: ChatCheckContext, input: { message: string; expectedPageUrl: string }): Promise<ChatRelayObservation> {
  const { call, conversationId } = await sendChatMessage(context, input.message);
  const request = call.request as { capabilities?: Array<{ id?: unknown }>; onScreen?: Record<string, unknown> } | null;
  const capabilityIds = (request?.capabilities ?? []).map(entry => String(entry?.id));
  const onScreen = request?.onScreen ?? null;
  const response = call.response as { ok?: unknown; payload?: { turn?: { turnId?: unknown }; response?: { execution?: unknown } } } | null;
  const turns = await context.reader.waitFor(conversationId, "the person's turn and an automation turn after it", all => {
    const person = [...all].reverse().find(turn => turn.author === "person" && turn.text === input.message);
    const answer = person && all.find(turn => turn.ordinal > person.ordinal && turn.author !== "person");
    return person && answer ? { person, answer } : undefined;
  });
  const snippet = turns.answer.text.split("\n")[0]!.slice(0, 40);
  const panelShowedAnswer = await context.session.panel!.shows(snippet, 20_000);
  const workerRequests = context.workerRequests?.();
  const workerRequestSeen = workerRequests ? workerRequests.some(entry => entry.url.endsWith("/append-turn") && (entry.postData as { text?: unknown } | null)?.text === input.message) : undefined;
  const checks: Record<string, boolean> = {
    capabilityIdsAreTheSix: capabilityIds.length === EXPECTED_CAPABILITY_IDS.length && EXPECTED_CAPABILITY_IDS.every((id, index) => capabilityIds[index] === id),
    pageUrlIsTheScenarioPage: onScreen?.pageUrl === input.expectedPageUrl,
    carriedABearerCredential: call.bearer,
    coreAccepted: call.status === 200 && response?.ok === true,
    coreAnsweredWithAnAutomationTurn: turns.answer.author === "automation",
    panelShowedTheAnswer: panelShowedAnswer,
  };
  if (workerRequestSeen !== undefined) checks.serviceWorkerSentIt = workerRequestSeen;
  return {
    conversationId,
    sent: { text: input.message, capabilityIds, onScreen, bearer: call.bearer },
    ...(workerRequestSeen === undefined ? {} : { workerRequestSeen }),
    core: { status: call.status, ok: response?.ok, execution: response?.payload?.response?.execution ?? null, responseTurnId: response?.payload?.turn?.turnId ?? null },
    personTurn: { ordinal: turns.person.ordinal, text: turns.person.text },
    automationTurn: { ordinal: turns.answer.ordinal, text: turns.answer.text, attachment: turns.answer.attachment },
    panelShowedAnswer,
    checks,
  };
}
