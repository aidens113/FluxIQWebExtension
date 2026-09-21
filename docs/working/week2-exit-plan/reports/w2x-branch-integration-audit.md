# w2x-branch-integration-audit

## Outcome

Done (read-only). This audit covers each open task in both repositories, what
is proven live, what is uncommitted, conflicts measured with
`git merge-tree --write-tree`, where the branches overlap in meaning, a
recommended integration order, and a list of what can be removed.

No merge, checkout, build, test, live run, or history change was made. No
branch, worktree, source file, or working document was modified. This report is
the only file written. Ports 3000 and 4711 were only queried, and neither was
listening.

Baselines used: downstream `dev` = `2b3484b` (one docs commit past the
`d3ad8c5` named in Current State); Core `dev` = `2d3e69a`.

## What changed and why

Only this report was written. It exists so the supervisor can decide the
integration order and removal list without rediscovering branch state.

## Per-task table

| Task | Content (both repos) | Live-proven (report, evidence) | Unproven / failed live | Uncommitted in worktree | Textual conflicts | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| **t027** `task/t027-multi-action-exploration` | DS: 41 commits, 127 files, +9,217/-205. Core: 11 commits, 45 files, +1,435/-172. Contents: panel golden-path lane, creation/apply drivers, runtime snapshot-readiness reuse, host-state timeout, recorder scroll, reconnect, extraction exit, repair categories, ranking, and terminal outcomes; Core panel storage init, autofill, grant limits, preflight diagnostics, permission-continuation UI and public client export. It also carries the **first-generation multi-action batch** (Core `ef7892f`, `4b79c00`, `042562e`; DS `719a34d`, `88329d0`), with a **production default of 16** (Core `loop-limits/evidence-loop.ts:53`). | Panel generation, apply, and 4/4 deterministic execution with zero provider calls (`w2-panel-evidence-runtime-binding.md`, bundle `demo-llm-explore-2026-09-21T00-22-44-392Z-fdf63b`). Saved 4-action run 14.774 s -> 8.165 s (-44.7%), 4/4, oracle passed (`w2-runtime-command-latency-trace.md`). Host-state timeout: run `run-muah724i-1e821737` passed (`w2-host-state-command-timeout.md`). Reconnect reuse, recording playback reuse, and run presentation passed (`w2-reconnect-reuse-live.md`, `w2-recording-playback-reuse-live.md`, `w2-panel-run-presentation-live.md`). Extraction exit: 8 rows, record oracle passed (`extraction-exit-live-2026-09-21T01-52-37-011Z-1895f8`). Read-once creation produced one durable proposal (`demo-llm-explore-2026-09-21T03-39-51-674Z-b87d9c`, bootstrap investigation Current State). Ranking projection: 5 candidates in 680 bytes (`w2-repair-candidate-ranking-live.md`). Autofill and storage init were validated live in the isolated t027-storage pair (`w2-panel-autofill.md`, `w2-panel-runtime-initialization.md`). | Real-provider repair never produced a patch (`w2-panel-repair-continuation.md` BLOCKED; the ranking repair stopped before dispatch; `w2-fresh-ui-repair-cycle.md` stopped at creation). Terminal repair outcome is proven provider-free only (`w2-panel-repair-result-boundary.md`). The provider-triggered permission-continuation dialog is **not** proven live. First-generation batching was not adopted live (`w2-t027-batch-adoption.md`) and its proof was inconclusive (`w2-t027-provider-batching.md`). The unified one-or-many runs never completed a Flow (`w2-unified-evidence-decision-live.md`: `bootstrap.unknown_parameter`; `w2-unified-decision-feedback-only.md`: `evidence_repeat_without_progress`; `w2-panel-unified-*`). That code was **never committed**; it exists only as dirty fxlab worktrees. **Every t027 creation proof ran on Core `ef7892f`, whose default is 16.** | DS: `docs/working/mvp-week2-automation-loop-plan.md` (+10 lines, brief `w2-mvp-latency-critical-path-audit`) and untracked `.../reports/w2-mvp-latency-critical-path-audit.md`. t034's brief requires reading this report. Core: clean. | vs dev: DS `docs/working/README.md` only (a generated index); Core clean. vs t033: DS 4 files, Core 18 files (inventory below). vs t029/t034: DS README only; Core clean. | **Merge after split**: merge-based reconciliation onto `dev` after t033 lands, dropping the first-generation batch surface (`bootstrap-no-proposal-investigation/reports/w2-t027-t033-integration-map.md`). |
| **t033** `task/t033-multi-action-reconcile` | DS: 2 commits, 16 files, +665/-20 (Lab-only run-scoped `maxActionsPerDecision` 1 or 16, plus docs). Core: 2 commits, 39 files, +1,649/-132. The strict singleton-or-list contract, atomic preflight, transition, permission and evidence visibility, ordered state, bounded diagnostics, production default one. | None as acceptance. The only live runs were two environment failures before any provider call and one baseline on the **wrong task**, `social-scheduler-week-ahead` (14/14 records on that task, $2 grant instead of $1). All are non-acceptance (`w2-multi-action-live-ab.md`). Focused tests only: 130 Core and 58 DS at `0dbf62f`/`fab7cba`. | The same-code A/B (1 vs 16 on `social-scheduler-schedule-post`) was never run. The integration review **blocked** `fab7cba`/`0dbf62f` on three findings: non-atomic ledger admission, classified refusal not stopping, and `uniqueItems` (`w2-multi-action-integration-review.md`). The remediation claims 93/93 focused tests, check and build pass, but the rereview has **not** run (`w2-multi-action-remediation-rereview.md` is absent). | Core: 9 remediation files (+198/-16) under `runtime/llm/evidence-batch/*`, `evidence-loop.ts`, `recovery/{exploration-budget,runtime-exploration}.ts` and tests. DS: working doc plus 3 untracked reports (integration review, live A/B, remediation). | vs dev: clean in both repos. vs t027: see inventory. vs t029/t034: clean. The remediation files overlap only files t033 already owns. | **Hold, then merge as-is**, after the remediation commit, the rereview, and the live A/B. |
| **t029** `task/t029-arbitrary-js-node` | Committed: docs only. DS has 4 commits (plan, node-library gap audit, semantic-actionables probe: "Reject duplicate actionable query node" is a decision, not code). Core has 1 plan commit. It is 11 DS commits and 2 Core commits behind `dev`. | Committed reports: the gap audit found no purpose-built node justified; existing snapshot and inspect already cover semantic actionables (`w2-node-library-gap-live.md`, `w2-semantic-actionables-live-probe.md`). Uncommitted reports: the hand-authored two-node Chromium 151 journey passed (sum `7`, marker `js-live`) three times (`w2-arbitrary-js-node-live.md`, `w2-arbitrary-js-remediation-live.md`, `w2-arbitrary-js-persistence-boundary-live.md`), with 68/68 Core and 11/11 extension focused tests. | Both real-provider selection attempts failed to give an oracle, and the model-authored select/apply/run journey is unproven. Firefox fails closed and is unverified. **The final rereview blocks** on JSON-result lineage, delayed/duplicate transport classification, and USER_SCRIPT byte-check poisoning (`w2-arbitrary-js-persistence-final-rereview.md`). | **The whole implementation is uncommitted.** DS: 22 modified files (+408/-49) plus `apps/extension/src/runtime/run-javascript.ts`, its test, 6 reports, and a temp driver `.tmp-w2-final-boundary-live.mjs`. Core: 23 modified files (+834/-71) plus a new `harness/tests/output-validation.test.ts`. | Committed: README only. Uncommitted, tested with `git merge-file` after normalizing line endings: DS `apps/extension/src/runtime/action-runner.ts` conflicts with t027 in one hunk (the `run_javascript` branch vs the snapshot-readiness note; a straightforward union). Core `runtime/llm/deepseek-provider.ts`, `harness/output-validation.ts`, and `runtime/service.ts` merge textually clean against both t027 and t033, but need a semantic union. | **Hold.** |
| **t034** `task/t034-post-action-readiness` | DS only: 1 commit, the plan doc (62 lines) and README. No code. A flat worktree on shared Core `F:\fxwork\!FluxIQ` (`2d3e69a`). | Nothing yet. | Its premise, the 8.165 s one-shot snapshot-readiness reuse (`noteSnapshotReadiness`), exists **only on t027** (`258fbbf`). `dev` and t034 have none. It will edit the same `action-runner.ts` and `automation-tab.ts`. | Clean. | vs dev: clean. vs t027/t029: README only. | **Hold** until t027 lands, then merge `dev` into it and dispatch. |

