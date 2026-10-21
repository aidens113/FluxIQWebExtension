# Codex recovery: t752

## Progress (2026-10-20)

- Read the original brief, lane and A-D reports and handoff; audited paired worktree status. A/B and C integration patches exist. Judge consistency is already implemented but unreported, spanning structured diagnosis, earlier-advice memory and unsupported-no reasks.
- Supervisor flagged two correctness requirements: earlier advice must never supersede the immutable task; unmeasured defects must remain nonpromotable.
- Started grouped Core narrow gate over result-verification, project-agent contracts/dispatch, closest-trial, candidate/subflow trial services, candidate gates, and llm. Running; exact output will be added.
- Started Core typecheck. Running.
- Core structure audit failed: new as-never test stubs (2 files), earlier-advice barrel imports, and located-defects at excessive depth (2 files). Repairing these before rerun.
- No commits, merges, pushes, paid runs, or panel management. Shared files flagged to supervisor for integration.

## Recovery changes and acceptance boundary

- Preserved inherited A-D work and integrated Core judge changes; fixed structural violations by moving located-defects up one feature level, using barrel imports and typed test fixtures.
- Corrected unsafe judge wording: changed advice is never proof of compliance/correctness; the original request remains authoritative.
- Removed advice eviction after three trials; advice per revision remains bounded (800 chars).
- Added structured `other` for non-row requirements. Wrong ordering/format, missing required field/action and unmeasured constraints remain unsure after unsupported rechecks; they never create an automatic yes.
- Preserved absence versus explicit [] through provider-result, context packing and verdict screening. Current output schema requires defects; legacy-compatible reply reading accepts omission and keeps prior prose weighing. A provider ignoring its schema can therefore retain a conservative legacy no. This limitation does not manufacture a yes.
- Added optional claimed cell `value`; Core checks it against stored cell data, so an exact-answer row falsely assigned another value does not support a no. Row/column membership only grounds a reference; it does not prove semantic correctness. Existing prose/condition-witness checks still run first.
- Updated Core architecture (judge consistency section) and prompt contracts/pins. Added headed social read spec assertion that real Core verifier holds two repeated contradictory method nos as unsure against actual whole-text browser rows.

## Observed checks so far

- Initial `pnpm` commands were refused by PowerShell's execution policy; used pnpm.cmd thereafter.
- Initial Core `pnpm.cmd exec tsc --noEmit -p .`: exit 0.
- Initial Core audit: 5 violations from partial work (as-never, imports, depth); repairs landed, rerun pending.
- Initial grouped broad affected Core selection: interrupted after revealing old unstructured-no regressions. No acceptance claim or real-SQL group result from this run.
- First focused grouped selection: unsupported-no route 13 tests passed; located-defects 8 passed; earlier-advice 5 passed; unsupported build judge 1 passed; output-schema 10 passed. system-prompt 2 failures (old literal assertions), subsequently updated. Real-SQL group had no selected files and exited 0.
- First headed Chrome content harness: social-read-discloses-kept passed (18.7s); read 3 kept rows / 1 disclosed row, read measured 2886ms. It ran before the final added Core judge assertion. Structure-control result and final rerun pending.
- Final 8-file grouped Core gate, final typecheck/audits, domain/extension focused tests, paired Core build: running. Exact completion lines will follow.

## Strict current decoding (2026-10-21)

The earlier conservative omission bypass is removed. `harness/run.ts` identifies current verification calls to `parseAutomationStudioLlmProviderResult`; a negative reply with missing, malformed or partly malformed defects is unusable (`llm_output.verification_defects_required`). Positive and unrelated diagnoses retain existing behavior. Direct legacy persisted decoding without the current-call flag remains readable. New route tests exercise the actual verifier/harness path.

Supervisor owns tests/run-outcome-harness.ts, run-outcome.test.ts and run-outcome-repair.test.ts for fixture migration; worker excludes them. Worker migrates other actual negative fixtures with measured rows or explicitly records uncertainty when no wrong row/action was established. Existing pure negative verdict mapping tests now inject already-judged reports, rather than implying that action-only prose is a measured negative.

Observed strict gate: `pnpm.cmd test <build-test/tests/judge.test.ts> <tests/verify.test.ts> <tests/reask-route/tests/unsupported-no-route.test.ts>` in Core packages/fluxiq -> `Test Files 3 passed (3)`, `Tests 71 passed (71)`; real-SQL group `No test files found, exiting with code 0`; `[vitest-groups] all groups passed: parallel, real-sql`, process exit 0.

