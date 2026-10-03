# Report: t252-lead

## Outcome

Partial, stopped at a safe point for the night (supervisor, 2026-10-03). Both trees compile and pass their narrow
checks. P1, P2 and P3 (walker, judge view, stored consequences, wiring) are done and verified. Not started: w7 (the
parity test and the scripted confirm-requests proof) and P4 docs. Nothing is half-done: no worker was mid-edit
when work stopped.

## State of the trees (uncommitted work since the supervisor's checkpoints)

- **Core** `C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQ`, branch `task/t252-general-flow-authoring-impl`, HEAD
  `0d7d3071` (P1 checkpoint `e4854d20` plus lanes A and C). Uncommitted: P3, 44 paths. R =
  `packages/fluxiq/src/programs/automation-studio/runtime`.
  - w5: `R/llm/node-tools/replay-span.ts` (new), `replay-draft.ts`, `dry-run-gate.ts`, `run-flow-part.ts`,
    `R/flow-draft/dry-run.ts`. New tests `replay-draft-loop.test.ts`, `dry-run-gate-loop.test.ts`; `run-flow-part`
    and `dry-run` tests extended.
  - w6: `R/result-verification/build-test/pass-lines.ts`, `span-rows.ts`, `test-inputs.ts` (new), `summary.ts`,
    `index.ts`, `R/result-verification/contracts.ts`, `R/llm/diagnosis-instructions.ts`, `R/llm/step-log/field-names.ts`
    (new), `tool-step.ts`, `index.ts`, `R/llm/deepseek/tests/system-prompt-pins.json`.
  - w8: `R/flow-bootstrap/adaptation.ts` (`metadata.declaredConsequences`), `R/llm/evidence-loop/rerun-request.ts`,
    `R/flow-draft/amendment.ts` (`rerun_holds_binding`), `R/llm/draft-amendment-feedback.ts`,
    `R/flow-bootstrap/evidence-loop-steps.ts`, `R/activity/wording/draft-edit-refused.ts`.
  - w9: `R/llm/loop-configuration.ts`, `R/llm/evidence-loop.ts`, `R/llm/node-tools/run-flow.ts`, `R/service.ts` (two
    call sites: `nodeOf: nodeDescriptions.definition`), `R/llm/node-tools/dry-run-gate.ts`,
    `R/flow-draft/full-run-required.ts`, `R/llm/harness/request-evidence-check.ts`; new test
    `run-flow-rows-in-loop.test.ts`.
- **Downstream** `C:/Users/osrs_/FluxStuff/fxwork/t252/!FluxIQWebExtension`, same branch, HEAD `3ca6194b` (P2
  checkpoint `c62900cb` plus lanes A and C). Uncommitted: `domain/src/runtime/llm-evidence/node-run/written-step.ts`
  (lane A's `choice: undefined`, the only merge break), the design doc (Current State, briefs w4-w9, two ledger
  entries), `docs/working/README.md` (regenerated), reports w5, w6, w8, w9 and this report.

## What changed and why (P3)

The build's test now runs a loop as a loop: a `repeat` over a list runs each span member once per row the list
returned in the test, with that row as `item` and `$state` bindings resolved by the executor's resolver. A lasting
act becomes one verify call per row, never a press. The judge sees one line per pass, named by the row's screened
label. Stored nodes keep their declared consequences. The walker is fed node definitions at all three places it runs
in a build.

## Commands run and observed results

- Core libraries: `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` ->
  all three "reuse" (current). `pnpm build` -> the web app step fails on dev's `recall` kind (not t252, below).
- Downstream against the merged Core: `pnpm --filter @fluxiq-web-extension/domain check`, `.../extension check`,
  `.../test-runner check` -> first run 1 error, `written-step.ts(115)` missing `choice`; fixed; re-run rc 0, 0, 0.
- Domain tests beside t252 (81 files, `DOMAIN_TEST_BUILD_LABEL=t252-lead`) -> "# tests 621 # pass 621 # fail 0".
- Core after the merge, before P3: 9 test directories -> 148 files, 1529 passed, including recorded-windows.
- Core after w5, w6, w8: 11 directories -> "Test Files 229 passed", "Tests 2717 passed".
- Core after w9: `npx vitest run` runtime/llm, runtime/flow-draft, runtime/result-verification -> "Test Files 183
  passed", "Tests 1721 passed". `tests/service-bootstrap/tests/adaptation.test.ts` alone -> 9 passed (it timed out
  once under w9's parallel load; it is a known load-flaky test).
