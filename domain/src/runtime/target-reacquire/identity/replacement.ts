import type { WebAutomationElementFingerprint } from "../../../actions/types";
import type { WebFreshTarget } from "./fresh-target";

/** Fresh identity/address only; readsWords is the sole property inherited from the stale target. */
export function webTargetReplacement(fresh: WebFreshTarget, stale: WebAutomationElementFingerprint): WebFreshTarget {
  const element = structuredClone(fresh.element);
  element.selector = fresh.selector;
  delete element.xpath;
  if (element.context !== undefined) {
    delete element.context.listPosition;
    delete element.context.tablePosition;
    if (Object.keys(element.context).length === 0) delete element.context;
  }
  if (stale.readsWords === true) element.readsWords = true;
  else delete element.readsWords;
  return { selector: fresh.selector, element, hidden: fresh.hidden };
}
