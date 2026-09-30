// What the extension's chat may ask FluxIQ to do. Core executes each of these
// server-side and supplies its own descriptor for it, so only the ids are sent:
// the extension cannot describe a capability differently from how Core runs it.
// The ids are Core's conversation command catalog (`runtime/conversations/commands/`).

/** Capability ids the chat relay always offers Core on `append-turn`, as `[{ id }]`. */
export const CHAT_CAPABILITIES: readonly Readonly<{ id: string }>[] = Object.freeze([
  "flow.createHere",
  "flow.describe",
  "flow.explore",
  "flow.improve",
  "run.execute",
  "ask.answer"
].map((id) => Object.freeze({ id })));
