# w2-t027-t033 integration map

## Disposition

Use **merge-based reconciliation, not cherry-picking**. Finish and live-accept
t033 first, merge that paired task to `dev`, then merge the resulting `dev`
into t027 and make one explicit reconciliation commit on each t027 branch.
T027 contains many independent, ordered live/panel fixes; replaying more than
thirty commits by cherry-pick is less safe than retaining its history and
deleting/replacing the known first-generation batch surface.

The supervisor pinned the completed t033 product candidate after this review:
downstream `fab7cba` and Core `0dbf62f`. Those coherent commits do not change
the merge-based recommendation. T027's merge commits `0888d81` and `d0b4adc`
are ancestry synchronization only.

Production must remain default-one. No production UI/service caller may supply
`maxActionsPerDecision`; only the run-scoped Lab comparison may select `1|16`
until the same-code live acceptance passes.

## T027 Core commit classification

| Commit | Classification | Integration treatment |
| --- | --- | --- |
| `ef7892f` Add bounded multi-action evidence decisions | **Superseded by t033** | Do not retain its implementation. T033 rewrites the contract, parser, schema, transition, permission visibility, limits, diagnostics and caller control with default one. |
| `4b79c00` Accept canonical single-action evidence schema | **Superseded by t033** | T033's authenticated optional schema and default-one provider path replace it. |
| `1079ba8` Initialize panel storage before serving requests | **Independent** | Preserve all three files. |
| `b3f772f` Document panel storage startup contract | **Independent** | Preserve authored operations documentation. |
| `fe6e77a` Prevent credential autofill in automation dialogs | **Independent** | Preserve all hierarchy/modal files and test. |
| `042562e` Publish sanitized exploration batch telemetry | **Superseded by t033** | T033 slice 4 owns trace bounds, provider-decision counting, usage-once and batch diagnostics. Do not combine the old batch shape. |
| `680c515` Align panel exploration grant limits | **Independent; dependency of later panel acceptance** | Preserve authoring model/test hunks. |
| `949735d` Expose panel bootstrap preflight diagnostics | **Independent but file-dependent on t033** | Preserve categorical pre-provider failures and `llmEvidenceRuntimeStatus`; manually union them with t033 in shared diagnostics/service files. |
| `bb430e4` Expose categorical runtime repair outcomes | **Independent but file-dependent on t033** | Preserve settings/recovery files and grant-issue error mapping; manually union its handler/test hunks with t033's run-scoped option. |
| `2dcf06b` Add bounded permission continuation UI | **Independent; depends on `680c515` and public Core export** | Preserve panel/test, package export, client barrel/test and package-boundary note exactly as accepted by the final rereview. |

### Core file authority after merging t033 into t027

T033 is authoritative for these first-generation overlap paths:

- `api/contracts/adaptation.ts`;
- `runtime/llm/{deepseek-provider,evidence-loop,index}.ts` and their evidence-loop tests;
- `runtime/llm/harness/{output-validation,provider-result,structured-response}.ts`;
- `runtime/loop-limits/{evidence-loop,flow-bootstrap-evidence-loop}.ts`;
- every file under `runtime/llm/evidence-batch/` (use t033's decision without
  model-authored call IDs, strict input schema, transition, packet, stop,
  visibility and tests);
- batch-specific portions of `runtime/flow-bootstrap/generation-failure.ts`,
  its test, `runtime/service.ts`, and
  `runtime/tests/service-bootstrap/tests/generation.test.ts`.

Delete t027-only `runtime/llm/evidence-window.ts`; the t033 map explicitly
rejects that stale extraction. Do not retain t027's batch `packet.ts`, `run.ts`,
`schema.ts` or `stop.ts` merely because the paths match: their contents and
decision identity contract are superseded.

Three shared seams require a semantic union rather than choosing one side:

1. `runtime/flow-bootstrap/generation-failure.ts` and its test: start from t033
   diagnostics/accounting, then retain `949735d`'s categorical pre-provider
   failure codes and accounting.
2. `runtime/service.ts`: start from t033's run-scoped default-one limits and
   trace sanitation, then retain `949735d`'s `llmEvidenceRuntimeStatus` and
   categorical bootstrap-boundary assignments. Do not reintroduce `042562e`'s
   old `batchDecisions` construction.
3. `api/handlers/llm-generation.ts` and its test: retain t033's strict
   `maxActionsPerDecision` forwarding/refusal and `bb430e4`'s categorical
   `llmExecutionGrantIssueCode` mapping.

T027-only Core files under `apps/web/`, `runtime/action-permissions/client/`,
`runtime/recovery/{annotation,stages}`, `packages/fluxiq/package.json`,
`deepseek-bootstrap-exploration.test.ts`, and the two architecture/operations
documents are independent and should survive.

## T027 downstream commit classification

