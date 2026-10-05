# t262 integration audit

Worker report for brief `t262-audit` in [mvp-final-month-plan.md](../../mvp-final-month-plan.md).
Read-only audit of `C:/Users/osrs_/FluxStuff/fxwork/t262/` (both repositories, branch
`task/t262-mvp-live-continuation`), 2026-10-05. The only writing git command run was
`git merge-tree --write-tree`, which writes objects only. Nothing in `fxwork/t262` was edited.

## Outcome

Done. The committed t262 work can land. Core merges into `dev` with no conflicts. Downstream
has two conflicts, both in documentation only. No source commit came after the last recorded
narrow gate. The uncommitted Core work (B7 bindable guidance) **must not be committed as it is**:
`draft-amendment-feedback.ts` calls `automationStudioFlowDraftBindablePaths` but never imports it,
and the planned `bindable/tests/paths.test.ts` is missing. Neither active worker (resume-ab,
resume-cd) left a report, so nothing in the uncommitted work has an observed test result.

## 1. Commits not on `dev`

Merge bases: downstream `88c58d82`, Core `f6ef9f48` (= Core `dev`). Downstream `dev` has one commit
that t262 lacks: `b6768b7f` (a pointer to the handoff doc, docs only).

### Downstream (16 commits, 226 files, +14537/-326; 107 non-doc files)

| Commit | Kind | Purpose (from subject) | Non-doc areas (files) |
| --- | --- | --- | --- |
| 0e7526d5 | doc | Record resumed MVP scope and worker briefs | - |
| 326ad350 | **source** | Improve authoring evidence before resumed live tests | extension(3), domain llm-evidence(16); 7 test files |
| 9d401be6 | doc | Record live result and remaining MVP blockers | - |
| 14cd066b | **source** | Retain screened terminal evidence for live validation | test-runner(11); 4 tests |
| 7b5a3aa1 | doc | Record persistent-run debug and authoring corrections | - |
| e2aeb5b1 | doc | Record failed live endings and root-cause briefs | - |
| f9afcb12 | **source** | Isolate independent chat creation; keep saved replay project identity | test-runner(16); 5 tests |
| d51a92d4 | doc | Record zero-call live failures and briefs | - |
| 408ec3da | **source** | Scope mounted chat creation; add provider-free project setup | extension(24), test-runner(13); 14 tests |
| f32b7dc8 | doc | Record headed scoped-chat proof | - |
| 066d57ee | doc | Record A5/B4 debug and repair briefs | - |
| 9ff18e28 | **source** | Keep the dynamic bound-target fallback; document live repair gates | domain llm-evidence(3); 2 tests |
| 39686bf6 | doc | Keep A6/B5 evidence; compact the resume state | - |
| 2ef458a1 | **source** | Forward Lab call authority; keep current PRESENT runnable metadata | domain llm-evidence(2), test-runner(10); 4 tests |
| 476b52d7 | **source** | Keep keys during Lab replay; give truthful feedback on ambiguous targets | domain llm-evidence(5), domain runtime/tests(1), test-runner(12); 7 tests |
| 08272aee | doc | Record accepted cart creation and zero-model reuse, with debugs | - |

### Core (14 commits, 180 files, +4693/-667; 172 non-doc files)

| Commit | Kind | Purpose (from subject) | Non-doc areas (files) |
| --- | --- | --- | --- |
| 0e45fbd5 | doc | Record paired MVP continuation | - |
| 9f756676 | **source** | Improve draft evidence; flag uncertain act claims | fluxiq(26); 9 tests |
| 42434f42 | **source** | Repair accidental repeats; ignore recovery causes that have healed | fluxiq(15); 7 tests |
| 97e279de | **source** | Separate checked candidates from performed evidence; protect split lasting acts | fluxiq(22); 10 tests |
| bc9c8bb8 | doc | Record declared-arrival correction brief | - |
| 80116d0e | **source** | Use declared arrival evidence; keep compatible creation continuation | fluxiq(24), `.structure-baseline.json`; 11 tests |
| 00fcfe09 | doc | Record live setup cause and judge evidence release | - |
| 5c893a98 | **source** | Clarify truthful paging evidence on the judge summary copy | fluxiq(8); 2 tests |
| 4349568c | doc | Record paired live debug and repair release | - |
| 115f67e9 | **source** | Repair checked action identity and model-facing build feedback | fluxiq(37); 12 tests |
| 4b34571b | doc | Record paired live endings and repair owners | - |
| e8c89bbd | **source** | Enforce scoped Lab build calls; bound automatic reauthor retries | fluxiq(40), `.structure-baseline.json`; 16 tests |
| 0ecdec16 | **source** | Schedule genuine saved-Flow repairs; keep model accounting truthful | apps/web(5), fluxiq(27); 11 tests |
| db538300 | doc | Record verified live cart runtime and deterministic reuse that keeps the stored key | - |

