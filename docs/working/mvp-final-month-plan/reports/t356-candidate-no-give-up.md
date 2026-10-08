# t356: a candidate build does not give up on a failure it can recover from

Worker: t356-no-give-up. Worktree `C:\Users\osrs_\FluxStuff\fxwork\t356`. Core is on `0c53a16c` plus uncommitted edits. Downstream is on `47dd1a1b` plus uncommitted edits. Nothing is committed.

## Outcome

Done.

Every goal in the brief has a test that failed before the change and passes after it. The coordinator added C1, C3, C4 and C5 mid-task; those are covered too:

- **Re-testing after a transient trial result (C5).** A re-test after `execution_failed`, `not_judged` or `unsure` is no longer refused as a repeat. The trial gate now decides alone when the same revision may be tested again, up to 3 trials of one revision.
- **Targets that survive a trial reset (C1).** A handle no longer takes its identity from a view taken after its own action. "Collected" can no longer become the identity of the "Get coupons" button.
- **Refusals that name the problem and the fix (C3).** A refused handle is now named in the refusal, and every refused submission says how to recover.
- **Repeated refusals end the round early.** The same refusal three decisions in a row now ends the round. Before, it took about eight more refusals for the no-progress guard to stop the build.
- **Readable trial feedback (C4).** Each step in the trial feedback now names the control it acted on, says what happened in plain words, and says whether trying again may pass.

## What changed and why

### Core (`C:\Users\osrs_\FluxStuff\fxwork\t356\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\`)

**1. Re-testing after a transient result (goal 1, C5).**

- File: `flow-bootstrap/candidate/trial-gate.ts`.
- Cause, reproduced in a test: the web domain reports the page each call found, so the loop's repeat guard (`llm/repeat-guard/outcomes.ts`) had a page to key `core.test_candidate` on. A trial reports no page of its own, so the identical re-test looked like "the same call on the same page failed before". The test, run on the old code, produced exactly round 4's step 0050 `llm_evidence_loop.repeat_refused`.
- Fix: a transient verdict with a re-test left now carries `resultReason: "retry_allowed"`. The repeat guard already exempts any call whose result says to try again later (`retry-later.ts`), so it never refuses the re-test.
- The gate owns the limit: `AUTOMATION_STUDIO_CANDIDATE_MAX_TRIALS_PER_REVISION = 3` trials per revision and digest. After that it refuses `candidate.trial_retest_limit`, includes the last feedback, and says to change the step and resubmit.
- Each transient answer now carries `retestsLeft`.
- The `execution_failed` instruction now says to test the same revision again when the step may pass on a retry (`retryable`), and otherwise to correct the step.
- No edit to the repeat guard or `evidence-loop.ts` was needed.

**2. Refused submissions name a recovery and end the round on repeats (goal 3).**

- New file `flow-bootstrap/candidate/submission-refusal.ts`, wired in `authoring-loop.ts` and exported from `index.ts`.
- Every refused submission now carries `next`, a recovery instruction:
  - For refused handles, it names each one, for example "t478, t488". It says a handle belongs to the page view that printed it, and that to act on a control on the page the step runs on, the model should go there, capture it and copy the handle that view prints, or drop a step the Flow does not need.
  - Otherwise, it says to correct the listed issues in `previous`.
  - Either way it warns that a third refusal in a row ends the build.
- How the round ends early: the refused result now carries its refusal's own code as `resultCode` (for example `flow_bootstrap.evidence_completion_parameters_unresolved`) and `draft: { proposes: true }`. The loop's existing refusal-run rule (`llm/decision-handlers/refusal-run.ts`) then counts it. It warns at the second refusal of one kind and stalls at the third, through `unusableDecisions.stalled` under `llm_evidence_loop.repeat_refused`, like any other run of refusals.
- Before, a submission was a "look" to the loop and was never counted. Only the 8-step no-progress guard stopped round 4.
- `proposes: true` on a refused submission is safe: the candidate loop runs with `discoveryOnly`, so `draftRecord` adds no step.
- A side effect: an identical refused script on an unchanged page is now refused unrun by the repeat guard, which costs one decision and no submission check.

**3. Handles named in refusals (C3).**

- File: `flow-bootstrap/plan/issue-feedback.ts`.
- An issue whose code is about a handle (`*.handle.*`, with or without `:parameter`) now carries `handles: [{handle, location?}]`. These are read from the refused node's parameters, under the parameter the path or code names, or all of the node's parameters when no parameter is named.
- They are tokens the model wrote itself, not page content.
- This is the only change legacy builds can see: one extra field on handle issues.

**4. Trial feedback per step (C4).**

- File: `service/candidate-trial/feedback.ts`.
- Each step now carries:
  - `control`: the words of the element the node targets, from the graph node's `parameterValues.element`. That is the identity the domain resolved at submission, and it was already screened there.
  - `happened`: Core's plain sentence for each of the 16 failure categories.
  - `retryable`: whether the same action unchanged may pass, as the producer reported it.
  - The producer's `expected` and `actual` notes. Their contract keeps page content out of them.
  - For a skipped step, why it was skipped.
- The failure's free-text `message` is still never shown, because it can quote the page.
- Why `label` was always empty live: script steps set no node label.

### Downstream domain (`C:\Users\osrs_\FluxStuff\fxwork\t356\!FluxIQWebExtension\domain\src\runtime\llm-evidence\plan-resolution\`)

The coordinator approved ownership of `target-packets.ts` mid-task.

**5. A handle keeps what its views agree on (goal 2, C1).**