Earlier 8-file focused gate actually passed 138 tests and both groups; initial shell exit 1 came from PowerShell native stderr redirection, while runner reported all groups passed. Likewise both audit logs contain passed: Core 441 warnings/1152 baselined; downstream 219 warnings/618 baselined. Later commands explicitly exit with native LASTEXITCODE. Source has since changed for strict-current decoding and needs final gates.

Domain focused tests: 729 passed / 0 failed. Extension extraction/actions: 595 passed / 0 failed. Both headed social specs passed (6.1m): read 3 rows/1 disclosure at 2886ms; structure start5/drawn10/whole34/fields64/detect2586ms. Final browser judge assertion added after that run is pending fresh Core build.

Core build completed but inputs changed while it ran, so it deliberately did not stamp; do not treat as a current build. Core docs:reference completed and regenerated both reference files (4111 public declarations). No full suites, paid runs or panel management.

## Fixture migration validation (2026-10-21)

- Five-file grouped gate (narrowed-before, judge-accounts-for-rows, judge-sees-the-read, refuted-no/missing-claim-clause, refuted-no/narrowing-step-claim): `Test Files 5 passed (5)`, `Tests 65 passed (65)`, real-SQL none, both groups passed.
- Three-file grouped gate (build-test/judge-timeout, tests/judge-reply/truncated-reply, service/candidate-trial/tests/run): `Test Files 3 passed (3)`, `Tests 33 passed (33)`, real-SQL none, both groups passed. Timeout fixture uses a positive response to isolate timing; the transport negative fixture now actually stores an excluded replacement row and supplies its defect.
- Four-file grouped gate (build-yes-hold/held-double-no, saved-flow-trial, standing-no-record/record, label-condition-replay): `Test Files 4 passed (4)`, `Tests 34 passed (34)`, real-SQL none, both groups passed. Existing concrete row claims now carry those same rows and the request's own clause as structured defects. No fixture data was fabricated as output.
- Seven-file candidate/subflow gate migration first run: 12 failed / 11 passed. Existing local test adapters dropped standingNo on unknown outcomes, unlike production. They now carry unknown records and readings. Exact-output negative advice explicitly carries an empty account and remains unsure; Core's measured kept-condition record is still retained. Scripted independent yeses returned during reconciliation now settle inside the same trial, so standing-swing tests no longer require an additional trial. Rerun active.
- Final Core typecheck found two test-only errors (optional reading.observed, and dead expected===no branch after intentional unmeasured verdict migration). Both fixed; fresh typecheck still required.
- Added current malformed-account regressions to unsupported-no-route (non-array, unknown kind, and claimed value without a column). These require a fresh focused run.

## Final source-review follow-ups (2026-10-21)

Supervisor found two additional concrete corners while the stamped Core build was frozen:

1. Column grounding accepts fuzzy aliases, but claimed-value comparison currently uses exact keys. Planned correction: one unique canonical column resolution reused by both checks; ambiguity or no measured cell remains unconfirmed. Add alias false-value and ambiguous-alias regression.
2. Advice history deduplicates/filters by revision. This can discard seeded advice if a rebrief restarts numbering, and hides previous advice on a retest of the same revision. Planned correction: keep completed judged-trial entries in order, including same-numbered trials, rather than treating local revision as global identity. Add seeded same-revision/retest regression.

No source was edited during the frozen build for these follow-ups. Current final prompt group has two failing old expectations that dropped explicit []: patch-request-diagnosis and diagnosis-channel. They must now retain [] to preserve absence versus empty account; update those expectations along with the follow-ups and rerun their focused tests. Five other final contract files passed, including current malformed-account production-path regressions. Final pre-follow-up tsc passed; final pre-follow-up Core/downstream audits passed (441/1152 and219/618). Final Core build still active.

## Review follow-ups complete (2026-10-21)

- A column now resolves once to a unique canonical key, used by both grounding and actual-value checking. Missing/ambiguous resolution or a claimed value with no measured cell remains unconfirmed. Exact and aliased false-value claims, plus ambiguity, have regressions.
- Memory now keeps completed judged-trial history in order; local revision numbers are not identities. Same-revision retests and seeded rebriefs preserve prior advice and retain both trial entries. Existing per-entry text bounds remain.
- Removed unused private currentVerification parameter from the internal parser and corrected stale legacy/current comments. Public current-call enforcement remains.
- Follow-up grouped gate: 6 files / 77 tests passed; real-SQL none; both groups passed. Enhanced malformed-account route table (actual array inputs plus mixed valid/invalid account): 1 file / 19 tests passed; both groups passed. Follow-up Core tsc exit 0. Core docs reference regenerated after final cleanup (4111 public declarations), and git diff --check exit 0.
- Source/tests are frozen for final stamped rebuild. Supervisor may independently run owning-folder acceptance. Final build and final headed/read-completion/browser judge regression pending.

