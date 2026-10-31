# Grounded toggle Core implementation — t817

Outcome: Partial

Core package files are frozen for lead integration. Implementation and owning source tests are complete; P1b parent sync, version reservation, final types/library build and native browser proof remain with the lead. No git mutations, package-version edits, model calls, browser runs or panel management were performed.

## Result

- Ties collect all observations while retaining whole-target, handle, trial written-identity, renumbering and duplicate-step rules. Matching supplies no state intent.
- `runtime/toggle-state/` validates bounded plain signatures and an explicit exact `ensureState`. Complete pairs are direction-independent; conflicts never vote. Missing, unobserved and unresolved selections have distinct answerable refusal codes. A chosen state survives reversals and is copied from stored evidence.
- Actual `beforeSignature` survives exploration, trial ingestion/deduplication, build-record writing/parser/reopening/restoration. Legacy singleton records stay readable without an invented inverse. CC9 `shown` is separate from predicted `ensures` and uses the same bound.
- Repeated exploration refuses before dispatch without a grounded choice; unknown first presses still reveal evidence. Admitted undo retains its bypass. Tests cover selected already-satisfied skipping.
- The plan removes every raw written `ensureState` before checking scope, and reintroduces only a grounded stored value. Other consequences and unsupported-node paths retain the existing stripping behavior. A stateful target alone does not prove its node toggles: explicit state-setting nodes keep their own parameters. The existing unsupported path refuses only where that node's own tied press supplied another state-setting node.
- The selected state reaches revalidation/layout, JSON saved-graph round-trip and actual Core graph execution. Generic authoring guidance lives in the existing candidate action example; legacy guidance digests remain unchanged. Architecture and deterministic reference copies were updated.

## Exact changed Core paths

All source paths below are relative to `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `toggle-state/index.ts`, `choice.ts`, `signature.ts`, `value-key.ts`, `tests/choice.test.ts` (new focused feature; avoids adding a 26th file to `script-statements/`).
- `flow-bootstrap/explored-toggles.ts`, `tests/explored-toggles.test.ts`, `action-permissions.ts`, `tests/action-permissions.test.ts`.
- `flow-bootstrap/script-statements/index.ts`, `toggle-idempotent.ts`, `toggle-tie.ts`, `tests/toggle-idempotent.test.ts`, `tests/toggle-idempotent-trial-pass.test.ts`, `tests/toggle-tie.test.ts`.
- `flow-bootstrap/candidate/submission.ts`, `tests/toggles/tests/submission-toggles.test.ts`, `submission-toggles-graph.test.ts`, `submission-toggles-undeclared.test.ts` (the latter two share the preceding tests directory).
- `flow-bootstrap/plan/flow-script-format.ts`, `tests/flow-script-format.test.ts`.
- `llm/harness-options/binding.ts`, `plan-parameter-resolution.ts`, `tests/plan-parameter-resolution/tests/control.test.ts`.
- `project-agents/record/build-record.ts`, `build-record-parser.ts`, `tests/store.test.ts`.
- `service/project-build-toggles/toggles-record.ts`, `tests/project-build-toggles-record.test.ts`.
- `service/candidate-trial/tests/already-in-state/tests/trial-toggles.test.ts`.

Documentation: `docs/architecture/automation-studio/llm-flow-bootstrap.md`, `docs/reference/framework-reference.md`, `packages/fluxiq/docs/reference/framework-reference.md`. This downstream report is the only downstream file edited by this worker.

## Observed validation

Commands ran in paired Core root. Vitest paths below begin at `packages/fluxiq/` (the `--filter fluxiq exec` working directory).

- Fail-first: `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests/toggle-idempotent-trial-pass.test.ts -t "an observed toggle needs" --maxWorkers=2 --minWorkers=1` → **2 failed**, reproducing no refusal for mixed first-already-satisfied passes and selected shown state overwritten by press-result state. Same command after implementation → **2 passed**.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/toggle-state/tests/choice.test.ts src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests/toggle-idempotent.test.ts src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests/toggle-idempotent-trial-pass.test.ts src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests/toggle-tie.test.ts --maxWorkers=2 --minWorkers=1` → **36 passed** initially. Later owning reruns passed the added trust-boundary and setter assertions (**7** idempotent tests and **12** trial-pass tests), for **38 distinct final tests** in these four files.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/toggles/tests src/programs/automation-studio/runtime/flow-bootstrap/tests/action-permissions.test.ts src/programs/automation-studio/runtime/flow-bootstrap/tests/explored-toggles.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/plan-parameter-resolution/tests/control.test.ts src/programs/automation-studio/runtime/service/project-build-toggles/tests/project-build-toggles-record.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/already-in-state/tests/trial-toggles.test.ts src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/flow-script-format.test.ts --maxWorkers=2 --minWorkers=1` → **146 passed, 1 failed**; the new guidance assertion addressed the wrong export. The other eight files supplied **69 passing tests**. New candidate feedback assertions had earlier addressed `check.code`; corrected to the existing `check.issueCodes`/`check.feedback.code` shape.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/project-agents/record/tests/store.test.ts src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/flow-script-format.test.ts src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests/toggle-idempotent-trial-pass.test.ts src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/toggles/tests/submission-toggles-undeclared.test.ts --maxWorkers=2 --minWorkers=1` → store **14 passed**, trial-pass **12 passed**, undeclared-node **2 passed**; guidance export assertion was still being corrected.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/flow-script-format.test.ts src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests/toggles/tests/submission-toggles-graph.test.ts --maxWorkers=2 --minWorkers=1` → graph **2 passed**, including actual execution after JSON round-trip; one deliberate legacy-byte digest failed when the sentence was placed in global legacy guidance. Moved the sentence to candidate action guidance, preserving those bytes.
- Final `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/flow-script-format.test.ts src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests/toggle-idempotent.test.ts --maxWorkers=2 --minWorkers=1` → **85 passed** (78 format, 7 idempotent).
- Total final owning coverage across those observed reruns: **199 distinct tests, 14 files**. This is an aggregate, not a claim of one combined final run.
- `node scripts/structure-audit.mjs` (stdout filtered to failures/summary only) → **passed, 474 warnings, 1144 baselined**, exit 0. Earlier targeted directory/name/export/import and model-text/reach/line/packing audits also exited 0. No baseline, model-text allow-list or structure configuration changed.
- `node scripts/docs-reference.mjs` → wrote both copies, **4382 public declarations**. `node scripts/docs-reference.mjs --check` → **Deterministic framework reference is current**, exit 0. Lead should regenerate/recheck after P1b synchronization; the final source change after this check was a method documentation comment plus removal of an unused test-only type import.

## Pending / limits

No package typecheck or library build ran: expressly reserved for the lead after P1b synchronization/version and heavy-check grant. No full sweep, downstream validation or native installed-extension proof was run by this worker. No fresh model-guidance allow-list entry was required or edited. The no-`ensureState` path intentionally preserves existing behavior, per lead scope review; a stateful view does not turn an intrinsic setter into a toggle press. Lead owns final paired integration, validation and git.

Changed: Core paths listed above, plus this report.
Validation: owning source tests aggregate 199 passing final cases; full structure audit exit 0; deterministic reference check exit 0 before final comment cleanup.
Not verified: parent synchronization, final package types/build, native browser proof, Firefox, full sweep and lead acceptance.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-core-result.md`
Notes: Actual states stay distinct from intent; legacy records never acquire a guessed inverse. Package source frozen. No git or paid work.
