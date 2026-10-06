# t264-core-chain (lead report)

Brief: `t264-core-chain` in `docs/working/mvp-final-month-plan.md`. Trees: `C:/Users/osrs_/FluxStuff/fxwork/t264/`
(`!FluxIQ` and `!FluxIQWebExtension`, branch `task/t264-core-integration-chain`, base Core `1fbfa5ef` / downstream
`bdda64b1`). `R/` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`. One stage per hand-back; the
supervisor commits each stage.

## Stage S1 — instruction authority (A4 + B F1 kind fallback onto t262 split acts)

Status: done, verified by the lead, uncommitted (2026-10-05). Ready for the supervisor to commit on
`task/t264-core-integration-chain` (Core) with this report and the worker report (downstream).

### Result

- Ported: A4 (t174 w107) whole: per-act read, read before a lasting call reaches the domain, unanswered acts
  lasting, one thread line, read-decision wording, `automationStudioFlowDraftDeclaresLasting` export, A4 tests and
  the confirm-requests fixture reply. B F1 (t193): `LASTING_KINDS` and its three tests.
- Reworked onto t262: `instructedLastingActs` composes (a) kind, (b) t262's grounding (unchanged, extracted to
  `quotedLasting`), (c) per-act answer (`R/flow-bootstrap/action-permissions.ts`). The read grounds a split act's
  entries in `source.clause` (`R/action-permissions/instructed.ts`, `readAutomationStudioInstructedRead`,
  `groundedWords`). t262's grounding test runs on kind-less copies plus a kinds assertion; A4's gate tests run on
  kind-less copies (`UNKINDED`) so they still exercise (c).
- Dropped: nothing from A4 or F1. Not in scope and untouched: t195 w49/w50 hunks in the same files; t174 A2/A3 hunks.
- Behaviour change accepted by the lead (worker note 1): a Confirm is a `submit` act, so a per-row Confirm that
  declares nothing lasting is now checked per row (`verify`/`verified`), not pressed, even when the read answers
  "none". The test is renamed to "checks a Confirm that declares nothing lasting once per kept row ... because
  confirming lasts by its kind". Why: dev already checks a lasting-declared Confirm per row and never presses it
  (same file, first test), and run `run-murwcaj0-40e56557` R3 was a Confirm declared `[]` that tests pressed again
  on real requests. Lost coverage: no Core test now drives a per-row replay of an act-claiming step that declares
  nothing lasting through the confirm-requests service fixture. A `set`/`open` act would be needed for that.
- Consequence for later stages: a read answer of "none" can no longer clear an add/save/claim/move/submit act.
- Lead edit: `docs/architecture/automation-studio/flow-authoring.md` section "Lasting acts from counted-object
  instructions" (t262 text) rewritten to name the three paths and the clause-grounded entries (worker note 3).

### Changed files (Core tree `fxwork/t264/!FluxIQ`)

`R/action-permissions/instructed.ts`, `R/action-permissions/tests/instructed.test.ts`,
`R/service/instruction-authority.ts`, `R/service/tests/instruction-authority.test.ts` (new),
`R/flow-bootstrap/action-permissions.ts`, `R/flow-bootstrap/tests/action-permissions.test.ts`,
`R/flow-draft/verify-only.ts`, `R/llm/node-tools/dry-run-gate.ts` (comments),
`R/service/flow-bootstrap-commands/permission-outcome.ts` (comments),
`R/tests/service-authoring/tests/confirm-requests-build.test.ts`,
`docs/architecture/automation-studio/{llm-flow-bootstrap,flow-authoring}.md`. All LF. Downstream tree: this report and
`t264-s1-instruction-authority.md`.

### Lead validation (re-run by the lead, logs in scratchpad `t264-s1/`)

- `npx vitest run` (in `packages/fluxiq`) over set A (`action-permissions/tests/instructed`,
  `service/tests/instruction-authority`, `flow-bootstrap/tests/action-permissions`, `flow-draft/tests/verify-only`,
  `flow-bootstrap/instructed-acts/tests/`) plus set B (`llm/node-tools/tests/{lasting-acts,lasting-acts-build,
  replay-draft-acts,replay-draft-excused,replay-draft-loop,rerun-check}`, `llm/evidence-loop/tests/rerun-request`,
  `tests/service-authoring/tests/`, `tests/service-bootstrap/tests/`) -> exit 1, `Test Files 3 failed | 43 passed
  (46)`, `Tests 9 failed | 522 passed (531)` (`lead-sets-ab.log`). The 9 failures are `accounting.test.ts` (6),
  `generation.test.ts` (1), `judged-build.test.ts` (2). They are pre-existing on dev: the same 9 test names fail in
  the dev sweep (`sweep-2026-10-05/core-test.clean`, Core dev `1fbfa5ef`) with identical assertion messages
  (`totalProviderCallCount` mismatches, `expected [ false, false ] to deeply equal [ false, true, true ]`,
  `flow_bootstrap.provider_transport_unknown`).
- `node scripts/build-cache/cli.mjs fluxiq:check` -> exit 0.
- `node scripts/build-cache/cli.mjs structure-audit:check` after the lead's doc edit -> exit 0, `structure-audit:
  passed (245 warning(s), 349 baselined)` (fresh run, "inputs changed").
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` (t264 downstream) -> exit 0, `core-build: FluxIQ Core's
  build ... is current with its source` (Core rebuilt by the worker with `pnpm.cmd build`, exit 0 per its report).
- Fixture screen: `grep -i` for URLs, cookies, bearer/authorization, passwords and e-mail domains in the three ported
  test files -> no hits.
- Not verified: no live, Lab or provider run; the read's new per-act question has not met a real model. The
  `extension check` was not run, because no extension file imports a changed contract.

### Sources read (lead)