Commit bodies are empty apart from trailers. Several commits carry only a `Worker:` trailer and no
`Task: t262` trailer (for example `e8c89bbd`, `2ef458a1`, `08272aee`, `db538300`), so the trailer
convention was applied unevenly.

Other observations on the combined diff:
- Core `.structure-baseline.json` changes in one direction only, lowering `runtime/service.ts` from
  4418 to 4400. No budget was raised.
- The public Core change is additive: `framework/index.ts` gains an optional `modelProvidersEnabled`.
  `apps/web` gains a `model-provider-admission/` module. The docs reference
  `packages/fluxiq/docs/reference/framework-reference.md` was regenerated.
- No tracked build output, `.fluxiq/`, or `test-runs/` paths are in either diff.
- `git diff --check dev...HEAD` (downstream) flags three files with a blank line at the end of the
  file. One is source: `packages/test-runner/src/flow-lane/terminal/stopped-without-failed-attempt.ts:23`.
  The other two are docs. Core: clean.

## 2. `git merge-tree --write-tree dev task/t262-mvp-live-continuation`

| Repo | Result tree | Exit | Conflicts |
| --- | --- | --- | --- |
| Downstream | `59199414df41d4927c3cecb87156c2a9f34a4445` | 1 | `docs/working/README.md`, `docs/working/claude-work-handoff-2026-10-03.md` (content) |
| Core | `eb857f0bd53254edc827e92df605d885afe5e0fc` | 0 | none (Core `dev` is the merge base, so the merge is effectively a fast-forward) |

Both downstream conflicts come from `dev`'s `b6768b7f` and t262 editing the same lines:
- `claude-work-handoff-2026-10-03.md`: both sides rewrote `Status detail:` and added a paragraph at
  the top of Current State. `dev` gives the absolute worktree path as plain text, at an older
  checkpoint wording. t262 links `./mvp-live-continuation-2026-10-03.md` directly and adds the A8/B7
  results. Once merged, the doc exists on `dev`, so **take t262's side**, but keep `dev`'s note that
  the absolute path is plain text only if the worktree path is still mentioned.
- `README.md`: this index is generated. The conflict is only in the line-count column and the new
  `mvp-live-continuation-2026-10-03.md` row. **Regenerate it** with the owning index step (the one
  `/handoff` uses); do not hand-merge it. Regenerating it also adds the untracked
  `mvp-final-month-plan.md` row once that doc is committed.

## 3. Uncommitted work in the t262 trees

### Core: brief `b7-current-bindable-guidance` (resume-ab)

| File | State |
| --- | --- |
| `runtime/flow-draft/bindable/paths.ts`, `bindable/index.ts` | new. `automationStudioFlowDraftBindablePaths(step)` returns dotted paths that appear in both the shown `input` and the runnable `ranWith`, have equal values and hold no binding (or are a recognised stored binding). It does not descend into `$state/$input/$row/$step`. |
| `runtime/flow-draft/entry.ts` | each proposed step gains `bindable: [...]`, plus one sentence in the instruction that explains `bindable` |
| `runtime/llm/draft-amendment-feedback.ts` | new `bind_new_key` wording; a `bind_new_key` refusal gains `bindable`; the feedback step type is widened to `input?`/`ranWith?` |
| `flow-draft/tests/entry.test.ts`, `llm/tests/draft-amendment-feedback.test.ts` | one new case each: alias `target.handle` versus runnable `selector/element` gives `bindable: ["text"]`, with no private value leaking |
| `flow-draft/tests/amendment.test.ts` | one new case: a binding to a whole existing object (with an explicit `test` or the default) is accepted. This covers existing behaviour, as the brief requires. |

