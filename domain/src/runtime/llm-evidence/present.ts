// Writing a field of the LLM evidence packet, as `untrusted-json.ts` is how a
// field is read off the page.
//
// ## The hole this closes
//
// Every optional field of the packet used to be emitted through a conditional
// spread:
//
// ```ts
// return { target, tag, ...(role ? { role } : {}) };
// ```
//
// TypeScript performs **no excess-property check through a spread**. The spread
// source `{ role }` is its own fresh literal, contextually typed by nothing, so
// the target's key set never sees it. Rename that key to `roel` and the field
// leaves the packet in silence: `check` exits 0 and every unit test passes.
//
// That is invisible here in a way it is not elsewhere. Nothing consumes this
// packet but a language model, which cannot complain about a field it was never
// shown -- it simply reasons with less and proposes a worse action. There is no
// reader to go red, no assertion to fail, no user-visible error. The same defect
// shipped three times in the page-evidence contract, which at least had readers;
// this module has none.
//
// A plain property in an object literal **is** excess-checked against its
// contextual type. So the fix is to stop spreading: write every field, optional
// ones included, as a plain property whose value may be `undefined`, and drop
// the undefined ones afterwards. `present` is that drop, and
// `contract-spread` in `scripts/structure-audit/config.mjs` is what stops the
// next spread being written here.
//
// ## Mentioned at the call site; optional in the packet
//
// The two are separated deliberately, because a rename is only half the way a
// field goes missing. The other half is deletion, and a type cannot catch a
// deleted *optional* field -- absence is exactly what optional means.
//
// So the call site must **mention** every key of the packet type, while an
// optional one is free to be given `undefined` and is then absent from the
// result. Deleting `role:` from a producer stops compiling; an element with no
// role still produces an object with no `role` key. Adding a field to a packet
// type likewise stops every producer of that type compiling until it says what
// it writes there.
//
// ## Why this is not `apps/extension/src/shared/present.ts`
//
// It is the same idea and it was the first thing tried. It is not importable:
// `domain/src` may not import `apps/extension/src` (AGENTS.md, enforced by the
// `imports` rule in `scripts/structure-audit/config.mjs`), the extension is not
// a dependency of this package, and `present` is a value rather than a type so
// there is no erasure to hide behind. A probe import produced exactly that
// finding before this file was written.
//
// One thing genuinely differs, and it is not a style choice. The extension's
// guard against an un-named type argument is `object extends T ? never`, which
// also fires for a type whose keys are **all optional** -- `object` is
// assignable to such a type. Half the packet's types are that shape
// (`WebLlmPageContext`, `WebLlmEvidenceDialog`, `WebLlmSanitizeOptions`, the
// inline `loading` and `navigation` records), so the extension's helper cannot
// write them at all: `present<WebLlmEvidenceDialog>({...})` is
// `TS2345: ... not assignable to parameter of type 'never'`. Measured, not
// assumed. The guard here keys on the type parameter's **default** instead, so
// it fires when and only when the caller named no type. The extension's copy has
// the same latent limit and no all-optional contract to trip it today.

/** The default `T` takes when a caller names no type argument, and nothing else. */
declare const CONTRACT_TYPE_NOT_GIVEN: unique symbol;
type ContractTypeNotGiven = { [CONTRACT_TYPE_NOT_GIVEN]: true };

/** Keys of `T` a caller may leave out. */
type OptionalKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];

/** Keys of `T` that must carry a value. */
type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>;

/**
 * `T`'s required keys, which may not be `undefined`.
 *
 * The `Exclude` matters because `present` strips `undefined`: a required key
 * given `undefined` would be silently removed and the returned `T` would be a
 * lie.
 */
type RequiredFields<T> = { [K in RequiredKeys<T>]-?: Exclude<T[K], undefined> };

/**
 * `T`'s optional keys, each of which must be written and may be `undefined`.
 *
 * `-?` makes the key mandatory at the call site; the `| undefined` keeps the
 * field optional in the packet. That pairing is the whole design: a deleted
 * field is a compile error, an absent value is not.
 */
type OptionalFields<T> = { [K in OptionalKeys<T>]-?: T[K] | undefined };

/**
 * Every key of `T` and no other, written out.
 *
 * `NoInfer` stops `T` being read off the argument -- inferring the type from
 * the literal would check the literal against itself, which is the original
 * silence in a new costume -- so an un-annotated call falls back to the default
 * and lands on `never`.
 */
type PacketFields<T> = [T] extends [ContractTypeNotGiven] ? never : NoInfer<RequiredFields<T> & OptionalFields<T>>;

/**
 * One packet value, built from a literal the compiler checks against its type,
 * with its absent optional fields removed.
 *
 * Key order is the literal's, so the serialized bytes are what the conditional
 * spreads produced.
 */
export function present<T extends object = ContractTypeNotGiven>(fields: PacketFields<T>): T {
  const source = fields as Record<string, unknown>;
  const written: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== undefined) written[key] = value;
  }
  return written as T;
}
