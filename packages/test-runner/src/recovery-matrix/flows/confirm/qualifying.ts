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
// The opening -- the three overlays and the way to the requests page -- is
// `opening.ts`. Each request card is found by its profile link, and the
// card's Confirm by its label (`apps/scenario-lab/src/scenarios/
// social-network-feed/`).
import { CONFIRM_OPENING } from "./opening.js";

export const CONFIRM_QUALIFYING = String.raw`flow: Confirm every friend request from someone with at least five mutual friends
${CONFIRM_OPENING}
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
