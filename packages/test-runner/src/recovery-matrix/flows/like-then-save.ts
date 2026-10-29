// Matrix case 13c: a step bound to a read list's row meets that row redrawn
// after the read, and finds it again without a model (t786).
//
// photo-social's home feed shows each post's like count, "842 likes". The Flow
// reads the feed's posts -- each one's author, the link to the post's own page,
// and its like count -- and then, for each of the first two, presses the post's
// heart and then its bookmark.
//
// The heart moves the post's own count by one once the server has the like
// (`apps/scenario-lab/src/scenarios/photo-social/client/post-script.ts`), so
// "842" is no longer anywhere in that post. The bookmark step's control is
// scoped to a record holding every value of its pass's row
// (`domain/src/output-nodes/targets/row-scope.ts`, the page's
// `content/identity/record.ts`), so no record holds it any more and the press
// fails target-not-found although the post is still there. After the third
// failed attempt Core re-runs the read internally, the web host matches the
// same post again by its link (a key column; a count may differ,
// `domain/src/runtime/target-reacquire/`), and the fourth attempt presses the
// bookmark on the fresh row. Every pass meets this, since every pass likes its
// own post first.
//
// Why not social-network-feed: its Like changes only the button's own label
// and class, and the post's words still hold "Like", so no value a read takes
// goes away; and its "See more" cannot be the change either, since a list read
// opens each kept row's collapsed text itself (`content/extraction/
// text-disclosure/`). The fixture is unchanged.
//
// The first two posts of the first screen are harbourlight.studio's
// `D1OKDvAEHfa` (842 likes) and saltmarsh.goods' `D0eFDg0l9aY` (412), neither
// liked nor saved when the visit starts (`data/saved.ts`); `repeat most: 2`
// keeps the loop to them whatever later screens load.
//
// Targets are the page as the browser renders it; classes move with the seed,
// so none is named:
// - the cookie dialog's "Decline optional cookies" by its test id; the
//   notifications prompt's second button, "Not Now"; the messages dock's
//   collapse control inside its shadow root (`client/overlay-script.ts`). All
//   three are `optional`: the extension's interference clearing may answer one
//   first;
// - a post is a feed `article` showing a like count (`a[href$="/liked_by/"] >
//   span`, absent where the author hides it); its author is the first profile
//   link that is not the avatar's, its link the timestamp's (`a[href*="/p/"]:has(> time)`);
// - the heart and the bookmark are div buttons named only by their icon's
//   label, "Like" and "Save". Both clicks carry an `element` identity: the row
//   scope is written into a recorded element, and a selector alone carries none.

const POST = String.raw`article:has(a[href$=\"/liked_by/\"] > span)`;
const READ = String.raw`{"item": "${POST}", "fields": {"author": "a[href$=\"/\"]:not([tabindex]):not([href*=\"/p/\"])", "postLink": {"kind": "link", "selector": "a[href*=\"/p/\"]:has(> time)"}, "likes": "a[href$=\"/liked_by/\"] > span"}}`;

export const LIKE_THEN_SAVE = String.raw`flow: Like the first two posts in the home feed and save each one
step: decline optional cookies if they are still asked
  node: web.dom.click
  selector: [data-testid="cookie-policy-manage-dialog-decline-button"]
  timeoutMs: 8000
  consequences: none
  optional: yes
step: answer Not Now to notifications if they are still asked
  node: web.dom.click
  selector: [role="dialog"][aria-modal="true"] button + button
  element.tagName: button
  timeoutMs: 8000
  consequences: none
  optional: yes
step: collapse the messages dock if it is open
  node: web.dom.click
  selector: [part="collapse-button"]
  element.context.shadowHosts: ["fl-dock"]
  timeoutMs: 6000
  consequences: none
  optional: yes
step posts: read the posts in the feed
  node: web.dom.extract_list
  extractList: ${READ}
  extractList.minItems: 2
step like: like the post
  node: web.dom.click
  selector: [role="button"]:has(> svg[aria-label="Like"])
  element.tagName: div
  element.role: button
  timeoutMs: 8000
  consequences: modify_existing
  repeat over: posts
  repeat through: save
  repeat most: 2
step save: save the post
  node: web.dom.click
  selector: [role="button"]:has(> svg[aria-label="Save"])
  element.tagName: div
  element.role: button
  timeoutMs: 3000
  consequences: modify_existing`;
