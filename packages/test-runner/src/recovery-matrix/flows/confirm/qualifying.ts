// Matrix row 13a (and the Flow row 9 runs under its dropped acknowledgement):
// social-network-feed's confirm-requests task as a candidate script.
//
// The four requests from people with at least five mutual friends -- Amara
// Osei, Jonas Weber, Lin Zhao and Freya Holm -- confirmed one after another.
// The site lets three confirms through in fifteen seconds, so the fourth press
// meets "You're going too fast". The extension reports that press as refused
// with the notice's own wait, and Core's retry presses again after it: a
// retry, never a failure, and never a model call.
//
// The three overlays are `optional`: the extension's interference clearing
// closes a dialog that stands in the way while a step waits for its target,
// including the very prompt a "Not now" step aims at (matrix case 13a, first
// launch: "closing 1 dialog the page had put in the way", then the target was
// absent on all four attempts), so a run must go on whether or not the Flow's
// own press was the one that answered it.
//
// Targets are the site's markup (`apps/scenario-lab/src/scenarios/
// social-network-feed/`), as its recording script names them (`manifest.ts`):
// - the cookie dialog (`data-lb="consent-title"`), its last button "Allow all cookies";
// - the notification prompt, a `dlg-t` dialog whose footer's first button is "Not now";
// - the chat window's "Close chat";
// - the banner's Friends link, then the requests page's "See all";
// - each request card by its profile link, and the card's Confirm.
export const CONFIRM_QUALIFYING = String.raw`flow: Confirm every friend request from someone with at least five mutual friends
step: allow the cookies if they are still asked
  node: web.dom.click
  selector: [data-lb="consent-title"] [role="button"]:last-child
  timeoutMs: 8000
  consequences: none
  optional: yes
step: decline notifications if they are still asked
  node: web.dom.click
  selector: [role="dialog"][data-lb="dlg-t"] > div:last-child > [role="button"]:first-child
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
  consequences: none
step: confirm Amara Osei
  node: web.dom.click
  selector: [role="listitem"]:has(a[href$="/people/amara-osei/"]) [aria-label="Confirm"]
  timeoutMs: 8000
  consequences: modify_existing
step: confirm Jonas Weber
  node: web.dom.click
  selector: [role="listitem"]:has(a[href$="/people/jonas-weber/"]) [aria-label="Confirm"]
  consequences: modify_existing
step: confirm Lin Zhao
  node: web.dom.click
  selector: [role="listitem"]:has(a[href$="/people/lin-zhao/"]) [aria-label="Confirm"]
  consequences: modify_existing
step: confirm Freya Holm
  node: web.dom.click
  selector: [role="listitem"]:has(a[href$="/people/freya-holm/"]) [aria-label="Confirm"]
  consequences: modify_existing
step: wait for Freya Holm's request to read accepted
  node: web.dom.wait_for_selector
  selector: [role="listitem"]:has(a[href$="/people/freya-holm/"]) a[href*="/messages/t/"]
  timeoutMs: 20000`;