Assessment: **about 80% complete, not safe to commit as is.**
- **Defect:** `llm/draft-amendment-feedback.ts` uses `automationStudioFlowDraftBindablePaths`
  (line 191) without importing it. Its only imports are `JsonObject` and
  `AutomationStudioFlowDraftAmendmentRefusal`. This fails type-checking, and at runtime any
  `bind_new_key` refusal would throw a `ReferenceError` inside
  `decision-handlers/amendment.ts` → `tell()`. That is the exact B7 path this unit is meant to fix.
  The import should probably go through the `flow-draft/index.ts` barrel, which does not yet
  re-export `bindable`, rather than reach into `flow-draft/bindable/` from `llm/`.
- The brief's owned file `bindable/tests/paths.test.ts` does not exist. The helper's own cases are
  untested: nested paths, arrays, null, stored bindings, and `ranWith` absent.
- The worker's report `reports/b7-current-bindable-guidance.md` does not exist, so no fail-first or
  passing count was ever recorded. The files' last write was 2026-10-03 23:21, which looks like the
  run stopped mid-unit.
- Production callers: `decision-handlers/amendment.ts` passes `context.draftSteps`, full draft steps
  that carry `input`/`ranWith`. That fits the widened type.

### Downstream: brief `c4-actual-saved-row-fixture` (resume-cd)

`domain/src/runtime/tests/carried-row-service-repair.test.ts` is new and untracked, 278 lines, one
test. It builds an actual public `AutomationStudioService`, the domain native bundle and
`IoRegistry`, and a saved graph `start→list(extract_list)→for-each→row-type($state item.desired)→
type(summary,"wrong")→end`. It then runs `build_and_adapt` and asserts all of the following:
- the saved run extracts and types two rows plus the summary;
- the repair resets and lists fresh;
- the fresh reversed rows are typed with their own values;
- the decoy row is never written;
- the judge comes after the correct summary;
- the `row-type` node and its `$state` binding stay unchanged.

Assessment: **looks complete as a fail-first fixture, but unverified.**
- An ignored bundle `domain/.test-build-scratch/t262-c4-row-service/carried-row-service-repair.test.mjs`
  is dated 23:21, so a bundle was built.
- No report `reports/c4-actual-saved-row-fixture.md` exists, so no observed outcome was recorded.
- The test collects `bootstrap.required_input_unconnected` diagnostics. That suggests the fixture was
  already hitting the documented limitation: seeding does not rebuild for-each repeat metadata (see
  `c4-row-repair-preflight.md`).
- It is expected to **fail** against current source: it is a fail-first test with no fix yet.
  Committing it as is would add a red test to `dev`.
- Commit it only together with the graph-reconstruction fix, or mark it as an expected failure
  under a recorded decision.

### Downstream: brief `p5-earlier-output-contract` (resume-live-prep) and doc edit

- `docs/working/mvp-live-continuation-2026-10-03/reports/p5-earlier-output-contract.md` is new and
  untracked, 25 lines. It is a partial read-only investigation: 8 owners were read and a bounded
  expansion was requested (graph-run, run-state, assemble, replay, the plan→persisted mapper).
  It contains no recommendation yet. It is safe to commit as a docs-only snapshot.
- `mvp-live-continuation-2026-10-03.md`, uncommitted (+10/-1): adds the P5 brief and rewrites
  "Active owners" to say the AB, CD and P5 workers are active. It is safe to commit as docs, but
  that sentence is no longer true (no worker is running), so correct it when the doc is next touched.

## 4. Last recorded gate and what came after

The last source gate in the ledger is two entries: "Focused quality unit ready for paired source
checkpoints" and "Paired quality checkpoints and Claude entry point".

> Validation: Core223tests15owners/web29tests2owners/domain20tests3owners/Lab24tests4owners independently PASS; Core/web/domain/Lab types PASS; Core5397files/domain861files/host1file/extension80files/Lab1628files fresh/stamped, references3088declarations. Both audits PASS243/165warnings349/118baselines, no baseline raise. git diff --check exit0. No whole suite or new paid launch.

