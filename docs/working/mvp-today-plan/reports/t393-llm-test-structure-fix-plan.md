# t393 — LLM test structure fix plan

## Finding

T388's only Core structure failure is exact and reproducible from the tree shape:
`packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/` has 26 direct source files,
one over the 25-file limit. The adjacent prefix-derived feature already exists at
`runtime/llm/evidence-loop/`, with its own `tests/` folder containing `call-id.test.ts`,
`draft-shown.test.ts`, and `rerun-request.test.ts`.

## Smallest semantically correct move

Move exactly one untracked test and strip the feature prefix now expressed by its directory:

```text
runtime/llm/tests/evidence-loop-progress.test.ts
  -> runtime/llm/evidence-loop/tests/progress.test.ts
```

In the moved file, change its sole local import:

```ts
// before
import { runAutomationStudioLlmEvidenceLoop } from "../index.ts";
// after
import { runAutomationStudioLlmEvidenceLoop } from "../../index.ts";
```

No other import, barrel, Vitest config, or production file needs changing. Repository search found
no explicit reference to the old test path, and `runtime/llm/evidence-loop/tests/progress.test.ts`
does not exist.

This is ownership-correct rather than a count shuffle. The test's only asserted contract is the
evidence-loop progress record (draft revision/state, page state, and answerability state), whose
named source contract is `runtime/llm/evidence-loop/progress.ts`. The destination gives that subject
the required one-step pairing, `evidence-loop/progress.ts` -> `evidence-loop/tests/progress.test.ts`.
It also follows the already-materialized `evidence-loop/` feature grouping and removes the redundant
`evidence-loop-` filename prefix. Exercising the contract through the public loop coordinator is an
integration choice, not ownership by the parent test folder; `evidence-loop/index.ts` explicitly
describes the parent `../evidence-loop.ts` coordinator as the compatibility entry for this feature.

The other top-level evidence-loop tests should not be moved merely to create headroom:
`evidence-loop-provider.test.ts` spans harness, DeepSeek, flow-bootstrap, and the loop;
`evidence-loop-seeded-draft.test.ts` spans the parent coordinator and parent loop configuration;
`evidence-loop-tool-failure.test.ts` owns coordinator-level failure behaviour; and
`evidence-loop-draft-shown.test.ts` owns coordinator/configuration integration while the focused
`draft-shown.ts` unit test is already correctly nested. Moving those would weaken the nearest-common-
owner rule or collide conceptually with an existing focused test.

After the move, the direct counts become 25 in `llm/tests` and 4 in
`llm/evidence-loop/tests`; neither directory approaches a new cap.

## Execution and validation commands

From `F:\!FluxIQ`, after the active root gate is no longer reading the tree:

```powershell
Move-Item -LiteralPath 'packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-progress.test.ts' -Destination 'packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/progress.test.ts'
# Apply the one import edit above.
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests/progress.test.ts
pnpm structure:check --rule directory-files
pnpm structure:check --rule test-placement
pnpm structure:check --rule imports
pnpm check
```

Then continue the supervisor's required full Core closure gates (`pnpm test`, `pnpm build`, and
`pnpm docs:check`) in the established serial order. Do not add a `directory-files` baseline entry.
The existing `.structure-baseline.json` is already modified for separate reductions; if
`pnpm structure:baseline` is run as part of final reconciliation, review its diff so this move does
not absorb unrelated working-tree changes.

## Collision and verification notes

- Before implementation, both the source test and the entire new `evidence-loop/` source/test group
  were untracked, so an apply-patch move was used instead of `git mv`.
- The Core checkout remains extensively dirty and several nearby LLM files are active work. The
  destination was confirmed absent immediately before the move; no collision occurred.
- T388's root run was recorded complete before implementation began.

## Implemented result

**Scoped verdict: GO.** The selected move is implemented exactly as specified. The old path is
absent, the new path exists, and the only content change is the required import-depth correction.
Reconstructing the old import in memory produced SHA-256
`0D9F7307A0E77F2878FD7663A60380EF37D31B1EA296326FC2A3254C10AA25B4`, exactly matching the source
hash captured before the move.

Observed validation from `F:\!FluxIQ`:

- Focused moved file: **PASS**, 1 file / 7 tests, 12 ms test time, command 2.80 s.
- `pnpm check`: **PASS**, exit 0. The structure audit passed with 189 advisory warnings and 358
  baselined findings, while noting one existing baseline entry can be lowered; contracts,
  client-gateway-websocket, FluxIQ, and web TypeScript checks all completed. The former
  `runtime/llm/tests` 26-file failure did not recur.
- `git diff --check -- <old-path> <new-path>`: **PASS**, exit 0, no diagnostics.
- Because the moved source was untracked before the move, the normal Git diff has no file body to
  inspect. A supplementary `git diff --no-index --check -- NUL <new-path>` emitted no whitespace
  diagnostics; its exit 1 is the expected no-index "files differ" status for a new file, not a
  whitespace error. Git emitted only its line-ending advisory.
- Final path state: old path absent; new path present and untracked. No destination collision
  occurred.

This GO is limited to the requested structure fix and its required checks. Root `pnpm test`,
`pnpm build`, and `pnpm docs:check` were not run, so t388's separate full-suite timeout and stale-
reference closure blockers are not claimed resolved. No other file was edited in Core, and no
provider/live action, staging, commit, or push occurred.
