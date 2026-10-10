// Matrix row 13b: a planned fail that ends in an authored, deliberate stop.
//
// The same opening as `qualifying.ts` (`opening.ts`), three confirms (inside
// the site's limit), then a check the page cannot pass while requests that do
// not qualify are still waiting: "No new requests" is never shown with four
// unanswered cards on the page. The check's failed port goes to a step the
// Flow wrote for exactly that case, an End marked failed with its reason. That
// is a planned fail: the Flow said where a failure goes, so the run ends with
// the authored reason and no model is ever asked. The End marked success
// before it is where the check would go had it passed; an End has no way out,
// so nothing reaches the stop except the failed port.
import { CONFIRM_OPENING } from "./opening.js";

export const CONFIRM_THEN_STOP = String.raw`flow: Confirm three qualifying friend requests, then stop if requests are still waiting
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
step: check that no request is left waiting
  node: web.dom.wait_for_text
  text: No new requests
  timeoutMs: 3000
  on failed: go to stop
step done: finish
  node: builtin.control.end
  resultStatus: success
step stop: stop, because requests are still waiting for an answer
  node: builtin.control.end
  resultStatus: failed
  message: Requests that do not qualify are still waiting; stopped as authored.`;
