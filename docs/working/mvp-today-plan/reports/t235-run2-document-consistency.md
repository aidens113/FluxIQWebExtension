# t235 — Run 2 document consistency audit

## Outcome

The run-2 facts are mostly consistent across the finalized debug and both plans: pass streak 0; Stage 6 entered but not settled; a reviewed five-node Flow; 12 observed of 13 expected; model-backed refutation; recovery routed but no repair adaptation, persistence, or replay; overlapping accounting representations kept separate; and t217's terminal final-exhaustion behavior not measured live.

Seven corrections remain:

1. `mvp-today-plan.md` still says in its header that run 2 is “ready,” although run 2 is complete.
2. Both Current State blocker paragraphs call the repair defect a blocker while the documents correctly remain `Status: Active`. Under the protocol, `Blocked` means work cannot proceed; here the next fix is known and work can proceed.
3. `language-driven-flow-loop-plan.md` Current State is exactly 150 lines, while the protocol requires **under** 150.
4. That Current State still says rung 1 has 14 attempts / 10 built / 4 pre-Flow stops; run 1 and run 2 make the current counts 16 / 11 / 5.
5. Both new run-2 ledger entries use `Accepted measurement; failed product verdict...`, which is not one of the four controlled Outcome values.
6. The run-2 debug still contains three t229 placeholders even though t229 is complete, and its Stage 4 heading says “replay” for the initial playback.
7. The debug repeats the artifact's `providerInvocation: attempted` as a proved provider call. T229 shows the service enters the broad `provider_request` classification window before the actual harness invocation, so the stored flag is accurately reported but does not prove bytes reached a provider.

## Check matrix

| Check | Result | Notes |
| --- | --- | --- |
| Consecutive-pass streak | Pass | Debug and both Current States/ledgers say 0; a future pass starts at 1. |
| Stage 6 wording | Pass with one precision edit | All say Stage 6 was reached/entered but recovery did not settle. No document awards repair/persistence/replay credit. |
| Five-node / 12-of-13 / refuted | Pass | Facts agree throughout. |
| Accounting overlap | Pass | Build/main is one 19-call representation; repair/verification is one two-call representation; evaluation is a 21-call roll-up; no combined token/cost total is invented. |
| t217 nuance | Pass | Intermediate unusable decisions were exercised; the terminal last-iteration exhaustion path was not. |
| Status | Pass | Both controlled header values are `Active`, which matches actionable queued work. |
| Blocker prose | Fail | Product defect is incorrectly labelled a blocker despite no inability to proceed. |
| MVP Current State size | Pass | 62 lines. |
| Operating-loop Current State size | Fail | 150 lines; must be 149 or fewer. |
| Run-2 ledger Outcome vocabulary | Fail | Must be exactly `Accepted`, `Partial`, `Reverted`, or `Blocked`. |
| Debug placeholders | Fail | `t229 follow-up`, `pending t229 source trace`, and `follow-up after t229` are stale. |
| Debug completion | Otherwise pass | Every stage is filled or explicitly bounded with `NO EVIDENCE:`; no TODO/TBD/template blank remains. |

## Copy-ready corrections — `mvp-today-plan.md`

### Header

Replace `Status detail` with:

```md
Status detail: Run 2 is an accepted failed product measurement that reached Stage 6; t229 isolated an over-broad reauthor request-classification boundary, and the next work is its narrow fix and a repeat default-profile run. The pass streak remains 0.
```

### Current State

Replace `Next` and `Blockers` with:

```md
**Next.** Narrow Core's reauthor request boundary so pre-request setup failures cannot claim a provider invocation, add the real-grant service regression, then repeat the same default-profile scenario. A pass begins the streak at one; another independent pass is still required. Do not award pass credit to run 2, combine overlapping accounting representations, or claim t217's terminal exhaustion behavior was measured.

**Blockers.** None. The active product defect is that wrong-answer recovery currently ends before producing a repair adaptation, so persistence and replay cannot begin; t229 identified the diagnostic-boundary fix that can proceed now.
```

In the Live run 2 paragraph, replace the provider-stage sentence with the more precise version:

```md
Recovery and result reauthoring routed, but the stored failure was `flow_bootstrap.unexpected_error` under the service's broad `provider_request` classification window before an adaptation, persistence result, or replay was published. T229 found that this window begins before the actual harness call, so the record does not independently prove a provider request was sent.
```

### Run-2 ledger entry

Replace:

```md
- Outcome: Accepted measurement; failed product verdict. Consecutive-pass streak remains 0.
```

with the controlled value:

```md
- Outcome: Accepted
```

The title, Validation, and Follow-up already retain the failed product verdict and zero streak. Do not append nuance to the Outcome value.

The current Validation line does not contain the exact command required by the protocol. If the supervisor has an independently observed integrity command, insert that exact command and result. If no such command was recorded, the protocol-safe replacement is:

```md
- Validation: not validated by a supervisor command recorded in this entry; t226–t228 contain the bounded artifact-check results used to draft the accepted measurement.
```

This audit cannot supply an exact command from the permitted documents without inventing one.

## Copy-ready corrections — `language-driven-flow-loop-plan.md`

### Current attempt count and line limit

Replace Current State lines beginning at `Where rung 1 actually is` through the paragraph ending with the no-lane run with this compact block:

```md
**Where rung 1 actually is.** `everything-store-plus-earbuds-under-50` has been attempted **sixteen times** since 2026-09-25 19:35 and has not passed; it is not left until it passes twice in a row. Eleven attempts built a Flow. Five stopped before a Flow: `run-muhp2yip-3a0f198b` on a stale domain build; `run-muhs8hx3-6fd929e6` and `run-muhtuizo-c458e49c` on an untyped provider-request failure whose exact throw remained unknown; `run-muhru6ny-a84eb4a2` without a lane record; and run 1, `run-muj2kzx1-8f9f8271`, after Stage 2 exploration without a proposal. Run 2 is the latest built result and is recorded below. The consecutive-pass streak remains 0.
```

This both corrects 14/10/4 to 16/11/5 and reduces the Current State well below 150 lines. After all edits, re-count from `## Current State` through the line before the next H2; the result must be 149 or fewer.

### Next and blocker wording

Replace:

```md
**The next action** is to narrow Core's reauthor request boundary, add the real-grant service regression, and then repeat `everything-store-plus-earbuds-under-50` under the same default 26-call profile. Debug the run before another provider call. The next pass starts the streak at one; the rung is left only after two consecutive independent passes.

**Blockers:** none. The active product defect is wrong-answer recovery ending before repair adaptation, persistence, and replay; t229 identified a diagnostic-boundary fix that can proceed. The worktree spawn limitation remains operational rather than product evidence.
```

### Ledger Outcome vocabulary

For the run-2 entry, replace:

```md
- Outcome: Accepted measurement; failed product verdict. Rung-1 consecutive-pass streak remains 0.
```

with:

```md
- Outcome: Accepted
```

As in the MVP ledger, replace the Validation line with the exact independently observed supervisor command/result if available; otherwise use `not validated` rather than presenting worker reports as verification.

Two older operating-loop entries also decorate the controlled value. Apply these mechanical corrections when touching the ledger:

```md
- Outcome: Accepted
```

- Move `Superseded as a description of the present by the entry below.` to that entry's Follow-up.
- Leave `Rung 1 has not passed and is not left.` in the existing Follow-up for the four-run entry, not on Outcome.

The two older entries also exceed the protocol's under-15-line ledger-entry limit. Their detailed run bullets should move to the existing archive on the next ledger compaction, leaving compact Changed/Why/Validation/Outcome/Follow-up lines. The new run-2 entry itself is under the line limit.

## Copy-ready corrections — run-2 debug

### Stage 4 heading

Replace:

```md
## Stage 4 — replay
```

with:

```md
## Stage 4 — playback and defensive recovery
```

The requested deterministic replay belongs under Stage 6 and remains `NO EVIDENCE` because repair never produced an applied adaptation.

### Stage 6 provider-boundary precision

Replace the reauthor paragraph with:

```md
- Reauthor routing entered and produced no adaptation or applied change. The stored diagnostic was non-retryable `flow_bootstrap.unexpected_error` at `provider_request`, with `providerInvocation: attempted` and `providerResponse: unknown`. T229 found that the service sets this broad stage before build routing, setup, and the actual harness invocation, so those stored fields do not independently prove that provider bytes were sent. The exact throwing statement remains `NO EVIDENCE`.
```

### Causes table

Replace the three stale cause rows with:

```md
| 1 | The authored Flow's dataset failed the exact oracle: 12/13 records, one positional match, seven any-order matches, with five value-difference, six moved, and one missing-record mismatch | **NO EVIDENCE:** the sanitized bundle does not identify the owning parameter/source | Requires a separately scoped screened source trace; do not infer from raw page values | Unassigned |
| 2 | Wrong-answer reauthoring routed but produced no adaptation; an ordinary error escaped somewhere inside the service's broad request-stage window | Core `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`; the exact throwing statement remains **NO EVIDENCE** | Narrow the actual harness invocation boundary; do not add blind retry or a provider-specific special case | t233 |
| 3 | The broad stage window records `provider_request` / `attempted` before actual request execution, overstating what an unclassified setup error proves | Core `runtime/service.ts`, supported by `runtime/flow-bootstrap/generation-failure/{phase-failure,failure-state}.ts` | Classify pre-request setup as `not_attempted` / `not_received`, while preserving typed harness/provider failures | t233 |
| 4 | No applied repair means no persistence or deterministic replay evidence exists | Consequence of the reauthor failure; no repair-lane artifact | After the boundary fix, repeat the live run and require an applied, persisted repair plus zero-provider replay | next live run |
```

This removes all three t229 placeholders while preserving the crucial limit: t229 found the owning classification boundary, not the exact original throw.

### Final classification

No change is needed. It correctly says genuine product/scenario failure, no facility failure, no build-exhaustion failure, pass streak 0, and t217 terminal exhaustion unvalidated live.

## Protocol disposition

- Keep both documents `Status: Active`; neither is unable to proceed.
- Use `Blockers: none` and name the repair issue as an active product defect/exit gap.
- Use `Outcome: Accepted` for an accepted measurement even when the measured product verdict failed. Evidence acceptance and product success are separate facts.
- `NO EVIDENCE:` markers in the debug are completed evidence-limit statements, not placeholders.
- The only stale placeholders are the three t229 references in the Causes table.

## Files inspected and validation

Inspected only the finalized run-2 debug, the two plans' headers/Current State/ledger, t226–t231, and the working-document protocol's Current State/header/ledger/compaction rules. No run artifact, source file, live system, browser, or provider was inspected or changed.
