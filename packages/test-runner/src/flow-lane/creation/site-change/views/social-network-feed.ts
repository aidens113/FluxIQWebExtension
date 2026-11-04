import { countOf, nested, part, recordsOf, tally, textsOf, type LastingView, type SiteState } from "../lasting-view.js";

/** The feed: posts by group and audience, whatever their words, trashed, hidden, liked and shared posts, answered and sent requests, and chat messages. */
export function socialNetworkFeedView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  for (const post of recordsOf(state, "pending")) tally(view, `group-post:${part(post, "group")}:${part(post, "kind")}`);
  for (const post of recordsOf(state, "created")) tally(view, `post:${part(post, "audience")}`);
  for (const id of textsOf(state, "trashed")) tally(view, `trashed:${id}`);
  for (const id of textsOf(state, "hidden")) tally(view, `hidden:${id}`);
  for (const id of textsOf(state, "liked")) tally(view, `liked:${id}`);
  for (const id of textsOf(state, "shared")) tally(view, `shared:${id}`);
  for (const id of textsOf(state, "friendRequestsSent")) tally(view, `friend-request:${id}`);
  for (const [id, answer] of Object.entries(nested(state, "requests"))) if (typeof answer === "string") tally(view, `request:${id}:${answer}`);
  tally(view, "chat-messages", countOf(state, "chatMessagesSent"));
  return view;
}