### t027 x t033 conflict inventory (merge-tree)

- Core, 18 conflicting files: `api/contracts/adaptation.ts`,
  `api/handlers/llm-generation.ts`, `runtime/flow-bootstrap/generation-failure.ts`
  and its test, `runtime/llm/deepseek-provider.ts`,
  `runtime/llm/evidence-batch/{decision,index,packet,run,schema,stop}.ts`
  (add/add), `runtime/llm/evidence-loop.ts`,
  `harness/{provider-result,structured-response}.ts`,
  `tests/evidence-loop-provider.test.ts`,
  `loop-limits/flow-bootstrap-evidence-loop.ts`, `runtime/service.ts`, and
  `tests/service-bootstrap/tests/generation.test.ts`.
- Downstream, 4 conflicting files: `docs/working/README.md`,
  `packages/test-runner/src/commands.ts`,
  `flow-lane/creation/build-proposal.ts` and its test.
- **Clean auto-merges that are semantically wrong.** git merges these without
  complaint, but the result would keep **two** max-action control routes and
  the old telemetry. These must be fixed by hand even though git reports no
  conflict:
  - DS `cli.ts`: t027 threads `llmMaxActionsPerDecision` into
    `beginLiveLlmRun`; t033 threads it into `runScenario`.
  - DS `flow-lane/creation/lane.ts`: t027 has `authorizeBuild` return
    `maxActionsPerDecision`; t033 uses a lane input.
  - DS `existing-fluxiq-control.ts`: t027's `batchDecisions` parser would
    survive. Keep t027's `patchSkippedCode`/`llm.runtime_patch_not_requested`
    and t033's input type.
  - Core `loop-limits/evidence-loop.ts`: t027's
    `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_MAX_ACTIONS_PER_DECISION = 16`.
  - Core `harness/output-validation.ts` and `api/handlers/tests/llm-generation.test.ts`.
  - The integration map's authority lists apply to all of these: delete Core
    `runtime/llm/evidence-window.ts` and DS
    `apps/extension/e2e/content/tests/exploration-state/tests/multi-action-{exploration,safety}.spec.ts`,
    restore `live-llm/{live-llm-plan,live-llm-run}.ts` to the dev/t033 version,
    and regenerate README.

