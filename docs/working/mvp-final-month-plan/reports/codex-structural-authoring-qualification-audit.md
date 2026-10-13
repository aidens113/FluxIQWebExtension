# Model-authored topology and structural qualification audit

Status: Read-only investigation complete; implementation and structural live qualification outstanding.
Date: 2026-10-13
Worker: codex-replay
Source inspected: paired t525 at downstream `6a46e66b` / Core `73550acb`, with isolated t525 judge edits frozen. No tests, builds, provider or browser runs were launched for this audit.

## Answer

The model can author routers, separately owned subflow graphs and reusable called parts. Saved runtime execution supports their input/output boundaries and child frames. However, the current creation trial cannot execute an ordinary submitted helper call through the production service: it never supplies the candidate's sibling graph loader. Creation acceptance also checks one selected entry path, not every justified entry situation. Current task-outcome passes therefore do not prove sound automatic decomposition, helper reuse or route coverage. Held multi-subflow re-authoring remains deliberately unsupported and fails closed before application.

This is a concrete implementation gap as well as a qualification gap. It does not justify requiring every simple automation to contain multiple subflows.

## Model-accessible structure

All Core paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `flow-bootstrap/candidate/authoring-loop.ts:124` puts the complete script, act, loop and state-format guidance on `core.submit_candidate`. Static validity produces a revision/digest, never semantic acceptance. Both script and canonical JSON plan submission are accepted.
- `flow-bootstrap/plan/flow-script-format.ts:203` describes conditional `subflow ... when ... end` blocks and the outside-block fallback. Its state-format lines 489–500 describe named `part` helpers, `call`, explicit inputs/results and alternate methods through handlers. Thus these primitives are offered to the model; they are not confined to a hand-authored API.
- `flow-bootstrap/script-statements/called-parts.ts` resolves calls, limits cross-boundary values to declared interfaces, refuses unknown/missing inputs and cyclic script calls. `flow-bootstrap/authoring/assemble.ts:145` refuses `flow_script.call_unavailable` if the filtered registry does not offer Call Subflow. Model availability remains subject to the actual registry/capability boundary, not guidance alone.
- `flow-bootstrap/adaptation.ts:356` replaces symbolic helper keys with minted sibling Subflow IDs. Each graph has parent Flow/Subflow ownership. The main entry gets applicable parent interface mappings; helper interfaces are retained on their own graphs.
- `executor/frames/call-subflow.ts` requires an owned graph source and a child-frame runner, preserves call inputs/results, rejects missing targets/cycles and retains child traces. `service/runtime-session/subflow-frame.ts` installs the owned durable sibling graph source for a saved run, caches one graph revision per run and records called versions.

Existing source tests establish these seams, but were only read in this audit: `flow-bootstrap/authoring/tests/routes.test.ts`; `tests/authored-call-subflow/tests/call-subflow.test.ts`; `executor/frames/tests/call-subflow.test.ts`; `service/runtime-session/tests/subflow-frame.test.ts`. The authored-call test manually supplies a loader for saved topology and proves declared input, fallback test value, isolation of unrelated parent inputs and returned helper output. It does not exercise candidate creation.

## Exact creation gap

`flow-bootstrap/verification/detached-execution.ts` clones and revalidates the complete submitted plan, normalizes all its graphs without applying them, observes fresh host routing state, and selects one candidate-owned entry graph. It then runs that graph with `runCanonicalAutomationStudioFlow`, normal retries and authored failure routes, while disallowing model diagnosis/patch recovery. Full-plan digest/freshness checks protect identity; this is not execution of every branch.

It never installs `options.subflowGraphs` from the normalized candidate topology. The actual production caller, `service.ts:1587–1588`, obtains trial options from `service/runtime-session/graph-options.ts`; that builder supplies effects, native execution, host capabilities, dataset writes and parking, but no sibling graph source. Consequently a submitted Call Subflow reaches `executor.call_subflow.no_source` at `executor/frames/call-subflow.ts:55`. Supplying accepted/durable graphs would also be wrong: candidate normalization mints unapplied IDs and the trial must run exactly that candidate, not whatever accepted sibling happens to exist.

`flow-bootstrap/verification/tests/detached-execution.test.ts` explicitly tests that only the selected submitted subflow runs and unselected outputs are not required. It covers fresh host routing, stale/cancelled identities, ownership/plan validation, partial-execution refusal and authored failure routes, but has no detached helper execution test. Selected-path semantics are correct; interpreting one such receipt as alternate-route qualification is not.

`service/candidate-trial/run.ts` opens one trial session, executes once and judges its selected graph/trace/result datasets. `service/candidate-trial/summary.ts` currently receives one graph's nodes/edges and top-level trace attempts. Child-frame read/act attribution needs an explicit regression when helper execution is added; child effects must not disappear from judge/reset evidence merely because they live outside the selected graph.

`service/candidate-trial/promotion.ts` promotes a whole candidate after one standing yes matches its exact revision/digest and authoritative record/base/settings. It does not require evidence for other Router entry cases or all helper interfaces. An untested alternative can be saved even though the observed selected route answered correctly.

## Static routing and reachability limits

