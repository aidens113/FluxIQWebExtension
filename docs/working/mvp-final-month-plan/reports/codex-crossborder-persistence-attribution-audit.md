# Crossborder repair persistence attribution audit

Status: Read-only worker claim; supervisor verification pending
Owner: codex-t517
Date: 2026-10-13
Frozen source: downstream `6a46e66b`, Core `73550acb`

The creation-bootstrap misattribution suspicion is ruled out. The global compatibility state contains a creation `flow_bootstrap` adaptation, but the project-scoped typed adaptation store contains a different, actual runtime repair. Its identifier matches the sealed repair-lane application. Reading only global state omitted the authoritative project adaptation and its object-backed artifacts; that was an investigation coverage error, not a demonstrated product persistence defect.

For paid run `run-mv79nr9o-89a70c81`, independent read-only queries found exactly one typed adaptation, applied with base revision 1 and applied revision 2. Its metadata identifies `temporary_target_override` and `inRunRepair:true`. Its source run equals the approval decision's judged run. The decision states `autoApply:true`, `applyAt:judged_whole_run`, and `applied:true`. A succeeded trial validation names that same run. One applied-to target is recorded. The audit contains one `testing` to `applied` event; the corresponding runtime row is succeeded with adaptation count 1.

The project adaptation has three real readable artifacts: patch, evidence, rollback. The patch contains one `edit_action_target`; rollback contains `set_node_parameters` and `set_node_metadata`. This independently supports actual runtime target-repair attribution. No artifact contents, identifiers, target values, paths containing project identifiers, or digests are reproduced here.

## Owning source and linkage

- Core `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/context.ts:105`: ledger receipts/recoveries join the run detail, including `inRunRepairs`, adaptation IDs and recovery metadata. Session `trace.repairs` and detail receipts are distinct projections; absent patch receipts on the raw session alone do not prove absence from the persisted detail/adaptation.
- Core `runtime/service/runtime-session/held-repair-verification.ts:37`: only trace-kept repairs contribute the overlay used for result verification; the root-frame overlay represents the graph actually executed.
- Core `runtime/service/runtime-adaptation/judged-promotion.ts:168`: settlement gathers recorded adaptations and the repairs the trace says ran. At line 330 it reads the exact stored adaptation; line 354 records refusal, and line 360 records the successful judged decision and invokes product application. The outcome rejects unrun, failed, cancelled, unjudged and refuted repairs.
- Core `storage/project/adaptation-store.ts:195`: resolves owned target graph and rejects a stale base; line 205 applies graph operations, compiles the revision and saves rollback; line 214 updates applied status/revision and appends the applied audit. Line 413 reconstructs the public adaptation from typed row plus object-backed patch/evidence, rather than the global bootstrap projection.
- Downstream `packages/test-runner/src/flow-lane/repair/prove-repair.ts:56`: takes repair IDs from the run's recovery, applies/reads those exact IDs, then replays. `run-repair-lane.ts:204` supplies the recovery IDs, optionally adding an explicit result-repair ID; it does not automatically substitute the creation promotion ID.
- Downstream `flow-lane/repair/apply-repair.ts:152`: an already-applied adaptation is read without another review/apply. `flowChangeOf` at line 200 labels it `changed_in_run` whenever every adaptation has stored change evidence. `revisionsOf` at line 258 accepts an advancing revision as change evidence. The before/after aggregate reads at lines 148 and 165 occur after the original product run, so equal hashes cannot establish the pre-repair graph.
- Downstream `run-evaluation/adaptation/measure.ts:81` grades the repair IDs as well as run-created/exercised IDs; `gate.ts:100` accepts `changed_in_run` and successful zero-call replays. These are helper classifications, not an independent full graph comparison.

Core paths in the latter bullets are relative to `packages/fluxiq/src/programs/automation-studio/`; downstream abbreviated paths are relative to `packages/test-runner/src/`.

## Remaining proof boundary and narrow future capture

No product source fix is justified by bootstrap attribution. Worker t516 separately owns reconstructing comparable pre/post executable graphs from retained graph operations, inverse operations and object evidence. Revision digests must not be compared as if they were both graph-state digests: initial graph revision and patch revision hash different projections. This audit proves repair identity, judged automatic application and persisted artifacts; it does not independently prove a changed executable graph, later reuse, correct task result or the full qualification gate. Successful oracle/replay and revision advancement alone are insufficient substitutes.

If retained evidence cannot establish P4, the smallest runner improvement is to capture a typed, scoped executable graph projection before the armed product run and after its judged automatic application, using the same owner/graph ID set and canonical projection. Inject the baseline into the repair proof; never call a post-run read a pre-repair baseline. Record hashes only, together with bounded repair kind/source-run/judged-run/applied status and target-graph linkage. Exclude bootstrap/unrelated/stale repairs explicitly; missing or mismatched linkage stays unproven. Preserve automatic product application and the provider-disabled later-session proof.

Owners for that change: the caller immediately before the armed run in `flow-lane/creation/lane.ts:455`, existing `repair/apply-repair.ts` state projection and persistence check, `repair/prove-repair.ts` input plumbing, `repair/run-repair-lane.ts` proof publication, and adjacent tests. Do not change Core promotion policy or legacy application semantics to make a helper pass. Test bootstrap-only/unrelated IDs, metadata-only revisions, genuine changed target parameters, mismatched graph owners, held/failed apply, unknown baseline, and auto-applied repair where the two post-run reads agree but the real baseline differs. Graph metadata/stamps alone must never establish executable repair; the present `stepsOf` includes entire node objects, so a new executable projection must distinguish attribution stamps from executable parameters.

## Independent rerun

Safe external script: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-13/codex-crossborder-provenance-audit.py`.

Command: `python C:/Users/osrs_/FluxStuff/lab-runs/2026-10-13/codex-crossborder-provenance-audit.py`.

Observed exit 0. Output contains booleans and counts only: assertions passed; typed repair rows 1; artifact kinds 3; applied audit events 1; same source/judged run true; succeeded whole-run validation true; executable pre/post difference proven by this script false. SQLite connections are `mode=ro`; no live launch, build, source edit, process management, override or commit occurred. Evidence is the retained t418 persistent-isolated `adapt-crossborder-continuation-1` project store and the sealed run's `snapshots/repair-lane.json`.
