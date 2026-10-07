# W4b report: document identity for the state diff (run-muw5zv4m-52d83027)

## Outcome

Partial. Everything in the brief is implemented, the fail-first tests went red and then green, and the Core tsc, structure audit and domain src/test typechecks pass. One typecheck error is left in a file I do not own. `apps/extension/src/shared/tests/present.test.ts:101` builds a `present<NavigationEvidence>({...})` literal, and `present` requires every optional field to be written, so it now needs `timeOrigin: undefined,` after `visibility: "visible"`. That is a one-line fix for the supervisor. The test still passes at runtime because esbuild strips types.

## What changed and why

- `domain/src/page-evidence/types.ts`: `WebAutomationNavigationEvidence.timeOrigin?: number | undefined`. Its doc comment says what the identity is and why the address alone is not enough, citing the run.
- `apps/extension/src/content/evidence/navigation.ts`: carries `timeOrigin` from `performance.timeOrigin`. It is read with a typeof guard plus a finite-number check, and with no try/catch. A first version used try/catch, and the structure audit failed it under `failure-as-empty` (baseline 1, and it became 2). The attribute has no failure path of its own, so only its absence is guarded, and a missing `performance` never fails the snapshot. The file header now explains the field.
- `domain/src/runtime/llm-evidence/page-evidence.ts`: `WebLlmPageContext.navigation.timeOrigin?: number`. `evidenceNavigation` passes it on only when it is a finite number, and the contract table has a new row for it. `page-view/header.ts` is unchanged. The ARRIVED line names its fields one by one, so `timeOrigin` never reaches the view text.
- `domain/src/runtime/host-runtime.ts` captureState: the summary is now `{ ...publishedWebLlmPage(packet), documentTimeOrigin? }`, and `publishedWebLlmPage` is unchanged.
- `domain/src/runtime/state-diff/summary-lines.ts`: `WebStateSummaryLines.documentTimeOrigin`, read from the summary as a finite number only.
- `domain/src/runtime/state-diff/state-diff.ts`: adds `documentChanged`. When both summaries carry the identity it compares them; otherwise it equals `locationChanged`. The header cites the run, and says that an SPA `pushState` route change now reads as the same document and that a reload is a new document.
- Core `result-verification/step-changes.ts`: a new `movedPage(diff)` skips a diff when `documentChanged === true`, or when `documentChanged` is absent and `locationChanged === true`. The header is updated: it now says "four of the diff's words" and has a paragraph on why a page move is a new document.
- Tests:
  - `domain/src/runtime/state-diff/tests/state-diff.test.ts`: three new tests, and the existing deepEqual now expects `documentChanged: true`.
  - `domain/src/runtime/tests/host-runtime.test.ts`: one new test. The summary carries `documentTimeOrigin` and the `page` text does not; a non-number gives none; a boundary diff with the same origin and another address gives `locationChanged` true, `documentChanged` false, with the lines diffed.
  - New `apps/extension/src/content/evidence/tests/navigation.test.ts` (7 files in that folder now).
  - Core `judge-sees-each-step.test.ts`: one new `it` covering all three rules, and the `diff` helper takes an optional `documentChanged`.

## Commands run and observed results