> Validation: both local commits observed, git status clean; main doc pointer first audit rejected external Markdown link, corrected plain path then structure auditPASS164warnings118baseline; diff --checkPASS; git push origin dev exited0. Final t262 auditsPASS243/165warnings349/118baseline. No paid launch yet.

The last ledger entry is a live-run check, not a source gate:

> Validation: ordinary replay85247/2328 each exit0/PASS, runtime1889d86e/555baa64 succeeded/exacttaskgoal held; constructorfalse, providercredentialsabsent, explicitpubliccalls/accountedcalls/interventions/harness0/gatefalse; one stored key preserved. Complete public topology aftereach readonly capture exactly unchanged parent/subflow/10nodegraph/router, digestc4c41898...c69c5; inspection83697/2588 strictstop/exit0/closedports observed.

The gated checkpoints are downstream `476b52d7` and Core `0ecdec16`. **No source commit came after
the gate.** The only later commits, `08272aee` and `db538300`, are docs only (confirmed with
`git diff-tree`). Everything not yet gated is the uncommitted work in section 3.

Caveats:
- The ledger says that gate ran "no whole suite". The full suites (`pnpm check`, `pnpm test`,
  `pnpm build`, Core vitest) have not run on t262's combined source. "Two full sweeps already
  October3" refers to earlier `dev` state.
- The ledger's own `git diff --check exit0` disagrees with the three end-of-file blank lines I
  observed against `dev...HEAD`. They may come from the three-dot range or from earlier commits,
  but are worth a glance.

## 5. What t262 delivered, and the defects it names

### Delivered (committed)

- **Evidence the build model sees:** draft evidence is richer; uncertain act claims are flagged;
  checked candidates are kept apart from performed evidence; split lasting acts are protected;
  accidental repeats are repaired; recovery causes that have healed are ignored.
- **Arrival and judge truthfulness:** declared arrival evidence is used; the judge summary describes
  paging evidence truthfully; checked action identity is repaired; build feedback to the model is
  clearer.
- **Lab and live harness:** the screened terminal evidence is kept; each chat creation is isolated;
  the saved replay keeps its exact project identity; chat creation is scoped to the mounted
  extension chat (`408ec3da`); a project can be set up without a provider; the A7-era ambiguity
  feedback is truthful.
- **Budget and calls:** Lab-scoped call admission is enforced (one purse for reader, decision,
  repair and judge calls; at most 48 calls; a $0.10 Lab-only ceiling); each question is counted once
  even if HTTP retries; automatic reauthor retries are limited to transient failures; a
  provider-call total is recorded on failure; the deadline keeps paid interventions and never
  reports a false zero.
- **Reuse:** replay with the provider disabled keeps the stored key and requires explicit
  zero-call accounting (`modelProvidersEnabled: false`, additive).
- **Repair:** saved-Flow repairs are scheduled from genuine candidates (actual six-case domain
  fixture); the dynamic bound-target fallback is kept; the current runnable metadata is kept for
  PRESENT.
- **Live result:** A8 (hub to cart) was created, ran, persisted, and replayed twice with the
  provider disabled, at $0.056566776, with 4/4 facts and an unchanged topology.

### Open defects it names

| ID | Defect | State in t262 |
| --- | --- | --- |
| B7 binding affordances | The draft shows the model the tool-facing input (`target.handle`). Bind checks the runnable `ranWith` (`selector/element`), so `bind_new_key` is refused, and the feedback told the model to name a parameter it was shown. The model looped (amendments 0019-0055). No defect in the whole-object grammar. | Fix is uncommitted and broken (missing import, missing helper test). Then one B retry with its own Stage1 is needed. |
| C4 row repair | Repairing a saved Flow does not rebuild for-each repeat metadata or convert `$state item.*` back to `$row` (SeedFromFlow / LoopSeedSteps), so per-row mapping is not proven to survive a repaired whole test. C needs 13 ordered records, 52 fields and all pages live. | Fail-first fixture uncommitted and unreported; graph-reconstruction fix not started. |
| D waypoints | Ordered route/waypoint protection for D (confirm requests) with grounded instructions: one shared instruction read for permissions and route, explicit named/open/unavailable route states, valid permissions kept when the route is invalid. Must not port the old URL scan or fail-open. | Design and phase-1 preflight reports complete; no source. D per-row action and four-record oracles are missing. |
| P5 `$step` | Earlier-step output cannot be bound: `binding-forms.ts` refuses every `$step` (`step_binding_not_yet`). It needs a deferred, stable identity that survives positional `sN` node keys, plus resolution of real outputs from strictly prior steps. | Contract investigation partial (section 3); no source. |