| Commit(s) | Classification | Integration treatment |
| --- | --- | --- |
| `719a34d` | **Mixed: mostly superseded** | T033 replaces all Lab max-action plumbing and the first-generation E2E specs. Preserve only the independent `domain/src/runtime/llm-evidence/tools.ts` instruction sentence unless later live evidence rejects it. Historical reports may remain clearly historical. |
| `88329d0` | **Superseded by t033** | T033 slice 4 owns bounded trace/refusal projection and caller tests. |
| `ba55ef2` | **Independent foundation** | Preserve panel golden-path orchestrator, package command and runner entrypoints. |
| `748aca8`, `f505bfc`, `5300f42`, `258fbbf` | **Independent** | Preserve host-state timeout, recorder-scroll tolerance, required-field labels, and runtime snapshot-readiness/extraction fixes with their tests. |
| `949a285`, `ac35719`, `b5bedf4`, `b056386`, `03c20a6`, `bb1a863`, `38fef3b`, `10c5cf5` | **Independent ordered live/panel fixes** | Preserve in order. `949a285` depends on `ba55ef2`; `b5bedf4` and later repair/UI changes depend on that panel path. `38fef3b`/`10c5cf5` are the accepted read-once/lifecycle-independent creation path. |
| `0fd9d0d`, `43a2606`, `e4ae4cc`, `370de7b`, `df6f66b`, `35b7f61`, `0cfbfda`, `18fb810`, `55c977d`, `c08dcf9`, `e2718cc`, `d7ec1a1`, `20e45c8`, `af53e0e`, `436f407`, `30772a0`, `230950a`, `7a93d18`, `96c6232`, `6af9ec1`, `b83f864` | **Independent/historical documentation** | Preserve as the live campaign record. Statements about the first-generation batch remain measurements, not current design. |
| `d0cca93` | **Superseded historical batch status** | Keep only as historical evidence if the working document clearly points to t033 as authoritative; do not use it as implementation guidance. |
| `96f0ba0` | **Generated/dependent** | Do not preserve its generated index result verbatim; regenerate `docs/working/README.md` after both task documents reach final state. |

### Downstream file authority after merging t033 into t027

T033 is authoritative for:

- `packages/test-runner/src/{cli,commands}.ts`;
- `packages/test-runner/src/flow-lane/creation/{lane,build-proposal}.ts` and
  `tests/build-proposal.test.ts`;
- the max-action portions of `existing-fluxiq-control.ts` and its test;
- t033-only `run-scenario.ts` and `tests/commands.test.ts`.

Manually union `existing-fluxiq-control.ts` and
`tests/existing-fluxiq-control.test.ts`: retain t033's optional run-scoped
`maxActionsPerDecision` request and t027 `03c20a6`'s bounded terminal-repair
outcome support.

Restore current-dev/t033 versions of t027-only
`packages/test-runner/src/live-llm/{live-llm-plan,live-llm-run}.ts`; t033 keeps
the feature control outside the provider budget plan and threads it only
through the create-Flow Lab lane. Delete the two t027 first-generation files:

- `apps/extension/e2e/content/tests/exploration-state/tests/multi-action-exploration.spec.ts`;
- `apps/extension/e2e/content/tests/exploration-state/tests/multi-action-safety.spec.ts`.

They assume globally enabled lists and model-authored call IDs and therefore do
not exercise t033's contract. The eventual live acceptance is the production
panel + unpacked extension A/B specified by t033, not these direct loop specs.

Preserve all other t027-only product files. Regenerate the working-document
index after reconciliation instead of choosing either branch's copy.

## Executable integration sequence

1. **Freeze t027.** Make no additional product changes there while t033 is
   validated. T027's authorized port-3000 process is operational evidence, not
   an integration worktree and must not be used for builds.
2. **Complete t033 as a coherent paired task.** Commit its Core slices and
   downstream Lab caller on their task branches, preserving default one. Merge
   current `dev` into both t033 branches and resolve/gate there.
3. **Run the exact same-code live A/B before promotion.** Baseline `1`, variant
   `16`, fresh isolated state/profile per arm. Require both persisted valid
   Flows, both deterministic extension oracles, at least one variant decision
   completing two ordered actions, usage once, ordered state, and exact stop /
   permission behavior.
4. **Integrate t033 first.** Finish/merge the downstream t033 task and then its
   Core counterpart under the paired-task procedure; push both `dev` branches
   together only after their required checks. This establishes the
   authoritative reconciled batch implementation on `dev`.
5. **Merge updated `dev` into both t027 task branches.** Do not cherry-pick the
   t027 chain. Resolve using the authority lists above. Add one explicit
   reconciliation commit per repository that removes the stale batch surface
   while retaining the independent t027 behavior.
6. **Verify the negative inventory before tests.** No t027 direct batch E2E
   specs, no t027 `evidence-window.ts`, no model-authored batch call IDs, no
   old `batchDecisions` telemetry builder, no Lab control in
   `live-llm-plan/run`, and no production caller selecting more than one.
7. **Verify the positive inventory.** T033 contract/transition/visibility/
   state/diagnostics/caller files are present; t027 panel storage, autofill,
   golden path, latency/reconnect/repair/extraction, categorical diagnostics,
   permission continuation/public export, response observer, and creation
   acceptance changes remain present.
8. **Regenerate the working-document index**, update both Current State
   sections to name the reconciliation, then run focused union checks followed
   by the final repository gates once. Finish t027 downstream first and Core
   second, then push both `dev` branches together.

## Stop conditions

Stop without promoting either branch if any of these occurs:

- t033's live variant does not create and execute the same valid user-visible
  Flow as baseline, or merely emits a list without completing two actions;
- provider usage, trace iterations, action rows, state records, permission
  termination, or target-stability stops disagree;
- any production caller opts into more than one, or default-one no longer
  removes/rejects the list surface;
- reconciliation would retain model-authored batch call IDs, the stale evidence
  window, old batch telemetry, or direct-loop E2E as acceptance evidence;
- a conflict appears outside the shared paths named above, or preserving an
  independent t027 diagnostic requires weakening t033's closed parser,
  permission visibility, accounting or run-scoped control;
- Core/downstream paired revisions cannot pass focused union checks and final
  gates together.

The provider-triggered permission-dialog journey remains an explicit live gap,
not evidence against this integration map and not something to silently claim
from component coverage.

No product/test changes, test or live runs, provider/browser/panel operations,
commits, pushes, or history mutations were performed for this map.
