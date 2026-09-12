# v-spec-typecheck

## Outcome

Done, but the headline is not what the brief expected: **the gap was already
closed.** `e2e/**/*.ts` has been in `apps/extension/tsconfig.test.json` since
commit `ed6ab74` ("Wave 2: the browser action vocabulary, implemented and
integrated"), whose own message says "The end-to-end specs are type-checked for
the first time." The working tree matched `HEAD` for that file when I started;
nothing had been deferred a third time.

So the count the brief asked for is:

| Measure | Count |
| --- | --- |
| Spec files now type-checked | 22 |
| Total `e2e/**` files in the program | 33 (plus one pulled in from `apps/scenario-lab/e2e/`) |
| Errors surfaced | **0** |
| Category 1 — genuine type error in a spec | 0 |
| Category 2 — spec asserting a field that does not exist | **0** |
| Category 3 — missing type for a Playwright/harness construct | 0 |

Because a green check that was *always* green proves nothing on its own, the
substance of this task became verifying that the gate is real rather than
vacuous, and closing the one hole that made it less than real.

## What changed and why

One file: `apps/extension/e2e/content/harness.ts`.

`SentMessage`, the type `harness.messages()` returns, was declared

```ts
export type SentMessage = { type?: string; payload?: unknown } & Record<string, unknown>;
```

That `& Record<string, unknown>` is precisely a category-2 hole. An index
signature types every misspelling as `unknown` rather than rejecting it, so
`message.payloadd` would compile and any assertion reading it would silently
prove nothing — the exact failure mode this brief exists to prevent. I removed
the intersection, leaving the type closed, and wrote the reasoning into the
doc comment so it is not "simplified" back later.

This was safe to do rather than merely recommend: nothing consumed the index
signature. The harness itself reads only `.type` and `.payload`, and across all
22 specs the only field ever read off a sent message is `.type` (in
`extract-list`, `identity`, `identity-resolution` and `frames`); `redaction` and
`selection-redaction` only `JSON.stringify` the array. The full check stayed
green after the change, so the narrowing is proven against the current tree.

I made no other edits. No spec needed one.

## How I established the gate is real

A green check inherited from someone else's commit is a claim, not evidence, so
I falsified it. I appended a probe to `waits.spec.ts` reading three fields that
do not exist, off the three types the harness actually hands specs, and ran the
check:

```
e2e/content/tests/waits.spec.ts(236,17): error TS2339: Property 'thisFieldDoesNotExist' does not exist on type 'BrowserActionResult'.
e2e/content/tests/waits.spec.ts(238,17): error TS2339: Property 'alsoNotAField' does not exist on type 'DomSnapshot'.
e2e/content/tests/waits.spec.ts(240,21): error TS2339: Property 'notARealEventField' does not exist on type 'RecordingEventPayload'.
```

An earlier probe also caught a nonexistent Playwright fixture name
(`contentHarness` instead of `openHarness`). The probe was reverted and the file
restored byte-for-byte (`git diff` clean) before any gate was run for record.

The gate has teeth because the harness returns real protocol types —
`runAction` → `BrowserActionResult`, `capture()` → `DomSnapshot`,
`recordedEvents()` → `RecordingEventPayload[]` — and all three are closed object
types with no index signature, under `strict`, `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes` from `tsconfig.base.json`. `SentMessage` was the
single exception, and it is now closed too.

## The vacuity class the type checker cannot see

Type checking cannot catch an assertion that passes because the thing under test
is simply absent — `expect(inputs[0]?.value).toBeUndefined()` passes just as
happily when no event was recorded at all. I audited every negative matcher
reading through an optional chain (14 sites across `check-assert`, `evidence`,
`failures`, `identity`, `redaction`).

They are sound. The security-relevant ones guard existence before asserting
absence — `expect(inputs).toHaveLength(1)` before indexing, and
`expect(password, "the password field is missing from the snapshot").toBeTruthy()`
before the optional chain — and each carries a positive control, such as
`expect(email?.value).toBe(FIXTURE_EMAIL)` proving the same snapshot does carry
an ordinary field's value. No vacuous assertion found. There are no non-null
assertions (`!.`) anywhere in the specs.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-spec-typecheck` set throughout. Every exit status
captured by redirect and `echo $?`, never through a pipe.

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no output.
  Runs `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, the second
  of which now covers `e2e/**`. Run after the `harness.ts` edit.
- `tsc -p tsconfig.test.json --listFiles` → **34** files under an `e2e/` path in
  the program: all 33 under `apps/extension/e2e/`, plus
  `apps/scenario-lab/e2e/network-policy.ts` reached by import. Confirms the
  include is doing work rather than silently matching nothing.
- `pnpm --filter @fluxiq-web-extension/extension test:content --workers=4` →
  **exit 0, 186 passed** in 22.9s. The specs still run, not merely compile.
- `node scripts/structure-audit.mjs` through a scratch `GIT_INDEX_FILE` (a copy
  of `.git/index`, with `apps/extension/e2e` and `tsconfig.test.json` added to
  the copy) → **exit 0**, `structure-audit: passed (29 warning(s), 19
  baselined)`. Warnings only, none from my change. I verified afterwards that
  the real index was untouched: `git diff --cached --name-only` is empty.

One command failed and is worth recording so nobody repeats it:
`pnpm --filter ... test:content -- --workers=4` passes `--` through to
Playwright as a literal filename filter, giving "No tests found" and exit 1.
Drop the `--`. The redirect-and-echo rule caught this; a pipe would have
reported the `echo`'s success and I would have recorded a passing suite that
ran zero tests.

## Not verified

- **No browser-level validation beyond the content harness.** The T2 harness
  runs the content script in a page with a `chrome.runtime` stub and no
  background worker, so nothing here exercises real cross-context delivery.
  Unchanged by my work — I altered no runtime code, only a test-side type.
- **The other extension gates.** I did not run `pnpm test`, `pnpm build` (the
  binding rules forbid it mid-wave), or any domain, contracts or test-runner
  check. My change is confined to a type in a test-only file that no `src/**`
  module imports.
- **Durability against in-flight work.** All gates ran against a tree other
  Wave 3 workers are actively editing. Green here means green at that moment;
  the supervisor's integration run is the one that counts.
- I did not re-run the checks after the final read-only audit, as nothing was
  edited after the `check`/`test:content`/audit sequence.

## Open questions and contradictions found

1. **`open-questions.md` is stale, and it cost a brief.** The entry beginning
   "**No end-to-end spec is type-checked.**" still says "neither covers
   `e2e/**`" and "Fix at Wave 2 integration", but Wave 2 integration did fix it,
   in the very commit that closed the wave. The entry was never marked settled,
   so this brief was written to do work that was already done, and described the
   gap as "deferred twice" when it had in fact been closed once. The supervisor
   should mark that entry settled, citing `ed6ab74`. The general lesson matches
   one already in the plan's ledger: a stale document read as current is
   indistinguishable from a real finding until someone opens the file.

2. **Ownership overlap between my brief and the wave brief.** My brief grants me
   "every file under `apps/extension/e2e/` except `identity-resolution.spec.ts`".
   But `wave-3.md` assigns `e2e/content/tests/frames.spec.ts` to
   `w3-frame-plumbing`, `evidence.spec.ts` to `w3-evidence`, `redaction.spec.ts`
   to `w3-redaction` and `failures.spec.ts` to `w3-failure-producers` — four
   files two workers both believe they own, while those workers are running. It
   did not bite, because zero errors surfaced and I edited none of them, but the
   exclusion list should have named all five files, not one. Flagging it as the
   binding rules ask.

3. **No product findings.** Category 2 is what the brief said matters, and it is
   zero. I want to be plain that this is a real zero, not an absence of looking:
   the falsification probe above shows the check rejects exactly that class of
   error today, and the one type that could have swallowed it has been closed.
   The specs assert what they claim to assert.
