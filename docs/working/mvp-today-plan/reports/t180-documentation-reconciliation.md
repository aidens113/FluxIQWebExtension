# Report: t180-documentation-reconciliation

## Outcome

Done. The smallest accurate reconciliation keeps the document `Active`, replaces the
stale dispatch/build-gate paragraphs in `Current State`, and adds two compact ledger
entries. The code and focused-test state has advanced; the four MVP criteria must not
be upgraded from their last live evidence because no report through t177 includes a
provider-backed Lab run.

## What changed and why

Only this report was added. The supervisor should apply the following reconciliation
to the shared document after independently checking the integrated tree.

### Header

Keep `Status: Active`. Replace `Status detail` with:

> The defensive runtime, risk-only permission boundary, and structured judge-to-repair
> path are integrated and focused-tested; combined release gates and the first live hard
> scenario measurement remain, so deterministic replay and live self-repair are still
> unproven.

### Current State replacement facts

Retain the four-criterion table's evidence states, with these exact clarifications:

- **Created from language — Works, repeatedly in the last live evidence.** No t163-t177
  report performed another provider call, so do not claim a newer live success.
- **Runs deterministically — Unproven live.** Core and browser defensive defaults now
  exist and are focused-tested, including bounded transient retry, non-retryable
  permission refusal, post-backoff deadline enforcement, and partial extraction. The
  hard scenario has not exercised them.
- **Repairs itself — Route open and strengthened, not live-proven.** Non-risk grant
  gates are removed on the named lane, structured screened judge instructions survive
  the bounded failure prose and reach recovery, and stale auto-repair/rerun assertions
  are reconciled. No report observed a provider-backed repair after these changes.
- **Judges its own answer — Last live evidence still says it refutes wrong answers.**
  The judge now receives screened Flow parameters, conversation and action counts and
  emits bounded structured fix advice; only tests, not a live judgement, verify the new
  directive path.

Replace the stale **Dispatched for these** paragraph with:

> **Implemented and reconciled.** t163 identified the retry and recovery gaps. t164-t169
> added the structured judge directive, Core-wide defensive execution, provider retry,
> browser-side recovery, and the risk-only permission boundary. t173 then found three
> integration defects: grant-aware provider retry, a post-deadline browser dispatch, and
> lossy judge advice. t170 and t171 closed all three with focused tests. t175-t177 found
> the remaining stable failures were stale fixtures/assertions rather than production
> regressions; no production change was needed for those three reconciliations.

Replace **The one thing standing between the tree and a measurement** with:

> **What remains before measurement.** Focused Core, domain, extension, contract and
> runner suites are green, and the domain and extension bundles were rebuilt. This is
> not combined release validation: Core was not built by t170, repository-wide gates
> were not run cleanly, and the isolated live lane still requires the full build/preflight
> sequence. After those gates, run `everything-store-plus-earbuds-under-50` twice and
> retain per-run debug evidence. No report through t177 ran a browser, provider, or Lab.

Replace **Blockers: none** with:

> **Known gates, not yet product-behavior blockers.** Core's structure audit still
> reports three violations (the 26-file `runtime/llm/tests` directory and two DeepSeek
> dependency-boundary imports), and downstream `pnpm structure:check` also reports the
> shared working-document index out of date. These and the combined build/check results
> need supervisor disposition before release. t174 statically proved the two residual
> grant-lifecycle inconsistencies do not block this exact live lane, but broader callers
> can still reach them. The machine-specific worktree and Core retry-on-RAM-fault notes
> remain unchanged.

Add a short scoped-evidence paragraph (or fold it into the preceding text):

> **Scoped validation evidence.** t170 recorded Core `tsc` passing and 55 files / 769
> focused tests passing; its structure audit failed with three violations. t171 recorded
> domain and extension checks passing, 847 domain tests and 832 extension tests passing,
> and both packages building. t172 recorded 145 contract tests, 1,462 runner tests and a
> provider-free readiness dry run passing. t175 recorded 10 representation and 62
> executor tests passing; t176 recorded 22 repair tests passing; t177 repeated all 847
> domain tests plus 14 focused extraction tests passing. These are worker-scoped results,
> not a substitute for the supervisor's combined validation or live measurement.

### Ledger bullets to append now

These entries intentionally remain `Partial`: under the protocol, report claims are not
supervisor verification, and the combined gates/live run are still pending.

```markdown
### 2026-09-26 — Defensive, judge, and permission changes integrated
- Agent: supervisor coordinating t163-t171 and t173
- Changed: Core executor/provider retry/result verification/grants; downstream browser recovery and extraction
- Why: apply the defensive-by-default, risk-only grant, and actionable-judge rules and close all three integration-review findings
- Validation: not validated by the supervisor yet — worker-scoped focused results are summarized in `Current State`; combined Core/downstream gates remain
- Outcome: Partial
- Follow-up: resolve the reported structure gates, build Core, and run the combined release checks

### 2026-09-26 — Live lane prepared and stable regressions reconciled
- Agent: supervisor coordinating t172 and t174-t177
- Changed: Lab readiness report; Core/domain test fixtures and assertions only
- Why: prove the named lane's static grant path, prepare its isolated invocation, and reconcile five stable failures without weakening refusal boundaries
- Validation: not validated by the supervisor yet — t172 recorded provider-free readiness; t175-t177 recorded focused green suites; no browser/provider/Lab run occurred
- Outcome: Partial
- Follow-up: complete preflight, run `everything-store-plus-earbuds-under-50` twice, and record both measured outcomes
```

After the supervisor actually observes the combined commands, append a separate
`Accepted` or `Blocked` ledger entry with those exact command results. Do not rewrite
either historical `Partial` outcome.

## Commands run and observed results

- Read `docs/working/mvp-today-plan.md` in full.
- Read the working-document protocol's controlled status vocabulary, authoritative
  `Current State`, ledger, and worker-report rules.
- Read the conclusions and validation/not-verified sections of t163-t177.
- `git status --short -- docs/working/mvp-today-plan/reports/t180-documentation-reconciliation.md docs/working/mvp-today-plan.md docs/working/README.md` showed the two shared documents were already modified and this report did not yet exist.
- No test, build, Core mutation, Lab run, commit, or push was performed, as assigned.

## Not verified

- I did not independently rerun any worker command; all numeric scoped results above are
  transcribed from completed reports and are explicitly labelled as such.
- No live behavior is inferred from unit tests, compilation, builds, or the readiness
  dry run.
- I did not inspect t178-t179 because the brief ends at t177; their conclusions should be
  reconciled separately if they complete before the supervisor edits the shared document.

## Open questions or contradictions found

- The existing `Current State` says the rebuild is the sole gate and `Blockers: none`.
  The completed reports now show additional unresolved structure/repository-gate results,
  so those statements are stale even though no live product defect is presently proven.
- t174 says two grant lifecycle inconsistencies remain reachable for broader callers but
  not for this exact scenario. They should stay visible without being mislabeled as a
  blocker to the pending measurement.
