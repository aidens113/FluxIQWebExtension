# Report: r-week1-doc-truth

## Outcome

Prepared paste-ready corrections for both Week 1 `Current State` sections and
conditional post-remediation ledger blocks. These edits distinguish the pushed
baseline from work currently under remediation and do not claim that a future
gate, mutation, Lab proof, bench, comparison, or ranking has passed.

No shared working document, source, Core file, generated/runtime data, commit,
or remote was changed.

## Downstream paste-ready replacements

### Replace the `**True on 2026-09-13.**` repository/gate bullets

```markdown
**Repository state at remediation intake on 2026-09-13.**
- **This repository:** `146cdbf`, equal to `origin/dev` before remediation
  began. The repository-state audit is pushed; remediation changes and their
  validation must be recorded separately before they are accepted.
- **Core:** `3d1a4a`, equal to `origin/dev`; `fluxiq` **0.4.0**, with the last
  Core code build at `e5c9828`.
- **Established gates:** Core's full sequential suite, build and package lint
  passed at `e5c9828`. Downstream root gates passed for the source at `4fe671e`,
  and the repository-state audit recorded a later clean `pnpm check`. These
  historical results do not validate the remediation now in progress.
```

### Replace `**In flight:**` and `**Queued, in dependency order**`

```markdown
**In flight:**
- The repository-state audit identified three pre-Stage-4 repairs. The wait
  bounds/diagnostics and cleanup-failure precedence are assigned together; the
  durable six-criterion comparison tool is assigned independently. Their
  implementation and supervisor verification are not yet ledgered as accepted.
- No Lab proof, final bench, comparison, or ranking run is in progress.

**Queued, in dependency order**
1. Integrate the two remediation workstreams, independently rerun their focused
   tests and mutation proofs, then run the required package/root gates.
2. Correct the paired Week 1 Current States and push coherent, verified `dev`
   heads together when both repositories change.
3. **Lab Stage 4:** run `l-final-proofs` alone at the pushed remediation pins;
   only after it passes, run the two complete `--repeat 3` benches at those
   same pins, concurrently only within the documented RAM limit.
4. **Phase 1.6b:** run the tracked comparison, complete `i-ranking-draft`, and
   write the six observed exit-criterion figures into the ledger.
```

### Replace the `Bench repeatable` exit-criterion row

```markdown
| Bench repeatable | Earlier Stage 3 load attempts exposed the wait-bound and pairing-diagnostic defects; no final bench is running and no complete A/B comparison is accepted | Two complete `--repeat 3` benches at the pushed remediation pins, followed by every Metrics tolerance and discard diagnostic through the tracked comparison tool |
```

Retain the existing `Everything is tested: the operating rules` section,
especially the three-tier/mutation rule, supervisor rerun requirement, private
build labels, sequential Core command, faulty-RAM rerun rule, and heavy-gates-
one-at-a-time rule. None is stale.

## Core paste-ready replacements

### Replace `**True on 2026-09-13.**` through the existing commit list intro

```markdown
**Repository state at remediation intake on 2026-09-13.**
- **Branch:** `dev` at `3d1a4a`, equal to `origin/dev`. The last Core code
  commit remains `e5c9828`; later commits record working-document state.
- **Versions:** `fluxiq` is **0.4.0**. `@fluxiq/contracts` (0.2.0) and
  `@fluxiq/client-gateway-websocket` (0.1.0) are unchanged.
- **The fifteen Week 1 code commits, ending at `e5c9828`:**
```

Keep the existing fifteen-item commit list and its Migration Notes paragraph
after that replacement.

### Replace Core `**Next steps:**`

```markdown
**Next steps:** Core has no pre-Stage-4 code remediation assigned in this work
unit. Keep `dev` paired with the downstream pin, preserve the documented Core
defects for later ranking/hardening, and run any newly required Core validation
sequentially because parallel native-SQLite workers are unsound on this machine.
The downstream sequence is: verified remediation and paired-document truth,
`l-final-proofs` alone, the two complete repeat-three benches, then tracked
comparison and ranking.
```

Retain the Core `Open for Core` statement that node-definition proposal
approval drops `expectedState`. The Core audit worker proposed removing it, but
the supervisor rejected that conclusion: the Flow approval path retains the
field while `recordingCandidateDefinition` / `materializeRecordingNode` still
drop it.

## Conditional post-remediation ledger blocks

These blocks are paste-ready templates, not present-tense completion claims.
Paste them only after replacing every bracketed field with an observed result.
If any check fails, record that failure instead of using `Outcome: Accepted`.

### Downstream Week 1 ledger

