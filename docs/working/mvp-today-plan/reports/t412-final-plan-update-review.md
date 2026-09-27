# Report: t412-final-plan-update-review

## Outcome

**Done.** T409 is now GO, so neither active plan should retain a pending-Core or pending-output-
freshness claim. The minimal final reconciliation below keeps both plans `Active`, records the
provider-free correction honestly, appends one `Partial` ledger entry per plan, and leaves the final
candidate/staged-path review, integration, and fresh live authorization as remaining work.

## Exact minimal edits

### `mvp-today-plan.md`

Keep `Status: Active`. Replace only `Status detail`, the `**Next.**` paragraph, the final stale
closure sentence in `**Fix-first local evidence.**`, and `**Blockers.**` with the following text:

```markdown
Status detail: Run 4 remains the latest accepted failed product measurement and the pass streak remains 0. Its measured draft-input loss is corrected inside the unchanged 4,000-byte reservation; provider-free Core/downstream gates and corrected-order output freshness are green apart from the documented downstream worktree-fixture environment block. Final candidate review, integration, and a fresh no-hindsight authorization remain; no provider call is authorized.
```

```markdown
**Next.** The provider-free correction gates are green: the supervisor observed Core `pnpm check`
and downstream `pnpm -r check`, `pnpm test`, and `pnpm build` exit 0; worker evidence records Core
root test/build/docs/structure success and t409 records corrected-order output freshness and identity.
Downstream root `pnpm check` remains qualified only by the known task-fixture environment block:
89/120 passed and 31 `git worktree add` cases failed with `cannot spawn git: Exec format error`;
all non-worktree gates passed. Freeze the exact repositories, complete the final candidate/staged-
path sensitive-data and inclusion review, reconcile Current State, and make the integration decision.
Only after the exact identity, provider-free dry-run, no-hindsight Stage 1, 13-record oracle,
evidence/debug contract, and one-Lab machine predicate are frozen may the supervisor issue one fresh,
explicit, command-specific authorization. No provider call is authorized now.
```

Replace the final sentence `Broad integrated Core and downstream closure remains in progress.` with:

```markdown
Provider-free Core/downstream command gates and corrected-order output freshness are green, subject
to the documented downstream worktree-fixture environment block; final candidate review and
integration remain. This does not establish provider convergence.
```

```markdown
**Blockers.** Flow creation remains unreliable, and runs 3 and 4 leave runtime, exact answer,
judgement, repair persistence, zero-provider replay, recursive post-replay judgement, and terminal
revocation unmeasured. The draft-loss correction is provider-free validated and output-fresh but is
not integrated or live-proven. Final candidate/staged-path review and a fresh command-specific
authorization still precede any provider call.
```

### `language-driven-flow-loop-plan.md`

Keep `Status: Active`. Replace only `Status detail`, `**The next action**`, and `**Blockers:**` with:

```markdown
Status detail: Rung 1 remains active with a zero-pass streak and run 4 remains the latest accepted failed product measurement. Its measured draft-input loss is corrected inside the unchanged reservation; provider-free Core/downstream gates and corrected-order output freshness are green apart from the documented downstream worktree-fixture environment block. Final candidate review, integration, and a fresh no-hindsight authorization remain; no provider call is authorized.
```

```markdown
**The next action** remains provider-free. Core reproduces the 26-decision failure and an 11-decision
fixture-defined completion, and the unchanged-budget `step_rows_v1` correction retains all 7-22
bounded inputs through decision 26; this is not provider convergence. The supervisor observed Core
`pnpm check` and downstream `pnpm -r check`, `pnpm test`, and `pnpm build` exit 0; worker evidence
records Core root test/build/docs/structure success and t409 records corrected-order output freshness
and identity. Downstream root `pnpm check` remains qualified only by the known task-fixture block:
89/120 passed and 31 `git worktree add` cases failed with `cannot spawn git: Exec format error`;
all non-worktree gates passed. Freeze the repositories, complete final candidate/staged-path review,
reconcile Current State, and decide integration. Only after exact identity, dry-run, no-hindsight
Stage 1 and its 13-record oracle, the evidence/debug contract, and the one-Lab machine predicate are
frozen may the supervisor issue one fresh command-specific authorization. No unchanged run 5 or
provider call is authorized now.
```

```markdown
**Blockers:** Flow creation remains unreliable and run 4's later stages remain unmeasured. The
draft-loss correction is provider-free validated and output-fresh but is not integrated or live-
proven; final candidate/staged-path review and a fresh command-specific authorization still precede
any provider call. The bounded artifacts publish no terminal grant lifecycle property, and the
worktree-spawn limitation remains operational rather than product evidence.
```

## Copy-ready ledger entries

Append exactly one entry to each plan. These links are relative to the plans in `docs/working/`, not
relative to this report; this corrects the report-local `./tNNN...` paths in t410's draft.

### Entry for `mvp-today-plan.md`

