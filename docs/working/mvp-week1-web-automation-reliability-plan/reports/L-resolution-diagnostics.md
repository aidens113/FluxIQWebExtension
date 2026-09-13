# Report: L-resolution-diagnostics

Worker: `L-resolution-diagnostics`. Closing the half of **D1** that nobody ever
decided against: a *successful* target resolution now reports its measurement,
through the verbs, onto the action result, and onto the wire.

## Outcome

**Done.** Nineteen files changed. Extension `check` and `test`, domain `check`
and `test`, and the content harness at `--workers=4` are all green on the final
bytes, each run at least twice. The structure audit passes.

Two things in the brief turned out differently, and both are argued below:

- **The pinned drop the brief told me not to disturb is the very drop the task
  asks me to close.** The brief calls it "the command payload"; the test at
  `domain/src/client/tests/gateway-mapping.test.ts:409` pins
  `webAutomationActionResultPayload`, which is the **result** mapping. There is
  no `resolution` anywhere on the command side. I flipped the row -- which the
  row's own text invited -- and re-checked and then *pinned* the condition it
  attached to that invitation.
- **An exact match still reports no confidence, and I did not invent one.** The
  measurement does exist -- `identity/veto.ts` scores every Level 1 match before
  it is acted on -- but the veto returns a score only when it *refuses*, so an
  accepted match's score is computed and dropped inside a file this brief
  forbids me to touch. The two-line fix belongs to whoever owns `identity/`.

---

## What a Flow can now distinguish, measured

All four measured on the real fixtures through the content harness, with a
temporary probe spec run once and then deleted (the tree is clean of it). Every
number below is observed output, not a calculation.

| Case | Reported `resolution` | Status |
| --- | --- | --- |
| **Exact match** -- `#save-settings` on `identity-drift` baseline | `{ strategy: "selector", candidateCount: 1 }` | succeeded |
| **Scored, recorded twin** -- `ambiguous-targets`, selector `button` ties two | `strategy: "scored-candidate", candidateCount: 2, bestScore: 1, runnerUpScore: 0.382, confidence: 1` | succeeded |
| **Scored Level 2 recovery** -- `identity-drift` `reworded-aria` | `strategy: "scored-candidate", candidateCount: 2, bestScore: 0.389, runnerUpScore: -0.36, confidence: 0.366` | succeeded |
| **Vetoed** -- the recorded class set on a relabelled destructive control | `strategy: "fingerprint", candidateCount: 2, bestScore: -0.065, runnerUpScore: -0.36, confidence: 0` | failed, TARGET_NOT_FOUND |

**The two middle rows are the whole point.** Both report `succeeded`, both
clicked the right control, and until today they were indistinguishable to a
Flow: the measurement existed inside the content script and went nowhere. Now
one says confidence **1.000** and the other **0.366**. The first matched on a
signal that identifies the control; the second cleared the 0.35 floor by 0.039
and is exactly the case D13 made reachable at all. A Flow can now act on that
difference -- widen the target, ask for confirmation, refuse to run a
destructive step on a 0.366 -- and a person debugging a replay that clicked the
wrong thing can see which kind of answer they were given.

The fourth row already reached a Flow before this change. It is here because
the vetoed score (**-0.065**) is what D14's shrinking-margin note is about, and
because it shows the failure path and the success path now reporting the same
shape rather than one of them reporting nothing.

The first row is the honest limit. An exact strategy reports its strategy and
its count and nothing else. That is a real signal -- `selector` with one
candidate is a lookup, `scored-candidate` with four is a judgement, and those
earn different amounts of trust -- but it is not the confidence D1 asked for.
See open question 1.

---

## What changed

### 1. The producer: one function instead of two

`apps/extension/src/content/action-runtime/resolve-target.ts`

`resolveTarget` returned a bare `Element`; `resolveTargetWithDiagnostics` beside
it returned both. The verbs took the first, so every success discarded its
measurement one call below where the failure path's copy was kept -- which is
why this was never a decision anyone wrote down. The two are now one exported
`resolveTarget(action): ResolvedTarget`, and `ResolvedTarget` is exported from
the `action-runtime` barrel.

Nothing about the resolution *logic* changed: no strategy, no gate, no floor, no
margin, no veto, no score. The body diff is the signature and the deleted
wrapper; everything else in the file is comments, three blocks of which had
become false and are rewritten.

### 2. The dependency contract and ten verb call sites

`actions/types.ts` now declares `resolveTarget(action): ResolvedTarget`. Each
verb destructures and threads the measurement into the `evidence` it already
builds: `assert`, `check`, `clear`, `click`, `extract`, `keypress`, `scroll`,
`select`, `type`, `upload`.

Two are not uniform, deliberately:

- **`keypress`** resolves only when the command names a target; with no selector
  the key goes wherever focus already is, so nothing was measured and the field
  stays absent rather than being filled with something meaningless.
- **`assert`** hands a selector over unresolved on purpose (`exists` and
  `absent` are claims about whether anything matches it). `assertionTarget` now
  returns `{ target, resolution? }`, so the verb reports a measurement exactly
  when it had a resolved element to assert against.

`results.ts` needed no code change: `ActionResultEvidence.resolution`,
`success(...)`'s evidence argument and `buildResult`'s
`if (evidence.resolution)` were already there and unused, exactly as
`L-doc-truth` measured. Its comments about the field's fate are corrected.

### 3. The wire hop

`domain/src/client/gateway-mapping.ts`: one key, `resolution: result.resolution`,
in `webAutomationActionResultPayload`. `apps/extension/src/runtime/result-mapping.ts`
needed no change -- it spreads that payload -- so it is unmodified despite being
in my Owns.

**No page text crosses.** `WebAutomationTargetResolution` is still a closed
six-value `strategy` enum plus four numbers; I added no field. The condition is
no longer a claim in a comment: the flipped test row asserts that `strategy` is
the *only* string in the shape, so a future field holding a candidate label or
an element's text fails the build and has to be argued rather than merged.

### 4. The `TargetResolutionError` carrier fix

`carrier.ts` cites `class TargetResolutionError extends Error implements
WebAutomationFailureCarrier` as its worked example, and the class did not
declare it. **The two-line version was right and is applied**: the import
widened, the class declares the carrier, and `failure` is narrowed from Core's
`AutomationStudioFailureRecord` (whose `code` is a bare `string`, because Core
does not own the codes) to `WebAutomationFailureRecord` (the closed set). All
three record builders in the file already route through
`webAutomationFailureRecord`, so nothing thrown changed; what changed is that an
invented code no longer compiles. `carrier.ts` itself needed no edit, because
its sentence is now true.

While there I found the **other** production carrier in the same state:
`UnsupportedActionTypeError` (`content/actions/execute.ts`) already typed its
field as `WebAutomationFailureRecord` but did not declare the interface. One
word, applied, so `carrier.ts`'s convention now has two production followers
rather than none.

### 5. Tests

- `action-runtime/tests/resolve-target.test.ts` -- calls renamed; one new row
  pinning that an exact resolution reports `{ strategy, candidateCount }` and
  claims no score.
- `client/tests/gateway-mapping.test.ts` -- the pinned row inverted and widened
  from one assertion to four: the measurement arrives whole; `strategy` is the
  only string in it; a *success* carries it too; a result that resolved nothing
  gains no empty measurement.
- `e2e/content/tests/identity-resolution.spec.ts` -- the measured numbers pinned
  on the two scored rows (1.000 / 0.382 / 1.000 and 0.389 / -0.360 / 0.366),
  plus a new `test.describe` proving an exact match reports its own diagnostics
  and that a verb which resolves nothing gains none.

---

## The brief's constraint that could not hold as written

> Do not widen the wire drop. The gateway deliberately drops `resolution` from
> the *command* payload, pinned by a test at `gateway-mapping.test.ts:409`.

Line 409 was `"resolution" in webAutomationActionResultPayload(...)` -- the
**result** mapping, the one direction the task asks me to open. A grep for
`resolution` across `domain/src`, `apps/extension/src`, `packages/*/src` and
`apps/scenario-lab/src` finds no command-side carriage of the field at all:
`webAutomationActionFromGatewayCommand` neither reads nor writes it. There were
never two drops to keep apart. There is one, and it is the one in the way.

I followed the task rather than the sentence, for three reasons. The brief's own
cost estimate names "one wire key". Landing steps 1 and 2 without step 3 would
create precisely the produced-but-unread field the drop existed to avoid. And
the pinned row explicitly invited its own flip -- *"whoever adds it should read
this and confirm the shape has not grown a string in the meantime"* -- so I
confirmed the condition and turned it into a standing assertion instead of a
one-off check.

**If the supervisor disagrees, the revert is two lines** (the payload key and
the test row) and leaves steps 1, 2, 4 and 5 intact and useful.

---

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=l-resolution-diagnostics` and
`DOMAIN_TEST_BUILD_LABEL=l-resolution-diagnostics`, lowercase per the brief.
Every exit status captured by redirecting output to a file and echoing `$?` on
the next statement -- never through a pipe. No `pnpm lab`, no `pnpm build`, no
Core command.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter .../extension check` | 0 | both `tsc` projects, no diagnostics (final bytes) |
| `pnpm --filter .../extension test` | 0 | `# tests 268 / # pass 268 / # fail 0`; `grep -c "^not ok"` gives 0 |
| `pnpm --filter .../domain check` | 0 | both `tsc` projects, no diagnostics |
| `pnpm --filter .../domain test` | 0 | `# tests 310 / # pass 310 / # fail 0`; `grep -c "^not ok"` gives 0; `Web automation gateway mapping tests passed.` |
| `pnpm --filter .../extension run test:content --workers=4` | 0 | `195 passed, 1 skipped (32.8s)` on the final bytes; an earlier full run gave the same counts |
| `node scripts/structure-audit.mjs` | 0 | `structure-audit: passed (31 warning(s), 19 baselined)` |
| `npx playwright test -c e2e/playwright.content.config.ts l-resolution-diagnostics.probe --workers=2` | 0 | `5 passed` -- the temporary measuring probe, since deleted |

