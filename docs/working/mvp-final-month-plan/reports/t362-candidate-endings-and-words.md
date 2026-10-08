# t362 — candidate endings, chat wording and Lab evidence (round 4 C6 and UI)

Worker: t362-endings. Worktree `C:\Users\osrs_\FluxStuff\fxwork\t362\` (Core-paired). Nothing committed.

## Outcome

Done. All three parts of the brief are in place and tested in both repositories:

1. **Endings name their real cause.**
   - No progress now reads "it kept trying without getting any further, so it was stopped".
   - Unusable replies keep "the model's answer could not be used". Only those replies get that wording now; round 4 got it through the stage fallback.
   - Each budget and allowance has its own words: spending limit, time, calls, decisions, steps, reading limit.
   - Trial verdicts are reported in the kept-draft sentence.
2. **What was kept is said honestly.**
   - A failed candidate build now saves the latest revision Core accepted as an unverified draft. It is still never promotable.
   - The chat says that draft was kept, says nothing was put into the Flow, and says how the test runs came out. It no longer says "has no steps yet".
3. **Candidate tools are plain acts.**
   - `core.submit_candidate` reads "Saving the Flow's steps".
   - `core.test_candidate` reads "Testing the whole Flow from the start".
   - The model's own text beside a card loses revision numbers, and "candidate" becomes "the Flow".
4. **The Lab records the candidate on a failure.** It reads the candidate id, the kept draft, the trials and their verdicts from Core's failure diagnostic, on both the chat path and the direct path.

## What changed and why

### Core (`C:\Users\osrs_\FluxStuff\fxwork\t362\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\`)

**Cause of C6, traced.**
- The candidate loop's stall (`unusableDecisions.stalled`) always ended as `flow_bootstrap.evidence_unusable_decision`. That includes runs of *refused but readable* submissions, which is what t356's refusal-run turned round 4's case into.
- A plain `flow_bootstrap.evidence_repeat_without_progress` had no words in `progress.ts` `CODE_WORDS`, so it fell to the stage words "the model's answer could not be used".
- A refused resubmission clears the controller's `latest()`, and a failed loop threw before anything was saved. So no draft was kept, and the failure did not name the candidate. The chat then said "has no steps yet" and the Lab read `candidate: null`.

**Files:**
- `flow-bootstrap/generation-failure/candidate-kept.ts` (new): the `candidate` block on a failure diagnostic.
  - Fields: `candidateId`, `draft` (`saved` or `none`), the latest accepted `revision` and `digest`, `trialCount`, and up to 16 `trials` (revision, verdict, trialRunId, code).
  - Ids, counts and closed words only. One parse is shared by producer and reader.
  - Wired into `diagnostic.ts` (type), `diagnostic-parse.ts` (exact-field list and parse) and the barrel `index.ts`.
- `flow-bootstrap/generation-failure/evidence-failure.ts`: `flowBootstrapEvidenceUnusableDecisionFailure` takes an optional `code`, so a candidate stall can end as `evidence_repeat_without_progress`. The default is unchanged.
- `flow-bootstrap/candidate/authoring-loop.ts`: an optional `accepted(candidate)` callback, called on each accepted submission.
- `service/candidate-failure/` (new directory):
  - `stall-code.ts` decides unusable answer vs no progress from the stall's issue codes. Only reply-shape codes count as unusable: `llm_output.*`, plus five of the loop's own decision codes.
  - `with-candidate.ts` saves the latest accepted revision through `keep`, then re-throws the failure carrying the `candidate` block, but only if it still reads back.
  - `index.ts` is the barrel, exported from `service/index.ts`.
- `service/flow-bootstrap-commands/candidate-generation.ts`:
  - The stall code comes from `stall-code.ts`.
  - It tracks the last accepted submission. Both failure paths (the loop throws, or `!loop.ok`) go through `withCandidate`.
  - The draft is kept only when the build was not stopped, the Flow and settings binding still matches, and the original-instructions fingerprint matches. These are the success path's own checks.
  - Draft-record construction is shared with the success path.
- `service.ts`: one argument added, `trialRecords: trials.records`, on the candidate generation call.
- `conversations/commands/progress.ts`:
  - New `CODE_WORDS` for no progress, unusable answer, reading limit, tool failure and cancellation.
  - `evidence_iteration_limit` is worded from `evidenceLoop.exhausted`: the budget bound (cost, tokens, duration, calls) or the decisions/steps allowance.
  - `failed(...)` accepts `account.kept`, a sentence placed after the rest.
- `conversations/commands/build.ts`: new `automationStudioConversationCandidateKeptSaid`. The failed build result now carries `candidateKept` from `diagnostic.candidate`.
- `conversations/commands/create-here.ts`: when a candidate draft was kept, the "left" sentence is that account plus "The Flow "X" keeps your instruction, so you can build it again." The "has no steps yet" sentence stays only when no version was ever accepted.
- `conversations/commands/explore.ts`, `improve.ts`: pass `kept: built.candidateKept`.
- `activity/wording/core-tool.ts`: plain titles for `core.submit_candidate` and `core.test_candidate`. These replace "Using “Submit candidate”" and "Using “Test candidate”".
- `activity/wording/person-words.ts`, applied to every screened model or judge line:
  - Revision mentions are removed after the noun they number.
  - They become "this version" as a sentence subject or after a preposition.
  - "candidate" becomes "the Flow".

Example of the new chat ending, round 4's case, from the test:

> "Create an automation here" stopped because the build failed: it kept trying without getting any further, so it was stopped. I kept the latest version of the Flow's steps that I wrote as a draft, but nothing was put into the Flow. A version of it was test-run from the start twice, and the last test run did not get to the end. The Flow "Hubs" keeps your instruction, so you can build it again.

### Downstream (`C:\Users\osrs_\FluxStuff\fxwork\t362\!FluxIQWebExtension\packages\test-runner\src\flow-lane\creation\`)

- `candidate-outcome.ts`:
  - `CreatedFlowCandidateOutcome.outcome` gains `failed`, plus a `draft` field (`saved`, `none`, or `null` on the other outcomes).
  - `CreatedFlowCandidateTrialRun` gains `verdict` (`null` where Core did not say it).
  - New `createdFlowFailedCandidateOutcome` joins the diagnostic's trials to the trial sessions by run id. The verdict that stood is the last trial's, or `not_tested` when there were none.
- `chat/build-from-chat.ts`: in candidate mode, `failedBuildOf` reads `diagnostic.candidate` and records `candidateOutcome`. This is the round 4 path.
- `build-proposal.ts`: the direct-path refusal does the same.
- Tests:
  - `chat/tests/build-from-chat.test.ts`: new chat-path failure test, and the promoted case gains `draft: null`.
  - `tests/candidate-draft.test.ts` and `tests/lane-candidate.test.ts`: object literals updated for `draft` and the trial's `verdict`.

## Commands run and observed results

Core, in `!FluxIQ/packages/fluxiq`:
- `npx tsc --noEmit -p .` → no output, exit 0. Run after the final file move.
- `npx vitest run` on the owning directories (`runtime/activity`, `runtime/conversations`, `runtime/service/flow-bootstrap-commands`, `runtime/service/candidate-failure`, `runtime/flow-bootstrap/generation-failure`, `runtime/flow-bootstrap/candidate`, `runtime/service/candidate-trial`, `runtime/service/candidate-drafts`) → `Test Files 83 passed (83)`, `Tests 962 passed (962)`. Run after the final layout.
- `npx vitest run` on `api/handlers/tests/llm-permission.test.ts`, `runtime/flow-bootstrap`, `runtime/exploration-reduction` and `runtime/tests/service-bootstrap` → `Test Files 131 passed | 1 skipped (132)`, `Tests 1705 passed | 2 skipped`. Run before the move into `service/candidate-failure/`; the move changed imports only.
- New tests:
  - `service/flow-bootstrap-commands/tests/candidate-failure-kept.test.ts` (3): a real service with a scripted provider. Refused submissions end as no progress, the draft is saved, and `diagnostic.candidate` names the trial with verdict `no`. A build with no accepted version keeps no draft. The stall-code table is covered.
  - `conversations/commands/tests/candidate-endings.test.ts` (4): words for each cause, the kept-draft sentences for each verdict, and the create-here end-to-end ending. No revision, id or code appears.
  - `activity/wording/tests/candidate-words.test.ts` (2): the tool titles, and revision/candidate screening of the model's lines.
- `node scripts/structure-audit.mjs` (Core) → `structure-audit: passed (289 warning(s), 710 baselined)`, plus "1 baseline entries can be lowered".
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` → Done. This was needed so downstream compiles against the new Core.

