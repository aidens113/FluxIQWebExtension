# Report: f-adapter-guard

Brief: `f-adapter-guard` in `briefs/finish-week1.md`. Worker, 2026-09-12, tree at
`HEAD 99eca80` plus other workers' in-flight edits. No commit, no staged change,
no `pnpm build`, no `pnpm lab`, no baseline edit, no Core edit.

## Outcome

**Done.** The runtime adapter no longer treats a `redacted: true` stamp as the
producer's declaration. A failure record's `expected`/`actual` on a sensitive
control is now withheld when the producer did not declare, whatever the client's
withholding layer wrote. A genuine producer declaration is still honoured on both
exits. The `test.fixme` row in `redaction.spec.ts` is now a live row. The guard
has a mutation proof on two tiers (unit and content harness), and the file was
restored byte-identical.

## What changed and why

### Re-verification at HEAD: half settled, half open

- **Settled.** The client-side stamp that `v-redaction-producer` section 4
  measured was already gone. Commit `1b6f5df` removed it from the withheld branch
  of `webAutomationSecretSafeValidation` (`domain/src/client/gateway-mapping.ts:289`).
  The tracked extension build does not stamp either
  (`apps/extension/build/background/index.js:2020`).
- **Open.** The adapter itself still took any `redacted: true` on the wire as a
  declaration: `isSensitiveElementDescriptor(...) && !isProducerRedactedComparison(...)`
  at `domain/src/runtime/adapter.ts:98`. A client built before `1b6f5df` still
  sends the stamp, and against such a client the guard stayed disarmed. The
  `test.fixme` row was still in `redaction.spec.ts:444`.
- **Red first.** The new probe rows were run against the unmodified adapter:
  `# tests 349 / # pass 347 / # fail 2`. The two failures were exactly the
  stamping-client rows for declarations `undefined` and `false`. The message was
  `no declaration state lets the value through, whatever the layer before this
  one wrote` / `true !== false`. The four other rows passed.

### `domain/src/runtime/adapter.ts` (396 -> 399 lines)

1. **New `producerDeclaredRedaction(validation)`.** It is true only when
   `isProducerRedactedComparison(validation)` holds **and** neither `expected` nor
   `actual` is `WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT`.
   - Only a withholding layer ever writes the marker. A search of `domain/src`
     and `apps/extension/src` found it written only at `gateway-mapping.ts:289`
     and `adapter.ts`.
   - The old layer wrote it only when the producer had *not* declared. So a flag
     next to the marker is never the producer's.
   - This is an equality test against the domain's own constant, not a scan of
     the text.
2. **Call site (line 97).** `withholdComparison` now uses the new function in
   place of `isProducerRedactedComparison`.
3. **`secretSafeDispatchPayload` strips an arrived `redacted` key**
   (`const { redacted: _stamp, ...unstamped } = validation`). Its own doc already
   says the output carries no flag. But the old `...validation` spread would have
   passed an incoming stamp on to Core, disarming the next reader.
   - This runs only when `withholdComparison` is true, which means no producer
     declared. Any flag present at that point is a stamp.
4. **Doc comments.**
   - The call-site comment and the payload guard's doc now name the new function.
   - The now-stale "until 2026-09-12" paragraph is replaced.
   - The "false declaration" paragraph is tightened, with all its claims kept.
   - This kept the file under the 400-line advisory.

### `domain/src/runtime/tests/adapter-redaction.test.ts` (238 -> 289 lines)

Six new rows, "the three-state probe": {client built before the stamp was
removed, this client} x declaration {`undefined`, `false`, `true`}. Each row
builds exactly what that client puts on the wire.

- **Undeclared.** The producer wrote a sentinel value, as a producer with its
  redaction removed would. The layer withheld the validation (with or without the
  stamp). The failure record carries the sentinel, because `result-mapping.ts`
  puts it on the gateway result directly.