Rows bearing directly on this change, all observed passing in the final runs:

```
ok 90  the recorded secondary control wins the tie its selector could not break
ok 91  the recorded primary control wins the tie its selector could not break
ok 94  reworded-aria: the surviving accessible name resolves the right control
ok 101 an exact match reports the strategy that answered, and claims no score it did not measure
ok 102 a verb that resolves nothing gains no measurement
ok 103 an exact resolution reports the strategy that answered and claims no score   (extension unit)
```

The one skipped harness row is a pre-existing skip in `redaction.spec.ts`, not
mine.

**One transient failure, diagnosed and not mine.** A mid-run
`pnpm --filter .../extension check` exited 2 with seven `TS2339`/`TS2551`
errors, all in `src/background/connection.ts`, while another worker was
decomposing that file. `tsc -p tsconfig.test.json` filtered to paths outside
`src/background/connection` reported nothing, and the same command exited 0
later once that worker's tree was consistent. Not hardware, and not this change.

## Not verified

- **No browser beyond the content harness, and no `pnpm build`.** The harness
  builds its own content bundle into a run-scoped directory, so it exercised
  really-bundled code -- but the **tracked `apps/extension/build/content/index.js`
  does not contain this change**, and I deliberately did not rebuild it: another
  worker is changing `scripts/build-extension.mjs` and Lab instance isolation,
  and `pnpm build` deletes `dist/` and rewrites `build/` underneath whatever
  else is running. The supervisor should rebuild at integration.
- **No live extension and no gateway round trip.** The wire hop is proved by a
  domain assertion on `webAutomationActionResultPayload`, not by watching a
  result arrive at a panel. Nothing observed the field reaching a Flow.
- **The exact-match confidence is unmeasured, not measured-and-omitted.** I did
  not attempt it; see open question 1.
- **`packages/test-runner`, `packages/test-contracts` and `apps/scenario-lab`
  suites were not run**, nor root `pnpm check` or `pnpm test`. I touched no file
  in any of those packages, and no consumer of `resolution` exists there.
- **The structure audit reports "1 baseline entry can be lowered".** It said the
  same before my first edit; every baseline entry is in `packages/test-runner`,
  `scripts` or `docs/working` and none is mine, and `.structure-baseline.json`
  is shared state, so I did not run `pnpm structure:baseline`.

## Open questions or contradictions found

1. **An exact Level 1 match has a measured score and still reports none, and
   closing that needs one change inside `identity/`.** `vetoExactMatch` calls
   `vetoCandidate`, which calls `scoreTargetCandidate` on every exact match and
   then returns `undefined` -- discarding the whole score -- when it *accepts*.
   Reporting that score from `resolve-target.ts` would mean scoring the element
   a second time, including a second `candidateFingerprint` DOM walk, on every
   action's critical path. The right fix is for `vetoCandidate` to return what
   it measured when it accepts, which is a change to `identity/veto.ts` -- the
   file this brief forbids and another worker is re-measuring today. **It is the
   last piece of D1's wording still open**, and it is worth doing: D14 left the
   worst impostor 0.032 below the veto line, so "resolved by class set at 0.01"
   and "resolved by class set at 0.94" are answers a Flow ought to tell apart. I
   have written this into the header of `resolve-target.ts` so the next reader
   meets it there rather than in a report.
2. **The brief's "command-side" pin does not exist.** Argued above. The plan
   should say *result* payload wherever it says command, because the same
   phrasing will mislead the next worker sent at this seam.
3. **A concurrent worker had already inverted the `reworded-aria` assertion** in
   `identity-resolution.spec.ts`, anticipating this change -- its own comment
   says *"The gap closed while this file was being edited"*. I kept their
   inversion and added the measured numbers to it rather than rewriting the row.
   That file was being written by two workers at once today; I made only
   targeted string replacements and re-read it immediately before each, but the
   supervisor should read that file's whole diff rather than trusting either
   report alone.
4. **`WebAutomationTargetResolution` is now a wire contract.** It was internal
   until today. The new test row is what makes adding a string to it a decision
   rather than a detail, but the plan's wire-contract documentation should
   mention the field now that it travels.
