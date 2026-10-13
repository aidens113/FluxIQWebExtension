# t477: a build with a recoverable path never ends on a look count, and the model gets what it needs after a trial (Core-paired)

Worktrees: `C:/Users/osrs_/FluxStuff/fxwork/t477/!FluxIQ` and `C:/Users/osrs_/FluxStuff/fxwork/t477/!FluxIQWebExtension`, both on
`task/t477-stall-retests-not-ends`. Nothing is committed. Core paths are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/`, and domain paths to `domain/src/runtime/llm-evidence/`.

## Outcome

Done. All three causes in the debug (`run-mv5uu9g1-9d80deea.md`) check out against the source and are fixed.

1. A stall no longer ends a candidate build while its latest revision can still be tested. When a run of looks or of refused
   repeats would stall the round, the loop first asks its caller for a recoverable move. For a candidate build that move is a
   retest of the latest revision. The loop runs it as its own call, and the model is shown a note saying why.
   A refused look is now a failed call for the one repeat guard. It no longer counts as a fresh look.
2. A stale-handle detect refusal now carries the page as it is now. It names the element's current handle when exactly one
   element has the old selector, and its `next` says to use that handle or look again. A trial's answer now carries a fresh
   view of the page the trial left (`pageAfterTrial`).
3. When the two judge calls split, the model now sees both readings: the no's `unconfirmedReading` and, new, the yes's
   `answeredReading` (expected and observed, screened), with a note on how to weigh them. The judge instruction now says
   the start view is never the page a list read ran on.

## What changed and why

### Cause 1: the look count ended the build (verified)

What I verified:

- `repeat-guard/outcomes.ts:284` counted a refused look toward the run of looks.
- `outcomes.ts:288-296` returned before storing any outcome for a refused look (`answer` was `undefined` when `refused`).
- `decision-handlers/searching.ts:40-45` stalled at 8 looks.
- `candidate-generation.ts:114-120` turns a stall into the build's ending.
- The note at `searching.ts:27` promised the Flow "is then tested and judged", which was false in candidate mode.

What changed:

- **`llm/repeat-guard/outcomes.ts`**
  - A refused look neither extends nor ends the run of looks.
  - It falls through to the failure path, so it is stored as `failed` on its page. The identical refused look is then
    refused unrun by the one guard and counts in `refusedAgain`. Retry-later reasons stay exempt, and the `HANDLE_UNSHOWN`
    lifting applies as it does for any call.
  - New `stallRecovered()` resets the run of refused repeats and the run of looks.
  - Header updated with the run that caused this.
- **`llm/repeat-guard/searching.ts`**: header only.
- **New `llm/decision-handlers/stall-recovery.ts`** (`automationStudioLlmEvidenceStallRecovery`)
  - It asks `input.recoverStall`. If the caller names a call, it pushes a `core.stall_recovery.<iteration>` note
    (code `llm_evidence_loop.stall_recovered`, `stalledOn`, `ran`, `ranAs`, instruction), calls
    `repeats.stallRecovered()` and returns the call to run.
  - Otherwise it returns the stall's issue codes, plus the caller's `endedBecause`, so the ending names why.
  - It never runs a tool the loop does not offer, or one past `maxToolCalls`.
  - Exported from the barrel.
- **`llm/loop-configuration.ts`**: new optional input `recoverStall(stall) → { call } | { endedBecause } | undefined`, with
  its documentation.
- **`llm/decision-handlers/searching.ts`**
  - At the look limit it consults the recovery before stalling.
  - The note now says: "At maxLooksInARow looks in a row the searching is stopped: what you have built so far is then tested
    and judged where it still can be, and the build ends only when nothing is left to test."
- **`llm/decision-handlers/refused-repeat.ts`**
  - `automationStudioLlmEvidenceRepeatStop` gains an overload taking the iteration, which consults the recovery. Only
    `HandleRefusedRepeat` passes it.
  - The amendment and rerun callers are unchanged, because they cannot run a call.
  - `RefusedRepeatNext` gains `{ kind: "recover" }`.
- **`llm/evidence-loop.ts`**
  - It runs a recovered call at the two stall sites: the run of looks inside `runCall`, and the refused repeat in the main
    loop. A small `recover` closure over `runCall` does this.
  - The file was at its 800-line budget, so I reflowed three comments, with the same words, to stay at 800.
  - The refused-look comment now says the repeat guard refuses it on an unchanged page.
- **`flow-bootstrap/candidate/trial-gate.ts`**: new `retestable()` returns the latest revision, its digest and the trials
  run so far, or why it cannot be tested. Each reason is a code:
  - `candidate.stall_no_trial_runner`
  - `candidate.stall_nothing_submitted`
  - `candidate.stall_latest_judged_no`
  - `candidate.stall_latest_failed_twice`
  - `candidate.stall_latest_passed`
  - `candidate.stall_retests_used`
- **New `flow-bootstrap/candidate/stall-retest.ts`** (`automationStudioCandidateStallRetest`)
  - It is the candidate build's `recoverStall`, and it allows one stall-run retest per revision and trial count.
  - A second stall before any new trial, for example after a retest that was refused because the site needed a reset, ends
    with `candidate.stall_retest_already_run`.
  - The gate still bounds the trials themselves.
- **`flow-bootstrap/candidate/authoring-loop.ts`**: passes `recoverStall: automationStudioCandidateStallRetest(gate)` and
  wraps the test tool's answer with the trial view (cause 2).

The build now ends only when no retest is left. It still ends under `flow_bootstrap.evidence_repeat_without_progress`
(`stall-code.ts` is unchanged), and the issue codes carry the `candidate.stall_*` reason.

### Cause 2: the stale handle and no fresh view (verified)

What I verified:

- `structure/detect.ts:229` and `:234` refused with `instead: undefined`.
- `rejectionDetail` set no `next` for these reasons.
- The test tool's answer carried no page.

What changed in the domain:

- **`structure/detect.ts`**: new `staleTarget()`, used for `page_moved_since_packet` and `handle_no_longer_on_page` from
  `boundTarget`.
  - It throws `RecoverableToolRejection` with the current capture as `page`. `tools.ts` already retains and shows a
    refusal's page, so that page becomes the packet the next call binds through.
  - When exactly one element in the same frame has the old element's selector in the restamped capture, its handle goes
    in `instead`.
  - It takes a new optional context member, `restamp`.
- **`tools.ts`**: passes `restamp: (page) => stable(input, page)` to the detection, as one line so the file stays at 800.
- **`tool-rejection.ts`**: `page_moved_since_packet` and `handle_no_longer_on_page` now get a `next` sentence.
  - With a handle in `instead`: "use that handle".
  - Otherwise: "use the newest view or look again; call without target where it is optional".
  - A handle is recognised as a single `^t[1-9][0-9]*$` entry, so the resolver's `web.handle.stale` codes in `instead`
    are never read as a handle.
  - The repeat path (`repeated-refusal.ts`) passes `instead` back through, so it says the same.

What changed in Core:

- **New `flow-bootstrap/candidate/trial-view.ts`** (`automationStudioCandidateTrialView`)
  - After a trial that ran, or a reset that moved the target (`effectApplied`), it takes one look with the domain's own
    look. That look is the tool's `initialObservation.input`, the same precedent as `parking/person-needed-tool-calls.ts`.
  - The look's answer goes on the trial's answer as `pageAfterTrial`, with a `pageAfterTrialNote`.
  - A look that fails or is refused adds no page, and the note says to look again. An abort is rethrown.

### Cause 3: the judge split (verified)

What I verified: `agreement.ts:107-122` kept only the no's reading, and a yes verdict kept none of its prose.

What changed:

- **New `result-verification/judgement-screen.ts`**: `screenedJudgement` and `screenedText` moved here from
  `repair-directive.ts`, unchanged. It is not exported from the barrel, and `repair-directive.ts` imports it.
- **`result-verification/contracts.ts`**: new `answeredReading?: { expected?, observed? }` on
  `AutomationStudioResultVerification`.
  - It is documented as never a repair and never advice.
  - It is not recorded on a run, because `run-record.ts` copies named fields only.
- **`result-verification/verdict.ts`**: a plain yes carries its screened expected and observed as `answeredReading`.
- **`result-verification/agreement.ts`**: on `model_disagreed`, it carries the yes call's `answeredReading` beside the no's
  `unconfirmedReading`, each copied from its own call.
- **`result-verification/build-test/judge.ts`**: an `unknown` from a split carries `answeredReading`.
- **`service/candidate-trial/feedback.ts`**: an unsure trial with a split carries `answeredReading` and a `readings` note.
  - The note says neither reading was confirmed.
  - It says to weigh each by the trial's own reads, steps and stored rows: the start view is the page before the first
    step, and a read ran on the page its own steps reached.
  - It says to change the Flow only where the evidence supports it, and otherwise to retest the same revision.
- **`llm/diagnosis-instructions.ts`**: one sentence added after the `startView` sentence, which both the post-run and the
  build-test judges receive: "startView is never the page a list read ran on once an earlier step searched, filtered,
  sorted or went to another page: …never judge a read's paging or count from what startView shows."
- **`llm/deepseek/tests/system-prompt-pins.json`**: the `loop_verification` and `loop_verification_build_test` pins were
  re-pinned with exactly that sentence inserted. The test file says pins move when Core's own prose does.

### Tests added or updated

**Core:**

- `repeat-guard/tests/outcomes.test.ts`: +2. A refused look is `failed` and leaves the look run as it was;
  `stallRecovered` resets both runs.
- `decision-handlers/tests/stall-recovery.test.ts` (new, 4 tests, through the real loop):
  - recovery at the 8th look;
  - recovery at the 3rd refused repeat, after which the runs start again;
  - `endedBecause` joins the codes;
  - a tool that is not offered, or no caller, ends as before.
- `flow-bootstrap/candidate/tests/stall-retest.test.ts` (new, 3 tests):
  - each `retestable` reason;
  - the once-per-trial-count bound;
  - end to end through the real authoring loop: an unsure trial, then 8 looks, then a stall retest that answers yes, and
    the build completes.
- `flow-bootstrap/candidate/tests/trial-view.test.ts` (new, 3 tests).
- `result-verification/tests/agreement.test.ts`: +3.
- `result-verification/build-test/tests/judge.test.ts`: +1.
- `service/candidate-trial/tests/feedback.test.ts`: +2.
- `llm/tests/diagnosis-channel.test.ts`: +1.

**Domain:**

- `structure/tests/detect.test.ts`: the stale cases now assert the page and `next`. A new test covers a page that moved
  and has one element with the old selector: `instead` names a fresh handle shown in the attached page, and a detection
  with that handle then succeeds.
- `tests/tool-rejection-detail.test.ts`: +1 test, and one expectation updated.
- `harness-options/tests/detect-option.test.ts`: the recovery-path stale refusal now carries the page and `next`.

## Commands run and observed results

Core (`C:/Users/osrs_/FluxStuff/fxwork/t477/!FluxIQ`):

- `pnpm check` in `packages/fluxiq` (tsc) printed no errors. The last run printed
  `{"build-cache":"build","step":"fluxiq:check",...}` and nothing else.
- `npx vitest run` over `runtime/llm`, `runtime/flow-bootstrap`, `runtime/result-verification`,
  `runtime/service/candidate-trial`, `runtime/service/flow-bootstrap-commands`, `runtime/service/candidate-failure` and
  `runtime/parking`:
  - First run: `Test Files 1 failed | 409 passed | 1 skipped (411)`, `Tests 4 failed | 4503 passed | 2 skipped`. All 4
    failures were `deepseek/tests/system-prompt.test.ts` pins, which were then re-pinned.
  - Re-run of that file: `Tests 31 passed (31)`.
- `npx vitest run runtime/activity runtime/conversations runtime/llm/deepseek`: `Test Files 69 passed (69)`,
  `Tests 635 passed (635)`.
- `pnpm structure:check`: `structure-audit: passed (336 warning(s), 1159 baselined)`.
  - It also reports "2 baseline entries can be lowered": `runtime/service.ts` file-lines and
    `storage/project/runtime-stream-store.ts` statement-packing.
  - Those are files I did not touch. I ran `pnpm structure:baseline`, saw that those were the only two entries, and
    restored the file, so the baseline is unchanged in my diff.
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`: Done. This was
  needed so the domain compiles against the changed Core.

Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t477/!FluxIQWebExtension`):

- `pnpm check` in `domain` (source and test tsc against the rebuilt Core) printed
  `core-build: ... current with its source.` and `{"build-cache":"build","step":"domain:check",...}`, with no errors.
- `node scripts/test-domain.mjs runtime/llm-evidence/tests/ runtime/llm-evidence/structure/tests/ harness-options/tests/
  node-run/tests/replay-verify plan-resolution/tests/`: `# tests 413`, `# pass 413`, `# fail 0`.