- `pnpm --filter fluxiq check` -> clean (stamp reuse). Core `node scripts/structure-audit.mjs` -> "passed (231
  warning(s), 349 baselined)". Downstream audit -> "passed (162 warning(s), 118 baselined)".

## Not verified

- No test yet runs the assembled Flow and the walker side by side (parity), and no scripted build proves the
  confirm-requests shape end to end. That is w7.
- The domain's real `outputs.records` and `item` handling against the walker: each side is unit-tested on its own.
- The domain tests were not re-run after P3. P3 changed only Core, and the downstream typechecks ran before P3, so
  re-run them after the lane D merge.
- Full suites and live runs: not run, by rule.

## What is next, in order

1. Supervisor: checkpoint P3, then merge lane D (Core `2da9ce41`, downstream `9fed3b76`). Expect contact in
   `R/flow-draft/amendment.ts` (single-row twin drop vs `bind` and `rerun_holds_binding`),
   `R/llm/draft-amendment-feedback.ts`, `R/result-verification/build-test/summary.ts` (rowContextKeys vs w6's pass
   lines), `R/llm/harness-options/binding.ts`, and downstream `domain/src/runtime/llm-evidence/plan-resolution/*` and
   `structure/first-item` (vs w3's `state-binding.ts` and the `row-scope.ts` move). `R/llm/evidence-loop.ts` is at
   the 800-line limit: if lane D adds lines there, it needs a split.
2. Rebuild Core libraries, re-run the three downstream typechecks, the domain tests beside t252 and the Core
   directories above.
3. w7 (brief in the design doc): the parity test and the scripted proof, with its variants (written Confirm,
   non-lasting act, zero rows refused `not_reached`, declared consequences kept on the stored node).
4. P4: Core architecture docs for the draft, the test and bindings; the downstream build-loop page;
   `docs-reference --check` in Core.

## Open questions or contradictions found

- **Stored-run permission gate (user).** Stored nodes now keep `metadata.declaredConsequences`, but no plain run
  reads it. Gating stored runs on it would change what every stored Flow does when it runs, so that is the user's
  call.
- **Core web app build broken on dev** (not t252): `apps/web/src/features/automation-studio/conversation/components/action-card/action-icons.ts`
  lacks the `recall` `ActivityActionKind` that lane C added (`383d529a`).
- Decisions taken (the supervisor may override): a while span whose body is a lasting act runs one pass; a written
  member excused because an earlier lasting act was withheld stays excused; zero rows give recorded members
  `passes: []` and refuse only written members.
- `R/flow-draft/amendment.ts` is large (`bind` could move to its own module). Downstream `node-run/` and
  `node-run/tests/` are at 25 files, Core `R/llm/evidence-loop/` at 25, and `R/llm/evidence-loop.ts` at 800 lines.
- P5 must add earlier steps' outputs to the walker's resolution state, for `$step` bindings.

## Merge of lane B, 2026-10-03

The supervisor ran `git merge --no-ff task/t193-live-self-repair` in both t252 trees: lane B plus dev with lanes A, C
and D. Core MERGE_HEAD is `6da08162` and downstream MERGE_HEAD is `3f0521f9`; the merge base is dev at t194. The lead
resolved all 17 conflicted files. **Nothing is staged**: the index still marks them `UU`, and the supervisor stages
and commits. R = Core `packages/fluxiq/src/programs/automation-studio/runtime`, D = downstream
`domain/src/runtime/llm-evidence`.

### Resolution decisions

1. **`R/flow-draft/amendment.ts`.** The `change` description keeps t252's `bind:` text. Lane D's reorder-first
   sentence is added before "Drop any other step...". The `through` refusal field and the in-order reading of one
   decision's amendments auto-merged.
2. **`R/flow-draft/dry-run.ts`.** The outcome keeps both fields: t252's `passes` and lane B's `excused`. The feedback
   line carries both `excusedLine` and the pass words. `DRY_RUN_INSTRUCTION` carries both texts, which auto-merged.
3. **`R/llm/node-tools/replay-draft.ts`.** Lane B's `reasons` map, `excusable` call field and `excused` outcome field
   are joined to t252's span walker:
   - `send` takes `excusable`.
   - A straight step's `excusable` is its conditional reason only while `excused(stepId)` holds, so an expanded span
     step never gets one. Otherwise it is `"withheld"` behind a checked lasting act.
   - A span's pass calls carry `excusable: "withheld"` only when `withheldBy` is set.
   - In `replay-span.ts` `memberOutcome`, a member that did not pass with `withheldBy` set also carries
     `excused: "withheld"`.
   - **Rule:** a step the test ran once per row is never excused as one the Flow does not always run. That is t252's
     verdict rule, now applied to lane B's words too.
4. **`R/llm/node-tools/dry-run-gate.ts`.** Both sides are kept:
   - t252's `not_reached` refusal of written steps (`notReached`, `repeatedStepIds`);
   - lane B's unchanged-replay guard (`unchangedLine`, `sameFailures`, the `unchanged` line).

   `unchangedLine` decides which steps "stood in the way" with the verdict's own exemption, so a failed per-row pass
   (`passes` set, no `withheldBy`) is named as a step to change.
5. **`R/result-verification/build-test/summary.ts`.** t252's `shown`/`rowsOf` sit beside lane B's `reasons`. Lane D's
   `rowContextKeys` target words auto-merged. Lane B's `excusedWords` no longer uses the draft's routing reason for an
   outcome with `passes`: only `excused` or a withheld effect excuses it. Without this, a repeat that failed per row
   would have told the judge "repeated: ... may not run at all".
6. **`R/llm/diagnosis-instructions.ts`.** The build-test instruction is dev's text (lane D's repeated-step sentence
   and left-out rows' tested values; lane B's two excused-step sentences), with t252's sentences after lane D's
   (passes, judge each pass against its own row, rows not passed, `buildTest.inputs`).
   - One t252 clause was dropped: "the step's target words are the row the build acted on".
   - Lane D's target words for a repeated step name no row ("in each row step N keeps"), so the passes are what name
     each row now.