Downstream, in `!FluxIQWebExtension`:
- `packages/test-runner`: `npx tsc --noEmit -p .` → no output, exit 0.
- `packages/test-runner`: `node ../../scripts/build-cache/cli.mjs test-runner:build`, then `node --test dist/flow-lane/creation/tests/*.test.js dist/flow-lane/creation/chat/tests/*.test.js` → `# tests 156`, `# pass 156`, `# fail 0`. The new chat-path test ("a candidate build that failed in the chat is recorded with its candidate, kept draft, trials and verdicts (t362)") passed.
- `node scripts/structure-audit.mjs` → `structure-audit: passed (176 warning(s), 257 baselined)`.

No new `as never` casts (the audit's as-never rule passed in both repositories). No import cycles (Core's import-cycles rule passed). No provider calls or paid runs.

## Not verified

- **No fail-first run.** The new tests were not run against the old code first. They assert things the old code could not produce: the `candidate` block, the no-progress code for refused submissions, and the new words.
- **No direct-path test.** The direct (non-chat) path's new `candidateOutcome` on a refusal has no test of its own. It shares `createdFlowFailedCandidateOutcome` with the chat path, which is tested.
- **No live UI check.** Nothing was run live: no Lab run, no extension build, no browser.
- **Full suites not run** (`pnpm check`, `pnpm test`, Core's whole vitest), per the twice-a-day rule.
- **Baseline entry not traced.** I did not trace which Core baseline entry "can be lowered", and I did not run `pnpm structure:baseline`.

## Open questions or contradictions found

1. **Files outside the listed ownership.** To carry the candidate on the failure I touched Core files the brief did not list:
   - `flow-bootstrap/generation-failure/` (new `candidate-kept.ts`, `diagnostic.ts`, `diagnostic-parse.ts`, `index.ts`, `evidence-failure.ts`)
   - `flow-bootstrap/candidate/authoring-loop.ts` (one optional callback)
   - `service.ts` (one argument)
   - `service/index.ts` and the new `service/candidate-failure/`

   None of these is on the "must not touch" list, and none is executor or retry code.
2. **The failure diagnostic is a wire contract and now has a new optional field, `candidate`.** Core's architecture docs do not describe candidate authoring mode at all, so no doc was updated. The docs were not in this brief, and t361 owns the lasting-act sections. A doc line belongs with whoever documents candidate mode.
3. **Behaviour change: a failed candidate build now saves an unverified draft.** It is the latest accepted revision, saved only when the binding still matches. It overwrites the Flow's `candidate-draft.json`, as a finished build's draft does. Nothing promotes it.
4. **Round 4 UI items not addressed; they belong to the extension.**
   - Moment 5 said "Trying again didn't fix the step" during a trial.
   - The overlay read "Fixing your Flow · Step 2 of 8" during a trial.

   That headline comes from `apps/extension/src/background/activity/`, which this brief forbade. Core still sends the test tool with phase `exploring`.
5. **Two wording heuristics may misfire:**
   - The model-text screen turns any "candidate" into "the Flow". A page phrase like "candidate products" would read oddly.
   - "rev N" after a preposition becomes "this version", even when the model meant an earlier revision.
