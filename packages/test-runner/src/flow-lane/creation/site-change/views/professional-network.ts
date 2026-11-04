import { part, recordsOf, tally, textsOf, type LastingView, type SiteState } from "../lasting-view.js";

/** The network: withdrawn, accepted and ignored invitations, follows, requests the run sent by member and messages by thread. */
export function professionalNetworkView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  for (const id of textsOf(state, "withdrawn")) tally(view, `withdrawn:${id}`);
  for (const id of textsOf(state, "accepted")) tally(view, `accepted:${id}`);
  for (const id of textsOf(state, "ignored")) tally(view, `ignored:${id}`);
  for (const id of textsOf(state, "following")) tally(view, `following:${id}`);
  for (const invitation of recordsOf(state, "sentByRun")) tally(view, `invited:${part(invitation, "memberUrn")}`);
  for (const message of recordsOf(state, "messages")) tally(view, `message:${part(message, "thread")}`);
  return view;
}
