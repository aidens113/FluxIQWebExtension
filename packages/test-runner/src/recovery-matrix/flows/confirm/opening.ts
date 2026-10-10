// The steps every friend-request Flow opens with: the three overlays social-
// network-feed puts up on a fresh visit, answered if they are still asked, then
// the way to the requests page. One text, so the Flows cannot drift apart.
//
// The overlays are `optional`: the extension's interference clearing closes a
// dialog that stands in the way while a step waits for its target, so a run
// must go on whether or not the Flow's own press was the one that answered it.
//
// Targets are the page as the browser renders it, not the markup source. The
// site's script turns every `data-lb` into an `aria-labelledby` naming a
// generated id and drops the attribute (`client/shell-script.ts`, `hydrate`),
// so a selector on `data-lb` never matches. Until t403 both overlay steps
// named one, so neither ever found its target, and the clearing answered both
// prompts instead (matrix case 13a and 13b, t399). The two prompts are both
// `role="dialog"` with `aria-modal="true"`, and only the notifications prompt
// has a close control (`aria-label="Close"`), which tells them apart:
// - the cookie dialog's footer ends with "Allow all cookies";
// - the notifications prompt's footer starts with "Not now";
// - the chat window's "Close chat";
// - the banner's Friends link, then the requests page's "See all".
export const CONFIRM_OPENING = String.raw`step: allow the cookies if they are still asked
  node: web.dom.click
  selector: [role="dialog"][aria-modal="true"]:not(:has([aria-label="Close"])) > div:last-child > [role="button"]:last-child
  timeoutMs: 8000
  consequences: none
  optional: yes
step: decline notifications if they are still asked
  node: web.dom.click
  selector: [role="dialog"][aria-modal="true"]:has([aria-label="Close"]) > div:last-child > [role="button"]:first-child
  timeoutMs: 10000
  consequences: none
  optional: yes
step: close the chat if it is still open
  node: web.dom.click
  selector: [aria-label="Close chat"]
  timeoutMs: 10000
  consequences: none
  optional: yes
step: open Friends
  node: web.dom.click
  selector: [role="banner"] a[aria-label="Friends"]
  consequences: none
step: see all friend requests
  node: web.dom.click
  selector: [role="main"] a[href$="/friends/requests/"]
  timeoutMs: 8000
  consequences: none`;
