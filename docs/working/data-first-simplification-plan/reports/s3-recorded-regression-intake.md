# S3 affected recorded-regression gate intake

Outcome: Done (read-only discovery); no gate or graph code implemented.

The current merge wrappers have no affected-recording gate. Downstream `scripts/task/finish.mjs` checks Core currency, merges dev into the task, then runs structure audit (or explicit full check) before the parent merge. Core `scripts/task/finish.mjs` runs a fixed `scripts/task/contract/list.mjs` prompt-test list plus its check command. Neither selects admitted recordings by import reach. Preserve the downstream narrow-check policy and twice-daily full-sweep limit; do not replace it with the fixed ten-task suite on every merge.

Existing generic graph substrate lives in Core `scripts/structure-audit/import-graph/index.mjs`: `buildRuntimeGraph`, `reachableModules`, `bindingChain`, plus workspace-export resolution in `scripts/structure-audit/browser-graph/resolve.mjs`. It is an evaluation-order graph, not an affected-check API: it explicitly omits dynamic imports, type-only imports and asset edges; another repository's linked packages are not followed. Using it unchanged would silently miss dynamic readers/prompt assets and paired Core changes. Do not change its cycle-analysis semantics to fix impact selection. Existing shared developer-tool loading is downstream `scripts/core-scripts/import-core-script.mjs`; `scripts/build-cache/{core-engine,bound-engine}.mjs` demonstrates a Core-owned configured engine. Build-cache input/dependency coverage is package/step oriented, not per-recording import reach.

Proposed bounded implementation:

1. Add a Core-owned public developer-tool affected-check seam under `scripts/task/affected-checks/` (new proposal, not an existing API). Reuse the existing resolver/parser primitives but build a separate dependency-impact graph covering static imports/reexports, literal dynamic imports and explicitly registered noncode prompt/model assets. Resolve the actual paired repositories' public package exports into each source tree; do not silently stop at a linked Core boundary. Union pre-change and post-change reach so deleted/renamed modules and removed imports still select their dependent roots. Return changed-file-to-root dependency evidence and unresolved paths; unresolved relevant reach is an explicit gate gap, never an unaffected verdict. Unit-test exports/barrels, dynamic imports, assets, paired packages, deletions and an unrelated leaf without browser/model calls.
2. Keep the recorded-fixture registry, ten-site scenario/task/oracle identities, admission and replay command dispatch downstream (suggested new `scripts/lab/recorded-regression/` owner). Each registry row names its actual replay/reader root and required proof class; machine-local ignored artifacts are resolved separately by stable fixture id. Select a row when its real dependency closure intersects changed files, not via task/site regexes or a handpicked passing list. Shared builder/data/judge modules can honestly affect many roots; a proven unrelated leaf produces an explicit zero-selection receipt rather than running unrelated fixtures.
3. After integration/Core-currency checks and normal narrow checks, the downstream finish wrapper invokes that selected gate before its parent merge. Its receipt binds both source heads/dirty fingerprints, changed-file basis, selected rows and reasons, artifact/task/oracle digests, admission and observed proof results. Applicable missing/unreadable/incomplete capture blocks acceptance. No unrelated full suite and no automatic paid launch. Decide mandatory-gate skip semantics explicitly before implementation; do not silently inherit `--skip-checks` as a bypass.

Evidence/admission state:

- `attempt-lane/scoreboard/fixed-tasks.ts` is the fixed comparison cohort, not an admitted replay registry. Historical right verdicts/call counts do not prove present replay evidence. Mk II sellers stays supplemental.
- `recorded-attempt-replay/admit.ts`, `cursor.ts`, `product-runtime.ts` already separate raw-transport admission from starting-copy/position/domain gaps, stop at first request divergence, and retain fullAttemptAccepted:false for prefixes. Strict full-domain composition additionally uses the public recorded trace wrapper's provenance/completeness gate. No open trace may be relabelled complete.
- Current F25 source has exact original-read command/result/HTML identity (89/96/artifact90), but its trace is open, starting state unproven and its unmatched30th request unresolved. It cannot satisfy a full build/replay/task regression gate. The proposed `recorded-read` proof can satisfy only a declared original read-boundary fixture after actual-reader/native-result/canonical20x6 equality passes; it cannot substitute for a missing full-task fixture.
- Other historical starting-store roots remain missing/unproved. Missing applicable capture must remain a blocking evidence gap; do not create passing fixture records from the scoreboard, prefixes, synthetic replacements or detector samples. Fresh completed capture and genuine starting receipt are prerequisites for broader recorded gates.
- New task-processing declarations are a compatibility dependency: action-only process:null vs truthful data criteria; old recorded replies stay byte-for-byte evidence and may diverge under the new contract.

Prompt/model dependency changes additionally require the approved tiny live smoke on the task's fixed starting model, using existing supervised campaign accounting and explicit unknown/in-flight cost handling. Selection can report that requirement; it must never launch paid work during discovery or invent a smoke pass from provider-free parsing. No paid smoke or browser ran here.

