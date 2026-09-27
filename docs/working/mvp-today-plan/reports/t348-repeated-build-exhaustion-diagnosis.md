# t348 — Repeated Stage-2 build-exhaustion diagnosis

## Decision

**The fix-before-retry boundary is now mandatory.** Run 4 is the second consecutive post-t217 accepted measurement to exhaust all 26 build decisions at Stage 2 with `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`. Per t327/t331, no unchanged run 5 is authorized. Another provider call must wait for a privacy-safe deterministic reproduction or stable draft/step instrumentation, an evidence-backed measured source change, and validation.

The proved product defect is **created-Flow convergence reliability**. The safe evidence still does not prove one deterministic Core branch, semantically identical reruns, lost feedback, truncated context, incorrect accounting, or a false answerability rejection. The operational stop threshold is intentionally stricter than the evidentiary threshold for choosing a code fix.

## Measured comparison

| Run | Build result | Decisions/calls | Tool calls | Bounded steps | Evidence bytes | Terminal / later stages |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Run 1, `run-muj2kzx1-8f9f8271` | No proposal | 26 | 24 | safe debug lists 26 decision rows | 109,661 | final cannot-answer was flattened to iteration-limit; no later stage |
| Run 2, `run-muj39xl6-f6a5d4e5` | Proposed and reached runtime/judgement | 19 build/main calls; 18 loop decisions | 15 | 25 | 91,140 | build converged; later failed before repair application |
| Run 3, `run-mujd550n-e8fbe7aa` | No proposal | 26 | 21 | 37 | 98,063 | truthful unusable/cannot-answer; no later stage |
| Run 4, `run-muje0grk-4d8d2d3f` | No proposal | 26 | 22 | 33 | 70,126 | truthful unusable/cannot-answer; no later stage |

Run 4's single build/observed representation is 370,882 input plus 3,642 output = 374,524 tokens and USD 0.049289784. Repair and verification accounting are absent because those stages did not run. Run 3 likewise had one 26-call build representation and no later-stage buckets.

The failures are not evidence-byte exhaustion: 70,126 and 98,063 bytes are far below Core's 1,048,576-byte total backstop. They are not cost, token, transport, runtime, oracle, permission, repair, or replay failures on the supplied facts. All three failed builds reached the call/decision ceiling without an answerable proposal; run 2 proves the same scenario/profile can converge inside that ceiling.

## Proven cause versus inference

### Proven

- Run 3 and run 4 are integrity-accepted product failures in the same Stage-2 terminal family after all 26 decisions.
- Completion answerability correctly refused a draft with no record-producing or record-storing path for an instruction asking for rows. Accepting that draft would violate the request, not repair reliability.
- T217's classification correction is working: both new failures preserve the actionable issue rather than flattening it to generic iteration-limit.
- No Flow survived validation, so there is no evidence about runtime, exact oracle output, repair persistence, recursive judgement, replay, or terminal grant lifecycle.
- The unchanged retry did not restore convergence. Creation is therefore too unreliable to justify another uncontrolled sample.

### Inferred, not proved

- Provider/model variation is a plausible contributor because run 2 converged and the other three did not, but four observations are not a probability estimate and do not isolate randomness from page state, exploration choices, or their interaction.
- The similar 26-call endings may reflect a draft-convergence cycle, but equal terminal codes do not prove equal draft content, equal step targets, equal feedback visibility, or semantically duplicate reruns.
- More calls might eventually produce a Flow, but no evidence identifies call 27 as corrective. Raising the ceiling would expand exposure while hiding the measured reliability defect.
- Earlier answerability feedback or a new draft-progress policy might help, but the current safe records do not show the exact point at which a correctable draft became stuck.

## Owning behavior and current test coverage

Likely Core ownership is concentrated in:

- `runtime/llm/evidence-loop.ts`: decision loop, draft amendments/reruns, progress guard, final completion-only turn, and exhaustion preservation;
- `runtime/llm/repeat-policy.ts`: request identity and when repeated/refused observations or actions count as progress;
- `runtime/llm/loop-budget.ts` and `runtime/loop-limits/flow-bootstrap-evidence-loop.ts`: remaining-decision guidance and the 26-decision backstop;
- `runtime/flow-bootstrap/answerability/check.ts`: the substantive record-producing/storing capability check and corrective feedback;
- `runtime/flow-bootstrap/generation-failure/evidence-failure.ts`: unusable-decision classification and issue preservation; and
- `runtime/service/flow-bootstrap-commands/evidence-trace.ts`: privacy-safe stored trace projection.

