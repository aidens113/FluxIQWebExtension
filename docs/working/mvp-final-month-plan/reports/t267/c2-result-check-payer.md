# t267 C2: who pays for a run's result check (MVP item 23)

Worker report for brief `t267-c2-result-check-payer`. Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t267/!FluxIQ`, branch
`task/t267-adaptation-loop-unblock`. Nothing committed.

## Outcome

Done. A paired client's model run (the extension's Automations Run) now pays
with the caller's key only for result checks that judge a repair. A person's own
session is unchanged and pays for every check. A re-authored Flow's re-run is
now judged under the repaired-run decision, the same way the resumed retry
already was.

## What changed and why

`A` = `packages/fluxiq/src/programs/automation-studio`, `R` = `A/runtime`.

- `R/service.ts`: three changes folded into existing lines. The file is still
  4400 lines, adds no method and keeps CRLF in the working copy.
  - The import adds `type AutomationStudioResultCheckCallerPays`.
  - `runRuntimeSession` input: on the `useReusableContext` line, added
    `resultCheckCallerPays?: AutomationStudioResultCheckCallerPays` with a
    one-line JSDoc.
  - The result ports' `resolveAutomationStudioResultCheckProvider({ scope, ...`:
    after `scope`, added
    `...(input.resultCheckCallerPays ? { callerPays: input.resultCheckCallerPays } : {})`.
  - The `rerunRepairedFlow` port, on its return line: when the re-run returns a
    session, `runResultCheck = automationStudioRepairedRunResultCheck({ context: adaptationContext, check: runResultCheck, nowMs: Date.now() })`
    runs, as the resume path at `:2686`/`:2739` does. `resolveProvider`
    reads `runResultCheck` lazily, so the re-run's verification resolves its
    provider under the `after_repair` decision.
- `A/api/handlers/runtime-execution.ts`: records `caller.paired` from
  `service.conversations.callerFor`. When `llmExecution` is set and the caller
  is paired, it passes `resultCheckCallerPays: "repair_checks"` to
  `service.runRuntimeSession`. A person's own session passes nothing. A
  key-locked paired client has no `llmExecution`, so it passes nothing either.
- `R/service/runtime-adaptation/result-check.ts`: changed only the doc comment.
  The "nothing passes `repair_checks` yet" sentence now says where the option
  is wired.
- `docs/architecture/package-boundaries.md`: added a short "Next minor
  (unreleased)" migration entry covering the new input, the paired-client
  endpoint change and the re-run decision. I used the literal union because
  neither `AutomationStudioResultCheckCallerPays` nor the resolver is
  re-exported from `R/index.ts`. No export moved, so I did not regenerate the
  framework reference; `docs:check` reports it current.
- Tests:
  - `A/api/handlers/tests/runtime-execution.test.ts`:
    - The paired unlocked-session expectation now includes
      `resultCheckCallerPays: "repair_checks"`.
    - The person-actor test now asserts the property is absent. Its exact
      `toHaveBeenCalledWith` already pinned this.
  - New `R/tests/service-adaptation/tests/caller-paid-result-check.test.ts`
    (237 lines). Its harness is cut down from
    `unattended-retry-verification.test.ts`:
    - (a) A clean run with a caller and `repair_checks` makes no
      `loop_verification` call and no standing call. The run records
      `core.result.no_model_available`.
    - (a') Under the `every_run` schedule with a standing authorization, the
      routine sample (`initial_window`) is paid by the standing authorization
      and never by the caller.
    - (c, resume) The drift Flow is repaired by `temporary_wait_retry` and the
      resumed retry. With `repair_checks` and a standing authorization
      available, the caller's key judges it: exactly one caller
      `loop_verification`, no standing call, and the recorded
      `resultCheck: { checked: true, code: core.check.after_repair, status: confirmed }`.
    - (b) Option absent: the clean run is judged by the caller even though the
      schedule skips run 1. This is today's behaviour.
  - New `R/tests/service-adaptation/tests/caller-paid-reauthor-check.test.ts`
    (191 lines). Its harness is cut down from
    `refuted-result/tests/reauthor-service.test.ts`, with the standing judge and
    the caller provider told apart. Under `repair_checks` with a standing
    authorization:
    - The standing judge refutes the routine check (two calls).
    - The caller pays for the re-author build:
      `[evidence_tool_decision x2, loop_verification x2]`.
    - The caller pays for the re-run's check (one `loop_verification`).
    - The run succeeds with `resultReauthor: { routed: true, applied: true }`.

## Commands run and observed results

Unless stated otherwise, all commands ran in `packages/fluxiq`.

- Fail-first, handler: `npx vitest run src/programs/automation-studio/api/handlers/tests/runtime-execution.test.ts`
  before the handler change: 1 failed, 7 passed. The diff showed the missing
  `"resultCheckCallerPays": "repair_checks"`. After the change: 8 passed.
- Fail-first, service: I copied the HEAD `service.ts` back in (CRLF), keeping
  the fixed copy in the scratchpad, and ran both new files.
  - Result: 3 failed, 2 passed.
  - Failed: (a), (a') and the re-author case. In (a) and (a') the caller was
    called (`expected [ { ... } ] to deeply equal []`). In the re-author case
    no standing call was made, because the caller paid the routine check.
  - Passed: the resume case and the option-absent case, as expected without
    the wiring.
- Fail-first, re-run fold alone: I restored the fix with only the
  `rerunRepairedFlow` assignment removed. The re-author case failed with
  `expected [ 'loop_verification', …(3) ] to deeply equal [ 'loop_verification', …(1) ]`:
  the standing authorization judged the re-run again. I then restored the full
  fix and `wc -l` showed 4400.
- Validation set, run twice:
  `npx vitest run A/api/handlers/tests/{runtime-execution,llm-generation,llm-permission,conversations}.test.ts A/runtime/service/runtime-adaptation/tests/ A/runtime/tests/service-adaptation/tests/`
  - Pass 1: `Test Files 35 passed (35)`, `Tests 274 passed (274)`, exit 0.
  - Pass 2: `Test Files 35 passed (35)`, `Tests 274 passed (274)`, exit 0.
- From the Core root:
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0. It printed
    `"step":"fluxiq:check","reason":"inputs changed: packages/fluxiq"`.
  - `node scripts/structure-audit.mjs`: exit 0,
    `structure-audit: passed (254 warning(s), 349 baselined).` No line names
    `service.ts`, `runtime-execution`, `result-check.ts` or the new test files.
  - `pnpm.cmd docs:check`: exit 0. It printed
    `structure-audit: passed (0 warning(s), 0 baselined).` and
    `Deterministic framework reference is current.`
- `wc -l R/service.ts`: `4400`.
- `git ls-files --eol`:
  - `service.ts` and `package-boundaries.md` are still `w/crlf`.
  - `runtime-execution.ts`, its test and `result-check.ts` are still `w/lf`.
  - The new test files are `w/lf`, matching `i/lf` across the tree.

## Not verified

- I did not run a live Lab run or exercise the real extension. The
  paired-client mapping is covered only through the handler test's
  `automationStudioConversationEffectiveCaller`.
- I did not run full package suites: `pnpm check`, `pnpm test`, or Core's whole
  vitest run. That follows the narrow-check rule.
- The failed-step re-author (`repairFailedStep` in `run-outcome.ts`) also goes
  through `rerunRepairedFlow`, so its re-run now gets the repaired decision too.
  I did not test that path directly.

## Open questions or contradictions found

1. **The recorded check code is stale on a re-author re-run.**
   `result-verification/run-outcome.ts` re-enters
   `verifyAutomationStudioRuntimeSessionResult({ ...input, session: rerun.session })`,
   so the re-run's verification still records the `resultCheck`
   (`checked`/`code`/`reason`) taken when the run started.
   - My fold changes who pays: the provider is read lazily. It does not change
     what is recorded, so the re-author test records `core.check.initial_window`
     although the re-run was judged as a repair.
   - Fixing the record needs `run-outcome.ts` to take the check lazily or
     through a port. That file is in `R/result-verification/**`, which I must
     not touch.
   - The re-author test pins the current record with a comment, and the
     migration note says so.
2. **A caller-paid check is recorded as unchecked when no standing
   authorization exists.** `automationStudioRunResultCheck` sets
   `checked`/`code` from the standing redemption. A run the caller's key judges
   with no authorization configured is therefore recorded as
   `checked: false, code: core.check.authorization_absent, status: confirmed`.
   This is what I observed for the resumed-retry case without `standing`. It
   is not new with this change, but it now matters more, since caller-paid
   checks are exactly the repair checks. I did not change it, because only the
   doc comment of `result-check.ts` was mine.
3. **The caller-pays type is not public.**
   `runRuntimeSession`'s new input refers to
   `AutomationStudioResultCheckCallerPays`, which is not re-exported from
   `R/index.ts`. A host can still pass the literal. Exporting the type is a
   one-line change in `R/index.ts`, which I do not own.