- **Declared.** The producer wrote a length phrasing, and the layer passed it
  through untouched.

What each row asserts:
- The sentinel is absent from the whole serialized result.
- Undeclared: both record strings are the marker, and no `redacted` key leaves on
  the payload validation.
- Declared: the record keeps the producer's phrasing, and `redacted: true` still
  rides on the payload.
- In every row the failure code is unchanged.

### `apps/extension/e2e/content/tests/redaction.spec.ts` (478 -> 468 lines)

- **`test.fixme` -> `test`**, row now at `:428`. It covers declarations
  `undefined` and `false`, each through this client and through a client that
  stamps, against strings holding the card field's real pre-filled value. It uses
  `expect.soft`, so one run names every state that leaks. That answers the
  "first failed assertion" limit `v-redaction-producer` section 7 recorded.
- **`throughTheDomain(result, stamped = false)`.** When `stamped` is set, it
  replaces the payload validation with the pre-`1b6f5df` layer's output: marker,
  marker, `redacted: true`.
- The header paragraph and the row's docblock described the defect as current.
  They are rewritten to the fixed state, shorter.
- The row the report's neighbours cite at `:310` still exists. It is the
  "post-condition is secret-free after the hop to the domain" row, now at `:287`,
  and it passes.

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=f-adapter-guard` and `EXTENSION_TEST_BUILD_LABEL=f-adapter-guard`
were set on every test command. Every exit status was captured by redirecting to
a file and echoing `$?`. Heavy gates ran one at a time. Every command below ran
once, so each result is a single observation.

| Command | Exit | Observed |
| --- | --- | --- |
| domain `pnpm test`, new rows, **unmodified adapter** | 1 | `# tests 349 / # pass 347 / # fail 2`: `not ok 275` / `276`, the stamping-client rows for `undefined` and `false` |
| domain `pnpm check`, after fix | 0 | 0 `error TS` |
| domain `pnpm test`, after fix | 0 | `# tests 349 / # pass 349 / # fail 0`; all six probe rows `ok` |
| extension `pnpm check` | 0 | 0 `error TS` |
| `node scripts/structure-audit.mjs` (my files are all already tracked) | 1 | `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`; `warn [file-lines] ...redaction.spec.ts: 468 lines is past the 400-line advisory threshold` |
| content harness `playwright test -c e2e/playwright.content.config.ts --workers=2 redaction.spec.ts`, after fix | 0 | `19 passed`; `:287` and `:428` both `ok`; 0 skipped (was `1 skipped, 18 passed`) |
| **mutation** domain `pnpm test` | 1 | `# tests 349 / # pass 347 / # fail 2`: `not ok 275 - the three-state probe, a client built before the stamp was removed: declaration undefined`, `not ok 276 - ... declaration false` |
| **mutation** content harness `redaction.spec.ts` | 1 | `1 failed / 18 passed`; failing row `redaction.spec.ts:428:1`, soft failures only for `declaration undefined, a client that stamps` and `declaration false, a client that stamps`, each `Expected substring: not <fixture card value>` and `Expected: "(withheld: ...)" / Received: "the field holds \"<fixture card value>\""` |
| restore check `cmp fag-adapter-fixed.ts adapter.ts` | 0 | byte-identical (run by the window's EXIT trap, and again before the final run) |
| domain `pnpm test`, after restore | 0 | `# tests 349 / # pass 349 / # fail 0` |
| content harness `redaction.spec.ts`, after restore | 0 | `19 passed` |

The **structure audit FAIL is not mine.** It is the `working-docs` rule on
`docs/working/README.md`, which `git status` shows modified alongside the plan
document: the supervisor's in-flight edit. No file I own is under `docs/working/`
apart from this report, which is untracked. `adapter.ts` at 399 lines raises no
warning. The spec's advisory warning predates this brief (478 lines) and went
down.

**The mutation** swapped a scratch copy of `adapter.ts` into the tree. It differed
from the fixed file only on line 97 (`diff` shows `97c97`, restoring
`!isProducerRedactedComparison(clientResult?.validation)`), which is the old
conjunction. The swap, both suites and the restore all ran inside one shell
command with an EXIT trap, so the window could not outlive it. The mutated file
compiled, so no other worker's type check could go red during the window. Only my
new rows could fail.

`git diff domain/src/runtime/adapter.ts` shows only the edits listed above. A
parallel worker's uncommitted `gateway-mapping.ts` change has no diff line
mentioning `redacted`, `isProducerRedactedComparison`, the marker, or
`webAutomationSecretSafeValidation`.

## Not verified

- **No Lab run.** For this fix, a Lab run must show three things:
  - A sensitive-control action that fails with a client failure record from a
    verb that does not declare (for example an `assert` or `click` validation on
    the card field). Its attempt trace and run history must carry the marker in
    `failure.expected`/`failure.actual`. The fixture's field value must be absent
    from the whole serialized run artifact.
  - The withheld payload `validation` must carry no `redacted` key.
  - A `web.dom.type` on the card field whose read-back fails must still carry the
    verb's "a withheld value of N characters" phrasing in the trace, not the
    marker.

  No Lab client sends the stamp today (the tracked build does not), so the
  stamping-client leg is proven only by the unit and harness rows.
- **`redacted: true` over an unredacted string is still believed, by design.**
  The adapter cannot tell a declared redaction from a lying declaration without
  scanning text (see the payload guard's doc and `redaction.spec.ts`). In the
  probe's `true` state the sentinel is absent **by construction**: a genuine
  producer wrote a length. That row's teeth are that the phrasing survives.
- **Readers of the stripped key.** I did not check whether anything in Core or
  `packages/` reads `redacted` from a runtime result's payload validation after
  the adapter. Nothing in this repository's `domain/src` does (search above).
- **Other checks not run.** No full `pnpm check` / `pnpm test` at the root, no
  full content harness, and no `pnpm build`. The adapter imports `node:crypto`
  and runs gateway-side, so I expect it is not bundled into
  `apps/extension/build/`. That is reasoned, not checked.

## Open questions or contradictions found

1. **The brief's premise was half stale at HEAD.** "Never withheld, whether the
   declaration is `undefined`, `false`, or `true`" was true when
   `v-redaction-producer` measured it. `1b6f5df` then removed the client stamp, so
   against today's client source `undefined` and `false` were already withheld.
   What stayed open was the adapter's reliance on the stamp's absence: any older
   client disarmed it. That was also why the `fixme` row was never reopened. The
   fix makes the adapter independent of that layer, which is what the brief asked
   for.
2. **"Sentinel absent in every state" versus "honour a genuine redaction."** For
   `true`, these conflict if the declared strings hold the sentinel.
   `v-redaction-producer` section 4 itself records that case as "believed, by
   contract". I resolved it by making the `true` state a genuine redaction (see
   Not verified). If the supervisor wants a `true` declaration bound to the exact
   strings it sits beside, the smallest version is this: honour the record's
   `expected`/`actual` only where they equal the declared validation's strings.
   That would touch `adapter.ts` again, and I believe `type.ts`/`clear.ts`/`select.ts`
   build both from the same strings, but I did not verify that.
3. **Where the marker rule belongs.** It sits in the adapter because the adapter
   is the only caller that reads a validation after another layer has touched it.
   `gateway-mapping.ts` reads the producer's own validation. If a third reader
   appears, the rule belongs in `domain/src/sensitivity/redaction.ts` beside
   `isProducerRedactedComparison`, a file this brief did not own.
4. **Baseline.** No `.structure-baseline.json` entry should change. None of the
   three files is baselined. `redaction.spec.ts` stays over the 400-line advisory
   at 468 lines, and remains the split candidate `v-redaction-producer` named:
   domain-hop rows versus recording and snapshot rows.