- t174 A4 (w107) diff: `R/action-permissions/instructed.ts` (+141: per-act schema, `readAutomationStudioInstructedRead`,
  unanswered read, non-enumerable `acts`), `R/service/instruction-authority.ts` (per-act question, read decision
  wording, failed read = every act unanswered), `R/flow-bootstrap/action-permissions.ts` (read before a lasting call
  reaches the domain; unanswered acts lasting; one thread line), `R/flow-draft/verify-only.ts` (exports
  `automationStudioFlowDraftDeclaresLasting`), comment-only `R/llm/node-tools/dry-run-gate.ts` and
  `R/service/flow-bootstrap-commands/permission-outcome.ts`, fixture `R/tests/service-authoring/tests/confirm-requests-build.test.ts`,
  tests `action-permissions/tests/instructed.test.ts` (+66) and new `service/tests/instruction-authority.test.ts` (164).
  Doc hunks: Core `llm-flow-bootstrap.md` @@-132 (+26) and `flow-authoring.md` @@-195 (+3); the other t174 doc hunks
  belong to A2/A3b and are not S1.
- t193 F1 diff: `LASTING_KINDS = {add_to, save, claim, move, submit}` lasting whatever the read quoted; kind on the
  `instructedLastingActs` act type; three tests (run `run-musp4h2f-72e8ed99`); comment edits in `verify-only.ts`,
  `dry-run-gate.ts`.
- t262 on dev (`97e279de`): `instructedLastingActs` acts carry `source {clause, object}` for split objects and ground
  attribution in the original clause; test "grounds split objects ... without classifying an unquoted sibling".
- Facts checked on the t264 tree: the service passes `automationStudioInstructedActs(bootstrapInstructionText)` (full
  acts with `kind` and `source`) to `instructedLastingActs` (`service.ts:1575`); `bootstrapInstructionText` is
  `title\nbody` joined by `\n` (`service.ts:1508`), the same text A4's authority reads acts from; the gate returns the
  derived array object itself (keeps the non-enumerable `acts`) and a thrown derive becomes a plain empty list
  (`action-permissions/gate.ts:397`); real tool inputs carry `consequences` at top level; export counts stay under the
  15-value limit (verify-only 9 -> 10, instructed 4 -> 8); no baseline entry for any S1 file; downstream touches these
  contracts only in `domain/.../plan-step-permission.test.ts` (types).

### Lead decisions for S1

1. An own act is lasting when any of: (a) its kind is `add_to|save|claim|move|submit` (B F1; independent of the read,
   but the read is still forced so the cross-check reuses it); (b) t262's quote/`source` grounding matches, unchanged;
   (c) the read carries per-act answers and this act's answer (same id and folded quote) is missing, `null`, or names
   a class (A4). Otherwise it is not lasting. A thrown read leaves only (a).
   Why: an add/save/claim/move/submit pressed again by a test always repeats a real effect (B: cart 1 -> 12/13); A4
   closes skipped acts (the coupon); t262's grounding stays the quote path.
2. Split acts in the read: the authority's act list keeps `source`; an act's class entries are grounded in its own
   quote, or, when that quote is not in an instruction (an assembled split quote), in `source.clause`, the person's
   original span. The existing overlap rule keeps one entry per class per clause.
3. t262's grounding test keeps its assertions, run on kind-less copies of the acts; it gains one assertion that the
   same acts with kinds are both lasting.
4. Not in S1: any t195 w49/w50 hunk in `instructed.ts`/`instruction-authority.ts` (dropped per brief); t174's non-A4
   hunks.

### Worker brief S1 (dispatched as `worker-high`, foreground)

See the dispatch text; report at `docs/working/mvp-final-month-plan/reports/t264-s1-instruction-authority.md` in this
tree.

Committed by the supervisor: Core `9975ce6d`, downstream reports `0c07fad1` (supervisor reran the S1 tests: 14
files, 301 passed; `fluxiq:check` 0; Core audit 0).

## Stage S2 — activity and refusal wording (B F6, then A5, then C w80/w81/w84/w76)

Status: done, verified by the lead, uncommitted (2026-10-05). Base: Core `9975ce6d`, downstream `0c07fad1`. Ready for the
supervisor to commit on `task/t264-core-integration-chain`: Core source and docs, downstream extension card files and five
reports (this one, `t264-s2-w1..w4-*.md`).

### Facts (lead)

- The S2 activity/UI files are unchanged on dev since the lane base `6beae684`, except
  `R/llm/decision-handlers/amendment.ts`, `R/llm/draft-amendment-feedback.ts`, `R/service.ts` and
  `R/service/flow-bootstrap-commands/build-judge.ts` (t262). So the three lanes conflict only with one another.
- `R/service.ts` is 4400 lines, exactly its ratcheted `fileLines` budget: every S2 edit there is in place.
- Core `docs/reference/framework-reference.md` is already stale on Core dev `3c47ed7d` (`node scripts/docs-reference.mjs
  --check` -> "is stale", exit 1) and in t264. It is generated, so no S2 worker regenerates it; it belongs to the
  docs-last step.