```markdown
### 2026-09-13 — Pre-Stage-4 runner and comparison remediation
- Agent: supervisor with workers `r-wait-and-cleanup`, `r-bench-comparison`, and `r-week1-doc-truth`
- Changed: [exact source, test, architecture, and paired Current State files]
- Why: Remove the load-bound/diagnostic blocker, preserve primary failures across cleanup, make the six-criterion comparison durable, and restore authoritative paired state before Stage 4.
- Validation: [focused tests and counts]; [each mutation and the expected failing test]; test-runner `pnpm check` -> [result]; CLI help/usage probe -> [result]; `pnpm structure:check` -> [result]; root `pnpm check`, `pnpm test`, and `pnpm build` -> [results, run one heavy gate at a time].
- Outcome: Accepted
- Follow-up: Push the coherent remediation pin, run `l-final-proofs` alone, then run the complete repeat-three bench pair at that same pin; comparison and ranking follow the benches.
```

### Core Week 1 ledger

Use this only if the supervisor changes the Core Week 1 document in the same
work unit; it records documentation truth, not a Core code fix.

```markdown
### 2026-09-13 — Paired Week 1 repository truth corrected
- Agent: supervisor, informed by `r-week1-doc-truth`
- Changed: `docs/working/mvp-week1-web-automation-reliability-plan.md` and generated working-document index if required
- Why: Replace the stale unpushed-branch and push-next claims while preserving the verified Core code/gate history, deferred defects, and sequential-validation rule.
- Validation: `git rev-parse HEAD` and `git rev-parse origin/dev` -> [observed paired commit state]; `pnpm structure:check --rule working-docs` -> [result]. No Core source changed and no new Core runtime/test claim is made by this entry.
- Outcome: Accepted
- Follow-up: Keep the Core pin paired with the downstream Stage 4 campaign; retain broader Core defects for ranking/hardening.
```

## Evidence cross-check

| Proposed claim | Evidence |
| --- | --- |
| Downstream baseline was pushed and aligned before remediation | Git: `HEAD == origin/dev == 146cdbf7e2577fcf542218ad24ffef3fc24b449e`; intake/current changes are remediation working-document paths. |
| Core baseline is pushed and aligned | Git: `HEAD == origin/dev == 3d1a4a232f3b8a4ab2bfe69ffc40ffcd329e465d`; Core worktree was clean. |
| Current remediation has not yet earned acceptance | Parent audit `Current State`: remediation is in progress and integration/supervisor verification is next. |
| No final Week 1 criterion is yet proven | `audit-integration.md`, P0 “The Week 1 result remains unverified by its own definition”; downstream Week 1 objective and exit table require real Lab observations. |
| Wait/diagnostic and cleanup fixes precede Stage 4 | `audit-downstream.md`, findings 1–4; parent audit `Confirmed before Stage 4`; remediation brief `r-wait-and-cleanup`. |
| Durable comparison follows the proof/bench runs | `audit-integration.md`, comparison-tool P1; remediation brief `r-bench-comparison`; downstream Current State dependency order. |
| The prior “partial uncommitted edits” claim is stale | `audit-downstream.md` contradiction and `audit-integration.md` stale-state P1; intake Git tree contained no such source edits. |
| The “benches are running” row is stale | Downstream Current State simultaneously says the session wrapped and nothing is running; `audit-integration.md` says the two complete final benches are absent. |
| Core's last code commit and historical gates remain valid | Core Current State records `e5c9828` as last code commit and the full sequential suite/build/package lint there; `audit-integration.md` confirms no later Core code and fresh declarations. |
| Node-definition `expectedState` remains open | Parent audit `Documentation truth` records supervisor rejection of the Core worker's contrary claim and distinguishes Flow approval from node-definition materialization. |
| Faulty-RAM rules must remain | Both Week 1 Current States require sequential Core tests, rerunning rare/impossible failures alone, and heavy gates one at a time. |

## Remaining inconsistencies and unknowns

- The exact remediation commit, changed-file list, test counts, mutation results,
  and full-gate results do not exist yet in the allowed evidence. They must be
  observed by the supervisor and substituted into the ledger template.
- The downstream heading “Phase: fixing what the Lab rerun found” remains true
  during remediation. After acceptance it should change to “Phase: Stage 4 final
  proofs” only when the remediation pin is pushed and `l-final-proofs` is
  actually next; it must not imply that the proof run has started.
- Do not change any exit criterion to passed until its required live Lab quote
  is in the ledger. Unit, mutation, type, structure, build, and CLI checks prove
  the repair, not the Week 1 product criterion.
- The broader Core result-persistence, unbound-input copy, default-storage, and
  `failureRoute` issues remain open/deferred exactly as the paired audit records;
  this documentation repair does not resolve or reclassify them.

## Validation performed

- Read only the assigned remediation brief, parent audit Current State, both
  Week 1 Current States, the three named audit reports, and Git heads/status.
- Cross-checked every proposed factual statement against those sources.
- Did not run product tests, Lab commands, builds, mutations, or browser work;
  this task changes documentation evidence only.