- `pnpm structure:check`: `structure-audit: passed (186 warning(s), 646 baselined)`.
  - Before my fixes it failed on `tools.ts` at 801 lines and on two test spreads (`contract-spread`). All three were mine
    and are fixed.

No paid run and no Lab run.

## Not verified

- **Live behaviour.** No Lab run was made (none was authorised). Whether lane C's build would now retest revision 3 and pass
  is inferred from the end-to-end unit test and from build 1 of that run passing on the same source.
- **Budget before a stall-run retest.** It checks only `maxToolCalls` and the gate's trial bound. It does not check the
  seconds or cost left: a trial took 52 s in this run. With little time left, the trial port's own deadline or a
  `not_judged` verdict is what bounds it.
- **Stalls not routed through recovery.** The refusal-of-a-kind run (`refusal-run.ts`), the `unusable()` path (refused
  completions and unusable replies), and the amendment and rerun repeat stops still end as before. They were not named in
  the brief, and the amendment and rerun callers cannot run a call synchronously.
- **A stall while a yes stands** ends `candidate.stall_latest_passed`. It does not complete on the model's behalf.
- **Stale page views.** The debug's suggestion to supersede stale page views in the evidence after a trial was not done.
  The fresh `pageAfterTrial` plus the domain's refusal page cover the hand-off.
