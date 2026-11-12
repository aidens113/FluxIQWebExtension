/** What the engine process tells the reaper over IPC: take responsibility for a profile directory, or let it go. */
export type ReaperMessage = { type: "register"; directory: string; fresh: boolean; requestId: number } | { type: "forget"; directory: string; requestId: number };

export function isReaperMessage(value: unknown): value is ReaperMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  if (!Number.isSafeInteger(message["requestId"]) || Number(message["requestId"]) < 1) return false;
  if (typeof message["directory"] !== "string") return false;
  return message["type"] === "forget" || (message["type"] === "register" && typeof message["fresh"] === "boolean");
}
