# Generic rejection observation consumer

Status: Worker handoff complete — source frozen; supervisor integration gates pending.
Owner: c-validation worker. Paired unit: t461.

## Current State

Implemented approved Core-only generic consumer. A owns downstream observation production/contracts; B owns downstream column fidelity. Read authoritative Current State/brief, provenance audit, retained D evidence and Core boundary. No downstream product edits, shared-document edits, commits, provider calls or browser sessions.

Producer rejectedObservations aligns exactly with full original-condition rejectedSamples. Closed passive observations carry original nonnegative conditionIndex, positive page/item, source field|read, optional generic readKind text|attribute|value|link|column, distinct present|absent|unavailable|withheld states. Only present carries string value, including empty. Null remains legacy unknown. No addressing additions, executable bindings, eligibility inference or predicate re-evaluation.

## Changes and ownership

- Core runtime/result-verification/contracts.ts: additive optional typed saved-account companion leftOutObservations.
- Approved focused condition-observation/{parse,screen,index}.ts and nearest tests/parse.test.ts: closed validator and privacy projection. Contract type imports are erased; storage's pure validator has no LLM runtime dependency. Helpers stay in feature-local barrel, without new public program exports.
- service/summaries/extraction-summary.ts +tests: validate full companion dimensions/ordinals before retaining same alone-prefix and label positions as aloneRows; store conditions.aloneObservations beside them. Invalid supplied companions reject summary under established whole-summary admission rule.
- read-account/{accounts,alone-rows}.ts +nearest tests: preserve witnesses beside saved-result labels. Existing denied-key, credential and locator policy screens before model-facing publication; denied source derives from authored tested field/helper attribute. Counts/legacy label formatting unchanged.
- Approved additional read-account/looped-account.ts +nearest test: concatenate labels/observations in pass order, including conflicting repeated-label reads; if any pass supplies companion, missing legacy positions become null, never absent. No dedupe/fabricated provenance.
- build-test/read-rows.ts +tests: retain screened trial observations matching explicit optional original entry.conditionIndex. Sparse group position never becomes predicate index. Missing-index all-null legacy companions stay unknown; invalid companions discarded without removing legacy labels/counts.

## Observed validation

Fail-first: three neutral integration regressions (actual runtime-dispatched stored attempt, saved read account, real build-test summary) failed with missing companions while 30 existing cases passed. Initial shell alternation quoting rejected before tests; reran exact files without filter. After implementation those files passed 34 cases. Additional loop-merger regression separately failed first with companion missing.

Final focused source run: 72/72 tests in seven owner files passed (24.37 seconds): summaries/extraction-summary 26; read-account/accounts 23; alone-rows 7; observation integration 3; looped-account 1; parser/screen 3; build-test/read-rows 9. Covers actual repeated-pass aggregation, sparse groups, denied authored helper keys, credential/locator withholding, distinct empty/present/absent/unavailable/withheld/null states, malformed closed metadata, aligned alone/label projection. Added privacy test initially expected ordinary URL to satisfy existing locator detector; corrected fixture to actual selector matching policy without broadening policy.

Cache-free Core package typecheck, current owning library build and native audits pending. Combined downstream gates supervisor-coordinated after current Core output/doc freeze.

## Limits

Source unit/integration evidence only; no paid/live browser outcome claim. Existing no-text label omission preserved with matching companions omitted together; reported counts remain original. Legacy absent companions gain no absent-read assertion. Passive evidence adds no numeric truth, eligibility verdict or scenario-specific model guidance.

Current frozen Core gates observed: direct pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental false exited 0. First attempt found literal widening of parser's source member only; explicit Pick contract type annotation corrected it without behavior change, source refrozen and parser 3/3 tests rerun passed. Forced owning pnpm.cmd --filter fluxiq build with FLUXIQ_BUILD_FORCE=1 exited 0 in 65.447 s, emitted 7262 files / 21,134,577 bytes. Current artifact packages/fluxiq/dist/runtime-build-identity.json. Native audit pending supervisor authored-doc freeze; downstream package gates await A producer test-layout refreeze.


## Exact final Core commands

Run from paired t461/!FluxIQ:

- pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/service/summaries/tests/extraction-summary.test.ts src/programs/automation-studio/runtime/result-verification/read-account/tests/condition-observation.test.ts src/programs/automation-studio/runtime/result-verification/read-account/tests/looped-account.test.ts src/programs/automation-studio/runtime/result-verification/condition-observation/tests/parse.test.ts src/programs/automation-studio/runtime/result-verification/build-test/tests/read-rows.test.ts src/programs/automation-studio/runtime/result-verification/read-account/tests/accounts.test.ts src/programs/automation-studio/runtime/result-verification/read-account/tests/alone-rows.test.ts
- pnpm.cmd --filter fluxiq exec tsc --noEmit --incremental false
- FLUXIQ_BUILD_FORCE=1 in process environment; pnpm.cmd --filter fluxiq build
- After type annotation only: pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/result-verification/condition-observation/tests/parse.test.ts
- git diff --check: exit 0 on final source.

Current Core artifactDigest: e274f117a232ef898a6256ff1942f989191ac7932b6d23b693ba1926e1c31934. Source/artifact frozen for supervisor verification. A separately reported downstream current-output types passed; worker does not substitute that claim for independent supervisor verification. Native audits remain coordinated after authored-doc freeze.


Supervisor coordination update: authored Core/downstream documentation is frozen. Root explicitly owns combined native audits and independent tests/types; no worker audit repetition requested. All worker source/tests/builds remain frozen. Existing pending-audit notes above describe chronology; current remaining audit owner is supervisor. No further worker product changes or validation runs.

## Supervisor acceptance

Root independently inspected source and observed Core72/domain78/extension83 owning tests, all cache-free affected typechecks and both native audits passed. Headed Chrome134 T2 packet/hash/DOM/schema-order checks passed independently; no background transport, model verdict, continuation or live withholding claimed. Current-dev integration and combined-source narrow gates still required before publication.
