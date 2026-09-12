// Writing the page-evidence contract, as `domain/src/page-evidence/wire.ts` is
// how it is read.
//
// ## The hole this closes
//
// Every optional field on the contract used to be emitted through a conditional
// spread:
//
// ```ts
// return { selector, role, ...(label ? { label } : {}) };
// ```
//
// TypeScript performs **no excess-property check through a spread**. The spread
// source `{ label }` is its own fresh literal, contextually typed by nothing, so
// the target's key set never sees it. Rename that key to `title` and the field
// leaves the wire in silence: `check` exits 0, every unit test passes, and both
// domain readers -- which are joined to the contract by type, so they still
// compile -- start reporting a page fact the producer no longer sends.
//
// That is the same failure the shared contract was built to end. Three defects
// in one plan came from a reader and a producer disagreeing about a field name
// with both sides' own suites green, and closing it for readers while leaving it
// open for producers closes the door and leaves the window.
//
// A plain property in an object literal **is** excess-checked against its
// contextual type. So the fix is to stop spreading: write every field, optional
// ones included, as a plain property whose value may be `undefined`, and drop
// the undefined ones afterwards. `present` is that drop.
//
// ## Mentioned at the call site; optional on the wire
//
// The two are separated deliberately, because a rename is only half the way a
// field goes missing. The other half is deletion, and a contract type cannot
// catch a deleted *optional* field -- absence is exactly what optional means.
//
// So the call site must **mention** every key of the contract type, while an
// optional one is free to be given `undefined` and is then absent from the
// result. Deleting `label:` from a producer stops compiling; a page with no
// label still produces an object with no `label` key. Adding an optional field
// to the contract likewise stops every producer of that type compiling until it
// says what it writes there, which is the difference between a field that was
// considered and one that was forgotten.
//
// ## Why the type argument is not optional
//
// The check only happens when the literal has a contextual type the compiler
// did not read off the literal itself. `present({ ... })` with `T` inferred
// would infer `T` *from* the argument and check nothing -- the same silence in a
// new costume. `NoInfer<T>` stops the inference, and `object extends T ? never`
// turns a call with no type argument into a hard error rather than a call that
// quietly returns `object`. So a call site either names the contract type it is
// writing or it does not compile.
//
// The same reason applies to `apps/extension/src/background/connection/`'s
// `compactObject`, whose runtime behaviour is identical: it infers `T` from its
// argument, so it compacts correctly and checks nothing. It is not a substitute,
// and neither is it wrong -- its callers assign the result to a typed target.
//
// ## What it deliberately does not do
//
// It writes no defaults and it invents no fields. An optional field whose value
// is `undefined` stays **absent** from the object, because absent and empty are
// different facts everywhere in this contract: a page with no dialog is not a
// page with an empty dialog, and `truncated: false` is not the same evidence as
// no truncation report at all. `false`, `0` and `""` are values and are kept.

/** Keys of `T` a caller may leave out. */
type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];

/** Keys of `T` that must carry a value. */
type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>;

/**
 * `T`'s required keys, which may not be `undefined`.
 *
 * The `Exclude` matters because `present` strips `undefined`: a required key
 * given `undefined` would be silently removed and the returned `T` would be a
 * lie. No contract type has such a key today, and this is what keeps it that way.
 */
type RequiredFields<T> = { [K in RequiredKeys<T>]-?: Exclude<T[K], undefined> };

/**
 * `T`'s optional keys, each of which must be written and may be `undefined`.
 *
 * `-?` makes the key mandatory at the call site; the `| undefined` keeps the
 * field optional on the wire. That pairing is the whole design: a deleted field
 * is a compile error, an absent value is not.
 */
type OptionalFields<T> = { [K in OptionalKeys<T>]-?: T[K] | undefined };

/** Every key of `T` and no other, written out. */
type EvidenceFields<T> = object extends T ? never : NoInfer<RequiredFields<T> & OptionalFields<T>>;

/**
 * One evidence value, built from a literal the compiler checks against the
 * contract, with its absent optional fields removed.
 *
 * Key order is the literal's, so the JSON is byte-identical to what the
 * conditional spreads produced.
 */
export function present<T extends object>(fields: EvidenceFields<T>): T {
  const source = fields as Record<string, unknown>;
  const written: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== undefined) written[key] = value;
  }
  return written as T;
}
