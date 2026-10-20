# t741 c3-incomplete-text: worker report

## Outcome

Done. An incomplete-text refusal now names the field, but only when that field is a key of the
`extractList.fields` the domain sent. Its `next` sentence now places the full read after the
repeat.

## What changed and why

- `domain/src/runtime/llm-evidence/action-failure/refusal.ts`: the new `incompleteTextField(result, sent)`
  reads the client marker `incomplete_text: field <name> ...` (regex `^incomplete_text: field (\S+)(?=\s|$)`).
  It returns the name only when all of these hold:
  - the name is an identifier (`KEY_NAME`, which t738 already uses);
  - `sent.parameters.extractList.fields` is a plain object;
  - the name is one of that object's own keys.

  When it returns a name, the refusal puts it in `missing: [key]` and in
  `instead: ["web.text.incomplete_field.<key>"]`. The code goes in `instead` because
  `rejectionDetail` passes only `instead`/`closeWith`/`target` into the next sentence (in
  `tool-rejection.ts`, which I do not own). `repeated-refusal.ts` already passes `instead` back,
  so a repeated refusal names the field again. This is the pattern t738 used for scroll keys.
  Without `sent`, with a key the request did not send, or with `fields` that is not a key map,
  nothing is named, which is the old behaviour.
- `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts`: the constant `INCOMPLETE_TEXT_NEXT`
  became `incompleteTextNext(instead)`. It ends: "After that repeat, not inside it, read the same
  listing again with the field `<key>` | the text field: by then every row is disclosed." The
  helper read says "without the field `<key>`" when the key is known, and "without the incomplete
  text field" otherwise. There is no "only after" wording. Before naming the key, it checks that
  the key is an identifier.
- Tests:
  - `action-failure/tests/refusal.test.ts` has a new test: a key the request sent is named (in
    `missing` and in `next`, and again on a repeat); an unsent key is never echoed anywhere in the
    refusal; with no request nothing is named; with non-map `fields` nothing is named.
  - `rejection-next/tests/next-sentence.test.ts`: I updated the existing ordering test so it
    expects "After that repeat ... read the same listing again with the text field", "not inside
    it" and "every row is disclosed", and does not allow "only after" or "only once". I also added
    a test that the known key is named and that a key which is not an identifier falls back to the
    generic sentence.

## Commands run and observed results

- Tests first, from `domain/`:
  `DOMAIN_TEST_BUILD_LABEL=t741-c3 node scripts/test-domain.mjs llm-evidence/action-failure/tests/refusal llm-evidence/rejection-next/tests/next-sentence`.
  Result: `# tests 22 # pass 19 # fail 3`. The 3 failures were the new and updated tests.
- After the fix, from `domain/`:
  `DOMAIN_TEST_BUILD_LABEL=t741-c3 node scripts/test-domain.mjs llm-evidence/action-failure/tests llm-evidence/rejection-next/tests`.
  Result: `# tests 24 # pass 24 # fail 0`. This covers both test folders, including
  `read-shortfall-pagination.test.ts`.
- I grepped the domain, extension and Core `src` for the old text ("read the full text",
  "incomplete text field"). Only my two files and their tests contain it, so no other pin moves.
- Line counts: `refusal.ts` is 305 lines and `next-sentence.ts` is 200, both under the 800-line
  file limit in `scripts/structure-audit/context.mjs`.

## Not verified

- No typecheck, structure audit or wider suite was run, as the shared rules say; the lead runs those.
- Not exercised live. The `verify.ts` caller (`webActionFailureRefusal(result)`) passes no `sent`,
  so that path still names no field. That is deliberate and safe. The capture and node-run paths
  do pass `sent`.
- I assumed the marker's `<name>` is the `extractList.fields` key. `field-reader.ts` passes `name`
  to `assertTextDisclosed`, but I did not trace where that name comes from. If it is not the key,
  the membership check simply names nothing.

## Open questions or contradictions found

- None blocking. Fields whose keys are not identifiers (for example ones containing a hyphen or a
  space) are never named. This is the same rule as the t738 scroll keys.