- F6 (t193 w6: C13 refusal cards, C14 the model's sentence is only what was tried, D8 card targets keep their end,
  D10 build wording on a split judge's card) includes `R/result-verification/unsettled/*` (moved there by t193 w10).
  The reconcile filed that under F4, but D10 needs it, so it lands in S2 with F6.
- t265's deferred hunks: A9's `apps/extension/src/shared/activity/wording.ts` hunk importing
  `activityActionFailureReason` (exported by A5's `src/ui/activity-action`) with its wording/card-words/action-card-view
  test lines; t194's `card-words.ts` `lowerFirst` with its action-card-view line. `card-words.ts`, `action-card.ts`,
  `stream/step/tests/card-words.test.ts` and `view/tests/action-card-view.test.ts` are t264's in S2 (supervisor
  2026-10-05). `shared/activity/wording.ts` and its test remain t265's file (uncommitted there), so t264 does not edit
  them; the Core export lands here and the wording hunk waits for t265 to land.
- `stream/step/tests/messages.test.ts` is t265's (it appends a test near line 427); F6's D8 expectation is one hunk at
  line 367, non-overlapping, so W1 ports that hunk only.

### Plan (serial; each worker owns the files its unit touches; next worker starts after the lead verifies)

- W1 (`worker-high`): F6, Core + extension card files.
- W2 (`worker-high`): A5 into the moved files: w108 D2/D4/D5/D9, w116 D3/D18, the build trace (w116 item 7) and R3
  `told` (answer step + decision handler), the `src/ui/activity-action` failure-reason export. Not in S2: w118 finishing
  verdict and `buildJudged` (S3, ending-wording owner); w108 Cause 6 `notRunYet` in `draft-amendment-feedback.ts` (S4,
  authoring owner of that file).
- W3 (`worker-high`): C w80/w81 (refused completion, check card words), w84 (answer folder for no-tool decisions,
  Core part), w76 Core part (`run-ending.ts`, `run.ts`, `service.ts` `readRecord`), t194's `card-words.ts` `lowerFirst`,
  and the extension test lines of A9's deferred hunk that live in t264-owned files.

### W1 (F6) — verified by the lead

- Worker report: `t264-s2-w1-refusal-cards.md`. 28 Core and 4 downstream files. Every file equals its t193 lane copy
  (legitimate: unchanged on dev since the lane base) except `U/activity-action/record.ts` (comment path to the moved
  `decision-answer/draft-edit.ts`) and `U/activity-action/refusal-words.ts` (drops `count_not_a_repeat`, a reason
  t264's refusal union does not have). No importer outside the owned files referenced the deleted modules (grep of
  `packages/` src). All 34 changed files LF (counted with node; `git ls-files --eol` agrees).
- Lead runs: `npx vitest run` on `R/activity R/result-verification U/activity-action R/flow-bootstrap/unfinished-build`
  -> exit 0, `Test Files 76 passed (76)`, `Tests 809 passed (809)` (`t264-s2/w1-core-vitest.log`); `fluxiq:check` 0;
  extension `stream/step/tests/*` + `view/tests/*` bundled and run -> `# tests 53 # pass 53 # fail 0`; extension check 0.

### W2 (A5) — verified by the lead

- Worker report: `t264-s2-w2-core-wording.md`. Ported/adapted: w108 D2, D5, D9; w116 D3, D15, D17, D21, R3 `told`,
  build trace. Superseded by F6: w108 D4 and w116 D18's "Changed the Flow" line (F6 gives every edit its own card).
- Hand merges checked: `R/llm/decision-handlers/amendment.ts` keeps t262's rerun split and adds the lane's `told`
  hunk unchanged; `R/service.ts` stays at 4400 lines (build and apply wrapped in `automationStudioLlmBuildTrace.timed`
  in place; the added comment sits after the closing brace). The build trace prints only step names, durations and
  code-shaped values, and only with `FLUXIQ_BUILD_PROGRESS_TRACE=1`.
- Lead runs: `npx vitest run` on `R/activity U/activity-action R/llm/step-log R/llm/decision-handlers
  R/llm/evidence-progress R/llm/evidence-loop R/service/flow-bootstrap-commands R/result-verification
  R/tests/service-bootstrap/tests R/tests/deepseek-bootstrap` -> exit 1, `Test Files 4 failed | 125 passed (129)`,
  `Tests 10 failed | 1158 passed (1168)`; the 10 are accounting 6, generation 1, judged-build 2 and
  `evidence-loop/tests/repeat-guard.test.ts` 1, all in the dev sweep with the same names and messages (t266 owns them).
  `fluxiq:check` 0; Core structure audit 0; extension check 0 ("Core's build ... is current with its source").
- Extension fallout of D21 (lead run of `stream/step`, `view`, `shared/activity`, `background/activity` tests: `# tests
  135 # pass 133 # fail 2`): `card-words.test.ts` "a test step says what the test did with it..." and
  `action-card-view.test.ts` "a card for each kind...", both t264-owned since this stage; W3 updates them. t265's
  `shared/activity` tests pass.

### W3 (C w76/w80/w81/w84) and W4 (its wiring) — verified by the lead

- W3 report `t264-s2-w3-completion-check-run-ending.md` (Partial: three items needed files outside its brief, all
  t264-owned); W4 report `t264-s2-w4-wiring-and-tried-words.md` finished them.
- Ported: w76 Core (`activity/run.ts` "Run failed: <sentence>", new `wording/run-ending.ts`, `service.ts` `readRecord`
  in place); w81 (`result-verification/check-words.ts`, row count first on the check card, merged with F6's build
  sentence); w80 (completion refused by a test is said as "sent back ... N steps need fixing" through the observer and,
  in traced builds, through `progress-trace.ts`'s `testRefused` hook; the gate's refusals carry non-enumerable `steps`;
  `core.decision_check` answered as "Deciding the next step — didn't work" in F6's card scheme; reason screen U4 merged
  after A5's D3/D15 screen; "tried, not ran" refusal words in `U/activity-action/refusal-words.ts`); w84 (answer folder
  for unusable and answered-from-memory decisions, merged with A5's `told` in one `result.json` builder; recorder wired
  in `evidence-loop.ts`, 2 lines in place, still 798 lines); t194's `card-words.ts` `lowerFirst`; t174's and t194's
  lines in `card-words.test.ts` and `action-card-view.test.ts` (the two D21 failures fixed).
- Not ported: `decision-refusal.ts` (its only hunk is w78, S4); C's U7 title/prose for the deleted
  `draft-edit-refused.ts` (superseded by F6's card); w72/w73/w74/w85 (superseded by t262); w82 (S5); t194's
  `messages.test.ts` U3 test (t265 already carries it).
- Lead checks of the narrow hunks: `dry-run-gate.ts` adds only `refusal()`/`refusedSteps()` and three call sites (no
  w72 seeding: 0 added lines mention carried/scheduledCandidate/seed); `progress-trace.ts` adds no reauthor/try trace;
  `evidence-loop.ts` `2 insertions(+), 2 deletions(-)`, 798 lines.

### Stage S2 lead validation (final tree, logs in scratchpad `t264-s2/`)

- `npx vitest run` (`packages/fluxiq`) on `R/activity U/activity-action R/result-verification R/llm/step-log
  R/llm/decision-handlers R/llm/evidence-progress R/llm/evidence-loop R/llm/node-tools R/service/flow-bootstrap-commands
  R/flow-bootstrap/unfinished-build R/tests/service-bootstrap/tests R/tests/service-authoring/tests
  R/tests/deepseek-bootstrap R/tests/service-flows` -> exit 1, `Test Files 4 failed | 189 passed (193)`, `Tests 10
  failed | 1634 passed (1644)` (`final-core-vitest.log`). The 10 (accounting 6, generation 1, judged-build 2,
  repeat-guard 1) compared with the dev sweep by failing-test name and assertion message: `diff` of the two sorted lists
  -> identical. t266 owns them.
- Extension: 25 test files under `panel/chat/stream/step`, `panel/chat/view`, `panel/chat/conversation`,
  `shared/activity`, `background/activity` bundled (`run-subset.mjs`, exit 0) and run with `node --test` -> `# tests 222
  # pass 222 # fail 0`.
- `fluxiq:check` 0; Core `structure-audit:check` 0; extension check 0 (`core-build: ... current with its source`, so
  Core was rebuilt after the last source change); domain check 0; downstream `node scripts/structure-audit.mjs` 0
  ("passed (165 warning(s), 118 baselined)").
- Line endings: 66 Core and 10 downstream changed/new files, 0 with CR (counted with node). Note: this checkout uses
  `core.autocrlf=true`, so untouched files are CRLF on disk and edited ones are LF; the index is LF either way.
- `activityActionFailureReason` is exported from `fluxiq/ui` (`src/ui/activity-action/index.ts:6`, re-exported by
  `src/ui/index.ts`, present in the built `dist/ui/activity-action/index.d.ts`).

### Carried forward from S2

- A9's `apps/extension/src/shared/activity/wording.ts` hunk and its `shared/activity/tests/wording.test.ts` lines:
  t265 owns the file (uncommitted there). It can land once t265 is on `dev` and `dev` is merged into t264; the Core
  export it needs is here.
- To S3: w118 finishing verdict and `buildJudged`. To S4: w108 Cause 6 `notRunYet`; w78 `decision-refusal.ts`.
- `R/result-verification/check-words.ts` is not exported from the barrel (lane C did not either); no consumer needs it.
- Gaps: no test asserts `steps` on the gate's unchanged-again and replay-refused refusals (only `full_run_required`
  end to end); the `service.ts` `readRecord` wiring has no test of its own; no live, Lab, browser or provider run.
- `docs/reference/framework-reference.md` stays stale (pre-existing on dev), for the docs-last step.

Committed by the supervisor: Core `84117643`, downstream `ce1e8903`; then `dev` merged into both t264 trees (Core
`e223e765`, downstream `1529e5c3`: t263, t265, t266 sweep fixes, t268), Core rebuilt; the supervisor's post-merge run
of the previously failing files plus `activity`, `result-verification`, `tests/service-bootstrap`: 77 files, 668 passed,
0 failed.

## Stage S3 — judge and ending

Status: done, verified by the lead, uncommitted (2026-10-05). Base: Core `e223e765`, downstream `1529e5c3`. Ready for
the supervisor to commit on `task/t264-core-integration-chain`: 55 Core files, downstream `shared/activity/wording.ts` +
test, and four reports (this one, `t264-s3-w5..w7-*.md`). The pre-existing sweep failures are
fixed on this base (t266), so every failure in S3 runs is new or must be explained.

### Facts and decisions (lead)

- Since the lane base, dev changed in S3's areas only `build-test/{judge,summary}.ts` (+ judge test),
  `unfinished-build/{phases,reserve-judging,round-ending}.ts` and their tests (t262), and `conversations/commands/
  explore.ts`, `conversations/instructions/prompt.ts` (+ tests). Lane hunks elsewhere apply onto unchanged content.
- Units and their reports: A3a = t174 `reports/t174-w106.md`; A w118 = `t174-w118.md`; A6 = `t174-w105.md`; B F2 =
  t193 `1003-w3-replayed-press-observed`; B F3 = `1003-w4-judge-softened-progress`; B F4/F10 = `1003-w9-unfinished-
  ending-words` (+ `1003-w10` leftovers); D C2 = t195 `w42-judge-stopped-round`; D C4 = `w44-ending-ui`; D w48 =
  `w48-ending-words`.
- A3b (optional-only, choice-order) goes to S4: its files (`flow-bootstrap/instructed-acts/*`,
  `llm/harness-options/bootstrap-completion.ts`, `flow-draft/act-claim.ts`) are S4's authoring files (D w47, B F5).
- t195's `llm/deepseek/tests/request-body.test.ts`, `tests/deepseek-bootstrap/tests/observation.ts`,
  `tests/service-bootstrap/tests/extend.test.ts` and its `service.ts` hunk belong to w47/w49/w50, not S3.
- `conversations/commands/run-flow.ts`: only A6's one wording line (t267 will make it send `runIntent`; supervisor).
- A9's `apps/extension/src/shared/activity/wording.ts` hunk (t265 now in the tree) is t264's for this purpose.

### Plan (serial)

- W5 (`worker-high`): A3a + B F2 merged by hand (`build-test/{change-lines,observation,summary,index}`, diagnosis
  instructions, pins), B F3 (`build-test/judge.ts` onto t262, `unfinished-build/{judgement,progress,contracts}` F3
  parts).
- W6 (`worker-high`): D C2 onto t262's reserve judging and A w118 finishing verdict; sole owner of
  `unfinished-build/phases.ts` (every lane's phases hunk), `reserve-judging.ts`, `finishing-verdict.ts`, `contracts.ts`
  w118 part, `service.ts` `buildJudged` in place.
- W7 (`worker-high`): one ending-wording owner: B F4/F10, D w48, D C4, A6 (`unfinished-build/{not-finished,not-done,
  not-doable,budget-exhausted,replies-unreadable,ending-fit}`, `conversations/**`), and A9's extension wording hunk.

### W5 (A3a + B F2 + B F3) — verified by the lead

- Worker report: `t264-s3-w5-judge-evidence.md`. A3a and F2 merged in `build-test/{change-lines (new),observation,
  summary}.ts`: B's route and screen, A's cap (3 lines of 160 characters, the step's own control first) and A's
  "exploration state predates the test" sentence. F3: `oneCallSaidYes` in `judge.ts` onto t262; the
  `judge_no_longer_refutes` progress measure in `unfinished-build/{contracts,judgement,progress}.ts`.
- Two rules in neither lane, accepted by the lead: lines where a text now reads otherwise (`was "<old>"`) rank second,
  so the cap keeps the quantity a "+" set (B's defect); the domain's own `and N more changes` line is counted in
  `changedNotShown`, not shown. Both shapes exist in the domain (`node-run/press-effect/page-changes.ts:60,109`).
- Judge instruction, sentence-level diff checked: one sentence widened (`observed` includes a replayed step's
  change), two added (state predates the test; how to read `observed.changed`); pins updated to match.
- Left for later: A's Cause 5 parts of `summary.ts`/`summary.test.ts` (A3b, S4); B's `not-finished.ts` wording for a
  no-then-split pair (W7).
- Lead runs: `npx vitest run` on `R/result-verification R/flow-bootstrap/unfinished-build R/llm/tests
  R/llm/deepseek/tests R/tests/service-bootstrap/tests R/tests/deepseek-bootstrap R/tests/service-authoring/tests` ->
  exit 0, `Test Files 115 passed (115)`, `Tests 1126 passed (1126)` (`t264-s3/w5-vitest.log`); `fluxiq:check` 0; Core
  structure audit 0; 17 changed files, 0 with CR.

### W6 (D C2 + A w118 Core) — verified by the lead

- Worker report: `t264-s3-w6-stopped-round-and-finishing-verdict.md`. C2 rebuilt on t262's reserve:
  `automationStudioFlowBootstrapJudgeAtReserve` takes `stopped: "cost" | "calls" | "short"` (t262's `bound` mapping
  kept: a call refusal with `keptBackCalls` is `calls`); a round that stopped short with a clean, changed Flow is now
  judged (`shortJudged`, not when the Flow is unchanged since a judged no), and a judged no from it feeds `judgedNo`
  and phase 3's rules. t262's own phases and reserve-judging tests are untouched and pass. C2's test failed 4/6 with C2
  switched off (worker). w118: `finishing-verdict.ts` (digests, not raw signatures), `finished` carries `finishing`,
  `service.ts` writes `detail.buildJudged` on the `created` audit event (in place, 4400 lines); the build-trace hunks
  of lane A's `service.ts` were already landed by W2 (3 references present).
- New value for S5: `finishing.judgedAt` can be `"stopped_short"`; lane A's test-runner `build-proposal.ts` (A10, S5)
  must accept it.
- Lead runs: `npx vitest run` on `R/flow-bootstrap R/result-verification R/tests/service-bootstrap/tests
  R/tests/deepseek-bootstrap R/tests/service-authoring/tests R/service` -> exit 0, `Test Files 197 passed (197)`,
  `Tests 2139 passed | 1 skipped (2140)` (the skip is `loop-budget-cost-ending.test.ts:75`'s conditional `skipIf`);
  `fluxiq:check` 0; Core audit 0; 25 changed files, 0 with CR.

### W7 (B F4/F10, D w48, D C4, A6, A9 wording) — checked by the lead

- Worker report: `t264-s3-w7-ending-wording.md` (final sentence for every ending, a before/after for every chat
  line, each conflict and its choice). One ending author: lane D's plain words for the not-finished opening, list and
  tried sentence; lane B's distinctions for the judge clause (covers W5's no-then-split leftover), its doubt sentence,
  never-cut fitting (`ending-fit.ts`, new) and said-once progress sentence; create-here "The Flow "<name>" keeps your
  instruction." Two repeated clauses neither lane fixed (budget and not-doable endings) fixed and tested.
- A6 ported onto dev's `explore.ts`; `conversations/commands/run-flow.ts` diff is exactly one line (`announce:
  ... "Running "<name>" now. I'll say here how it went."`). A9: `X/shared/activity/wording.ts` and its test now equal
  lane A's files byte for byte (CR stripped); the only change is `activityActionFailureReason(code) ??
  OUTCOME_NOT_REPEATED` for `core.replay.(changed|unreproducible)`.
- C2 fallout found by W7: dev's `conversations/commands/tests/extension-chat.test.ts` "continues a kept creation ..."
  (t262 `80116d0e`) failed after W6, because its first build now stops short with a clean Flow and is judged, and the
  fixture judge said yes. W7 scripts that build's judge to say no (`scriptJudge(["no","no"])`); the continuation
  assertions are unchanged. Lead: legitimate (the test's premise, an unfinished first build, now needs a no). W6's
  wider behaviour (a short-stopped round 0 with no earlier judge is judged too, from the reserve kept from the start)
  is accepted: it matches the rule that a build finishes only on a judged whole-Flow run. My W6 rerun had not covered
  `conversations/`; the broad run below closes that gap.
- Left open by W7: internal words still in the budget ending ("over N decisions") and unreadable-replies ending ("the
  model's replies", "over one live round"), pinned in `tests/deepseek-bootstrap/tests/exploration.test.ts:120`,
  `tests/service-bootstrap/tests/unreadable-replies.test.ts:103-104`, `tests/service-bootstrap/tests/
  unfinished-build.test.ts:148`, `activity/build.ts:58`; lane B D12 repair heading "Building on the Flow" (not an
  ending); `kept-said.ts` "kept as a draft, not put into the Flow" still awkward; `not-done.ts` exports 11 values
  (advisory 8).
- Lead checks: 55 Core and 6 downstream changed files, 0 with CR (node count).

### Stage S3 lead validation (final tree, logs in scratchpad `t264-s3/`)

- `npx vitest run src/programs/automation-studio src/ui` (`packages/fluxiq`; the whole automation-studio program,
  run because C2 changes when a build finishes) -> exit 0, `Test Files 702 passed (702)`, `Tests 6730 passed | 1
  skipped (6731)`, 285 s (`s3-broad-vitest.log`). The skip is `loop-budget-cost-ending.test.ts:75`'s conditional
  `skipIf`.
- `fluxiq:check` 0; Core `structure-audit:check` 0; `service.ts` 4400 lines; `phases.ts` 716 lines (budget 800).
- Downstream: extension check 0 (`core-build: ... current with its source`); domain check 0; `node
  scripts/structure-audit.mjs` 0 ("passed (170 warning(s), 118 baselined)"); 21 extension test files under
  `shared/activity`, `panel/chat/stream/step`, `panel/chat/view`, `background/activity` bundled and run -> `# tests 165
  # pass 165 # fail 0`.
- Line endings: 55 Core and 6 downstream changed/new files, 0 with CR.
- Not verified: no live, Lab, browser or provider run; the real judge still returns no confidence or advice, so
  w118's record fields are tested with scripted values only.

### Carried forward from S3

- To S4: A3b (optional-only, choice-order, claim-doubt parts of `summary.ts` Cause 5) with D w47 on
  `bootstrap-completion.ts`; lane D w41/w46 hunks noted by W6; lane B D12 repair heading "Building on the Flow"
  (`phases.ts` + `phases.test`) if S4's owner of `phases.ts` takes it.
- To S5: test-runner `build-proposal.ts` must accept `judgedAt: "stopped_short"` (A10); w118's downstream chat-record
  `said` and `judged` fields.
- Wording debt (pinned in tests outside S3's ownership): budget ending "over N decisions", unreadable-replies ending
  "the model's replies"/"over one live round" (`exploration.test.ts:120`, `unreadable-replies.test.ts:103-104`,
  `unfinished-build.test.ts:148`, `activity/build.ts:58`); `kept-said.ts` "kept as a draft, not put into the Flow";
  stale `judgedTest` doc comment in `service/flow-bootstrap-commands/build-judge.ts` (reserve case only).

Committed by the supervisor: Core `5613270d`, downstream `d71d4b82` (supervisor rerun: automation-studio + ui 702 files,
6730 passed, 1 skipped; checks 0; shared/activity 20/20).

## Stage S4 — Core authoring (last stage), then docs

Status: done, verified by the lead, uncommitted (2026-10-05). Base: Core `5613270d`, downstream `d71d4b82`. Ready for the
supervisor to commit: about 100 Core paths (source, tests, docs, both regenerated references), three downstream
architecture docs, and seven reports (this one, `t264-s4-w8..w12-*.md`, `t264-docs-last.md`). S5 (Lab records) moved to t267;
`R/service/runtime-adaptation/**` is t267's and is not touched. t269 (B7 binding etc.) starts after t264 lands.

### Facts (lead)

- t262 changed most S4 files since the lane base: `flow-draft/{amendment,entry,step,dry-run,verify-only}.ts`,
  `llm/{draft-amendment-feedback,evidence-loop,evidence-loop-decision,unusable-decision}.ts`,
  `llm/decision-handlers/amendment.ts`, `llm/evidence-loop/rerun-request.ts`, `flow-bootstrap/instructed-acts/*`,
  `harness-options/{bootstrap-completion,draft-acts}.ts`. Every unit is a hand merge.
- Budgets (800 lines): `flow-draft/amendment.ts` 602 (B adds ~128, D ~215 incl. hunks to drop), `llm/evidence-loop.ts`
  798, `llm/evidence-loop-decision.ts` 645. `amendment.ts` will need a split by responsibility (Core code-structure
  rules: a focused module or directory, never extract-and-drop).
- Excluded as superseded: t174 A2 (`reversal.ts`, toggle), t174 claim-doubt/kind-words, t194 w72/w73/w74/w85, t195
  w49/w50 (route enforcement), t195 `always` change (t262's `unrepeat` stays).

### Plan (serial; each worker owns its unit's files; next starts after the lead verifies)

- W8: B F5/F10 (t193 w5 amendment answers, moved act told) + A5 w108 Cause 6 `notRunYet`.
- W9: D C1 (t195 w41 stable rerun numbers) + D w45 (repeat revalidation on `unrepeat`, shown-number semantics);
  owns the `amendment.ts` split.
- W10: D w47 (routing words; start-location note reworked against t262's declared arrival) + A3b (optional-only,
  choice-order onto dev's, A's Cause 5 `summary.ts` parts).
- W11: C w79 + D w46 (repeat guard, `draft-key.ts`, `evidence-loop.ts` within 800) + C w78 (brief advice, rerun needs
  input).
- W12: leftover ending words if their pins are reachable; docs-last: regenerate both `framework-reference.md` copies
  (`pnpm.cmd docs:reference`), check Core and downstream architecture docs against the landed behaviour of S1-S4.

### W8 (B F5/F10 + A5 Cause 6) — verified by the lead

- Worker report: `t264-s4-w8-amendment-answers.md`. Ported onto t262: truthful bind answers, refusals with `next`,
  moved act told as information (`automationStudioLlmEvidenceClaimWrittenAct` in `decision-handlers/amendment.ts`;
  the `evidence-loop.ts` hunk equals lane B's exactly, 798 -> 796 lines); `notRunYet` ends with the checklist sentence
  when one is given. B's `once` and `count_not_a_repeat` superseded by t262's `unrepeat`. `amendment.ts` 658 lines.
- Left out by W8: lane B's one-sentence narrowing of the decision instruction ("only a value a step typed, or a read's
  condition, is bound ... a press's control or option is never bound"), because its pin is in
  `llm/deepseek/tests/system-prompt-pins.json`. Assigned to W11 (owner of `evidence-loop-decision.ts`).
- Lead runs: `npx vitest run --minWorkers=1 --maxWorkers=4` on `R/flow-draft R/llm R/flow-bootstrap
  R/tests/service-authoring/tests R/tests/service-bootstrap/tests R/tests/deepseek-bootstrap R/conversations` -> exit 0,
  `Test Files 302 passed (302)`, `Tests 3138 passed (3138)`; `fluxiq:check` 0; Core audit 0; 13 files, 0 with CR.

### W9 (D C1 + D w45) — verified and completed by the lead

- Worker report: `t264-s4-w9-rerun-numbers-and-repeats.md` (Partial: two stale fixtures outside its brief).
  `flow-draft/amendment.ts` split into `flow-draft/amendment/` (12 modules + barrel, largest `apply.ts` 233 lines;
  every old export kept, checked by comparing export names of `HEAD:amendment.ts` with the new modules: none missing).
  C1: a rerun keeps the replaced step's number; the replaced attempt moves to the end with `replacedBy` and amending it
  is refused `not_a_kept_step`. w45: numbers in one decision read against the draft as shown; after a move every repeat
  that can no longer run is taken off (`repeat_taken_off`, with words in `refusal-words.ts`). Dropped: `always`, w45's
  first-step sentence, every w49/w50 hunk. `evidence-loop.ts` 796 lines.
- Lead edits (lane D's two fixture edits, which follow from C1): `tests/service-bootstrap/tests/extend.test.ts`
  `RERUN_CARRIED = [rerun(1), rerun(2)]` with its comment; `tests/deepseek-bootstrap/tests/observation.ts` exempts a
  step with `replacedBy` from `withoutInput`. Both normalized to LF. Those two files -> `Test Files 2 passed`, `Tests 8
  passed`.
- W9 ran `git mv` (outside its brief) and unstaged it; lead check: `git diff --cached --name-only` -> empty.
- Lead runs: `npx vitest run --minWorkers=1 --maxWorkers=4` on `R/flow-draft R/llm R/flow-bootstrap R/activity
  U/activity-action R/tests/service-authoring/tests R/tests/service-bootstrap/tests R/tests/deepseek-bootstrap
  R/conversations` -> exit 0, `Test Files 332 passed (332)`, `Tests 3544 passed (3544)`; `fluxiq:check` 0; Core audit
  0 (fresh run).
- Left for W12: comments still naming `flow-draft/amendment.ts` in `flow-bootstrap/instructed-acts/choice-order.ts:20`,
  `llm/evidence-loop/trace.ts:98`, `service/flow-bootstrap-commands/evidence-trace.ts:162` (+ any others);
  `llm/evidence-loop/held-amendments.ts` gives a held amendment's `repeat_taken_off` the wrong step number (edge case,
  W9 report); answerability draft-entry budget margin is 71 bytes (4,929 of 5,000).

### W10 (D w47 + A3b) — verified by the lead, one lead edit

- Worker report: `t264-s4-w10-routing-words-and-optional-only.md`. w47: routing refusals in words
  (`draft-routing.ts`, `{"change":"always"}` replaced by t262's `unrepeat`), carried to the model by
  `bootstrap-completion.ts`; the read note; the start note (step 1 may be rerun to the stable deeper address where the
  work begins) checked against t262's declared arrival, with the completion test declaring the arrival binding. A3b:
  new `instructed-acts/optional-only.ts` (an act's only step is not left optional; a completion refusal
  `bootstrap.instructed_act_only_optional`), dev's `choice-order.ts` code unchanged (dev already covers lane A's main
  case), A's Cause 5 lines in `build-test/summary.ts`. Lane A's fixture `run-musq0b1m-draft.ts` not created (the test
  uses four inline placeholder steps; no site URL, title or banner text).
- Lead decisions on W10's questions: optional-only as a completion gate is accepted (lane A's design; it restricts no
  action). `withRoutingSentence` kept. The missing code in `issue-feedback.ts` `AUTHORED_CODES` and
  `unfinished-build/not-done.ts` `BLOCKED_WORDS` goes to W12.
- Lead edit: W10 had dropped, with w49/w50, the start note's opening clause "Unless the person's instruction says how
  to get there (pages, menus or links to go through: then follow that route and keep its steps), ...". That clause is
  prompt wording only (no route detection), and without it the note would invite skipping a route the person named,
  against the user's rule. Restored in `llm/deepseek/request-body.ts` with a comment saying lane D's detection is not
  ported, and pinned by two new assertions in `deepseek/tests/request-body.test.ts`. `R/llm/deepseek` -> `Test Files 9
  passed`, `Tests 106 passed`.
- Lead runs (after the edit): `npx vitest run --minWorkers=1 --maxWorkers=4` on `R/flow-bootstrap R/llm R/flow-draft
  R/result-verification R/tests/service-authoring/tests R/tests/service-bootstrap/tests R/tests/deepseek-bootstrap
  R/conversations R/activity` -> exit 0, `Test Files 354 passed (354)`, `Tests 3705 passed (3705)`; `fluxiq:check` 0;
  Core audit 0; nothing staged; 60 changed files, 0 with CR.

### W11 (C w79 + D w46, C w78, B's bind sentence) — verified by the lead

- Worker report: `t264-s4-w11-repeat-guard-and-brief-advice.md`. One repeat guard: w79 (a handle refusal is lifted
  after a new look) and w46 (`repeat-guard/draft-key.ts`, keyed on the Flow signature, which holds the acts and
  `ranWith` B F11 added to the amendment memory). w78: a repair brief no longer hands the model false advice; an
  `amend_draft` whose rerun carries no input is refused `llm_evidence_loop.rerun_needs_input`. B's sentence: the
  decision instruction now says only a typed value or a read's condition is bound, never a press's control or option
  (sentence-level diff equals lane B's; only the `evidence_tool_decision` pin changed).
- Lead check: no w72 seeding in `evidence-loop-decision.ts` (the one "carried" match is a doc line about a rerun that
  carried no input). Sizes: `evidence-loop.ts` 796, `evidence-loop-decision.ts` 668, `llm/tests/unusable-decision.test.ts`
  797 (W11 compacted ported lines to stay under 800; W12 splits it instead).
- Lead runs: `npx vitest run --minWorkers=1 --maxWorkers=4` on `R/llm R/flow-bootstrap R/flow-draft R/recovery
  R/activity R/conversations R/result-verification R/tests/service-authoring/tests R/tests/service-bootstrap/tests
  R/tests/deepseek-bootstrap R/tests/refuted-result` -> exit 0, `Test Files 404 passed (404)`, `Tests 4267 passed
  (4267)`; `fluxiq:check` 0; Core audit 0; nothing staged; 76 changed files, 0 with CR.

### W12 (leftovers) — verified by the lead

- Worker report: `t264-s4-w12-leftovers.md` (before/after for every changed sentence). Done: the optional-only code
  in `plan/issue-feedback.ts` `AUTHORED_CODES` and `unfinished-build/not-done.ts` `BLOCKED_WORDS` (each with a
  failing-first test); plain ending words (kept sentence "The steps I found so far were kept as a draft, so building
  again carries on from them."; budget ending uses the shared tried sentence, no "over N decisions"; unreadable replies
  "the replies it got back could not be read", no "over one live round"; headline "Build stopped: the replies it got
  back could not be read"), all pins updated (incl. two in `judged-build.test.ts`); `held-amendments.ts` keeps a
  `repeat_taken_off`'s own step, numbers mapped back to the model's (failing-first: got 3, expected 2); lane B's two
  bind assertions; the four stale `amendment.ts` comment paths and the `judgedTest` doc comment.
- Not done, lead decision: splitting `llm/tests/unusable-decision.test.ts` (797 lines). `llm/tests/` and
  `llm/evidence-loop/tests/` are both at the 25-file directory limit, and the cases test `llm/unusable-decision.ts`,
  so another folder would break test placement. The file stays at 797 of 800 lines; regrouping `llm/tests/` by prefix
  is a separate structural unit.
- `plan/issue-feedback.ts` is stored `-text` with CRLF (two literal control bytes in a regex on dev): lead check `git
  ls-files --eol` -> `i/-text w/-text`; `git diff --numstat` -> `4 0`; CR count 203 -> 207 (the 4 new lines follow the
  file's own convention).
- Open (W12): other held refusals (e.g. `over_not_before`) may still give `over`/`through` in renumbered numbers; the
  budget ending's opening still says "model calls".
- Lead runs: `npx vitest run --minWorkers=1 --maxWorkers=4` on `R/llm R/flow-bootstrap R/flow-draft R/activity
  R/conversations R/result-verification R/recovery R/tests/service-authoring/tests R/tests/service-bootstrap/tests
  R/tests/deepseek-bootstrap R/tests/refuted-result R/service/flow-bootstrap-commands` -> exit 0, `Test Files 410
  passed (410)`, `Tests 4322 passed (4322)`; `fluxiq:check` 0; Core audit 0; nothing staged; 105 other changed files,
  0 with CR. Core `node scripts/structure-audit.mjs --rule docs-links` -> passed.

### Docs-last (W13) and one lead source fix

- Worker report: `t264-docs-last.md` (about 25 doc fixes, each with file:line and reason). Core
  `docs/architecture/automation-studio/{llm-flow-bootstrap,flow-authoring,client-gateway}.md` and downstream
  `docs/architecture/{build-loop,extension-client,web-capabilities}.md` now describe the landed S1-S4 behaviour (lasting-act
  rule, refusal cards and "Edit the Flow", ending sentences, rerun numbering, optional-only, the start note's
  named-route clause, the build trace). Both `framework-reference.md` copies regenerated by `pnpm.cmd docs:reference`.
- W13 found a false model-facing sentence (pre-t264, commit `ed35dfa1`): `unfinished-build/unchanged-complete.ts`
  told the model "a round that changes nothing ends the build as not doable", but such a round ends
  `notFinished: { kind: "repeated_unchanged" }` (`phases.ts:534`). Lead edit: "... ends the build unfinished." plus a
  header comment, and its pin in `tests/unchanged-complete.test.ts`. `unfinished-build` tests -> `Test Files 24
  passed`, `Tests 186 passed`. References regenerated again after this edit.
- Left alone (pre-existing): Core `docs/architecture/package-boundaries.md:320-321` names two files that do not exist.

### Stage S4 final lead validation (logs in scratchpad `t264-s4/`)

- `npx vitest run --minWorkers=1 --maxWorkers=4 src/programs/automation-studio src/ui` (`packages/fluxiq`) -> exit 0,
  `Test Files 705 passed (705)`, `Tests 6808 passed | 1 skipped (6809)`, 443 s (`final-broad.log`; started after the
  last source edit).
- `fluxiq:check` 0; Core `structure-audit:check` 0 (fresh run); `pnpm.cmd docs:check` 0 ("Deterministic framework
  reference is current."); Core `pnpm.cmd build` 0 after the last source edit.
- Downstream: domain check 0 and extension check 0, both with `core-build: ... current with its source`; `node
  scripts/structure-audit.mjs` 0 ("passed (170 warning(s), 118 baselined)"); 21 extension test files under
  `shared/activity`, `panel/chat/stream/step`, `panel/chat/view`, `background/activity` -> `# tests 165 # pass 165 # fail
  0`.
- Tree: nothing staged; no path under `R/service/runtime-adaptation/**` changed; 109 Core files (all but the `-text`
  `plan/issue-feedback.ts`) and 10 downstream files, 0 with CR. Budgets: `service.ts` 4400 (ratchet), `evidence-loop.ts`
  796, `evidence-loop-decision.ts` 668, `phases.ts` 716, `llm/tests/unusable-decision.test.ts` 797 (of 800).
- Not verified: no live, Lab, browser or provider run for any S4 unit. The S4 behaviours that need live proof: rerun
  numbering and repeat take-off as the model sees them (D lane), moved-act told and bind answers (B lane), the
  optional-only completion refusal and choice order (A lane), the repeat guard on unchanged drafts (C/D lanes).

### Carried forward from t264 (for the supervisor's plan)

- `llm/tests/` and `llm/evidence-loop/tests/` are both at the 25-file directory limit; `unusable-decision.test.ts` is at
  797 of 800 lines. Regrouping `llm/tests/` by prefix is a separate structural unit.
- Held refusals other than `repeat_taken_off` (e.g. `over_not_before`) may name `over`/`through` in renumbered numbers
  (`llm/evidence-loop/held-amendments.ts`).
- The budget ending's opening still says "model calls"; `not-done.ts` exports 11 values (advisory 8).
- The start note's named-route clause is wording only: lane D's route detection (w49/w50) is not ported and waits for
  t262's D waypoint design (t269 or later).
- W6's `finishing.judgedAt: "stopped_short"` must be accepted by the test-runner `build-proposal.ts` reader (t267, which
  now owns S5's Lab records).
- Answerability draft-entry budget margin: 71 bytes (4,929 of 5,000) after C1's replaced-attempt line.
