// What a withheld comparison says, and how a producer declares it already
// withheld one.
//
// Two exits carry an action's comparison off the browser -- the wire payload's
// `validation` (`client/gateway-mapping.ts`) and the failure record's
// `expected` and `actual`, re-established on the far side of the WebSocket
// (`runtime/adapter.ts`) -- and each asks `isSensitiveElementDescriptor` about
// the descriptor riding on the same result before letting the two strings
// through. The marker they substitute lives here rather than in either of them:
// a marker that reads differently at the two exits is a marker nobody can grep
// for, and grepping a whole serialized payload for a leak is how every leak in
// this plan was found. It sat in `client/gateway-mapping.ts` until the
// directory this file is in had an owner, which gave `runtime/` an import of
// `client/` for one string.
//
// The second export is the half the domain cannot work out for itself. It can
// judge whether an element is sensitive -- the wire descriptor carries `type`,
// `autocomplete` and `data-sensitive`, which is the whole rule. It cannot judge
// whether a string it is handed has *already* been redacted by the producer, so
// without a declaration it must withhold every comparison on a sensitive
// control, including the producer's carefully redacted phrasing ("the field
// holds a withheld value of 12 characters", which names a length and never a
// value). That is a real diagnostic cost paid on every sensitive-control
// failure, not only on a leaking one.
//
// The declaration is a contract, never a heuristic. Nothing here reads the
// text: a predicate that scans a string for things that look like card numbers
// both misses and misfires, and is worse than withholding.

/**
 * What a comparison says instead of its two strings when the action ran on a
 * control the sensitivity rule marks.
 */
export const WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT = "(withheld: the action ran on a control that holds a secret)";

/**
 * Whether the producer declared that it already withheld this comparison's
 * values.
 *
 * The declaration is `redacted: true` on the validation
 * (`WebAutomationActionValidation`), set by the verb that built the strings,
 * and it covers every comparison on that result: the validation's own
 * `expected` and `actual`, and the failure record's, which the producer builds
 * from the same two strings.
 *
 * **It fails safe when absent.** Anything other than the boolean `true` is
 * read as "not declared" and the caller withholds: an older client, a new verb
 * that has not been taught the flag, a value hand-written onto the wire, or a
 * validation carrying no comparison at all. A leak by omission is the failure
 * mode worth designing against here -- the flag exists to buy back phrasing,
 * and a flag that could be *forgotten* into permissiveness would buy that back
 * by handing out secrets.
 *
 * The input is `unknown` for the same reason `isSensitiveElementDescriptor`'s
 * is: one caller holds a typed validation and the other holds a JSON object
 * that crossed a WebSocket, and neither may assume the other's shape.
 */
export function isProducerRedactedComparison(validation: unknown): boolean {
  if (!validation || typeof validation !== "object" || Array.isArray(validation)) return false;
  return (validation as Record<string, unknown>).redacted === true;
}
