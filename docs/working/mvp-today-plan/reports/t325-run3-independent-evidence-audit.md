# t325 — Run-3 independent bounded evidence audit

Run: `run-mujd550n-e8fbe7aa`

Verdict: **accepted finalized measurement; failed at Stage 2 before Flow proposal**

This audit independently read only the conservative artifact index and five uniquely indexed structured artifacts allowed by t313/t317. It did not open logs, events, provider sidecars, screenshots, HTML, browser data, page snapshots, raw datasets, the run debug, or any unindexed artifact. No provider, live, browser, test, build, commit, or shared-document action was performed.

## Index/read gate

The index was schema `0.1`; every indexed entry used the conservative `applied|verified` redaction set. Each opened artifact had exactly one indexed entry with `redaction: applied`:

- `run.json`;
- `summary.json`;
- `evaluation.json`;
- `snapshots/live-llm.json`;
- `snapshots/flow-lane.json`.

Neither conditional artifact was indexed, so neither was opened:

- `snapshots/extraction-mismatches.json`;
- `snapshots/repair-lane.json`.

The manifest, summary, and evaluation agree on the run id and failed verdict. The manifest says `redactionState: verified`.

## Highest stage reached

**Stage 2 — exploration/build, failed before proposal.**

Positive evidence:

- `flow-lane.build.outcome: failed`;
- evidence loop: 26 decisions, 21 tool calls, 37 bounded steps, 98,063 evidence bytes;
- `flow-lane.complete: false` and `stoppedAt: build`;
- evaluation: `flowCreated: false`.

The evidence loop recorded bounded exploration/action outcomes, including successful actions and inspection, repeating-structure detection, draft amendments/reruns, closed action refusals, unusable decisions, and the final cannot-answer issue. The terminal progression ended with a draft rerun, an invalid-input refusal (`node_not_runnable_here`), and a final unusable decision carrying `bootstrap.cannot_answer_instruction`.

Stage 3 was not reached:

- review, Flow shape, and authored nodes are null;
- no adaptation id was published;
- no runtime run id or runtime status exists;
- actions are empty.

## Closed failure

The smallest bounded failure record is:

- build outcome: `failed`;
- failure code: `flow_bootstrap.evidence_unusable_decision`;
- failure stage: `provider_output_validation`;
- issue code: `bootstrap.cannot_answer_instruction`;
- provider invocation: `attempted`;
- recovered after timeout: `false`;
- build duration: 209,151 ms.

Evaluation records `failureCategory: runtime.behavior`. It also carries a separate facility-classification object with boundary `finalized-bundle`, stage `scenario.execute`, and reason `unclassified`; preserve that typed representation rather than silently relabelling it. The unsafe free-form failure message and summary failure prose were not copied.

## Oracle and answer evidence

The intended judgement is structurally identified as `expected-dataset` at step id `extract-plus-under-fifty`, step index 16. No oracle comparison ran:

- `evaluation.extraction: null`;
- `oracleVerdict: null`;
- `reportedVerdict: null`;
- no mismatch snapshot is indexed.

**NO EVIDENCE:** expected-versus-observed record counts, field comparison, ordering, or mismatch details were not measured because no Flow was created or run; the properties that would answer them (`evaluation.extraction[]` and a conditional mismatch snapshot) are absent/null. Do not backfill the prewritten 13-record oracle as a measured expected/observed count.

## Judgement, repair, application, replay, and revocation

None of these stages was reached:

- `flow-lane.resultVerification: null`;
- `live-llm.verification: null`;
- `evaluation.harnessRecovery: null`;
- `harnessActivations: 0` at evaluation level;
- `adaptationCost`, `adaptationValidation`, `adaptationPersistence`, and `adaptationReuse` are all null;
- no repair-lane snapshot is indexed;
- no runtime run id/actions exist.

Therefore:

- **NO EVIDENCE:** no answer judgement occurred; the verification properties are null.
- **NO EVIDENCE:** no automatic wrong-answer repair route occurred; no recovery/result-repair/result-reauthor record exists.
- **NO EVIDENCE:** no adaptation was proposed, approved, applied, or persisted; the build has no adaptation id and all adaptation metrics are null.
- **NO EVIDENCE:** no deterministic replay occurred; there is no runtime run and no repair-lane replay record.
- **NO EVIDENCE:** no post-repair recursive judgement occurred; verification is null.
- **NO EVIDENCE:** terminal grant revocation is not published by the bounded artifact schema; issued bounds and settlement accounting do not prove revocation.

## Accounting representations — kept separate

### Build/main observed usage

`snapshots/live-llm.json.observed` records:

- calls: 26;
- observed per-call entries: 25;
- unrecorded calls: 1;
- per-call record status: `not recorded`;
- interventions: 0;
- input tokens: 362,468;
- output tokens: 5,999;
- total tokens: 368,467;
- estimated cost: USD 0.057534336;
- provider gate invoked: true.

### Build record representation

`live-llm.build` records 26 provider calls and 26 loop-provider calls. Its accounting is exactly the same representation as observed usage:

- input tokens: 362,468;
- output tokens: 5,999;
- total tokens: 368,467;
- estimated cost: USD 0.057534336.

These numbers are **not added** to the observed numbers. Evaluation's `llm.calls: 26` is also corroboration, not a third bucket.

### Repair and verification representations

There is no repair object and verification is null. No repair/verification calls, tokens, or costs are reported, so no second accounting bucket exists.

### Ceilings

The plan and issued grant both record a 26-call ceiling, 560,000 total-run-token ceiling, USD 0.25 per-call estimate ceiling, and USD 2 total estimate ceiling. The observed aggregate is within those numeric ceilings, but the bounded snapshot publishes no separate typed breach result beyond the settlement/gate record; this audit does not invent one. The one unrecorded call remains explicitly unrecorded and is not assigned to another stage.

## Final classification

Run 3 is a valid, redacted failed measurement that exercised creation-time exploration only. It independently proves:

- the default 26-call build grant was reached;
- exploration and draft amendment/rerun activity occurred;
- the final unusable decision survived into the typed terminal build failure;
- the failure stopped creation before proposal/review.

It does **not** prove Flow creation, runtime playback, oracle comparison, self-judgement, repair routing, adaptation application/persistence, deterministic replay, recursive verification, or grant revocation. It does not advance the consecutive-pass streak.

## Procedure deviation

One bounded extraction command accidentally selected the nested task descriptor wholesale and emitted its instruction SHA-256 into internal tool output. The hash was not written into this report or any shared document, and no instruction text, credential, provider text, page data, or raw artifact was emitted. Subsequent extraction used explicit safe members. This violated the “never print hashes” handling rule and is recorded here rather than hidden; it does not change artifact integrity or the substantive classification above.