- Red, Core: `npx vitest run src/programs/automation-studio/runtime/result-verification/tests/judge-sees-each-step.test.ts` printed `Tests 1 failed | 5 passed (6)`. The new test's `changedOf(summary,"s9")` expected the rewritten lines and received `undefined`.
- Red, domain: `node --test` on the bundles from `run-subset.mjs domain t286b` (state-diff, host-runtime) printed `# pass 19 # fail 5`. The failures were state-diff tests 1, 6, 7 and 8, and host-runtime "a summary carries the document's identity…".
- Red, extension: navigation.test printed `# pass 1 # fail 1` (`expected: 1759000000123.4`, timeOrigin absent).
- Green, Core: the same vitest command printed `Tests 6 passed (6)`.
- Green, domain: the bundles for state-diff, host-runtime, llm-evidence/page-evidence, packet-carries-no-selector and page-evidence-joinery printed `# tests 50 # pass 50 # fail 0`.
- Green, extension: navigation.test plus shared/present.test printed `# tests 10 # pass 10 # fail 0`.
- Core: `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check-t286b.tsbuildinfo` exited 0 with no output.
- `node scripts/structure-audit.mjs` (downstream) exited 0 and printed `structure-audit: passed (171 warning(s), 118 baselined)`. The earlier try/catch version had failed `failure-as-empty`.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` and `... extension check` both refused before typechecking. `scripts/check/core-build.mjs` printed "FluxIQ Core's build … is 32 minute(s) behind its source. Stale: …result-verification/step-changes.ts", which is my Core edit, and the brief forbids building Core. I ran the underlying typechecks directly instead, with t286b buildinfo files:
  - domain `tsc -p tsconfig.json --noEmit` exited 0.
  - domain `tsc -p tsconfig.test.json --noEmit` exited 0.
  - extension `tsc -p tsconfig.json --noEmit` exited 0.
  - extension `tsc -p tsconfig.test.json --noEmit` exited 2, with `src/shared/tests/present.test.ts(101,50): TS2345 … Property 'timeOrigin' is missing … 'OptionalFields<WebAutomationNavigationEvidence>'`. This is the unowned file named under Outcome.

## Reader and digest audit (both repos, including packages/test-runner and scripts/lab)

- Readers of `locationChanged` and the diff:
  - Downstream: `domain/src/runtime/host-runtime.ts:185` produces the diff (`inspectStateDiff`). Its tests are `domain/src/runtime/tests/host-runtime.test.ts:173,200`. The test-runner tests mention `state_diff` and `stateDiff` only as opaque fixtures (`flow-lane/tests/harness-recovery.test.ts:156,165`, `flow-lane/tests/persisted-flow-run.test.ts:547`). No production test-runner or scripts/lab code reads `locationChanged`.
  - Core: the only production reader is `result-verification/step-changes.ts`, which is changed. `recovery/tests/context.test.ts:348` is an old-shape (v2) fixture and is unaffected. `executor/host-state.ts` stores the diff as it comes, and `executor/trace-withholding.ts:66` treats `stateDiff` as data. The recovery model's `core.state_diff` will now also show `documentChanged`.
- State digest (`domain/src/runtime/llm-evidence/state-digest/state-digest.ts:167`): `navigation: OMITTED`, so it never reads `timeOrigin`, and a reload does not change the digest.
- Route state and signatures (`domain/src/runtime/route-state/`): nothing reads `navigation`.
- Hashes:
  - `domain/src/runtime/adapter.ts:379` hashes `JSON.stringify(publishedWebLlmPage(evidence))`. That does not include `navigation`, so the hash is unchanged.
  - `reusable-evidence.ts` hashes location and elements only, and `stable-handles.ts` hashes location, frame, record and tag.
  - Recording state projection (`domain/src/recording/web-state/evidence/project.ts:156-164`) and `recording/domain.ts:72-78` name navigation fields explicitly, so `timeOrigin` is not projected.
  - Core's `recovery/refuted-result/history.ts` `answerDigest` hashes the run result summary, which does not contain it.
- Nothing needed excluding.

## Not verified

- No live browser check that `performance.timeOrigin` survives `dom-snapshot.ts` merging. `apps/extension/src/background/connection/dom-snapshot.ts:295,421` passes `evidence.navigation` through whole, read but not run.
- The recovery model now sees a `documentTimeOrigin` number in `core.state_snapshot`, because the summary is returned whole. This is harmless but new, and it is not screened as page text.
- Core recording-state-index hashing of raw recorded snapshots was not traced in depth. The domain projection drops the field before Core sees it.
- Full suites were not run, by the rules.

## Open questions or contradictions found

- `present.test.ts:101` (unowned) needs `timeOrigin: undefined,` for the extension test typecheck to pass.
- The brief's "read it so a failure never fails the snapshot" conflicts with the audit's `failure-as-empty` rule if it is done with try/catch. I resolved it with a type guard and no catch, as above.
