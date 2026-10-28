# t769 B17: a single-subflow test answered from the recording, said as one by the builder's gate

AS = `packages/fluxiq/src/programs/automation-studio/` in Core `fxwork/t769/!FluxIQ`, branch `task/t769-p6-offline-trials-in-builds`.

## Outcome

Done. Option (a) from B15's open question 1 is in place. A port's subflow trial result may now carry one marker, `checkedAgainst: "recorded_run"`. The single-subflow whole test sets it when the supervisor's whole gate kept the answer from the recording.

When the marker is present, the builder's subflow gate handles the answer as it handles its own kept answers:
- It lifts `checkedAgainst` to the top level of its evidence.
- It puts B3's `said` words (`AUTOMATION_STUDIO_TRIAL_OFFLINE_FIRST_WORDS.kept`) before the instruction.
- It skips `reset.trialRan` and `leftOnSite`.

As a result, builder-loop's `automationStudioCandidateTrialView` sends no after-trial page look for such an answer.

The start hook and project reset that run before the port call are unchanged and still run on this path. t775 owns that code. No reset precondition was added.

UNIT READY: AS runtime/flow-bootstrap/subflow-candidate/contracts.ts, AS runtime/flow-bootstrap/subflow-candidate/subflow-trial-result.ts, AS runtime/flow-bootstrap/subflow-candidate/subflow-trial-gate.ts, AS runtime/flow-bootstrap/subflow-candidate/tests/subflow-trial-offline.test.ts, AS runtime/project-agents/single-subflow/single-subflow-trial.ts, AS runtime/project-agents/single-subflow/whole-test-port.ts, AS runtime/project-agents/single-subflow/tests/single-subflow-offline-first.test.ts

## What changed and why

- `subflow-candidate/contracts.ts` (lines 127-133): adds an optional `checkedAgainst?: "recorded_run"` to `AutomationStudioSubflowTrialResult`, with a doc comment. This is the one plain marker.
- `subflow-candidate/subflow-trial-result.ts` (lines 40-41): the gate's result read copies the marker onto the answer it keeps. Without this, the read would drop it, because it rebuilds the answer field by field.
- `single-subflow/single-subflow-trial.ts`:
  - `answerOf` (lines 259-260) sets `trial.checkedAgainst = "recorded_run"` when the whole gate's evidence says `checkedAgainst: "recorded_run"` (the existing `recorded` flag).
  - Header lines 116-119 say so.
- `single-subflow/whole-test-port.ts`: no code change. The port's `{ rowCheck, ...trial }` already hands the marker through, and so do the dispatch wrapper and `receipts.wrap`. The header bullet "The start hook still runs first" (lines 22-24) now records that the hook and reset still run before a test the whole gate then answers from the recording, and that the marker is handed through unchanged.
- Gate `subflow-candidate/subflow-trial-gate.ts` (785 -> 791 lines). Every changed line range, after the edit:
  - Lines 238-239 (header, P6 paragraph): two added comment lines. They say a port's own answer from the recording is said and kept the same way, nothing is recorded as left on the site, and the hook and reset before it still ran.
  - Line 266: added `import { AUTOMATION_STUDIO_TRIAL_OFFLINE_FIRST_WORDS as OFFLINE_WORDS } from "../offline-first/index.ts";`.
  - Lines 550-551: added `const recorded = !kept && asked.answer.checkedAgainst === "recorded_run";`, after the notRun and unaffordable returns.
  - Line 571: `siteless ? undefined :` became `siteless || recorded ? undefined :`, so `trialRan` is skipped and there is no `leftOnSite`.
  - Line 578: `offline &&` became `(offline || recorded) &&`.
    - This goes beyond the brief's letter. A yes a port says the recording gave is never kept as the yes that completes, as the gate's own offline rule (Decision 3) says.
    - The whole gate never returns such a yes (D48). This is only a guard.
  - Line 587: the instruction prefix is now `kept ? kept.said : recorded ? OFFLINE_WORDS.kept : ""`.
  - Line 594: added `...(recorded ? { checkedAgainst: "recorded_run" } : {})` as the evidence's last spread.

## Commands run and observed results

All on 2026-10-28, from `packages/fluxiq` unless noted.

- **Tests first.** `pnpm test .../subflow-candidate/tests/subflow-trial-offline .../single-subflow/tests/single-subflow-offline-first` printed `Test Files 2 failed (2)`, `Tests 3 failed | 14 passed (17)`, `[vitest-groups] failed: parallel (exit 1)`. The failures were:
  - The gate kept no: `expected { offline: +0, admissions: 1, …(4) } to deeply equal ...`, because `ran` was 1.
  - The recorded yes: the same `ran` mismatch.
  - The single-subflow builder: `expected { ok: false, partial: true, …(9) } to match object { checkedAgainst: 'recorded_run' }`.
  - The new live-control test passed before the change, as intended.