Downstream ownership begins only after Core publishes the safe fields: the test-runner live-LLM build snapshot/usage projection must carry the bounded diagnostic shape without opening provider/page content.

Existing focused tests pin important pieces separately: repeat/refusal progress, amendment feedback, unusable-decision guards, final completion-only budget behavior, answerability refusal, terminal classification, evidence-trace sanitization, and provider-call accounting. The service-level DeepSeek bootstrap test also pins repeated unusable decisions to the authorized-call limit and grant release. What is missing is one deterministic integration fixture spanning the mixed successful-tool/draft-rerun/completion-refusal path that ended these live builds.

## Required deterministic reproduction

Add a scripted Core integration fixture at the Flow-bootstrap service boundary, using a fake provider and deterministic fake tools—never a live provider or page. It should execute an exact 26-decision sequence containing:

1. a deterministic opening observation and several successful tool executions;
2. draft amendments and reruns, including at least one applied edit, one unchanged/refused edit, and one rerun tool row sharing its provider iteration;
3. a completion whose plan parses but answerability rejects with `bootstrap.cannot_answer_instruction`;
4. corrective feedback shown to the next scripted decision;
5. a late correction/rerun that still leaves no record-producing/storing step; and
6. final exhaustion on the authorized boundary.

Before testing any fix, the fixture must assert current invariants: exactly 26 paid decisions, tool calls counted separately from provider decisions, no budget/accounting breach, every feedback/refusal represented once, no proposal/review/adaptation persisted, terminal `flow_bootstrap.evidence_unusable_decision` at `provider_output_validation`, issue `bootstrap.cannot_answer_instruction`, and grant release. A companion success script should branch from the same prefix, retain a record-producing step, complete before 26, and prove the fixture is not constructed to fail unconditionally.

This reproduction determines whether a candidate policy or implementation change alters the measured sequence. A shorter unit test of answerability or exhaustion alone is insufficient because those isolated behaviors already pass.

## Required privacy-safe instrumentation

The next diagnostic record must establish semantic progress without retaining prompts, page values, selectors, or arguments:

- publish the existing per-decision `draft` visibility measurement (`bytes`, budget, listed/unlisted step counts, omitted-input counts, instruction bytes, over-budget flags) through every stored-trace rebuilder; `trace.ts` explicitly notes that this currently exists on the in-memory result but is not yet published to a finished run;
- add a Core-minted monotonic draft revision and stable build-local step ids to amendment/rerun rows, with only before/after revision, targeted step ids, applied/refused counts, kept-step count, and rerun step id—not step content or inputs;
- publish content-free answerability state at each completion: record-producer present, record-store present, and closed issue code;
- publish whether a decision changed page state, draft structure, or answerability state, so “tool succeeded” is not automatically treated as semantic convergence;
- carry these bounded fields through `service/flow-bootstrap-commands/evidence-trace.ts`, its exhaustive member-preservation tests, Core's evidence-step projection, and the downstream safe live-LLM snapshot.

A raw hash of user/page/provider content is not required. Sequential build-local identities and closed booleans/counters are enough to prove whether the same retained draft/step state recurred while preserving the privacy boundary.

## Fix-before-retry boundary

Do not raise calls/tokens/cost/timeout, add provider retries, weaken `bootstrap.cannot_answer_instruction`, collapse every rerun as duplicate, or launch another unchanged attempt. The next allowed provider measurement requires all of:

1. the deterministic fixture and/or the safe identity instrumentation above;
2. an observed source-owned contradiction or repeated semantic state that selects a concrete fix;
3. a measured Core change with focused tests for both failure and successful-convergence branches;
4. Core/downstream full validation and output-freshness closure for the changed scope;
5. a fresh disposition, no-hindsight record, privacy capture plan, provider-free preflight, and one-Lab gates.

If instrumentation shows distinct productive drafts until the final refusal, the appropriate work may be provider/prompt/policy research rather than a loop-code patch. If it shows the same answerability-deficient revision cycling while Core labels steps as progress, ownership is the evidence-loop progress policy. If it shows the record-producing step existed but answerability could not see it, ownership is the plan/registry answerability boundary. If feedback or the full draft was not shown, ownership is context/draft projection. Those are testable branches; the current sanitized counts cannot choose among them.

## Scope

I used only sanitized run-1 through run-4 debug/report facts and owning Core/downstream source/tests. I did not open `test-runs`, raw artifacts, provider/page content, prompts/responses, logs, browser state, or credentials; did not run tests/builds/live/provider commands; and did not edit source/shared plans/debugs. This report is the only file written.
