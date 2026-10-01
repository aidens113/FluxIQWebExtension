# t195-w20k: a control the page disables for a moment is waited for

## Outcome

Partial. The marker, the gate call sites, the recovery rule and the tests are done and pass. On job-board's shield the
new path cannot by itself wait the 3 s out: a new fault word gets `budget.ts`'s blip ladder (250 + 500 = 750 ms), and
`budget.ts` is outside this brief. The one-line change is given under Open questions.

On the shield as recorded, the resolver does not land on the disabled button at all (probe below). It answers
`target_not_found`, which recovery already waits out on the 3750 ms target ladder. So C5 bites only when the recorded
target names nothing the veto can check.

## What changed and why

- **The marker is Core's own `effect: "unacted"`, not a `beforeDispatch` key.** Core's record parser
  (`!FluxIQ/packages/contracts/src/failure/parse-record.ts:57`) returns `null` for any key outside `RECORD_FIELDS`. So
  a new key on the failure record would make Core drop the whole record. `effect` is already in that set, and its Core
  doc says "the producer states the act demonstrably did not happen". Core's disposition does not change, because
  ACTION_REJECTED stays `retryable: false` and `assess.ts` refuses on that before it reads the effect. Nothing in
  `domain/src/runtime/failure/` was touched: `WebAutomationFailureRecord` already has `effect`.
- **`results.ts`**:
  - `ActionResultEvidence` gains `refusedBeforeDispatch?: true`. It goes on the evidence, not as a new `actionRejected`
    parameter, because the verbs call `deps.rejected`, whose signature lives in `actions/types.ts`, which I do not
    own.
  - `actionRejected` builds both of its records (the ACTION_REJECTED one and the dialog one) through a new
    `refusalRecord`. That function adds `effect: "unacted"` only when the marker is set.
  - Note: this overrides the codes.ts comment "the effect is the row's, never the caller's" for this one path. The
    reason is that ACTION_REJECTED is written both before and after a verb acts.
- **Gate call sites set the marker**: `click.ts:143`, `type.ts:48`, `select.ts:67` (the actionability gate) and
  `check.ts:45` (the first gate). These are not marked:
  - `check.ts:58` (after `setCheckedState`);
  - `select.ts`'s disabled-option rejection;
  - `upload.ts`, `clear.ts` and `keypress.ts` (not in the brief).
- **`recovery/fault.ts`**:
  - Adds the fault word `"disabled_target"` and `disabledBeforeDispatch()`. That function applies only to
    ACTION_REJECTED, only when `failure.effect === "unacted"`, and only when the reason token is `disabled:`.
  - `recoverableFault` returns `"disabled_target"` after the obstruction check.
  - It is not an obstruction: `faultNeedsInterference` stays false, so no layer is pressed.
  - It stays bounded by `RECOVERY_BUDGET_MS` through the existing loop.

## Tests

- `content/action-runtime/recovery/tests/attempt.test.ts` has three new rows. They use the real `actionRejected`,
  loaded dynamically after stubbing `window`, `document` and `location`:
  1. A gate-`disabled` click is absorbed as `disabled_target` after one 250 ms wait and succeeds, and nothing is
     pressed.
  2. The refusal `check.ts` hands over after `setCheckedState` has no effect, so it is not absorbed: one attempt, no
     pause.
  3. A gate-`disabled` that never clears is `exhausted`. It returns the last attempt's own result and no attempt is
     dispatched past `RECOVERY_BUDGET_MS`.
- `content/actions/tests/gate-refusal.test.ts` is new and runs the real verbs:
  - the gates in click, type, select and check pass `refusedBeforeDispatch: true`;
  - `check.ts` after `setCheckedState` does not;
  - select's disabled option does not.
- Revert check: I restored the six source files to HEAD and ran these tests. Four rows failed: attempt rows 1 and 3
  above, the gate-refusal "each verb's gate" row, and a now-removed `check.ts`-gate attempt row. On the final test set,
  three rows failed (`ℹ pass 58 / ℹ fail 3`). I then restored the sources. The two "not absorbed" rows pass both ways by
  design, because they are guards against over-absorbing.
