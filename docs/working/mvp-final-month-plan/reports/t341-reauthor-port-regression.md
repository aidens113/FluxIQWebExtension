# t341 re-author port regression on Core dev

Worker: t341-reauthor. Core worktree `fxwork/t341/!FluxIQ`, branch
`task/t341-reauthor-port-regression` at `e76e1775`. Nothing committed.

## Outcome

Done. The product did not regress. The seven failures came from test stubs
that no longer matched the build's contract after a deliberate, correct change.
I updated the stubs to return what the real build returns, and I added one
assertion that pins the purse charge on the refused-draft path.

- **First bad commit:** Core `87c4c9f9` "Wire explicit candidate requests to
  durable unverified drafts" (Task t299, Worker p0_acceptance, 2026-10-06
  23:44). Its parent `08fb8668` passes 36/36. `87c4c9f9` fails 7/36: the same
  seven tests that fail on dev.
- **Cause:** that commit widened the build's result type
  (`AutomationStudioGenerateFlowBootstrapAdaptationResult`) to a union of a
  legacy proposal (`status: "proposed"`) and a candidate draft
  (`status: "draft"`, which has no `adaptationId`). It also added a guard in
  `runtime-adaptation/reauthor-build.ts:141`:
  `if (generated.status !== "proposed") throw flowBootstrapPhaseFailure("post_provider_validation", ...)`.
  The `generate` stubs in `step-failure-port.test.ts` and
  `refuted-result-port.test.ts` returned only `{ adaptationId, accounting }`,
  with no `status`, and were cast `as never` or wrapped in an untyped `vi.fn`,
  so the type checker never saw the mismatch. Under the new guard every such
  stub reads as "not a proposal". The build is refused at
  `post_provider_validation`, so `approve` is never called and nothing is held.
  The purse failure (0.2 against 0.22) has the same cause. The stub's malformed
  accounting (`{ estimatedCostUsd }` with no `requestId`) went down the failure
  path, the phase failure dropped it, and the build's 0.08 × ceiling was not
  charged.
- **Why the change is correct and stays:** production re-author requests never
  set `authoringMode`. The request in `reauthor-build.ts:127-131` carries
  `projectId, flowId, mode: "extend", evidenceGuided, caller,
  permittedConsequences`. So the real service build always returns
  `status: "proposed"` here, and the guard never fires on the real path.
  - The guard is defence in depth: if a draft ever reached the re-author, it
    must not be approved as an adaptation that does not exist.
  - This matches consultant revision P0 item 2: a case that cannot be supported
    stays visible as a refused draft, not as a reported success, and the
    previously accepted graph is kept.
  - The re-author never applies its edit. It approves and holds it for the
    judged re-run (t267), so there is no apply-before-judged path to fence here.
  - t299 already tests the guard: `reauthor-build.test.ts` "refuses an
    unexpected candidate draft rather than approving a fabricated adaptation".
    That test uses a full, typed proposal fixture.

## What changed and why

All changes are in Core
`packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/tests/`.
No product source changed.

- New file `reauthor-proposal.ts` (test support, one export
  `automationStudioReauthorProposed(adaptationId, accounting?)`). It returns the
  full typed legacy proposal (`AutomationStudioGenerateFlowBootstrapAdaptationProposal`)
  that the service's build answers a re-author: `status: "proposed"`, risk,
  digests, and accounting with `requestId` and `estimatedInputTokens` filled in
  under the caller's amounts. The doc comment states the contract: a re-author
  never asks for candidate authoring, and since t299 the build refuses anything
  that is not `status: "proposed"`. Both test files share this helper, so the
  contract is written once.
- `step-failure-port.test.ts`: 2 stubs now call the helper (the default `deps`
  build and the purse test).
- `refuted-result-port.test.ts`: 10 stubs now call the helper. The test
  amounts and expectations are unchanged.
- `reauthor-build.test.ts`: the existing draft-refusal test also asserts
  `result.purse.spentUsd ≈ ACCOUNTING.estimatedCostUsd`. A refused draft still
  called the model, so the repair's purse must pay for it. This pins the case
  behind the 0.2 versus 0.22 symptom for well-formed accounting, and it passes
  on current product code.

## Commands run and observed results

From `fxwork/t341/!FluxIQ/packages/fluxiq` unless noted.

- Repro on the branch (`e76e1775`): `npx vitest run <step-failure-port.test.ts> <refuted-result-port.test.ts>`
  printed `Tests 7 failed | 29 passed (36)`.
- Bisect, run in place in the t341 Core tree (no edits pending) with
  `git checkout --detach` and the same two-file vitest run:
  - `e9b7d691`: 36 passed
  - `1736ba81` (the first commit in the range to touch runtime-adaptation, the
    t296 held-topology change): 36 passed
  - `08fb8668` (parent of `87c4c9f9`): 36 passed
  - `87c4c9f9`: 7 failed, 29 passed (the same seven names)

  Only three commits in `e9b7d691..dev` touch runtime-adaptation (`1736ba81`,
  `87c4c9f9`, `8c5482e7`). Afterwards I restored the tree with
  `git checkout task/t341-reauthor-port-regression` and confirmed
  `git branch --show-current` printed `task/t341-reauthor-port-regression` at
  `e76e1775`.
- After the fix: `npx vitest run src/programs/automation-studio/runtime/service/runtime-adaptation`
  printed `Test Files 12 passed (12)`, `Tests 169 passed (169)`. This included
  step-failure-port 13/13, refuted-result-port 23/23 and reauthor-build 26/26.
- Nonincremental typecheck: `npx tsc --noEmit -p tsconfig.json` (its include
  covers `src/**/*.ts`, tests too) exited 0 with no output, in 32.6 s.
- Structure audit, from the Core root: `node scripts/structure-audit.mjs`
  printed `structure-audit: passed (285 warning(s), 349 baselined).` Warnings in
  the owned area are advisory only:
  - the directory holds 17 source files against an advisory 15 (the new file is
    under `tests/`)
  - `refuted-result-port.test.ts` is 471 lines (it was 470 and already past 400)
  - `judged-promotion.test.ts` is 408 lines
- `npx biome check` on the four files reported "These paths were provided but
  ignored" (biome config excludes them), so biome did not lint them.

## Not verified

- Live behaviour of a re-author: no provider calls, Lab runs or panel, as the
  brief requires.
- The full Core vitest suite and `pnpm check`. Per the validation policy I ran
  only the owned directory's tests.
- I did not separately prove that the new purse assertion fails without
  charging (no fail-first mutation of product code). It does pin the current
  behaviour.

## Open questions or contradictions found

- t299 changed a shared result type but did not run the port tests that
  consume it. The `as never` casts on `deps` and the untyped `vi.fn` stubs in
  the port tests hid the contract from `tsc`. The new helper is typed. A future
  structural guard could ban `as never` on `generate` stubs, but I did not add
  one because it is outside this brief.
- The phase failure drops accounting that has no `requestId`
  (`{ estimatedCostUsd }` only). The real service build always supplies a
  `requestId`, so I treat this as a fixture artifact, not a product defect.
- No file outside the owned area needed changes. I did not touch
  `runtime/service.ts` or `flow-bootstrap-commands/**` (t340's files).