7. **`R/llm/deepseek/tests/system-prompt-pins.json`.**
   - `loop_verification` is lane B's pin; t252 never changed it.
   - `loop_verification_build_test` is lane B's pin with its build-test instruction replaced by the merged one.
   - The pin test confirms both, byte for byte.
8. **`R/llm/evidence-loop/rerun-request.ts`.** Both header paragraphs are kept: t252's bindings and lane D's rerun of
   a done act, which is run as a check.
9. **`R/flow-draft/index.ts`.** Both exports are kept: `excused.ts` and `flow-inputs.ts`.
10. **Tests.** In `R/flow-draft/tests/amendment.test.ts` and `R/llm/tests/diagnosis-channel.test.ts`, both sides'
    describe blocks are kept.
11. **`framework-reference.md` (both copies).** Regenerated with `node scripts/docs-reference.mjs`: "Wrote ... (3065
    public declarations)". Then `--check`: "Deterministic framework reference is current."
12. **Downstream.**
    - `docs/working/README.md`: the incoming side, as briefed.
    - `D/node-run/replay.ts`: lane B's `readRows(payload, where, ranWhere)` inside t252's
      `withNodeOutputs(..., flowRows(...))`.
    - `D/node-run/replay-answer.ts`: t252's `webNodeReplayFlowRows`, then lane B's `labelled(..., tested)` and
      `testedColumns`.
    - `D/node-run/verify.ts` imports: `JsonValue` (lane B) and `webAutomationScopedToRow` (t252).
