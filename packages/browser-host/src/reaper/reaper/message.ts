/** What the engine process tells the reaper over IPC: take responsibility for a profile directory, or let it go. */
export type ReaperMessage = { type: "register"; directory: string; fresh: boolean } | { type: "forget"; directory: string };

export function isReaperMessage(value: unknown): value is ReaperMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  if (typeof message["directory"] !== "string") return false;
  return message["type"] === "forget" || (message["type"] === "register" && typeof message["fresh"] === "boolean");
}
