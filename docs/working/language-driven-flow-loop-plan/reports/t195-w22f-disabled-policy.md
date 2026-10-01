# t195-w22f: a control that stays disabled fails promptly; one that is changing is waited out

## Outcome

Done. `click.spec.ts:132` ("a disabled target is rejected, and nothing on the page moves") passes, and the spec is
unchanged. Recovery now waits at a gate-level `disabled` only while the control shows it is changing: its text or name
changed since the previous attempt, or it says `aria-busy="true"`. A static disabled control gets one look of 1,100 ms and
then fails with exactly the shape the spec asserts.

One other row in the same spec, `click.spec.ts:119` ("the whole gesture is untrusted..."), fails both before and after
this change. The disabled path is not involved; see Open questions 1.

## What changed and why

- **`recovery/refused-control.ts` (new).** This holds a closed, bounded fingerprint of a refused control.
  - The state is `{ fingerprint: 8 hex chars (FNV-1a), busy: boolean }`.
  - The fingerprint covers the control's `textContent` (whitespace-normalized, at most 512 characters), `aria-label`,
    `aria-valuetext`, and the value of a button-like `<input>` (`button`/`submit`/`reset`). No other input's value is
    read.
  - `busy` is true when `closest('[aria-busy="true"]')` finds the control or something holding it.
  - The state is kept in a `WeakMap` keyed by the result object, beside the result and never on it. Core's record parser
    drops a whole record for one unknown key, and no page text is held.
  - Exports: `noteRefusedControl`, `refusedControl`, and `refusedControlChanging(previous, current)`. That last one is
    true when `current` is busy, or when both states exist and their fingerprints differ.
- **`results.ts` / `actionRejected`.** On the ACTION_REJECTED path only, when `refusedBeforeDispatch`, `reason ===
  "disabled"` and `evidence.target` are all present, it calls `noteRefusedControl(result, target)`. The gates in click,
  type, select and check already pass `target: element` and `refusedBeforeDispatch: true` (F32), so none of the four verb
  files needed changing. I also updated the doc comment on `ActionResultEvidence.target`.
- **`recovery/budget.ts`.** New `RECOVERY_DISABLED_BACKOFF_MS = [1100, 1100, 1100, 1100]`, which `disabled_target` now
  uses instead of the target ladder.
  - The rungs must be at least one countdown tick apart. Otherwise two attempts see "Please wait 2" twice and the loop
    gives up on a control that is counting down.
  - The rungs total 4.4 s, which covers job-board's 3 s. `RECOVERY_BUDGET_MS` (5 s) still caps the wait.
  - The first rung is all a static control costs, so it stays under the brief's ~1.2 s.
- **`recovery/attempt.ts`.** For `disabled_target`, the loop tracks the control state from the previous attempt.
  - The first refusal in a run is always given its one look.
  - A later refusal is absorbed only when `refusedControlChanging(previous, current)` is true.
  - When it is not:
    - **If the previous wait was only the first look**, the look is removed from `absorbed`. It absorbed nothing; it
      established the refusal is not transient. The account sentence is therefore omitted, and the page's refusal is
      reported exactly as the verb wrote it: `web.action.rejected`, `retryable: false`, `"disabled: the element is
      disabled"`. That is the spec's exact shape.
    - **If the control had been changing and then stopped**, the last refusal is pushed onto `absorbed`, so the outcome
      is `exhausted` and the texts say "did not recover within its N attempts...". The first implementation stopped
      without pushing, and `outcomeOf` then called the failure "recovered". The frozen-countdown unit row caught this.
  - Any other fault resets the tracking, so a later disabled refusal gets a fresh look.
- **`recovery/fault.ts`.** Documentation only: `disabled_target` makes a refusal eligible to be waited at, and the loop
  decides how long.
- **`recovery/index.ts`.** The barrel exports the new module and ladder.

## Tests

- `recovery/tests/attempt.test.ts` (disabled section rewritten). Each row uses the real `actionRejected` with a fake
  control:
  - a disabled-for-a-moment click lands, with `waitedMs` equal to `RECOVERY_DISABLED_BACKOFF_MS[0]`;
  - **countdown** ("Please wait 3/2/1", then enabled) is waited out: 4 calls, pauses `[1100, 1100, 1100]`, `recovered`;
  - **static** control fails after one look: 2 calls, pauses `[1100]`, `absorbed: []`. After `recordRecovery`, the
    message, validation and `failure.actual` are exactly the spec's strings, with `retryable: false`;
  - a gate refusal with no noted control is treated as static;
  - **busy** control with an unchanging label is waited out: 4 calls;
  - a countdown that freezes stops at the attempt that shows it, as `exhausted` with the account sentence;
  - `check.ts` after `setCheckedState` is still not waited out (row kept);
  - a busy control that never clears ends at the budget, and no attempt is dispatched past `RECOVERY_BUDGET_MS`. This
    replaces the old "stays disabled past the budget" row, which now fails fast by design.