13. **Unchanged, auto-merged and confirmed by tests:**
    - lane D's single-row twin drop, reorder hint and `rowContextKeys`;
    - lane B's `excusable`;
    - the checked-not-pressed rule (dev's `lastingActs` rule);
    - lane C's unchanged-complete guard.
14. **Structure.** `D/node-run/` went to 26 files: t252's 25 plus lane B's `nested-consequences.ts`. The shared-prefix
    pair `layer-element.ts`/`layer-member.ts` moved to `D/node-run/layer/{element,member,index}.ts` (plain `mv`, not
    staged). The importers were updated: `covered-target.ts` and `press-effect/answered-layer.ts`. The directory is now
    at 24 files. `R/llm/evidence-loop.ts` stays at 800 lines (the merge changed 5 lines in place).
15. **t252's own regression, found by the merge's checks.** `R/tests/deepseek-bootstrap/tests/answerability.test.ts`
    "converges through the judge's no..." failed with the draft at 4,327 bytes against the stub's 4,000.
    - Cause: P1 grew `AUTHORED_INSTRUCTION` from 2,086 to 3,240 bytes (write, loop and bind guidance). t252's scoped
      runs never covered this directory.
    - It passes on lane B's tip, so the merge did not cause it.
    - Production has had no draft byte budget since 2026-09-30, so the stub's measuring stick in `harness.ts` was
      re-calibrated to 5,000, with a comment, and the test's `budget` expectation updated.
    - **Cost note for the supervisor:** about 1,150 more bytes, roughly 290 tokens, in every authored decision's draft
      entry, mostly cached.
16. **Pinning tests** (worker t252-merge-w1, report `reports/t252-merge-w1-combination-tests.md`). One describe each was
    added in `R/llm/node-tools/tests/replay-draft-loop.test.ts`, `R/result-verification/build-test/tests/excused.test.ts`
    and `R/llm/node-tools/tests/dry-run-gate-loop.test.ts`, pinning decisions 3, 4 and 5. The lead mutation-checked
    each:
    - reverting decision 3 or 5 failed 3 of 34;
    - reverting decision 4 failed 1 of 9;
    - the source was restored each time.

### Checks (run by the lead on the resolved trees)

| Check | Observed |
| --- | --- |
| Core `npx tsc --noEmit -p .` (packages/fluxiq, heavy.sh) | rc 0 |
| Core `pnpm --filter fluxiq check` (after the test edits) | rc 0, `fluxiq:check` built |
| Core `node scripts/structure-audit.mjs` | `structure-audit: passed (239 warning(s), 349 baselined).` |
| Core `node scripts/docs-reference.mjs --check` | `Deterministic framework reference is current.` |
| Core vitest `R/{activity,conversations,flow-bootstrap,flow-draft,llm,result-verification,service,tests}` + `src/ui/activity-action`, run concurrently with the check | `Test Files 5 failed / 441 passed (446)`. 3 were 15 s timeouts (adaptive-retry-resume, recorded-gap, instruction-readiness), and all three passed run alone. 1 was t252's own (item 15), now fixed. 1 was pre-existing (below). |
| The 5 files alone | `Tests 2 failed / 8 passed`: answerability (item 15) and service-wiring |
| `R/service/datasets/tests/service-wiring.test.ts` "fails the attempt ... store cannot be opened" | **Pre-existing, not t252.** It fails identically on lane B's tip (`fxwork/t193`, `67dcc087`) and on dev `424a70b3` (`fxwork/t250`): `AggregateError: ... project database pool is closing. What the run held for its judged end could not be settled`. Branch `task/t207-store-failure-pool-regression` exists for it. |
| `R/tests/deepseek-bootstrap` after item 15 | `Test Files 2 passed (2)`, `Tests 11 passed (11)` |
| Worker files, then `R/llm/node-tools` + `R/result-verification/build-test` | `Tests 34 passed (34)`; `Test Files 31 passed (31)`, `Tests 275 passed (275)` (both rerun by the lead for the first) |
| Core libraries `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` | contracts reuse; `fluxiq:build` built (5257 files); gateway reuse |
| Downstream `pnpm --filter @fluxiq-web-extension/{domain,extension,test-runner} check` | rc 0, 0, 0; rerun after the `layer/` move: rc 0, 0, 0 |
| Domain tests beside t252 and the conflicted files (92 files in 11 directories, scoped runner, label `t252-merge`) | `# tests 725`, `# pass 725`, `# fail 0` |
| After the `layer/` move: `D/node-run/tests` + `D/node-run/press-effect/tests` | `# tests 207`, `# pass 207`, `# fail 0` |
| Downstream `node scripts/structure-audit.mjs` | 1 violation: `[working-docs] docs/working/README.md is out of date`. That is the incoming README, left for the supervisor to regenerate as briefed. The `node-run/` file-count violation was fixed (item 14). |

### Not verified

- The extension build, the extension tests, Core `apps/web` and full suites: not run, by rule.
- Live runs: not run (held).
- The span's `excusable: "withheld"` reaching the chat: Core tests show it on the executor call. The activity
  observer's handling of it on a pass call (`<id>.pass.<n>`) was not exercised.
- `D/node-run/verify.ts`: lane D's `draft.ranWith` on a check now states row-scoped parameters when a pass sends
  `item`. Core's replay ignores a replay answer's `draft`, by reading, not by a test.

## w7 and P4, 2026-10-03

The supervisor committed the lane B merge: Core `5f0bb788`, downstream `04178c6b`. This stage ran in the same trees
and left everything uncommitted and unstaged. There were three workers, in parallel, on disjoint files:
- w7a (worker-high): the parity test;
- w7b (worker-high): the end-to-end proof;
- w10 (worker): P4 docs.

Briefs were in the dispatch, after the design doc's w7 brief and the coordinator's list. R = Core
`packages/fluxiq/src/programs/automation-studio/runtime`.

### What landed

1. **Parity** (w7a, `reports/t252-w7a-parity.md`). `R/llm/node-tools/tests/replay-parity.test.ts` (new; the
   directory now has 24 files) covers one draft: a Flow input, a list, and a repeat holding a row-scoped press and a
   `$row`-bound step.
   - The draft runs two ways and must give the same sequence of (node, resolved parameters, `item`):
     - through the build's real path (assemble, validate, normalise, `canonicalFlowDocument`,
       `runAutomationStudioGraph` with fake natives);
     - through the walker with a fake host.
   - A second case: a lasting press is a per-row `replay: "verify"` on the same row and target.
   - The assembler's plan-node defaults (`timeoutMs`, `recordOutput: null`, `normalise.ts` `materialiseDefaults`) are
     dropped from the comparison only while they equal the default.
