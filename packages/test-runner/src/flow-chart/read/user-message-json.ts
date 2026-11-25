/** What a provider request's first message carries: a string, or text blocks. */
export type RequestMessages = { messages?: { role?: string; content?: string | { text?: string }[] }[] };

/** The first user message's text (a string or its blocks joined); `undefined` when the request holds none. */
export function userMessageText(request: RequestMessages): string | undefined {
  const content = request.messages?.find((message) => message.role === undefined || message.role === "user")?.content;
  if (content === undefined) return undefined;
  return typeof content === "string" ? content : content.map((part) => part.text ?? "").join("");
}