- `recovery/tests/refused-control.test.ts` (new, 6 rows) covers:
  - the fingerprint format, and that no page words are kept;
  - that a tick changes the fingerprint and whitespace does not;
  - that a submit input's value is read and a text input's value is not;
  - `busy` read from the control or an ancestor;
  - the `refusedControlChanging` truth table;
  - a missing state.
- `recovery/tests/budget.test.ts`: the disabled-ladder row now asserts the new ladder:
  - every rung is between 1,000 and 1,200 ms;
  - the rungs sum to at least 3,000;
  - the sum is below the budget.

## Commands run and observed results

- Before any change:
  - **Command:** `bash heavy.sh "t195-w22f content click.spec" pnpm --filter @fluxiq-web-extension/extension test:content -- click.spec.ts --reporter=line`
  - **Result:** `2 failed / 15 passed`.
  - **`:132` diff:** `failure.actual` read `"disabled: the element is disabled; the execution did not recover within its 5 attempts after absorbing disabled_target, ×5, waiting 3750 ms"`, and so did `validation.actual`.
  - **`:119`:** `status: "failed"`, expected `"succeeded"`.
- `node <scratchpad>/run-dir-tests.mjs apps/extension w22f content/action-runtime/recovery/tests content/actions/tests`
  - First run: `ℹ tests 176 / pass 175 / fail 1`. The failure was the frozen-countdown row reporting outcome
    `recovered`, which led to the push fix above.
  - Final: `ℹ tests 176 / ℹ pass 176 / ℹ fail 0`.
- Same `test:content` command after the change: `1 failed / 16 passed (27.0s)`. `:132` passes. The only failure is
  `:119`, unchanged from before.
- Probe of `:119`:
  - **Probe:** a temporary `console.log` of the reply, run with `-g untrusted`. The spec was restored from a scratch copy
    afterwards, and `git status` shows `click.spec.ts` unmodified.
  - **Reply:** `status: "failed"`, `code: web.validation.output_not_observed`, actual `"the point 640,292 landed on the target; the page ignored the first press, so it was pressed once more, and it ignored that press too: no request, no change inside the control or its section, no navigation and no focus move"`.
- `bash heavy.sh "t195-w22f check" pnpm --filter @fluxiq-web-extension/extension check` exited 0.
- `node scripts/structure-audit.mjs`:
  - The first run reported `4 violation(s)`, all in files other workers own:
    - `domain/.../structure/tests/continues.test.ts` (contract-spread);
    - `apps/extension/src/content/extraction/section-link.ts` (failure-as-empty).
  - A rerun a minute later printed `structure-audit: passed (154 warning(s), 118 baselined)`.
  - Warnings only on my files: `attempt.test.ts` at 595 lines and `results.ts` at 526 lines, both past the 400-line
    advisory.

## Not verified

- No Lab or live run, per the brief. Whether job-board's real "Please wait N" shield is waited out end to end is not
  exercised. w20k found that the resolver answers `target_not_found` there, so this path may not even be reached on the
  shield.
- No browser spec beyond `click.spec.ts`. No `type`/`select`/`check` disabled specs were run.
- The fingerprint against a real DOM. Only `failure-surfaces`' static button (via the spec) and fake elements in unit
  tests were exercised. Neither a real `aria-busy` page nor a ticking page was run in a browser.
- A countdown whose tick is slower than 1.1 s would be refused after its first unchanged look unless it also sets
  `aria-busy`. That is by design under the lead's rule, but it is untested against a real page.

## Open questions or contradictions found

1. **`click.spec.ts:119` fails on dev, and the cause is not this brief's.** The ignored-press rule
   (`IGNORED_TWICE` in `actions/click.ts`, the `ignored-press/` watch) reports a click on a plain `<p>` that has no
   activation behaviour as OUTPUT_NOT_OBSERVED. The spec expects `succeeded` with nothing recorded. Either the rule
   should exempt targets with no activation behaviour, or the row's expectation changed with that feature. I did not
   touch it: the rule's owner and intent are outside this brief.
2. **Account visibility trade-off.** A static control's one look (1,100 ms) does not appear in either wire text. This
   keeps the spec's exact failure shape, as the lead's decision quotes it. The wait is visible only in
   `startedAt`/`finishedAt` and in the in-page account object (`attempts: 2, waitedMs: 1100, absorbed: []`, outcome
   `clean`). If the supervisor prefers that the look be stated, there is a two-line alternative:
   - keep the look in `absorbed`;
   - relax the spec's three exact strings to head matches plus an "after absorbing disabled_target" assertion, as the
     covered and hidden rows already do.