```markdown
### 2026-09-27 — Run-4 packing correction reached provider-free closure
- Agent: supervisor with [t385](./mvp-today-plan/reports/t385-downstream-post-core-validation.md), [t395](./mvp-today-plan/reports/t395-core-timeout-stability-review.md), [t397](./mvp-today-plan/reports/t397-generated-reference-re-review.md), [t405](./mvp-today-plan/reports/t405-updated-docs-privacy-scan.md), [t406](./mvp-today-plan/reports/t406-core-baseline-final-audit.md), [t409](./mvp-today-plan/reports/t409-post-supervisor-build-freshness.md), and [t410](./mvp-today-plan/reports/t410-final-closure-synthesis.md)
- Changed: Lossless `step_rows_v1` packing, ownership-correct tests and local timeout budgets, generated references, and corrected-order downstream outputs.
- Why: Remove run 4's measured bounded-input loss without changing the 4,000-byte reservation or provider budgets, then prove the provider-free cross-repository correction before another live decision.
- Validation: Supervisor observed Core `pnpm check` and downstream `pnpm -r check`, `pnpm test`, and `pnpm build` exit 0 (847/847 domain, 832/832 extension, 571/571 Scenario Lab, 1,470/1,470 test-runner); linked workers observed Core root test 5,437 passed / 1 skip, root build/docs/structure green, and corrected-order freshness 6/6 with markers 12/12.
- Exception: Downstream root `pnpm check` exited 1 only at `pnpm task:test`: 89/120 passed and 31 `git worktree add` cases failed with `cannot spawn git: Exec format error`; all non-worktree gates passed.
- Outcome: Partial
- Follow-up: Complete final candidate/staged-path sensitive-data and inclusion review, reconcile/freeze identity, and decide integration; no provider call before a fresh no-hindsight command-specific authorization.
```

### Entry for `language-driven-flow-loop-plan.md`

```markdown
### 2026-09-27 — Run-4 fix-first correction reached provider-free closure
- Agent: supervisor with [t385](./mvp-today-plan/reports/t385-downstream-post-core-validation.md), [t395](./mvp-today-plan/reports/t395-core-timeout-stability-review.md), [t397](./mvp-today-plan/reports/t397-generated-reference-re-review.md), [t405](./mvp-today-plan/reports/t405-updated-docs-privacy-scan.md), [t406](./mvp-today-plan/reports/t406-core-baseline-final-audit.md), [t409](./mvp-today-plan/reports/t409-post-supervisor-build-freshness.md), and [t410](./mvp-today-plan/reports/t410-final-closure-synthesis.md)
- Changed: The unchanged-budget `step_rows_v1` correction retains every bounded fixture input through decision 26; Core/downstream provider-free gates and corrected-order output freshness are green.
- Why: Remove run 4's measured information loss before testing whether the same default profile can converge; fixture completion is not provider convergence.
- Validation: Supervisor observed Core `pnpm check` and downstream `pnpm -r check`, `pnpm test`, and `pnpm build` exit 0; linked workers observed Core root test 5,437 passed / 1 skip, root build/docs/structure green, and corrected-order freshness 6/6 with markers 12/12.
- Exception: Downstream root `pnpm check` exited 1 only at `pnpm task:test`: 89/120 passed and 31 `git worktree add` cases failed with `cannot spawn git: Exec format error`; all non-worktree gates passed.
- Outcome: Partial
- Follow-up: Run 4 remains latest and the streak remains 0; complete final candidate review/integration and all frozen no-hindsight gates before any fresh command-specific authorization.
```

`Outcome: Partial` is required: t409 closes freshness, not final candidate review, integration, or
live proof. Do not reuse t401's stale pending-Core/downstream follow-ups or t410's `t409 pending`
agent wording.

## README regeneration and limits

Because both headers, Current State text, and total line counts change, regenerate the derived index
after both plans settle:

```text
pnpm structure:baseline --rule working-docs
pnpm structure:check --rule working-docs
```

Inspect that the two README rows remain `Active`, retain paired value `none`, link to the right plans,
and show the newly observed line counts. Record the actual check output; do not copy a prior result.

The proposed Current State replacements remain comfortably below 150 lines: MVP starts from 119 and
language-loop from 125, and neither replacement approaches a 25-line increase. Each ledger entry is
8 physical lines (heading plus seven bullets), leaving 11/20 and 7/20 entries respectively. Even
with conservative blank-line additions, the plans remain far below 800 lines (currently 310 and
706). No compaction is triggered.

## Commands run and observed results

- Read-only inspection confirmed current sizes of 310/706 lines, Current State sizes of 119/125,
  and ledger counts of 10/6 for MVP/language-loop.
- Read-only inspection confirmed t409's GO: seven corrected-order builds exited 0, freshness passed
  6/6, markers passed 12/12, manifest bytes matched, and intended Core runtime identities matched.
- No source/shared-plan edit, index regeneration, structure check, test, build, provider, browser,
  Lab, panel, live, stage, commit, finish, or push was performed. This report is the only edit.

## Not verified

The final candidate/staged-path sensitive-data and inclusion review, integration/finish readiness,
and every future no-hindsight/live gate remain unverified here. Supervisor observation remains
required before the plan edits and ledger entries are accepted as repository truth.