Validation: read-only file/source inspection only; no graph execution, tests, builds, git mutation or extra heavy job.
Not verified: complete affected-check API implementation, cross-repository graph coverage, admitted full-task recordings, actual original-reader parity, prompt/model live smoke.
Report: docs/working/data-first-simplification-plan/reports/s3-recorded-regression-intake.md
Notes: Generic impact/task tooling stays Core; scenario/admission/browser replay stays downstream. Main t986 validation takes priority once its queued refresh opens.

Outcome: Done
Changed: docs/working/data-first-simplification-plan/reports/s3-recorded-regression-intake.md
Validation: read-only inspection of named task wrappers, graph APIs, scoreboard and admission sources; tests/builds not run (discovery only, no extra heavy job).
Not verified: actual impact selection or admitted recorded-regression execution.
Report: docs/working/data-first-simplification-plan/reports/s3-recorded-regression-intake.md
Notes: Main t986 implementation/validation remains active; no source or paid action from this intake.


## S3 concrete API and mandatory-gate brief (proposal only)
Role: bounded Core impact-tool worker and downstream gate worker, serial at the public interface; no implementation authorized by this intake.
Goal: before parent merge, select and execute only applicable admitted provider-free recorded regressions, with auditable zero-selection or blocking gaps.
Core proposed owner: scripts/task/affected-checks/{index,plan,snapshot,resolve,contracts}.mjs and owning tests; preserve existing evaluation/cycle graph semantics.
Down proposed owner: scripts/lab/recorded-regression/{registry,admit,run,receipt,index}.mjs, owning tests, and minimal scripts/task/finish.mjs delegation after narrow checks.
Public API: await planAffectedChecks({ repositories, roots, assetEdges }) -> { sourceBasis, changes, selected, unaffected, gaps, graphComplete, planDigest }.
repositories: [{ id, root, before:{head}, after:{head,dirtyDigest}, linkedPackages:{[publicPackageName]:repositoryId} }]; reject unknown heads, stale dirty digests or ambiguous package ownership.
roots: [{ id, repositoryId, entries:string[] }]; assetEdges: [{ repositoryId, owner, asset }]; ids/paths are normalized and repository-contained.
Engine reads immutable before git objects and hash-verified candidate working content; sourceBasis binds both paired heads, file status/content digests and dirty fingerprints.
Build independent before/after import graphs; union reverse impact so removed imports, deleted roots and renames cannot disappear from selection.
Resolve actual package.json public exports and source entry targets in BOTH paired snapshots, including barrels, literal dynamic imports and declared prompt/model assets.
Each selected row carries changed path -> import/export/asset chain -> root evidence with before/after side; gaps name unresolved relevant edges without exposing content.
Nonliteral dynamic import, unresolved paired export, unreadable changed asset or absent required root yields graphComplete:false and blocking gap, never unaffected.
Down registry row: {id,rootIds,scenarioId,taskId,taskDigest,oracleDigest,requiredProof,artifactId,artifactManifestDigest}; roots must be real executable boundaries.
Proof classes: raw_transport, original_read, recorded_build, four_attempt_task; each has its own minimum admission contract and may not substitute for a stronger class.
Raw transport needs complete exact request/reply bytes/status/MIME/correlation; original_read needs exact command/result/artifact/binding identity, raw-row equality and valid public schema.
Recorded_build additionally needs completed live domain trace, authentic pre-entry starting snapshot/position and strict public runtime composition; open/stopped prefixes are diagnostic only.
four_attempt_task additionally needs unchanged task/oracle, complete result acceptance and three saved-Flow continuation proofs with explicit calls/costs; unknown is not zero.
An absent capture is an explicit registry state {artifactId,state:"absent",reason}; selection produces blocked_missing_capture, not a skip, fabricated fixture or removed row.
Other admission gaps (incomplete trace, missing start, unmatched request, historical process divergence) remain exact blocking reasons for the required class.
Finish order: integrate candidate dev/Core currency -> existing narrow checks -> verified affected plan -> selected admission/replay -> receipt verification -> parent merge.
Mandatory semantics: --skip-checks and --full-check do not bypass this gate; there is no success override or automatic paid fallback.
Only graphComplete:true with zero applicable rows may skip replay successfully; emit unaffected receipt with changed basis, examined roots and planDigest.
Any applicable absent/invalid evidence, unregistered relevant replay root, unresolved reach or failed replay exits nonzero before merge; report distance reached and first gap.
Cache reuse requires identical paired sourceBasis, planDigest, registry/task/oracle/artifact digests, proof class and replay implementation fingerprint; otherwise rerun.
Keep proof outputs per fixture; downstream receipt names observed class/result/continuation and measured provider-free egress, with fullAttemptAccepted:false for every prefix.
Prompt/model asset impact also selects required supervised fixed-model smoke; missing current approved smoke receipt blocks its own gate, never spends automatically.
Acceptance owners: deletion/rename, barrel/export retarget, paired public dependency, literal dynamic import, declared asset, unresolved reach, unrelated leaf and stale snapshot.
Down owners: missing artifact selected vs unrelated, weaker-proof refusal, zero-selection receipt, --skip-checks nonbypass, stale cache and first divergence/no network fallback.
No ten-task full suite by default; no synthetic replacement of historical captures; F25 remains only original-read candidate until that actual reader proof passes.
Validation for this follow-up: read-only reasoning from existing intake; no extra graph execution, heavy job, product edit, browser or provider call.
