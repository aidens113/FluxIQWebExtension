import { part, recordsOf, tally, textsOf, type LastingView, type SiteState } from "../lasting-view.js";

/** The classifieds: saved and hidden listings, offers and messages by listing, whatever their words. */
export function localClassifiedsView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  for (const id of textsOf(state, "saved")) tally(view, `saved:${id}`);
  for (const id of textsOf(state, "hidden")) tally(view, `hidden:${id}`);
  for (const offer of recordsOf(state, "offers")) tally(view, `offer:${part(offer, "listingId")}`);
  for (const message of recordsOf(state, "messages")) tally(view, `message:${part(message, "listingId")}`);
  if (state.notificationPrompt === "enabled") tally(view, "notifications");
  return view;
}