- Dynamic imports, deliberately: `results.ts` and the verbs reach `frame-geometry.ts`, which reads `window` when the
  module loads. A static import would pass only if another test bundle had left a `window` on the global first.

## Commands run and observed results

- `node <scratchpad>/run-dir-tests.mjs apps/extension w20k content/actions/tests content/action-runtime/recovery/tests content/action-runtime/tests`
  printed `ℹ tests 205 / ℹ pass 187 / ℹ fail 18`. These 18 failures are not from this change: running the same failing
  files against HEAD sources gave the same set (`diff` of the failing names was empty). They are:
  - `click.test`, `execute.test` and `page-identity.test`, which fail to load with `ReferenceError: window is not
    defined` (`frame-geometry.ts:16`) under this per-file runner;
  - 15 rows of `store-chooser-replay.test` (`the packet shows the chip and Millbrook's button: []`).
- New and recovery rows only: `ℹ tests 61 / ℹ pass 61 / ℹ fail 0`.
- `bash heavy.sh "t195-w20k extension check" pnpm --filter @fluxiq-web-extension/extension check` exited 1 with three
  TS2610 errors. All three are in files that are unmodified in this worktree, and none is in a file I touched:
  - `src/panel/extraction/tests/dialog-dom.ts(16,37)`;
  - `src/panel/recording/review/tests/recording-review.test.ts(20,16)`;
  - `src/panel/settings/tests/forget-confirmation.test.ts(17,16)`.
- `node scripts/structure-audit.mjs`: no violations (warnings only). It first flagged two barrel bypasses in my tests,
  which I fixed.
- **Resolver probe.** This was a temporary `zz-w20k-probe.test.ts`, run once and then deleted. It recorded
  `{button, text/name "I'm a person", selector .tl-shield > div > button}`. Against "Please wait 3/2/1" it printed:
  - veto: `{"score":0.104,"confidence":0.085},"refusedBecause":"uncorroborated"`;
  - Level 2: `unmatched`, with Submit at -0.116;
  - the enabled "I'm a person" candidate: score 1, accepted.

  I also read `resolve-target.ts`, `identity/veto.ts`, `identity/corroboration.ts` and `identity/score.ts`. An exact
  match the veto refuses becomes a miss. `stableNameReading` needs a kept text run, and a one-run button whose whole
  text was replaced has none. Level 2 also requires exact corroboration (at least 0.92 on text, name, label, id or
  test id). So resolution throws TARGET_NOT_FOUND, which is `target_absent`, and that is absorbed on
  `RECOVERY_TARGET_BACKOFF_MS` = 250 + 500 + 1000 + 2000 = 3750 ms. That covers 3 s.

## Not verified

- No browser, Lab or live run, per the brief.
- `stableNameReading` was not run, because it needs a DOM. Its verdict for this case is from reading the code.
- The existing rows of `click.test.ts`, `execute.test.ts` and `page-identity.test.ts` could not run under the brief's
  runner because of the pre-existing `window` load failure. The package runner (`pnpm test`) was not run, since the
  user's rule is no full suites.
- Whether the background worker or Core relay passes `effect` through unchanged. Core's parser admits it, but I did not
  trace `runtime/result-mapping.ts`, which belongs to w20h.

## Open questions or contradictions found

1. **`budget.ts` needs one line for this path to cover the shield's 3 s.** As written, `"disabled_target"` gets the
   blip ladder of 750 ms. Suggested change at `recovery/budget.ts:68`:
   `if (fault === "target_absent" || fault === "disabled_target") return RECOVERY_TARGET_BACKOFF_MS;`
   That ladder fits inside `RECOVERY_BUDGET_MS`. Attempt test row 1 asserts `waitedMs: RECOVERY_BLIP_BACKOFF_MS[0]`,
   which is 250 and equal to the target ladder's first rung, so it would still hold. `budget.test.ts`'s "everything
   else is the short one" row names only four faults, so it would also still hold.
2. **The brief's suggested `beforeDispatch: true` on the failure record would break the wire**, because of Core's
   closed key set. I used `effect: "unacted"` instead (see above).
3. **`checkable-state.ts:34` decides `disabled` before it changes anything**, so `check.ts`'s second `disabled` is
   also, strictly, before dispatch. I left it unmarked as the brief and audit specify. That is the conservative
   direction.