- Files: `element-identity.ts` (new `webPlanElementIdentityAcrossViews`) and `target-packets.ts` (new `acrossViews`, called by `remember` and by both branches of `rememberLook`).
- Cause: the store keeps the newest view per page, and a newer view replaced each handle's identity outright.
- New rule: when a newer view shows a handle with the same tag, role, selector and shadow hosts, the handle keeps only the fields both views agree on. A label the action changed ("Get coupons" becoming "Collected") is dropped, and once dropped it stays dropped. If a newer view shows another element under the handle, it replaces the identity whole.
- Why the label is dropped rather than kept as first shown: the same handle also serves exploration on the page as it is now. A second press of the "Collected" control while carrying "Get coupons" would be refused by the page's identity veto (`apps/extension/src/content/identity/veto.ts`, rule 1), which fires when the page contradicts the recording. An identity without a label contradicts neither the reset page nor the current one. **This differs from the coordinator's wording "its unpressed label".** Decision for the supervisor: if you want the pre-action label kept instead, `webPlanElementIdentityAcrossViews` is a one-line change. The cost is the exploration re-press trap just described.
- **Not done: handles for controls that left the page (t478 and t488).** They still resolve as `unknown`. `resolve()` serves exploration node runs as well as plan resolution. Making a departed handle resolvable would turn exploration's immediate `handle_not_in_packet` into a dispatch to a control that is gone. C3 is handled on the Core side instead: the handle is named, and the model is told to look at the page the step runs on or drop the step.

## Commands run and observed results

- **Fail-first, Core.** I copied the 6 product files aside, restored them to HEAD and moved the new module away, then ran the 4 new or changed test files: `Test Files 4 failed (4)`, `Tests 9 failed | 24 passed (33)`. The 9 that failed are every new test. The re-test failure printed `core.repeat_check ... "code":"llm_evidence_loop.repeat_refused"`, exactly round 4's 0050. The files were then restored.
- **Fail-first, domain.** Same approach for `element-identity.ts` and `target-packets.ts`: `not ok 6` (relabelled control) and `not ok 8` (look cut short), `# pass 6 # fail 2`. Test 7 is a guard and passes either way. The files were then restored.
- **Core tests (in `packages/fluxiq`).** `npx vitest run` over `runtime/flow-bootstrap`, `runtime/service/candidate-trial`, `runtime/llm`, `runtime/service/flow-bootstrap-commands`, `runtime/tests/service-bootstrap` and `runtime/activity`: `Test Files 333 passed | 1 skipped (334)`, `Tests 3692 passed | 2 skipped (3694)`.
- **Core typecheck, nonincremental.** `npx tsc --noEmit -p tsconfig.json`: exit 0. The first run found one test-only type error in `submission-refusal.test.ts:93`. I fixed it and re-ran to exit 0, then re-ran that test file: 3 passed.
- **Core audit.** `node scripts/structure-audit.mjs`: `passed (288 warning(s), 508 baselined)`, exit 0. It also printed "1 baseline entries can be lowered"; I did not check which entry, or whether it was already like that before my change.
- **Domain tests.** These ran through a scratch runner that bundles only the named entries into the ignored `domain/.test-build-scratch/t356` and imports them. That is the same esbuild settings as `scripts/test-domain.mjs`, without building the whole suite. All 119 test files under `src/runtime/llm-evidence/**/tests/`: `# tests 837 # pass 837 # fail 0`.
- **Domain typecheck.** `npx tsc -p tsconfig.json --noEmit` exit 0, and `npx tsc -p tsconfig.test.json --noEmit` exit 0.
- **Downstream audit.** `node scripts/structure-audit.mjs`: `passed (176 warning(s), 182 baselined)`, exit 0.
- **No `as never` added.** The new feedback test uses `as unknown as AutomationStudioFlowArtifact` for a partial graph fixture.
- Line endings match each file's blob in HEAD (all LF, except `issue-feedback.ts`, which is CRLF in HEAD). The raw NUL control character in `issue-feedback.ts`'s existing `printablePath` regex is preserved. `git diff --stat` shows only my hunks.

## Not verified

- No live, Lab, provider or panel run, as the brief required. Whether the model actually re-tests, or follows `next` and re-observes, is unmeasured.
- The extension identity veto's behaviour with a label-less identity on a real page was reasoned from `veto.ts`'s header (rule 1 is a contradiction score; rule 2 needs only fields the recording carried), not exercised.
- I did not run the whole Core suite, the whole domain suite, the extension build or the test-runner, per the narrow-gate rule. Domain coverage was `llm-evidence` only.
- I did not trace the overlay and step-card wording for the new `resultCode` on refused submissions. Round 4's UI review shows "Using “Submit candidate”" either way. The activity tests passed.

## Open questions or contradictions found

1. **The ownership path is slightly off.** The brief names the repeat guard as `runtime/llm/evidence-loop/**`, but it lives in `runtime/llm/repeat-guard/`. It needed no edit, because the existing retry-later exemption was enough.
2. **Label policy (C1)** differs from "keep the unpressed label", for the veto reason given in section 5. The supervisor should confirm.
3. **Handles for controls that left the page stay `unknown`**, for the shared-resolver reason given in section 5. If they are wanted for candidate scripts only, `resolve()` needs a caller-specific mode, and `resolve-plan-node.ts` (not owned here) would have to choose it.
4. **Retries inside a trial (C2) remain t355's.** Until then, a busy first press spends one of the 3 trials per revision on each retry the model asks for.
