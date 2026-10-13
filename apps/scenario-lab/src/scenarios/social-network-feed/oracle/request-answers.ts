/**
 * The server's answer to one friend request, as the page's
 * `social-friend-request-<id>` element carries it: `pending` until it is
 * answered, then `confirmed` or `deleted`. A request nobody answered is written
 * out as `pending` rather than left out, so a fact can say a request is still
 * pending, which an absent value could not.
 *
 * It is self-contained -- no imports, no closures -- because the page's script
 * carries it as source (`markup/shell.ts`) to rewrite the elements after every
 * answer, so the live page reads exactly what a fresh render would.
 */
export function friendRequestAnswer(requests: Readonly<Record<string, string>>, id: string): string {
  return requests[id] ?? "pending";
}