2. **Proof** (w7b, `reports/t252-w7b-confirm-requests-proof.md`).
   `R/tests/service-authoring/tests/confirm-requests-build.test.ts` is new, in a new feature directory, because
   `R/tests/service-bootstrap/tests` is at its file limit. It runs the whole build through `AutomationStudioService`
   with a scripted model and judge and a stand-in domain: eight requests, three kept.
   - **Main case.** List with `where` (add), Confirm run live on a kept row, `repeat`, `bind` `{"$row":"name"}`,
     complete. Asserted:
     - the test sent the Confirm 3 times, each `verify` with its kept row as `item` and the bound value resolved to
       that row's name;
     - only the exploring press was ever pressed, and no call names an excluded row;
     - the judge's request shows 3 passes by kept label and no excluded row;
     - the build is proposed, then applied;
     - the stored Flow has exactly one For Each over the list, with the Confirm inside it fed `item`;
     - the Confirm's parameters are `{person: {$state: {path: "item.name"}}}`, and the explored row's name appears
       nowhere in the Flow;
     - `metadata.declaredConsequences` is kept.
   - **Variants:**
     - written Confirm: nothing pressed, same stored shape, and the plan-time gate record lists its declaration;
     - non-lasting act: a step replay per row, never verify;
     - zero kept rows with a written Confirm: refused `full_run_required` / `not_reached` before any judge, and no Flow
       stored.