## Recommended integration order

0. **Commit what lives only in worktrees** (supervisor, on the task branches):
   - t027 DS: the latency audit report and its brief. t034 depends on it.
   - t033: the Core remediation, plus the DS doc and 3 reports.
   - t029: WIP in both repos. Drop or relocate `.tmp-w2-final-boundary-live.mjs`.

   Check: `git status --short` is empty in each of those worktrees.
1. **t033 first (paired)**:
   - Run the remediation rereview (brief `w2-multi-action-remediation-rereview`
     is already written).
   - Merge `dev` into both t033 branches. Downstream only needs a README
     regenerate; Core is already current.
   - Run the live A/B: `social-scheduler` / `social-scheduler-schedule-post`,
     seed 171, arms `1` then `16` from fresh isolated state. Correct the $2
     grant to the intended $1 total.
   - Then run the focused Core set (evidence-batch contract, evidence-loop,
     runtime-exploration, permission, state-record) and the 58 DS test-runner
     tests, plus `pnpm --filter fluxiq check` and `build`.
   - Finish DS, then Core.

   **Narrowest check after the merge:**
   `git diff task/t033-multi-action-reconcile dev -- . ':!docs'` is empty in
   both repos. The merge is tree-equal to the tested branch, so nothing else
   needs to run.
2. **t027 second (paired)**:
   - Merge the updated `dev` into both t027 branches and resolve using the
     inventory above.
   - Verify the integration map's negative and positive inventories. There
     must be no `evidence-window.ts`, no `batchDecisions` builder or parser, no
     default of 16, and no Lab control in `live-llm-plan`/`run`.
   - Then prove it live first:
     - one `panel:golden` creation run on the reconciled pair. This is
       required because all earlier creation proofs ran on the default-16 Core.
     - one replay of the saved 4-action Flow, confirming about 8.2 s, 4/4, and
       the oracle.
   - Then the focused tests:
     - Core: generation-failure, llm-generation handler, service-bootstrap
       generation, blank-flow-authoring, `lib/fluxiq`, action-permissions
       client, recovery annotate/stages.
     - DS: `automation-tab`, `action-runner`, `target/candidates`, llm-evidence
       tools, test-runner build-proposal, existing-fluxiq-control, commands,
       browser-session.
   - Run `pnpm check`, `pnpm test`, and `pnpm build` once, then finish DS,
     then Core, and push both.

   **Narrowest check after the merge:** product-path tree equality with the
   tested branch, as in step 1.
3. **t034 third**: merge `dev` into it (README only), then dispatch its
   live-first brief `w2-post-action-readiness-live`. **Check:** its own saved
   4-action A/B against the ~8.2 s control, plus the
   `automation-tab`/`action-runner` focused tests and the extension build.
