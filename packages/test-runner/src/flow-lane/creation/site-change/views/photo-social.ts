import { part, recordsOf, tally, textsOf, type LastingView, type SiteState } from "../lasting-view.js";

/** The photo site: saved and liked posts, each collection's posts, follows and the messages the person sent by thread, whatever their words. */
export function photoSocialView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  for (const code of textsOf(state, "saved")) tally(view, `saved:${code}`);
  for (const code of textsOf(state, "liked")) tally(view, `liked:${code}`);
  for (const account of textsOf(state, "following")) tally(view, `following:${account}`);
  for (const collection of recordsOf(state, "collections")) {
    tally(view, `collection:${part(collection, "slug")}`);
    for (const code of textsOf(collection, "codes")) tally(view, `collected:${part(collection, "slug")}:${code}`);
  }
  // A thread holds the shop's replies too; only what the person sent is their act.
  for (const message of recordsOf(state, "messages")) if (message.from === "me") tally(view, `message:${part(message, "thread")}`);
  return view;
}
