# t297 Final Plan Draft Refresh

Status: Copy-ready report only
Evidence basis: t285, t289, t290, t293, and t295
Live boundary: **unchanged — run 2 is the latest accepted measurement and the pass streak is 0.**

This refresh supersedes t285's copy-ready state text. The authored-document/index and downstream
freshness blockers recorded there are closed. The two test-only Core reconciliations are focused-
green, but the complete final-tree Core root test and provider-free dry-run are still pending.

## `mvp-today-plan.md` Current State replacements

Keep the purpose, criteria table, both live-run sections, accounting, t217 correction, and run-2
evidence status unchanged. Replace the current `**Implemented.**` and `**Local validation.**`
paragraphs with:

```md
**Implemented locally after run 2.** Core now separates setup from provider-request provenance,
retains the exact run-owned grant only for private nested reauthoring, durably applies an approved
repair, continues that held grant against the applied binding, replays the selected Subflow without
a provider call, and recursively judges the replay. Public generation cannot retain the grant.
Closed post-apply failures preserve applied state without replay or raw error leakage.

**Final-tree local validation.** The production-focused Core set passed 135/135; Core check, build,
structure, privacy, retention, and export reviews passed. The two stale/flaky root-test expectations
were reconciled test-only: risk-only permissions passed 81/81 and deterministic post-entry timeout
coverage passed 51/51. All six downstream outputs are strictly fresh against their tracked inputs
and dependencies. The complete final-tree Core root `pnpm test` and provider-free dry-run remain
pending; no new live evidence or pass credit exists.
```

Replace `**Next.**` and `**Blockers.**` with:

```md
**Next.** Run the complete Core root test on the settled test tree and record its totals. Capture
final Core/downstream identity, repeat the one-Lab process/lock gate, and run the unchanged zero-
provider dry-run. If both gates pass, create the no-hindsight pending debug before any provider call
and repeat the default-profile live scenario. A pass begins the streak at one; another independent
pass is still required.

**Blockers.** No known production defect remains from run 2. Run-3 readiness is still closed by the
pending final Core root test and provider-free dry-run. The latest one-Lab observation was GO only
as a snapshot and must be repeated immediately before execution. The repaired path is not live-
proven: run 2 remains a failed product measurement and the consecutive-pass streak remains 0.
```

With the existing wrapping retained, this replacement stays well below the 150-line Current State
budget (approximately 75 lines; t285 projected 78 with its longer, now-obsolete blocker text).

Append this ledger entry before `Open Questions`:

```md
### 2026-09-26 — Run-2 repair implementation and pre-live local gates closed
- Agent: supervisor with t233–t297
- Changed: Core provenance, exact grant continuation, repair/replay wiring, test-only permission and deadline reconciliations, downstream rebuilt outputs, and evidence reports
- Why: Carry the correct run-2 refutation through durable repair and provider-free replay without widening authority, leaking raw failures, or mistaking local proof for live success.
- Validation: Core focused production set 135/135 plus check/build/reviews passed; permission reconciliation 81/81 and deadline reconciliation 51/51 passed; all six downstream outputs are strictly fresh; latest one-Lab snapshot found zero matching processes and no build lock. Final Core root test and provider-free dry-run remain pending.
- Outcome: Accepted
- Follow-up: close the root-test and dry-run slots below, then repeat the unchanged default-profile live scenario; run 2 remains latest and streak remains 0.
```

## `language-driven-flow-loop-plan.md` Current State replacement

Do not change sixteen attempts, eleven built Flows, five pre-Flow failures, the run table, run IDs,
accounting representations, or the statement that persistence/replay are not proven live. Replace
`**What is proven working, live, that this document once recorded as broken.**` through the current
`**Blockers:**` paragraph with:

```md
**What is proven working, live, that this document once recorded as broken.** Multi-node created
Flows can reach playback, exact extraction comparison, and model-backed self-judgement; run 2's
five-node Flow returned a measurable 12-of-13 result and the judge refuted it. Wrong-answer recovery
and reauthoring route, but no current run proves repair persistence or deterministic replay. The
full self-repair cycle remains unproven.

**What is implemented but not live-proven.** Core now retains only the exact run-owned grant for
nested reauthoring, applies the approved repair, continues the same grant against the applied
binding, replays without a provider call, and judges the replay. Production-focused validation
passed 135/135 plus check/build/reviews; test-only permission and deadline reconciliations passed
81/81 and 51/51. Six downstream outputs are fresh. None of this changes a live result or streak.

**The next action** is the complete Core root test, final tree identity, a repeated one-Lab gate,
and the unchanged zero-provider dry-run. If those pass, create the no-hindsight pending debug and
repeat `everything-store-plus-earbuds-under-50` under the default 26-call profile. Debug it before
another provider call. A pass starts the streak at one; leave the rung only after two consecutive
independent passes.

**Blockers:** the final Core root test and provider-free dry-run are pending. The latest one-Lab
snapshot was clear but is not a reservation. No repaired Flow, persistence, replay, or recursive
fourth judgement has been proved live; run 2 remains the latest failed measurement and the
consecutive-pass streak remains 0.
```

This replacement is no longer than t285's projected replacement and keeps Current State within the
150-line budget when its wrapping is preserved (approximately 147 lines).

Append this ledger entry before `Open Questions`:

```md
### 2026-09-26 — Run-2 repair is locally closed; the live loop remains at streak zero
- Agent: supervisor with t233 to t297
- Changed: Core repair/continuation/replay wiring, final test-only reconciliations, downstream fresh outputs, and pre-live evidence reports
- Why: Correct the Stage-6 reauthor failure without turning implementation and test proof into live success evidence.
- Validation: production-focused Core 135/135 plus check/build/reviews passed; permission matrix 81/81 and deadline matrix 51/51 passed; all six downstream outputs are fresh; latest one-Lab snapshot was clear. Complete Core root test and provider-free dry-run remain pending.
- Outcome: Accepted
- Follow-up: close those two gates, then repeat rung 1 under the unchanged default profile; run 2 remains latest and streak remains 0.
```

## Conditional slots — do not apply before observing the command

After the final Core root test, replace only the pending-root clause in each Current State. On pass:

```md
The complete final-tree Core root test passed <TOTAL>/<TOTAL> with <SKIPS> skip(s) in <DURATION>;
both reconciled files passed.
```

On failure, keep readiness closed and record only the observed command, exit status, failing file,
test title, and exact typed failure. Do not call the prior focused matrices invalid unless the root
failure actually contradicts them.

After the provider-free dry-run, replace only its pending clause. On pass:

```md
The unchanged provider-free dry-run passed with `status:"ready"`, `providerCallCount:0`,
`lane:"created-flow"`, and `target:"isolated"`; its scenario/workflow/task/oracle/replay facts
matched the reviewed command.
```

On failure, keep the live gate closed and record its exact status/fact mismatch. A dry-run pass is
readiness evidence only: it does not increment the live streak, prove a repaired Flow, or authorize
changing the 26-call profile. Repeat the one-Lab gate immediately before the live command even when
the earlier snapshot and dry-run were green.

## Truthfulness constraints

- Preserve run 2 as the latest accepted measurement and the consecutive-pass streak at 0.
- Do not claim live repair application, persistence, provider-free replay, or recursive judgement.
- Do not claim final Core root or dry-run success until their exact commands finish and are read.
- Treat t290 and t293 as test-only closure; they did not change production outputs or invalidate
  t289's six freshness comparisons.
- Treat t295's one-Lab GO as a timestamped snapshot, not a lock or authorization.
- Keep the machine's worktree-spawn limitation separate from product readiness.