4. **t029 last**, after its three rereview blockers close:
   - Merge `dev`. Union `action-runner.ts` with t027's readiness note and any
     t034 change. Semantically union Core `output-validation.ts`,
     `deepseek-provider.ts`, and `service.ts` with t033.
   - **Check:** rerun the two-node Chromium 151 oracle first. Then the focused
     68 Core and 11 extension tests, the domain registry and manifest tests,
     and `pnpm check` (structure audit on the new file).
   - Model selection and Firefox stay declared gaps.

**Fallback if the t033 A/B fails.** The integration map's stop conditions would
also stall t027. Do not wait. Reconcile t027 against `dev` by restoring the dev
versions of every superseded first-generation batch file, which keeps
production single-action exactly as it is on `dev`. Land t027's independent
work, and leave t033 held.

## Removal list

Each entry was checked read-only: HEAD is contained in `dev` or in the t027
branch, and no node or browser process is working inside it. That process check
and the `pnpm task prune --dry-run` run both found none.

**Closed tasks (`pnpm task abandon <id>`):**

| Task | Command | Condition |
| --- | --- | --- |
| t006, t007 (paired), t017 | `pnpm task abandon <id>` | Dry-run applied=false with no refusal. Clean. |
| t008, t011 | `pnpm task abandon <id>` | Clean. Each holds **ignored `test-runs/` evidence**: t008 has 70 entries, t011 10 (`campaigns`). Removal deletes them. Archive first if a ledger cites them. |
| t005 | `pnpm task abandon t005 --force` | Refused without `--force`. Downstream `4766b59` is not an ancestor of `dev`, but it landed as `97fb7da`; `git range-diff` shows only context differences. Core side merged and clean. |
| t021 | Archive or discard the Core diff first, then abandon | Dry-run passes, but **real abandon will refuse**: `F:\fxwork\t021\!FluxIQ` has 13 modified and 3 untracked files. That is the old uncommitted batch prototype, which t033 mapped and rejected. Abandon removes Core first and refuses on the dirty tree, so nothing is lost if it is run as-is. |
| Stray branch `week1-core-production-build` (DS) | `git branch -D` | 4 commits, all patch-equivalent in `dev` (`git cherry`: 0 unmerged). |

**`pnpm task prune`** (the dry-run output as observed): 9 orphaned Core
worktrees, `F:\fxwork\{t012,t016,t018,t020,t022,t024,t026,t028,t030}\!FluxIQ`.
All are clean and their HEADs are in Core `dev`. It also removes 138 scratch
directories totalling 1.05 GB (`.lab-instances`, `.test-build-scratch`).

**Keep:** `F:\fxwork\!FluxIQ` (the shared Core that t034 uses);
`F:\fxlab\lab-ext` and `F:\fxlab\!FluxIQ` (the canonical Lab pair; `lab-ext`
holds 166 MB of `test-runs`); and the t027, t029, t033, and t034 worktrees.

