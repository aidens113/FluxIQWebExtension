// Matrix row 13b: a planned fail that ends in an authored, deliberate stop.
//
// The same opening as `qualifying.ts`, three confirms (inside the
// site's limit), then a check the page cannot pass while requests that do not
// qualify are still waiting: "No new requests" is never shown with four
// unanswered cards on the page. The check's failed port goes to a step the
// Flow wrote for exactly that case, an End marked failed with its reason. That
// is a planned fail: the Flow said where a failure goes, so the run ends with
// the authored reason and no model is ever asked. The End marked success
// before it is where the check would go had it passed; an End has no way out,
// so nothing reaches the stop except the failed port.
export const CONFIRM_THEN_STOP = String.raw`flow: Confirm three qualifying friend requests, then stop if requests are still waiting
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