Also still open: B has no accepted run at all, and C and D are unproven live. Project B holds an
unfinished draft Flow that must not be replayed.

## Recommendation: landing t262 on `dev`

1. **Land the committed checkpoints only** (downstream up to `08272aee`, Core up to `db538300`).
   They are gated and none of them is ungated source. Before `pnpm task finish`, move the
   uncommitted work aside: commit it on a follow-up branch, or let the B7/C4 owners finish it.
   Never commit it as is.
2. **Order:** follow the repository rule for a task paired with Core. Finish downstream first so
   its checks build against the t262 Core worktree; then merge Core `task/t262` into Core `dev` in
   Core (a fast-forward-equivalent, no conflicts). Push both `dev` branches in the same unit:
   downstream needs the new Core API (`modelProvidersEnabled`, call admission).
3. **Conflicts:** for the handoff doc, take t262's side, folding in `b6768b7f`'s plain-text-path note
   if the path is still mentioned. Regenerate `docs/working/README.md`.
4. **Post-merge narrow checks:** both structure audits; type checks of `fluxiq`, `@fluxiq/web`,
   domain, extension and test-runner; and the owning tests from the gate (Core 15 owners, web 2,
   domain 3 including the `carried-service-repair` bundle, Lab 4). Then queue one background
   full-suite sweep on `dev`, since t262's combined source has never had one.
5. **Follow-up units (serial in Core `runtime/flow-draft` and `llm`):**
   - B7 bindable fix: add the import via the barrel, add `bindable/tests/paths.test.ts`, run the
     fail-first test and then the fix.
   - C4: the row fixture together with graph reconstruction.
   - D phase 1.
   - P5.

   B7 and C4 overlap only in that both touch Core seeding and draft owners, so serialize their
   Core edits.

## Commands run and observed results

- `git rev-parse`, `git log dev..HEAD`, `git log HEAD..dev` (both repos): 16 downstream and 14 Core
  commits ahead; downstream `dev` is 1 commit ahead (`b6768b7f`); Core `dev` is 0 ahead.
- `git diff-tree --name-only` per commit: kind and area tables above.
- `git diff --shortstat dev...HEAD`: downstream 226 files +14537/-326; Core 180 files +4693/-667.
- `git merge-tree --write-tree --name-only dev task/t262-mvp-live-continuation`: downstream exit 1,
  2 conflicts; Core exit 0, tree `eb857f0b`.
- `git status --porcelain -uall` and `git diff` (both trees): as in section 3.
- `git diff --check dev...HEAD`: 3 end-of-file blank lines downstream; Core clean.
- `git check-ignore -v` on the scratch bundle: ignored by `.gitignore:24`.

## Not verified

- No test, type check, build or audit was run (the brief forbids them). The missing import is
  established by reading the file's imports, not by compiling it.
- I did not check whether the C4 row fixture currently fails, or how.
- I did not check whether the committed checkpoints still pass their gates after merging `dev`.
- I did not check the structure-audit effect of the new `bindable/` directory or of the extra test
  in `domain/src/runtime/tests`.
- Ledger claims (gate counts, live results) are quoted, not reproduced.
- I did not check overlap with the lane trees t174/t193/t194/t195; that belongs to the
  lane-tree-reconcile brief.

## Open questions or contradictions found

- The continuation doc's uncommitted "Active owners" text says three workers are active. None is
  running, and none left a report.
- The ledger reports `git diff --check exit0`, but `dev...HEAD` shows three end-of-file blank lines
  (minor).
- The `Task:` trailer is missing on several t262 commits, contrary to the branch convention.
