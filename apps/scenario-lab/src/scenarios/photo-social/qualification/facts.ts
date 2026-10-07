import type { PhotoState } from "../types.js";

/** Complete synthetic account facts; no personal or message contents. */
export function studioUnionAccountFacts(state: PhotoState): string {
  return JSON.stringify({ saved: [...state.saved].sort(), collections: state.collections.map(({ name, slug, codes }) => ({ name, slug, codes: [...codes].sort() })).sort((a, b) => a.name.localeCompare(b.name, 'en')), liked: [...state.liked].sort(), following: [...state.following].sort(), outbox: [...new Set(state.messages.filter(({ from }) => from === 'me').map(({ thread }) => thread))].sort().map((thread) => ({ thread, count: state.messages.filter((message) => message.from === 'me' && message.thread === thread).length })), blocked: state.blocked });
}