## Owning-gate fixture follow-up (2026-10-21)

Supervisor's independent owning-folder gate exposed further current-negative fixtures without the required defect account. Final stamped build was safely interrupted (exit 1), with no orphan t752 tsc process; building resumes only after these fixtures and the complete owner gate are stable. Migrating the specifically failing route fixtures, preserving row evidence and existing refutation checks. Unnamed possible missing rows/counts and search-method doubts remain uncertain; no default fabricated defects are added to shared provider helpers. Final headed three-spec acceptance remains pending.

## Owner gate migration progress

Supervisor's full result-verification owner selection exposed missing current-negative accounts in 12 additional fixture files plus the known explicit-empty assertion. First migration gate: 13 files, 91 passed / 9 failed. Six of the remaining affected files now pass (37/38 in seven-file follow-up including the 19 production unsupported-negative regressions); only build-test/judge-rows remains under investigation. That replay appends the unfiltered read to the filtered read, so rows called missing may in fact be stored; the fix must use the actual kept accessory witness, not invent missing rows.

Small source correction in agreement/unsupported-no.ts preserves Core's existing partial/whole contradiction labels on uncertain final readings. Earlier the final unsupported label silently dropped this metadata. Existing split/partial route tests exercise the real path: claims remain unsure, and the actual contradiction finding remains attached. No promotion is inferred from a label. Current package typecheck is running; final build remains stopped pending source stability and supervisor integration decision.


## Stable checkpoint after owning-fixture migration

All previously failing owner fixture files now have a passing focused run. Initial migration gate: 13 files / 100 tests, 91 passed and 9 failed. The seven-file follow-up passed six files / 37 tests; its only remaining failure was build-test/judge-rows, subsequently passing all 4 tests. The 19 production unsupported-negative regressions also passed in that follow-up. All runs used parallel and real-sql groups; these narrow selections had no real-SQL tests. No full suite was run. Supervisor still independently reruns the owning directory.

Exact command (cwd Core/packages/fluxiq; external `TEMP/t752-owner-fixtures2.log`):

```text
node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql "src/programs/automation-studio/runtime/result-verification/tests/first-ask-route/tests/first-ask-confirmed.test.ts" "src/programs/automation-studio/runtime/result-verification/refuted-no/tests/references-route.test.ts" "src/programs/automation-studio/runtime/result-verification/tests/reask-route/tests/narrowing-no-route.test.ts" "src/programs/automation-studio/runtime/result-verification/build-test/tests/judge-rows.test.ts" "src/programs/automation-studio/runtime/result-verification/refuted-no/tests/request-words-route.test.ts" "src/programs/automation-studio/runtime/result-verification/request-rows/tests/kept-condition-advice.test.ts" "src/programs/automation-studio/runtime/result-verification/refuted-no/tests/split-partly-refuted-route.test.ts" "src/programs/automation-studio/runtime/result-verification/tests/check-card.test.ts" "src/programs/automation-studio/runtime/result-verification/refuted-no/tests/judge-route.test.ts" "src/programs/automation-studio/runtime/result-verification/tests/reask-route/tests/split-no-route.test.ts" "src/programs/automation-studio/runtime/result-verification/refuted-no/tests/partly-refuted-route.test.ts" "src/programs/automation-studio/runtime/result-verification/build-test/tests/first-ask.test.ts" "src/programs/automation-studio/runtime/result-verification/tests/verdict.test.ts"
```

Exact command (cwd Core/packages/fluxiq; external `TEMP/t752-owner-fixtures3.log`):

```text
node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql "src/programs/automation-studio/runtime/result-verification/tests/reask-route/tests/narrowing-no-route.test.ts" "src/programs/automation-studio/runtime/result-verification/build-test/tests/judge-rows.test.ts" "src/programs/automation-studio/runtime/result-verification/refuted-no/tests/split-partly-refuted-route.test.ts" "src/programs/automation-studio/runtime/result-verification/tests/check-card.test.ts" "src/programs/automation-studio/runtime/result-verification/tests/reask-route/tests/split-no-route.test.ts" "src/programs/automation-studio/runtime/result-verification/refuted-no/tests/partly-refuted-route.test.ts" "src/programs/automation-studio/runtime/result-verification/tests/reask-route/tests/unsupported-no-route.test.ts"
```

Exact command (cwd Core/packages/fluxiq; external `TEMP/t752-judge-rows-final.log`):

```text
node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql "src/programs/automation-studio/runtime/result-verification/build-test/tests/judge-rows.test.ts"
```

