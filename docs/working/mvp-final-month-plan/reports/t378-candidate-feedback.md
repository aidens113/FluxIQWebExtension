# t378: candidate refusals point at the model's own script line (lead report)

Lead: `lead-xhigh`. Trees: `C:/Users/osrs_/FluxStuff/fxwork/t378` (downstream and Core, both on
`task/t378-candidate-feedback`). Brief: `### Brief: t378 ...` in the supervisor's `docs/working/mvp-final-month-plan.md`.
Nothing committed. Worker reports: `reports/t378-candidate-feedback/w<N>-*.md` beside this file.

## Current State

**Done, uncommitted, verified by the lead; nothing needs a decision before integration.** Both repos are on
`task/t378-candidate-feedback` in `fxwork/t378`: Core has 106 modified and 48 new files, plus two tests moved into
`executor/step-skip/tests/`; downstream has 33 modified and 13 new. Core was built in this tree after the last
source edit.

| Unit | State | Where |
| --- | --- | --- |
| 1 Refusals name the script step | Done. Every candidate refusal issue carries `step`, `label`, `line`, and an `instead` where Core can say what to write. The `next` advice names the refused steps by line. A corpus test plus a source scan fails when a refusal reaches the model without a line. `repeat most:` under a span's last step now bounds the span. A run of refusals counts as "the same" only when the same issues recur. | W1, W9 |
| 2 Format matches the checks | Done. The `submit: true` clause is corrected, with a search example; `repeat most:` placement is stated; rows are narrowed with the listing's `where`, and `recordOutput.process` only shapes the output. Every example parses and assembles (test). Judge advice now points at the listing's `where`. | W2 |
| 3 Identical resubmission | Done. In candidate mode the original issues are restated with candidate advice and no draft words. A submission is keyed on its `flow`/`plan` only, which closes the lane B 0060 hole. The digest is never shown to the model. | W3, W9 |
| 4 Missing final brace | Done. The missing closers are appended when the finish reason is `stop` and the result parses; a `length` finish is never repaired. | W3 |
| 5 Never-shown handle | Done. A candidate handle resolves only if a tool answer printed it (`web.handle.unknown`). A candidate press on a target with no control role is refused (`web.handle.not_a_control`) unless exploration pressed it with an effect. Exploration itself is unrestricted. | W6, W13 |
| 6 Wording | Done. Refusal card reason by issue code, counting steps; "sent the same Flow again, unchanged"; an ending that names its cause and the refused step in the model's words, never "Create an automation here"; cards say choose, tick, type or press and name the control and the row; "Next page"; unusable replies become the status "Asking the AI model again"; narration is qualified when it contradicts what happened; the overlay wraps; the candidate loop gets `describeCall`. | W4, W5, W11, W12, W15 |
| 7 Lane D rate-limit rule | Done in code; needs a live run. The wait node pauses and continues. The retry wait credits time already passed. `metadata.paceMs` is honoured, raised after a hinted failure, recorded in the trace, written into the saved Flow at promotion, and kept on draft read-back and rerun. The script can write a guarded group in a loop (`optional: yes` plus `only after:`) and `repeat pace:`, with guidance and a parsed example. The executor skips an absent guarded group without spending retries or recovery. Trial feedback names the slow-down, the row and the wait. | W7, W8, W10, W14, W17, lead |

Not done, by choice or design (none blocks): `service/candidate-failure/refusal-codes.ts` still drops the place of a
long code. The ending finds the step by code instead, and trimming the place broke that match (W17 reverted it). A
look's page view counts as printed even when not shown (W13 kept this, to avoid adding refusals). Trial feedback does
not claim "the run closed the notice", because Core gets no signal for it. A parked-then-resumed run starts with no
learned pace. A repair shown as a script has no pace line for a step outside a repeat (design question).

Needs a live run: whether the model follows the new text (`consequences: none` on a `submit: true` search,
`repeat most:` placement, `where` on the listing), lane D's adaptation after a slow-down (the guarded group and pace
in the saved Flow, then playback), and the new card, ending and overlay words on screen.

## Evidence read (lead)

- Lane B: debug `run-mv0fu9pb-57454dc4.md`, report causes C1-C4, worker report `w1-refusal-index.md` (node 10/17 =
  steps 8/14, lines 32/58; merge nodes from optional steps shift indices; `step-permission.ts:109-112` requires
  `consequences:` for `dom-type` with `submit: true`; format `:141` says the opposite).
- Lane C: debug `run-mv0fuotv-805294d7.md`, UI report. `repeat most: 10` written under the span's last step; parse
  attaches it to that step; routing refuses `repeat_body_is_routed` (path `flow.line.22`) and `repeat_invalid`
  (`flow.line.27`); repeat note at `repeat-guard/feedback.ts:22-26` gives legacy draft advice; three `content_unclosed`
  replies missing only the final `}`.
