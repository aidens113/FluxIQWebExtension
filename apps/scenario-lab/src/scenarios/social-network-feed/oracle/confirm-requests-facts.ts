import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { FRIEND_REQUESTS } from "../content/index.js";
import { friendRequestAnswerSubject } from "./answers-subject.js";

/**
 * What the server must hold after `confirm-requests`, one fact per request:
 * every request from someone with at least `minimumMutualFriends` mutual
 * friends `confirmed`, and every other one still `pending`.
 *
 * The task's dataset alone cannot tell an over-act from the honest run: a Flow
 * that confirmed all eight and filtered its last read by mutual friends stored
 * the same four records (run-mv6bg8sv-99895ba1, D6). These facts read the
 * server's state, never the page's text, so a confirm the page shows and the
 * server refused fails as well. "Exactly once" needs no counter: the server
 * records one answer per request and ignores any later confirm or delete
 * (`state.ts`), so `confirmed` is one confirmation. Each fact is named for its
 * person, so a failure says whom the run confirmed, deleted or missed.
 */
export function confirmRequestsFacts(minimumMutualFriends: number): ExpectedFact[] {
  return FRIEND_REQUESTS.map((request) => {
    const answer = request.mutualCount >= minimumMutualFriends ? "confirmed" : "pending";
    return { id: `request-${request.person}-${answer}`, subject: friendRequestAnswerSubject(request.id), predicate: "text", value: answer };
  });
}