Final package typecheck: `pnpm.cmd exec tsc -p packages/fluxiq/tsconfig.json --noEmit` (Core root), exit 0; external TEMP/t752-type-owner-followup.log. `git diff --check` exit 0. Core final audit completed: 441 warnings / 1152 baselined, passed (TEMP/t752-audit-stable.log). Audit preceded final small metadata/fixture changes.

The build-test rows fixture now reports its actual existing left-out earbuds via asked_missing, keeping the original checkedRows assertions and no verdict. No synthetic data or default defects were added. Unnamed joint-condition gaps and unmeasured region/action claims remain unsure. Final unsupported readings preserve Core partial/whole contradiction metadata, tested through production split/partial routes. Strict current negative decoder rejects missing/malformed accounts; legacy direct persisted reads remain compatible. Presence grounding does not claim formal proof of task semantics: Core checks recorded contradictions first and claimed cell values when supplied; other/unmeasured constraints remain unconfirmed.

SOURCE STABLE; no build running. Awaiting supervisor owning gate/integration decision before final stamped rebuild. Final headed three-spec/browser judge regression and downstream final package checks remain pending.

Core changed-file list at stable checkpoint (includes inherited lane work and supervisor three-fixture partition):

```text
docs/architecture/automation-studio/llm-flow-bootstrap.md
docs/reference/framework-reference.md
packages/fluxiq/docs/reference/framework-reference.md
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/contracts.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/earlier-advice-memory.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/earlier-advice/tests/trial-gate-earlier-advice.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/kept-condition/tests/kept-condition-after-split.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/kept-condition/tests/kept-condition-drop.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/kept-condition/tests/kept-condition-fixture.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/kept-condition/tests/kept-together-drop.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/trial-gate-standing-no.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/trial-gate.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/contracts.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/disclosure-advice.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/subflow-trial-gate.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests/builder-loop.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests/earlier-advice/tests/subflow-trial-earlier-advice.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests/kept-condition-drop.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests/revisions-after.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests/standing-no-swing.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/output-schema.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/output-schema.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt-pins.json
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/system-prompt.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/tests/verdict-before-cut.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/verdict-before-cut.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/context-packet.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/provider-result.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/run.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/structured-response.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/tests/patch-request-diagnosis.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/deepseek-evidence-preflight.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/diagnosis-channel.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/verification-defects/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/verification-defects/schema.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/verification-defects/well-formed.ts
packages/fluxiq/src/programs/automation-studio/runtime/project-agents/contracts/builder-return.ts
packages/fluxiq/src/programs/automation-studio/runtime/project-agents/contracts/tests/closest-trial-latest.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/receipts.ts
packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/run-brief.ts
packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/tests/earlier-advice/tests/earlier-advice-across-briefs.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/tests/receipts.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/trial-port.ts
packages/fluxiq/src/programs/automation-studio/runtime/project-agents/supervisor/tests/closest-trial.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/agreement/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/agreement/tests/loan-fixture.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/agreement/unsupported-no.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/judge.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/tests/first-ask.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/tests/judge-rows.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/tests/judge-timeout.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/tests/judge-unsupported-no.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-test/tests/judge.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-yes-hold/tests/held-double-no.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/build-yes-hold/tests/saved-flow-trial.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/contracts/earlier-advice.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/contracts/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/contracts/read-account.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/contracts/repair.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/contracts/run-result-summary.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/contracts/verification.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/located-defects/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/located-defects/located-defects.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/located-defects/tests/located-defects.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/accounts.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/kept-every-row.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/same-target.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/sentence.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/tests/working-rows.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/tests/working-sets.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/working-rows.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/working-sets.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/refuted-no/record.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/refuted-no/tests/judge-route.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/refuted-no/tests/missing-claim-clause.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/refuted-no/tests/narrowing-step-claim.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/refuted-no/tests/partly-refuted-route.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/refuted-no/tests/references-route.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/refuted-no/tests/request-words-route.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/refuted-no/tests/split-partly-refuted-route.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/refuted-no/tests/together-rows.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/request-rows/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/request-rows/kept-without-asked-column.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/request-rows/summary-reads.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/request-rows/summary-with-also-in-result.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/request-rows/tests/kept-condition-advice.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/request-rows/tests/stored-though-left-out.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/request-rows/unquoted-rows.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/standing-no-record/tests/label-condition-replay.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/standing-no-record/tests/record.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/standing-no/earlier-advice.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/standing-no/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/standing-no/tests/earlier-advice.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/check-card.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/first-ask-route/tests/first-ask-confirmed.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/judge-accounts-for-rows.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/judge-reply/tests/truncated-reply.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/judge-sees-the-read.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/narrowed-before.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/reask-route/tests/narrowing-no-route.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/reask-route/tests/split-no-route.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/reask-route/tests/unsupported-no-route.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/run-outcome-harness.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/run-outcome-repair.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/verdict.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/tests/verify.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/verdict/codes.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/verdict/defects.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/verdict/index.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/verdict/result-verdict.ts
packages/fluxiq/src/programs/automation-studio/runtime/result-verification/verify.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/feedback.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/run.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/summary.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/tests/earlier-advice/tests/earlier-advice.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/tests/processed-out.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/tests/run.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/subflow-trial/run.ts
packages/fluxiq/src/programs/automation-studio/runtime/service/subflow-trial/tests/earlier-advice.test.ts
```