- Lane D (unit 7, by supervisor message): report `lane-d-candidate.md` and W1-W3 reports in `fxwork/t275`. Findings
  a-h as relayed (trial feedback drops the absorbed rate-limit refusal; wait starts after a 2.7-4.6 s snapshot;
  `builtin.timing.wait` ends the run; no in-loop guarded step or pace; filtering taught at run end instead of the
  read's `where`; refusal kind vs issue; press on plain text t860; UI rows, overlay cut, ending cause).
- Lab artifacts (read-only): `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-08/run-mv0fu9pb-57454dc4/` (B, 0058 call),
  `.../run-mv0fuotv-805294d7/` (C, 0036 call). Reproduction template:
  `<session scratchpad>/w1/refusal-index.mjs` (feeds a call's script through built Core + domain rule).

## Decisions (lead)

- D1 Refusal issue contract (every candidate refusal entry the model sees): `{code, path?, message?, step?, label?,
  line?, instead?, accepted?, handles?}`. `step` is the step's description as the model wrote it, `label` its label
  when written, `line` the 1-based script line the issue is about (the step's `step:` line for a node-level issue,
  the specific line for a line-level one). A Core-generated node (merge after an optional step, loop head) maps to
  the written step whose line made it. Issues about the whole Flow carry no line and must be in one explicit,
  tested list. A JSON-plan submission names the node by key and name, no line.
- D2 `repeat most:` written under another step of a `repeat while` span bounds that span (nesting is refused, so it
  can bound only one); written where no `while` span can take it, it is refused naming its own line and the move.
- D3 A run of refusals is "the same" when the same issues recur (codes plus lines), not when the refusal category
  recurs (lane D f).
- D4 Pace contract: Flow node `metadata.paceMs` (positive integer ms) = minimum time between successive starts of
  that node within one run. The executor honours it everywhere (trial and playback). After an attempt whose failure
  carries a wait hint (`retryAfterMs`, e.g. `web.action.rate_limited`), the run raises that node's pace to at least
  the hint and grows it on each further limit; the trace records it; promotion writes the learned pace into the
  saved Flow. A script writes it with `repeat pace: <duration>` on a span's first step (lands on that step's node).
- D5 Guarded group (the user's interruption rule): `optional: yes` is allowed on a step inside a repeat span; steps
  that follow it with `only after: <its label>` run only when it was done, then the pass continues where it was. So
  "if the notice shows: close it, wait, go on with the loop" is written as an optional dismiss plus an only-after
  wait. `builtin.timing.wait` pauses and continues instead of ending the run.
- D6 Activity event contract for row names (lane D UI): the step event inside a `repeat over` pass carries `row`
  (string, the pass's row as a person reads it); W4 produces it, W5 renders it.

## Worker plan (files are the partition)

| Worker | Effort | Units | Owns |
| --- | --- | --- | --- |
| W1 | high | 1 (locator, test), C C1, lane D f | Core `flow-bootstrap/authoring/**`, `plan/issue-feedback.ts`, `llm/harness-options/bootstrap-completion.ts`, `flow-bootstrap/candidate/{submission,submission-refusal}.ts`, their tests |
| W2 | medium | 2, lane D e and B3 | Core `plan/flow-script-format.ts`, `llm/diagnosis-instructions.ts`, their tests; domain `output-nodes/extract-list/catalog-text.ts`, `runtime/llm-evidence/tools.ts` |
| W3 | medium | 3, 4, lane D C1 wording | Core `llm/repeat-guard/**`, `llm/decision-handlers/{refused-repeat,refusal-run}.ts`, `llm/deepseek/response-envelope.ts`, their tests |
| W4 | high | 6 (Core runtime wording), lane D h | Core `runtime/activity/**`, `conversations/commands/progress.ts`, `llm/unusable-decision.ts`, `service/candidate-failure/**`, `service/flow-bootstrap-commands/candidate-generation.ts` |
| W5 | medium | 6 (UI), lane D a (chat), h | Core `src/ui/activity-action/**`; extension `src/panel/chat/**`, `src/shared/activity/**`, the build overlay module |
| W6 | high | 5, lane D g | domain `runtime/llm-evidence/plan-resolution/**`, `page-view/**`, `stable-handles.ts` |
| W7 | high | 7 runtime (lane D a, b, c, pace learn/persist) | Core `runtime/executor/**` except `node-execution/**`, `nodes/timing/**`, `service/candidate-trial/**` |
| W8 | high | 7 syntax (lane D d), after W1, W2, W7 | Core `flow-bootstrap/authoring/**`, `flow-bootstrap/plan/**` (contracts/compile as needed), `plan/flow-script-format.ts` |

## Ledger

### 2026-10-09 - plan and Phase 1 dispatch
- Briefs W1-W7 below written before dispatch; dispatched in parallel, foreground.

### 2026-10-09 - Phase 1 returned (W1-W7); lead integration
- Returns: W1 Done, W2 Partial (pins), W3 Done, W4 Partial, W5 Partial, W6 Done, W7 Partial (pace not yet written
  to the saved Flow: plan validation refuses an unknown node field). Worker claims are claims until the lead's
  Phase 3 runs.
- Lead: `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` (Core) -> no output, exit 0. `node
  scripts/structure-audit.mjs` (Core) -> 2 violations: `as-never` in
  `llm/decision-handlers/tests/candidate-repeat-told.test.ts:29`, `failure-as-empty` in
  `llm/repeat-guard/outcomes.ts:356` (W3's files).
- Lead applied W2's re-pin of `llm/deepseek/tests/system-prompt-pins.json`: a key-by-key comparison showed only
  `loop_verification` and `loop_verification_build_test` differ, by exactly the new listing-`where` judge sentence;
  inserted into those two values only, CRLF kept.
- Open seams found in reports: recovery wording options `siteWaitMs`/`slowedDown`/`presses` not passed by
  `executor/graph-run.ts:622`; `row` not declared on `ClientGatewayActivity.step` (`packages/contracts`);
  extension `isModelThought` keys on the old "Deciding the next step" title; domain `tool-rejection.ts` lacks a
  reason for `web.handle.not_a_control`; W6's residual false-refusal risk (wordless detection `at` handles,
  node-run note handles, text-like controls exploration pressed with effect); repeat key for `core.submit_candidate`
  includes `summary` (lane B 0060 escaped the guard that way); refusal-run warning shows the digest key;
  `executor/tests/failed-step-reason.test.ts:90` expects the old "page was busy"; plan node `paceMs` (W8).

## Briefs

(W1-W8 brief texts are the dispatch prompts; each is reproduced in the worker's report header.)

### 2026-10-09 - Phase 2 (W8-W13) and Phase 3 (W14-W17, lead) returned and integrated
- W8 Partial (runtime skip gap, closed by W14), W9 Done, W10 Done, W11 Partial (ending lacked step words, closed by
  W15), W12 Done, W13 Done, W14 Done, W15 Partial (pace on draft, closed by W17), W16 Done (docs), W17 Partial
  (place trimming reverted on purpose).
- Lead edits: `llm/deepseek/tests/system-prompt-pins.json` (two `loop_verification` values, W2's judge sentence);
  legacy schema ratchet raised 6,000 -> 6,100 in `flow-bootstrap/tests/plan.test.ts` and
  `llm/tests/evidence-loop-provider.test.ts`, with the reason (the corrected clause costs 131 bytes, 5,943 -> 6,074;
  every shorter wording tried stayed over 6,000); `flow-bootstrap/candidate/tests/submission-refusal.test.ts:86` now
  expects the digest-free warning; `llm/evidence-loop/rerun-replacement.ts` keeps `paceMs` on a rerun, with a test
  (fail-first: "Tests 1 failed | 15 passed (16)" on HEAD source, then "16 passed (16)"); docs
  `automation-studio/llm-flow-bootstrap.md` (known gap replaced by the fixed rule; `MAX_GUARDED_STEPS = 32`
  confirmed at `executor/step-skip/optional-step.ts:12`) and `automation-studio.md:940` (moved test paths);
  `pnpm docs:reference` regenerated `docs/reference/framework-reference.md` (3,369 -> 3,386 declarations, only t378
  additions); five extension tests pinned to "the page was busy" for `web.action.rate_limited` updated to the new
  slow-down words (`background/activity/tests/candidate-trial-live.test.ts:112,133`, `pacer.test.ts:307`,
  `panel/chat/tests/live-run-display.test.ts:152-153`; the code only mentions the old words in comments).
- Validation (lead, all in `fxwork/t378`):
  - Core `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` -> exit 0; `-p packages/contracts/tsconfig.json` ->
    exit 0. `node scripts/structure-audit.mjs` -> "passed (293 warning(s), 708 baselined)". `pnpm docs:check` ->
    "structure-audit: passed (0 warning(s), 0 baselined)" and "Deterministic framework reference is current."
  - Core `npx vitest run` on every touched directory (activity, conversations/commands/tests, executor, flow-bootstrap,
    flow-draft, llm/{repeat-guard,decision-handlers,deepseek,harness-options,tests,evidence-loop,node-tools},
    service/{candidate-trial,candidate-failure,flow-bootstrap-commands}, runtime/tests/executor.test.ts, nodes/tests,
    ui/activity-action, packages/contracts) -> "Test Files 396 passed | 1 skipped (397)", "Tests 4777 passed | 2
    skipped (4779)". The first run of the same set, before the lead's fixes, had 4 failures: the two ratchets, the
    digest pin and the `execute.test.ts` 5 s timeout under load, which passed in the second run.
  - Core `pnpm build` -> exit 0 (6m30s). Downstream `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0
    ("core-build: ... is current with its source"); `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0
    (W5 had seen 11 tsc errors against the stale Core); downstream `node scripts/structure-audit.mjs` -> "passed (184
    warning(s), 257 baselined)".
  - Domain `DOMAIN_TEST_BUILD_LABEL=t378-lead node scripts/test-domain.mjs` -> "# tests 1652 # pass 1652 # fail 0".
    Extension `EXTENSION_TEST_BUILD_LABEL=t378-lead node scripts/test-extension.mjs` -> first 2725/2730 (the five
    stale pins above), after the fix "# tests 2730 # pass 2730 # fail 0".
  - Provider-free reproduction (`<scratchpad>/t378-repro/repro.mjs`: built t378 Core's real
    `AutomationStudioFlowCandidateSubmissionController` and `automationStudioCandidateSubmissionRefusal`; domain's
    real `webPlanStepPermission`; handles counted as resolved): lane B 0058 is refused with
    `web.step.consequences_undeclared` at line 32 "search for the paper towels" and line 58 "search for the dinner
    napkins", each with the `submit: true` `instead`; `next` names both lines and steps. Lane C 0036: `accept ok true
    errors []`, the plan's `builtin.control.repeat` carries `{"most":10}` (the misplaced line now bounds the span).
    Through the controller, lane C's remaining issues are four stub artifacts (handles replaced by strings fail
    registry validation) and two genuine script faults, now located at line 10 "read this page of results" with
    their accepted shape: `record_output.process_invalid_dedupe` and `record_output.process_unknown_field` (`where`
    on `sponsored`/`plus`, which are not saved columns).
- Not run: any Lab, live or provider run; full suites (`pnpm check`, `pnpm test`, Core's whole vitest run).

### 2026-10-09 - before merge: examples off the Lab tasks; provider-unavailable regression (lead, on HEAD b97d5215)
- Examples (coordinator: the slow-down example mirrored lane D's task). Verdicts on every example the model is shown:
  the three legacy examples (rename a member, orders awaiting dispatch, export this week's orders) mirror no task,
  so they are kept. Four candidate examples mirrored tasks and were replaced, same nodes, edges, bindings and numbers:
  - two shirts with a colour and size into a basket (everything-store kettles, lanes A and B) became a task tracker:
    search, open, High priority chip, status, estimate, save;
  - earbuds under 50 on every page (lane C) became gardening books since 2015 in a library catalogue;
  - friend requests confirmed per row (lane D) became marking overdue invoices as reminded in a billing tool;
  - the slow-down friend-request loop (lane D) became archiving the Garden Club newsletter's messages in a mail
    inbox, with the optional notice close, `only after:` wait and `repeat pace: 6 s`.
  The inline `rating atLeast 4` (lane C's "rated 4.0 or higher") became `amount atLeast 100`. New guard in
  `plan/tests/flow-script-format.test.ts`: no example script may contain a realistic scenario's site, goods or act
  word. Fail-first on HEAD's file: "Tests 4 failed | 3 passed" (exactly the four mirrored examples), green after.
  The framework reference was regenerated (the loop constant's doc comment changed).
- Regression: `runtime/tests/service-bootstrap/tests/provider-unavailable.test.ts:113` (0 failed "Deciding the next
  step" rows, expected 3). Cause: t378 W4 retitled the failed decision row "Asking the AI model again", so the
  started "Deciding the next step" row was no longer closed under its own title, the contract `decisionFailed`
  exists for. The repeat guard, the brace repair and the decision handlers are not involved. Fix in
  `activity/observer.ts`: the closing row keeps the title "Deciding the next step" (failed) with W4's plainer label
  and text. The extension (W12) already heads a failed deciding row in the present tense and treats it as status.
  `activity/tests/observer.test.ts` now expects the restored title; its own name says it "closes the decision row".
  `docs/architecture/extension-client.md` is corrected to match.
- Validation: `npx vitest run .../provider-unavailable.test.ts` -> "Tests 3 passed (3)". `npx vitest run` on
  `tests/service-bootstrap`, `activity`, `conversations/commands/tests`, `flow-bootstrap`, `llm/deepseek` and
  `llm/tests/evidence-loop-provider.test.ts` -> "Test Files 188 passed | 1 skipped (189)", "Tests 2267 passed | 2
  skipped (2269)". Core `tsc --noEmit` exit 0; Core audit "passed (295 warning(s), 708 baselined)"; `pnpm
  docs:check` "Deterministic framework reference is current."; downstream audit "passed (184 warning(s), 257
  baselined)". Core dist not rebuilt after these edits; the extension tests were not re-run (they do not read
  Core's title).
