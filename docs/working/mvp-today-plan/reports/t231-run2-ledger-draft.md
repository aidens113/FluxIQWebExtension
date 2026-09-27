# t231 — Run 2 Current State and ledger draft

These are copy-ready deltas only. They do not edit either shared plan. Run 2 is an accepted measurement with a failed product verdict; it does not advance the consecutive-pass streak.

## `mvp-today-plan.md` — Current State delta

Replace the four-row MVP-criterion table with:

```md
| MVP criterion | Current evidence | Still required |
| --- | --- | --- |
| Created from language | Run 2 built and reviewed a five-node Flow: two navigation, two click, and one list-extraction node. | A faithful Flow that returns the exact expected dataset under the default profile. |
| Runs deterministically | Run 2 executed the created Flow through extraction and judgement, but no post-repair replay was published. | Provider-free replay with the exact expected dataset. |
| Repairs itself | Run 2 routed wrong-answer recovery and reauthoring, but reauthoring failed at `provider_request` with `flow_bootstrap.unexpected_error` before any repair adaptation, persistence, or replay. | A repair that is created, applied, persisted, and proven by successful deterministic replay. |
| Judges its own answer | Run 2's model-backed judge correctly refuted a 12-of-13 result as `core.result.does_not_answer_request`. | Preserve the refutation through a successful directed repair and replay. |
```

Insert after the existing live-run-1 paragraph:

```md
**Live run 2.** `run-muj39xl6-f6a5d4e5` is an accepted measurement with a failed product verdict. It reached Stage 6: the build proposed and reviewed a five-node Flow, playback reached extraction, the oracle measured 12 observed records against 13 expected, and the model-backed judge refuted the answer. Recovery and result reauthoring were routed, but reauthoring failed at `provider_request` with `flow_bootstrap.unexpected_error` before an adaptation, persistence result, or replay was published. The consecutive-pass streak remains 0.

**Run-2 accounting.** The evaluation roll-up records 21 calls. Build and main observation are the same 19-call bucket, with 239,801 input plus 3,705 output tokens, 243,506 total, and estimated USD 0.03085158; two of those calls lack per-call records. Repair observation and verification are the same two-call representation, with 5,930 input plus 733 output tokens, 6,663 total, and estimated USD 0.0017178. These overlapping representations are not additive, and the permitted artifacts publish no combined token/cost roll-up. The typed accounting reports zero budget breaches and zero pending calls.
```

Append to the existing `t217 correction` paragraph:

```md
Run 2 emitted two non-terminal `core.decision_unusable` decisions and later completed a proposal. It therefore exercised unusable classification but did not end in iteration exhaustion; t217's terminal final-exhaustion preservation remains unmeasured live.
```

Replace `Run-2 readiness`, `Next`, and `Blockers` with:

```md
**Run-2 evidence status.** The completion marker, artifact index, and bounded structured artifacts passed byte, digest, and redaction verification. The accepted measurement is a product failure, not a facility failure. It proves creation, runtime, extraction comparison, judgement, and recovery routing; it does not prove repair application, persistence, or deterministic replay.

**Next.** Diagnose and correct the reauthor `flow_bootstrap.unexpected_error` without broadening past the sanitized evidence boundary, then repeat the same default-profile hard scenario. A pass begins the consecutive-pass streak at one; one further independent default-profile pass is still required. Do not award pass credit to run 2, combine overlapping accounting buckets, or claim t217's terminal exhaustion behavior was measured.

**Blockers.** No facility or external blocker is recorded. The product blocker is that wrong-answer recovery fails before producing a repair adaptation, so persistence and replay cannot begin.
```

## `mvp-today-plan.md` — ledger delta

Append:

```md
### 2026-09-26 — Run 2 reached judgement and failed before repair application
- Agent: supervisor with t225–t231
- Changed: run-2 debug/evidence reports, this plan's Current State, and the operating-loop Current State
- Why: Measure the four MVP criteria on the same default-profile hard scenario after the run-1 build failure and t217 correction.
- Validation: `run-muj39xl6-f6a5d4e5` bundle integrity/redaction passed; the accepted measurement reached Stage 6 with a five-node Flow, 12 of 13 records, a refuted judgement, and recovery routed. Reauthoring failed at `provider_request` before adaptation, persistence, or replay. Evaluation records 21 calls; the 19-call build/main bucket and matching 2-call repair/verification representations remain separate and are not double-counted.
- Outcome: Accepted measurement; failed product verdict. Consecutive-pass streak remains 0.
- Follow-up: diagnose and fix `flow_bootstrap.unexpected_error`, then repeat the default-profile scenario. t217's terminal final-exhaustion behavior remains unmeasured live.
```