- **After the change.** `pnpm test src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate src/programs/automation-studio/runtime/project-agents/single-subflow` printed `Test Files 34 passed (34)`, `Tests 187 passed (187)`, `[vitest-groups] all groups passed: parallel, real-sql`.
- **Extra narrow check** (the dispatch wrapper carries the marked result). `pnpm test src/programs/automation-studio/runtime/project-agents/dispatch` printed `Test Files 25 passed (25)`, `Tests 136 passed (136)`, `all groups passed: parallel, real-sql`.
- **Typecheck.** `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` printed no output, exit 0.
- **Structure audit.** From the Core root, `node scripts/structure-audit.mjs | grep -E "FAIL|structure-audit:"` printed `structure-audit: passed (444 warning(s), 1152 baselined).`, with no FAIL. These advisory warnings were already there before this task: `subflow-candidate/` has 19 files and its `tests/` has 25, and the gate is at 791 lines (threshold 400). No new file was added.
- **Line endings.** My Python edits briefly wrote these files with LF, while the checkout uses CRLF. I rewrote them as CRLF, and a byte count confirms every line ends in CRLF: contracts, gate, result read, the gate's offline test, single-subflow-trial, and the single-subflow offline-first test. whole-test-port was edited CRLF-preserving.

## Tests added

- `subflow-candidate/tests/subflow-trial-offline.test.ts`:
  - `LiveAnswer` gains an optional `checkedAgainst`.
  - A `LOOK` tool and a `looksAfter()` helper call the real `automationStudioCandidateTrialView`, the view builder-loop.ts runs, and count `executeTool` calls.
  - New describe block with three tests:
    1. **Kept no from the recording.** Calls are `{offline 0, admissions 1, hooks 1, resets 1, trials 1, ran 0}`. The evidence has top-level `checkedAgainst`. The instruction starts with `WORDS.kept` and then the no words. There is no `leftOnSite` or `offlineCheck`. The gate weighs it as no, the digest is closed, and the page look count is 0.
    2. **Recorded yes.** `resultCode: subflow.trial_offline_yes`, `ran 0`, and completion is refused with `subflow.trial_required`.
    3. **Live answer from the same port.** `ran 1`, no `checkedAgainst`, no prefix, and the page look count is 1.
- `single-subflow/tests/single-subflow-offline-first.test.ts`, first test, through the real whole-test port and subflow gate:
  - The live first answer has no top-level `checkedAgainst`, no prefix, and gets one look.
  - The kept answer has `checkedAgainst: "recorded_run"` at the top level, an instruction that starts with `OFFLINE.kept + " "`, no `leftOnSite`, and zero looks.
- The same file's second test (live after an offline pass) now also asserts that the evidence has no top-level `checkedAgainst`.

## Not verified

- **Not tested inside builder-loop.** No test ran the full builder loop (builder-loop.ts's `executeTool`). Instead, the real `automationStudioCandidateTrialView` was called on the gate's real answer, with `targetMoved` unset. In a real build, `input.trial.moves` may count a move from the pre-call hook or reset. The view would then still look, which is the intended behaviour, because the hook did move the page.
- **Gate reset not exercised on the single-subflow path.** `gatedSingleBuild` gives its gate no `reset`, so on that path `leftOnSite` and `trialRan` were checked only by the gate-level test, which has a counting reset.
- **Chat words not checked.** `activity/candidate/offline-words.ts` reads the evidence's top-level `checkedAgainst`. I did not run its tests or check the chat words end to end.
- **No full suites, no live or paid runs, no model calls.**

## Open questions or contradictions found

1. **The pre-call hook and reset remain.** On this path, the builder's gate still runs admission, `prepareStart` and `reset.beforeTrial` before it asks the port, so a kept no still costs a start hook and a reset. The evidence therefore may still carry `startedWith` or `absorbedByStartReset`, which is truthful because they ran. t775 is retiring those reset gates. This change does not touch them, as the brief said.
2. **The reset ledger after a skipped `trialRan`.** For a recorded answer, `reset.beforeTrial` admitted but `trialRan` is skipped. The ledger's phase counters and read clock are therefore not advanced (`site-reset/ledger.ts:528`). Nothing landed on the site, so this looks right, but it is a state no earlier path produced: the gate's own kept answers never ran `beforeTrial` either. Worth a look when t775 reworks this path.
3. **The t647 explored-on-absorbed finding.** A recorded non-yes whose pre-call hook took back an act explored by this brief can still get `coreFindings: trial.explored_on_absorbed_act`. The gate's own kept answers never do, because no hook ran for them. I left this unchanged to keep the edit minimal. Say if it should be skipped for `recorded` too (a one-token change at gate line 561).
4. **The receipt is listed as heard from the port.** The dispatch wrapper lists such a trial through `receipts.wrap` and `receipts.weighed`, not `receipts.kept`. The receipt reference carries no recorded flag, as B11 says. This is unchanged and outside my files.
