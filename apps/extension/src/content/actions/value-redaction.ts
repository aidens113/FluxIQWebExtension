// How a validation string is allowed to name a field's value.
//
// A verb proves its post-condition by comparing what it asked for with what the
// field ended up holding, and it says both in `expected` and `actual`. Those
// strings travel to the gateway inside the action result and into Core's
// failure record, so for a sensitive control -- a password, a one-time code, a
// card field, anything marked `data-sensitive` -- quoting the value hands the
// secret to every consumer of the result. That was the leak `web.dom.type`
// carried: it returned the typed text twice in one result.
//
// The answer is not to drop the comparison. A validation that cannot say
// whether the value matched is worthless, so the verbs still say that, in
// words; what they stop doing is quoting. The value is replaced by its length,
// which is what a person debugging a read-back actually needs -- an empty field,
// a truncated entry, a field that reverted -- and which says nothing about the
// content.
//
// The sensitivity test is deliberately not here. It is the one shared
// `isSensitiveFieldSignature` (src/shared/sensitive-field.ts), which each verb
// reaches through `isSensitiveFormControl` and passes in as `withheld`: a
// second rule in this file is exactly how a billing card number leaked once
// already.

/** A field's value as a validation string may name it: quoted, or its length alone when the control is sensitive. */
export function describeFieldValue(value: string, withheld: boolean): string {
  if (!withheld) return `"${value}"`;
  if (value.length === 0) return "an empty value";
  return `a withheld value of ${value.length} character${value.length === 1 ? "" : "s"}`;
}