- **Press refusals.** `press.ts:152` still refuses a stale handle without the page or `instead`. It now gets the generic
  `next` sentence through `rejectionDetail`. Only detect was in scope.
- **The full suites** (`pnpm check` and `pnpm test` at the repository roots) were not run, per the twice-a-day rule.

## Open questions or contradictions found

- **Files touched beyond the brief's list.** Each is needed for the change, and each change is minimal:
  - In Core: `llm/evidence-loop.ts` (net zero lines), `llm/loop-configuration.ts`, `llm/decision-handlers/` (`searching`,
    `refused-repeat`, the new `stall-recovery` and the barrel), `flow-bootstrap/candidate/` (`authoring-loop`,
    `trial-gate`, two new files and the barrel), `result-verification/` (`contracts`, `verdict`, `repair-directive`
    extraction, new `judgement-screen`, `build-test/judge`), `service/candidate-trial/feedback.ts`,
    `llm/diagnosis-instructions.ts` and the deepseek pins.
  - In the domain: `tools.ts` (one line) and `tool-rejection.ts` (the `next` sentences).
- **The repeat guard (the t475 area).** I edited `llm/repeat-guard/outcomes.ts` (refused looks and `stallRecovered`) and
  the `searching.ts` header there. The brief assigns them to me as "outcomes.ts and its look-counter". I did not touch the
  reset-gate path or `result-summary.ts`.
- **Behaviour change.** A look the domain refused, sent again unchanged on an unchanged page, is now refused unrun as a
  repeat. Before, it ran again. This is the user's rule and the debug's proposal. No existing test pinned the old
  behaviour (`run-mudwci8d`'s concern was answering from memory, and that path is still not taken).
- **Contradiction with the debug.** The debug proposed that a look which answered something new should not extend the run
  of looks. I did not apply that. It would reopen lane A's t174 case of 45 varied finds on one page. The look count still
  stops the searching, and now retests instead of ending.