## `language-driven-flow-loop-plan.md` — Current State delta

Insert after the existing rung-1 history table, leaving the older table as historical evidence:

```md
**Latest accepted rung-1 measurement.** `run-muj39xl6-f6a5d4e5` reached Stage 6 and failed the product verdict. It built a reviewed five-node Flow, ran it, observed 12 of 13 expected records, and was correctly refuted by the model-backed judge. Wrong-answer recovery and result reauthoring routed, but reauthoring failed at `provider_request` with `flow_bootstrap.unexpected_error`; no repair adaptation, persistence result, or deterministic replay was published. This is progress in stage reach, not a pass. The rung-1 consecutive-pass streak remains 0, and the rung is not left.

The evaluation roll-up records 21 calls. The 19-call build/main-observation representation is one overlapping bucket (239,801 input, 3,705 output, 243,506 total, estimated USD 0.03085158), and its two missing per-call records remain explicitly unrecorded. The two-call repair-observation and verification records are another overlapping representation (5,930 input, 733 output, 6,663 total, estimated USD 0.0017178). Do not add either pair or invent a combined token/cost total.

Run 2 also emitted two `core.decision_unusable` decisions before continuing to a completed proposal. Because it did not terminate in iteration exhaustion, t217's final-exhaustion preservation fix remains unmeasured in a live run.
```

Replace the current `What is proven working, live` paragraph with:

```md
**What is proven working, live, that this document once recorded as broken.** Multi-node created Flows can reach playback, extraction comparison, and model-backed self-judgement; run 2's five-node Flow returned a structurally measurable 12-of-13 result and the judge refuted it rather than reporting success. Wrong-answer recovery and reauthoring route, but run 2 failed before creating an adaptation, and no current run proves repair persistence or deterministic replay. The gate is open; the full self-repair cycle is still unproven.
```

Replace `The next action` and `Blockers` with:

```md
**The next action** is to diagnose and correct run 2's reauthor failure `flow_bootstrap.unexpected_error` at `provider_request`, then repeat `everything-store-plus-earbuds-under-50` under the same default 26-call profile. Debug each run before another provider call. The next pass starts the streak at one; the rung is left only after two consecutive independent passes.

**Blockers:** no facility or external blocker is recorded. The active product blocker is wrong-answer recovery failing before repair adaptation, persistence, and replay. The environment's existing worktree limitation remains operational rather than product evidence.
```

## `language-driven-flow-loop-plan.md` — ledger delta

Append:

```md
### 2026-09-26 — Run 2 reached Stage 6 but failed before repair application
- Agent: supervisor, with workers on t225 to t231
- Changed: the bounded run-2 debug/evidence reports and both plans' Current State
- Why: Continue rung 1 with the default-profile hard scenario and measure creation, execution, judgement, repair routing, persistence, and replay in one run.
- Validation: `run-muj39xl6-f6a5d4e5` passed bundle integrity/redaction checks and produced an accepted failure measurement: a five-node Flow, 12 observed of 13 expected records, model-backed `refuted`, and recovery/reauthoring routed. Reauthoring failed `flow_bootstrap.unexpected_error` at `provider_request`; no repair adaptation, persistence, or replay artifact was produced. Evaluation records 21 calls, while overlapping build/main and repair/verification accounting representations remain separate.
- Outcome: Accepted measurement; failed product verdict. Rung-1 consecutive-pass streak remains 0.
- Follow-up: diagnose the reauthor failure and rerun the same default-profile scenario. Do not claim the t217 terminal final-exhaustion fix measured; this run continued after its unusable decisions and completed a proposal.
```

## Consistency notes for integration

- “Accepted” describes evidence quality, not product success.
- Stage 6 was reached but did not settle successfully.
- The five-node build adaptation is creation evidence, not repair evidence.
- The judge refutation is proven; sanitized directive prose is not retained.
- No adaptation id, persistence result, repair-lane artifact, or replay result exists for the repair attempt.
- Do not add 19-call build to 19-call main observation, or two-call repair observation to two-call verification.
- Do not convert the 21-call evaluation roll-up into token/cost totals absent an explicit combined aggregate.
- The pass streak is 0; a future pass would start it at 1.