`flow-bootstrap/plan/route-validation.ts` refuses missing conditions, identical-condition shadowing, and Subflows absent from its reached set. Called helpers deliberately do not need Router rules: their call nodes add their symbolic targets to that set. Multiple called reusable helpers therefore do not inherently conflict with router reachability.

However, this set collects references from every graph rather than traversing from Router/fallback roots. A canonical plan can contain an orphan helper component whose members reference each other and appear reached, although no executable entry reaches them. Script call-cycle checks are stronger for script calls but cannot substitute for validation of canonical JSON plans. The route validator detects exact duplicates, not every logically dominated predicate (for example a broad earlier predicate covering a later narrower one). No general satisfiability proof or alternate-state execution gate exists here.

## Held topology safety

`service/runtime-adaptation/held-candidate.ts` accepts only the existing selected Subflow ID/graph ID, exactly one held Subflow, with all Router rules/fallback pointing there and matching ownership. It returns explicit unsupported codes for missing selected Subflow, multiple/other Subflow, other graph, or routes elsewhere.

`service/runtime-adaptation/repair-rerun.ts` reads that candidate before writes/dispatch; an unsupported topology returns `repair_rerun.held_reauthor_unsupported.*`. It never applies the held edit to make a trial possible. Supported held execution records its adaptation identity for judged settlement. `service/runtime-adaptation/tests/held-candidate.test.ts` covers the unapplied selected graph and unreadable/stale decline. Whole-topology re-author is a missing extension of this boundary, not permission to remove the fence.

The consultant revision correctly requires complete topology candidates, ownership/bindings/output contracts, and detached validation before promotion. Its historical warning about early applying other topologies is addressed by the present explicit refusal; safe execution of those topologies remains unfinished.

## Smallest ordered units

1. **Candidate-owned helper execution.** Core `flow-bootstrap/verification/detached-execution.ts`, a focused adjacent candidate-topology graph-source owner/barrel and owning tests. Install a clone-bound in-memory source for candidate siblings, including graph contracts/ownership and recovery sibling when relevant, using the normal frame runner. Do not read/mutate accepted graphs or allow caller-provided foreign siblings to substitute. Preserve full identity checks, inherited permissions, cancellation, no-model execution and selected-route semantics. Test two helpers, nested calls, repeated row calls with different inputs, returned outputs, missing/cyclic targets, stale candidate during a child call, failure propagation and zero accepted-store writes. Add `service/candidate-trial/{run,summary,landed-acts}.ts` only where those tests expose missing recursive child evidence; keep dataset/reset/judge accounting complete and no double counting.

2. **Rooted static reachability.** Core `flow-bootstrap/plan/route-validation.ts`, focused helper if needed, adjacent plan tests and script/canonical parity tests. Traverse calls from actual Router/fallback roots; reject disconnected helper components and unknown call targets. Preserve helper reuse and recovery registrations. Add narrowly provable shadow/constant-condition diagnostics without inventing a general solver or rejecting useful overlapping rules merely for overlap. Tests distinguish shared reachable helpers, uncalled helpers, orphan cycles, exact duplicate routes, and known dominance versus legitimate ordered alternatives. No model prompt changes needed to prove this.

3. **Entry-case evidence and qualification.** Core `flow-bootstrap/candidate/{trial-gate,contracts}.ts`, `service/candidate-trial/{contracts,port,promotion}.ts`, focused entry-case receipt owner, and service wiring only where required. Bind declared/observed applicable entry-case receipts to one candidate revision/digest and original task, using existing reset/start ownership. Missing or failed required case cannot promote. Run the normal Router on actual fresh observations; do not force every node on mutually exclusive branches or invent alternative states the task does not support. Downstream owns preparation through realistic site controls and independent structural/result oracles, under `packages/test-runner/src/flow-lane/` and adjacent scenario-owned manifests/tests. An actual qualification must cover state alternatives, appropriate helper factoring, exact data/lasting consequences and later saved zero-model reuse; arbitrary Subflow counts are not an oracle.

4. **Whole-topology held re-author.** Only after unit 1 is shared/coherent: Core `service/runtime-adaptation/{held-candidate,repair-rerun,judged-reauthor}.ts`, a focused detached topology adapter using the same candidate graph source, and adjacent tests. Carry Router/sibling graph identity, candidate-only traces and judge receipts through existing deferred settlement. No early writes, accepted-source fallback or rollback-as-safety. Tests cover Router change, added/changed sibling helper, alternate-route failure, cancellation/stale ownership, no apply before confirmed judgement, exact once promotion and subsequent provider-free reuse. Keep unsupported shapes declined until covered.

These are serial dependencies where the candidate executor and evidence contracts overlap. The implementation and downstream qualification partitions should be briefed separately; source fixes alone do not qualify model structural choices.

## Proof limits

Read-only source and authored contract/test inspection only. No actual model topology was newly generated or executed, no current live route matrix was measured, and no helper creation success is claimed. Existing lane outcome passes establish their recorded tasks, not alternate routes, repeated helper correctness, automatic decomposition or whole-topology held repair. All state, profiles, t525 judge source and shared working documents were preserved; this report is the only new artifact.
