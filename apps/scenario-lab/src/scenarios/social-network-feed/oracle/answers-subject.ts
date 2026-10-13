/**
 * The test id of the page element holding the server's answer to one friend
 * request (`request-answers.ts`). Self-contained, because the page's script
 * carries it as source (`markup/shell.ts`) to find the element again.
 */
export function friendRequestAnswerSubject(id: string): string {
  return "social-friend-request-" + id;
}
