// Whether Core's answer to a message the person sent says it started work.
//
// The background relays the send to Core's `append-turn` and hands the answer
// back unchanged (`background/panel/conversation-relay.ts`). With the panel's
// capabilities, Core reads the message, decides, and when the decision is a
// command it runs itself, starts it and says what came of it as
// `payload.response.execution` (Core's
// `AutomationStudioConversationCommandExecution`): `started` when work is now
// under way and its activity will follow, `done` or `failed` when the command
// finished inside the answer, and no execution at all when Core answered in
// words only. A first message's answer carries the same fields beside the
// opened `conversation`.
//
// Read by shape: anything else -- a failed send, a turn stored without
// capabilities, a payload this reader does not know -- is not a start.

/** True when `answer` says Core started work that will report activity. */
export function sendStartedWork(answer: unknown): boolean {
  const relayed = record(answer);
  if (relayed?.ok !== true) return false;
  const execution = record(record(record(relayed.payload)?.response)?.execution);
  return execution?.status === "started";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
