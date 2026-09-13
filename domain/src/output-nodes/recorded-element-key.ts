// The one name a recorded control is given when a node asks for something the
// recording could not hold and a supplier answers it at run time: a value the
// recorder withheld (`secret-binding.ts`) and the files a user chose
// (`upload-binding.ts`). Both requests name the control by this rule, so a
// supplier derives the key once from the recorded element, whichever namespace
// the request is under.

import type { JsonObject } from "fluxiq/core";
import { objectValue, stringValue } from "./targets";

/**
 * The key a recorded control's run-time request is made under, from the
 * identity the node already carries. Nothing is invented: each source below is
 * already in the node's parameters, so a supplier reading the approved Flow can
 * see what the node is asking for without re-deriving anything.
 *
 * In order:
 *
 * 1. **The recorded visual target's state path.** `web-state/action-target.ts`
 *    builds it as `web.elements.<stateId>`, where `<stateId>` was assigned
 *    across the whole snapshot and carries the positional suffix that separates
 *    repeated controls (`element/identity.ts`, `elementStateIdAssigner`). It is
 *    the only identity here that is already unique among the page's controls,
 *    so it is preferred.
 * 2. **The author-written identifier** -- test id, `id`, `name` -- in the order
 *    `stableElementId` prefers them. Two controls on one page with the same
 *    authored id would collide; they would also be indistinguishable to every
 *    other part of the system, and a collision here means one request, which is
 *    a wrong value rather than a silent empty one.
 * 3. **The selector**, which the node must have to be executable at all.
 *
 * Undefined only when the payload carries no identity whatever -- in which case
 * the node has no selector either and never becomes an executable action.
 */
export function webAutomationRecordedElementKey(payload: JsonObject): string | undefined {
  const element = objectValue(payload.element);
  const attributes = objectValue(element?.attributes);
  const statePath = stringValue(objectValue(payload.visualTarget)?.statePath);
  const fromStatePath = statePath?.startsWith("web.elements.") ? statePath.slice("web.elements.".length) : undefined;
  const identity = fromStatePath
    ?? stringValue(element?.testId)
    ?? stringValue(attributes?.["data-testid"])
    ?? stringValue(attributes?.["data-test"])
    ?? stringValue(attributes?.["data-cy"])
    ?? stringValue(element?.id)
    ?? stringValue(attributes?.id)
    ?? stringValue(element?.name)
    ?? stringValue(attributes?.name)
    ?? stringValue(element?.selector)
    ?? stringValue(payload.selector);
  const key = sanitizeRecordedElementKey(identity ?? "");
  return key.length ? key : undefined;
}

/**
 * A key that survives being written into a path and read back out. Dots are
 * folded away because Core splits an unmatched path on them
 * (`readAutomationStatePath`), so a dot in the key would make the path mean two
 * different lookups depending on whether the supplier keyed the input flat.
 */
function sanitizeRecordedElementKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 120);
}