3. **Fix: a row-bound recorded member nothing ever ran** (from w7b's finding).
   - The gap: without `nodeOf`, or whenever the test cannot read a span's rows, a recorded member bound to `$row` is
     sent once with no row and fails `core.replay.unresolved_binding`. That failure was excused as a repeat's, so the
     build proposed a loop body nothing had tested.
   - The fix: `R/llm/node-tools/dry-run-gate.ts` `notReached` now refuses it as `not_reached`, written or recorded,
     when the span was not walked. `R/flow-draft/full-run-required.ts` says so in its header and in the model's
     sentence ("or it takes a value from the item ($row)").
   - Pinned by 3 tests in `R/llm/node-tools/tests/dry-run-gate-loop.test.ts`:
     - refused when unwalked;
     - passes when walked;
     - an `$input`-only binding stays excused.
   - Reverting the rule fails 1 of 12.
4. **Fix: `flow_draft.input_conflict` is built** (from w10's finding). Design D3 and the `flow-inputs.ts` header
   promised it, but nothing read `conflicts`.
   - `R/flow-bootstrap/authoring/assemble-draft.ts` now refuses each conflict from
     `automationStudioFlowDraftInputs(steps).conflicts`, naming both values and the steps, at
     `draft.steps.<first>`.
   - The `flow-inputs.ts` header is corrected: the draft never named conflicts.
   - 2 tests are in `R/flow-bootstrap/authoring/tests/draft-bindings.test.ts`.
5. **P4 docs** (w10, `reports/t252-w10-docs.md`, then edited by the lead for items 3 and 4 and the proof).
   - Core: new `docs/architecture/automation-studio/flow-authoring.md` (the draft, written steps, bind, bindings and
     assembly checks, the walker, excusal, `not_reached`, the unchanged guard, part runs, the judge's view, parity
     and the proof, consequences, what is not built). It is linked from `llm-flow-bootstrap.md` and
     `docs/architecture/README.md`.
   - Downstream: new `docs/architecture/build-loop.md` (live run or write, replay with a row, `outputs.records`,
     verify per row, left-out rows' tested values, `rowContextKeys`, the web-4 Lists line). It is listed in
     `repository-layout.md`. Core's page is named by path, because the downstream docs-links rule refuses links that
     leave the repository.
   - Both `framework-reference.md` were regenerated: line numbers moved in `full-run-required.ts`.

### Checks (run by the lead after all three workers and both fixes)

| Check | Observed |
| --- | --- |
| Core vitest `R/{flow-draft, llm/node-tools, result-verification/build-test, flow-bootstrap, tests/service-authoring, tests/deepseek-bootstrap}` (heavy.sh) | `Test Files 125 passed (125)`, `Tests 1580 passed (1580)` |
| Walker expansion disabled (`replay-draft.ts` plan forced off), parity + proof | `Tests 5 failed / 1 passed`: both parity cases and the main, written and non-lasting proof cases fail; zero-rows stays refused by the unwalked rule. Restored (`git diff` empty) |
| Core `pnpm --filter fluxiq check` | rc 0, `fluxiq:check` built |
| Core `node scripts/structure-audit.mjs`; `--rule docs-links` | `passed (239 warning(s), 349 baselined)`; `passed (0 warning(s), 0 baselined)` |
| Core `node scripts/docs-reference.mjs --check` | first `stale` (line numbers from item 3); regenerated, then "Deterministic framework reference is current." |
| Core libraries `contracts:build fluxiq:build client-gateway-websocket:build` | reuse / built / reuse, rc 0 |
| Core `pnpm --filter @fluxiq/web check`; `apps/web` `vitest run src/features/automation-studio/conversation` | rc 0 (`web:check` built); `Test Files 26 passed (26)`, `Tests 267 passed (267)` |
| Downstream `pnpm --filter @fluxiq-web-extension/{domain,extension,test-runner} check` | rc 0, 0, 0 (each rebuilt against the new Core dist) |
| Domain `node-run/tests`, `node-run/press-effect/tests` (scoped runner, label `t252-w7`) | `# tests 207`, `# pass 207`, `# fail 0` |
| Extension `src/panel/chat/**/tests` + `src/shared/activity/**/tests`, 33 files (the scoped runner with test-extension.mjs's esbuild options, label `t252-w7`) | `# tests 253`, `# pass 253`, `# fail 0` |
| Downstream `node scripts/structure-audit.mjs` | `structure-audit: passed (163 warning(s), 118 baselined).` |

### Not verified

- The extension build (the bundles), the e2e specs, the extension's other test directories, and full suites: not
  run.
- Live runs: not run (held). The proof's stand-in mirrors the web domain's replay and verify contracts; the domain
  side is unit-tested on its own (`node-run` tests above), not run under the proof.
- Not covered by the parity test: the Router, while spans, and `$step` (P5, not built).
- Proof variant (d) ends `flow_bootstrap.provider_transport_unknown` only because the script has no decision after
  the refusal. It asserts the refusal itself and that nothing is stored.

### For the supervisor

- Changes since `5f0bb788` / `04178c6b`, all unstaged:
  - Core: `docs/architecture/{README.md, automation-studio/llm-flow-bootstrap.md, automation-studio/flow-authoring.md (new)}`,
    both `framework-reference.md`, `R/flow-bootstrap/authoring/{assemble-draft.ts, tests/draft-bindings.test.ts}`,
    `R/flow-draft/{flow-inputs.ts, full-run-required.ts}`,
    `R/llm/node-tools/{dry-run-gate.ts, tests/dry-run-gate-loop.test.ts, tests/replay-parity.test.ts (new)}`,
    `R/tests/service-authoring/tests/confirm-requests-build.test.ts (new)`.
  - Downstream: `docs/architecture/{build-loop.md (new), repository-layout.md}`, reports w7a, w7b, w10 and this
    section.
- Still the user's: the stored-run permission gate on `metadata.declaredConsequences`.
- `recorded-windows` and service-wiring (t207) remain pre-existing and not t252's.