Downstream changed-file list at stable checkpoint (includes inherited lane work and supervisor three-fixture partition):

```text
apps/extension/e2e/content/tests/extraction/tests/social-read-completion.spec.ts
apps/extension/e2e/content/tests/extraction/tests/social-read-discloses-kept.spec.ts
apps/extension/e2e/content/tests/extraction/tests/social-structure-row-control.spec.ts
apps/extension/src/content/actions/extract-list.ts
apps/extension/src/content/extraction/detect-structure.ts
apps/extension/src/content/extraction/field-budget/index.ts
apps/extension/src/content/extraction/field-budget/kept-sources.ts
apps/extension/src/content/extraction/field-budget/tests/kept-sources.test.ts
apps/extension/src/content/extraction/infer-fields.ts
apps/extension/src/content/extraction/infer-list.ts
apps/extension/src/content/extraction/item-shape/index.ts
apps/extension/src/content/extraction/item-shape/item-shape.ts
apps/extension/src/content/extraction/item-shape/tests/item-shape.test.ts
apps/extension/src/content/extraction/list-reader.ts
apps/extension/src/content/extraction/tests/fake-shadow-dom.ts
apps/extension/src/content/extraction/tests/infer-fields.test.ts
apps/extension/src/content/extraction/text-disclosure/disclosure-control.ts
apps/extension/src/content/extraction/text-disclosure/index.ts
apps/extension/src/content/extraction/text-disclosure/press-disclosure.ts
apps/extension/src/content/extraction/text-disclosure/read-disclosing.ts
apps/extension/src/content/extraction/text-disclosure/refused-controls.ts
apps/extension/src/content/extraction/text-disclosure/tests/read-disclosing.test.ts
apps/extension/src/content/extraction/text-disclosure/tests/text-disclosure.test.ts
apps/extension/src/content/extraction/text-disclosure/text-disclosure.ts
docs/architecture/extension-client.md
docs/working/trace-offline-trials-plan/reports/codex-recover-t752.md
docs/working/trace-offline-trials-plan/reports/codex-t752-supervisor-fixtures.md
docs/working/trace-offline-trials-plan/reports/t752-a-closest-trial.md
docs/working/trace-offline-trials-plan/reports/t752-b-working-rows.md
docs/working/trace-offline-trials-plan/reports/t752-c-read-discloses-kept.md
docs/working/trace-offline-trials-plan/reports/t752-d-structure-row-control.md
docs/working/trace-offline-trials-plan/reports/t752-judge-consistency-and-read-speed.md
domain/src/actions/extraction/read-request.ts
domain/src/actions/extraction/request.ts
domain/src/actions/extraction/schema.ts
domain/src/actions/extraction/summary.ts
domain/src/actions/extraction/tests/disclose-text.test.ts
domain/src/client/tests/gateway-command-parameters.test.ts
domain/src/output-nodes/extract-list/catalog-text.ts
domain/src/output-nodes/extract-list/issues.ts
domain/src/output-nodes/extract-list/tests/disclose-text.test.ts
domain/src/runtime/llm-evidence/action-failure/tests/refusal.test.ts
domain/src/runtime/llm-evidence/node-run/tests/run.test.ts
domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts
domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.ts
domain/src/runtime/llm-evidence/plan-resolution/issue-position.ts
domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts
domain/src/runtime/llm-evidence/rejection-next/tests/next-sentence.test.ts
domain/src/runtime/llm-evidence/structure/packet.ts
```


Supervisor independent stable gate: session 61955, 32 changed owner files / 362 tests passed, real-SQL none, both groups passed, native exit 0. This gate included tracked changed owner tests, located-defects and earlier-advice. The untracked production unsupported-no-route file was independently focused earlier (19 tests passed) and should be named explicitly in the integrated owner selection. Supervisor is checkpointing both task trees and will bring incoming t753 dev into this pair before any final build. Worker source remains frozen.
