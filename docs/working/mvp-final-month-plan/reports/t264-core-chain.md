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