**fxlab worktrees** are not task-managed. Remove them with
`scripts/worktree/remove.mjs` `removeWorktree`, which refuses a dirty tree or a
running process. Never use `git worktree remove --force`. Live evidence for
t027 lives under `F:\fxlab-runs\`, not in these worktrees.

- **Clean and in `dev`, safe now:**
  - `F:\fxlab-147fdb4` (outside `F:\fxlab\`)
  - `F:\fxlab\fxlab-09fd9c7-a`, `fxlab-16ff729`, `fxlab-16ff729-b`,
    `fxlab-7263534`, `fxlab-7263534-load`, `fxlab-prod-core`
  - `F:\fxlab\lab-core` (Core `8409ca2`)
  - `F:\fxlab\t029-semantic-actionables\{!FluxIQWebExtension,!FluxIQ}`
- **Dirty, but only with disposable output:** `F:\fxlab\fxlab-16ff729-step4`
  has 10 files in the formerly tracked `apps/extension/build`. Discard, then
  remove.
- **Dirty with stale source experiments** from Sept 16-17, superseded by more
  than 100 `dev` commits:
  - `F:\fxlab\verify-ext`: 11 of 16 edited source files are identical to
    `dev`; the rest (and `target-equivalence.ts`) evolved in `2a5555c`.
  - `F:\fxlab\verify-core`: 5 of 10 identical to `dev`.

  Optionally archive the diffs, then discard and remove.
- **`F:\fxlab\t027-*`** (16 pairs, 32 worktrees; every HEAD is on t027). Remove
  them **after t027 integrates**:
  - Clean: extraction-exit, panel-load, reconnect, and stable-tab (both sides);
    baseline, storage, and unified-decision (DS); ranking, recording-panel,
    repair-reuse, runtime-trace, and host-timeout (Core).
  - Dirty, but every edit is identical to the t027 tip: batch-order,
    host-timeout, panel-unified, ranking, recording-panel, and repair-reuse
    (DS); baseline and repair-result (Core).
  - Dirty with edits that differ from the tip:
    - batching (DS 1 file, Core 4)
    - panel (DS 3, Core 5)
    - repair-result DS (`panel-run.ts`)
    - runtime-trace DS (`automation-tab.ts`)
    - storage Core (`fluxiq.ts`)
    - batch-order Core (`evidence-loop.ts`)
    - panel-unified Core (2)
    - **unified-decision Core** (`schema.ts`, `evidence-loop.ts`,
      `bootstrap-completion.ts`): the only copy of the failed unified
      one-or-many experiment. t033 supersedes it; archive the diff if it is
      wanted as reference.

## Commands run and observed results

- `git worktree list`, `git branch -a -vv`, `git rev-list --left-right --count`,
  `git log`, and `git diff --stat` in both repos. These gave the commit counts
  in the table. Downstream `dev` moved to `2b3484b` during the audit.
- `pnpm task list` returned 11 tasks. t027 is ahead 41 and behind 0; t029 ahead
  4 and behind 10 (11 after `2b3484b`); t033 ahead 2 and behind 0; t034 ahead 1
  and behind 0.
- `pnpm task prune --dry-run` returned `applied:false`, 138 directories,
  1,051,234,417 bytes, and 9 orphaned Core worktrees.
- `pnpm -s task abandon <id> --dry-run` for t005 through t021: t005 was refused
  with "1 commit(s) that never reached dev"; the other six passed.
- Downstream `git merge-tree --write-tree` against `dev`: t027 and t029 conflict
  on README only (exit 1); t033 and t034 are clean (exit 0). Pairwise: t027 x
  t033 conflicts on 4 files; every other pair conflicts on README only, or is
  clean (t033 x t034).
- Core `git merge-tree --write-tree` against `dev`: t027, t029, and t033 are all
  clean. t027 x t033 conflicts on 18 files; t027 x t029 and t029 x t033 are
  clean.
- `git merge-file` on scratch copies of t029's uncommitted files. A first run
  with line endings as they were reported 1-2 conflicts per file. The cause is
  CRLF in the working copies; after normalizing to LF the Core files show 0
  conflicts, and DS `action-runner.ts` shows 1 real hunk against t027.
- `git cherry`, `git merge-base --is-ancestor`, and `git range-diff` for the
  closed tasks and fxlab HEADs. Everything is contained, apart from t005 and
  the week1 branch, which are patch-equivalent.
- Get-NetTCPConnection on ports 3000 and 4711: not listening. The Win32_Process
  scan found no node or browser process in `fxwork` or `fxlab`.

## Not verified

- No build, test, or live run. Every "proven" entry cites the report's own
  claim and its named run or bundle; I did not open raw run bundles.
- The semantic correctness of any merge resolution. The auto-merge hazards
  above were found by reading the diffs, not by compiling the merged tree.
- The t033 remediation's 93/93 claim, and t029's 68/11 claims, were not rerun.
- Whether ignored `test-runs/` in t008 and t011 are cited by any ledger.
- Git stash contents: a hook blocks `git stash list` for workers.

## Open questions or contradictions found

1. The Current State says t029 "has a node-library gap audit and a planned
   privileged JavaScript node". In fact the node is **implemented, uncommitted,
   in both t029 worktrees**, proven live for the hand-authored path, and
   blocked by 3 rereview findings.
2. The Current State says t033 is "awaiting a live A/B". In fact integration
   review blocked it first. The remediation is uncommitted and not yet
   rereviewed, and the only live attempt used the wrong task and a $2 grant.
3. t034's premise and code base both depend on t027-only code
   (`noteSnapshotReadiness`, `258fbbf`). Its required read,
   `w2-mvp-latency-critical-path-audit.md`, is uncommitted in the t027 worktree.
4. `bootstrap-no-proposal-investigation.md` says the manual panel "is running
   ... at `http://127.0.0.1:3000`". At audit time neither 3000 nor 4711 was
   listening.
5. `pnpm task abandon --dry-run` does not decide the dirty-worktree refusal: it
   returns before `removeWorktree`'s status check, so t021 passes the dry-run
   and would fail for real. The script's comment claims "decides every
   refusal".
6. `domain/src/runtime/llm-evidence/state-digest.ts:101` contains a literal NUL
   byte (`const FIELD = "<NUL>"`), so git treats the file as binary. Diffs are
   hidden and concurrent edits cannot be merged textually; t027 edits it. Using
   the `"\u0000"` escape would behave identically.
7. The integration map's stop conditions stall t027 if t033's variant fails. I
   recommend the fallback above; the decision belongs to the supervisor.
