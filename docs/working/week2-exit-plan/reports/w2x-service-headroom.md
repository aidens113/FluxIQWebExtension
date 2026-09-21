# w2x-service-headroom

Worker report, 2026-09-21. Task t048, plan step L0, slice C0 of
`reports/w2x-existing-flow-and-repair-design.md`. Worktrees: Core
`F:\fxwork\t048\!FluxIQ` and downstream `F:\fxwork\t048\!FluxIQWebExtension`,
both on `task/t048-service-headroom` at t027's tip (Core HEAD `510680f`).
Nothing is committed. `AS/` = Core `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. Core `AS/runtime/service.ts` goes from 6,381 to 6,275 lines, and the
ratchet is lowered to match, which leaves 106 lines of headroom. The review
projection now lives in `AS/runtime/flow-bootstrap/review-projection.ts`. The
recovery port `flowScope` is now `flowForRecovery` and returns
`{ scope; metadata? }`. Behaviour is unchanged. The moved code is
byte-identical to what left `service.ts` apart from the two `export` keywords.
One live `week-ahead` build passed: 14 of 14 `matchedRecords`, and
`build.providerCalls` (5) equals `observed.calls` (5). The build, the apply and
the review projection all ran through the moved code.

## What changed and why

All changes are in the Core worktree. The downstream worktree is unchanged:
`git status --short` prints nothing.

- **New `AS/runtime/flow-bootstrap/review-projection.ts` (125 lines).** It holds
  `bootstrapAdaptationAsFlowAdaptation` and `sanitizedBootstrapAccounting`,
  moved from `service.ts` lines 5961-6068. That is the design's `6021-6128`
  span in the older numbering, and I found it by content. The accounting
  check moves too because the projection calls it. The generation and proposal
  paths in `service.ts` still call it, and now import it back.
- **`AS/runtime/service.ts`.** The 108 lines are removed. Both functions are
  imported through `./flow-bootstrap/index.ts`, since the structure audit
  requires imports from another directory to go through its barrel. The unused
  `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ACCOUNTED_TOKENS` import is dropped.
  The recovery port binding is now
  `flowForRecovery: … getFlow(…).then((flow) => ({ scope: flow.scope, ...(flow.metadata ? { metadata: flow.metadata } : {}) })).catch(() => undefined)`.
- **`AS/runtime/flow-bootstrap/index.ts`.** It adds
  `export * from "./review-projection.ts"`. Its header comment no longer claims
  the export list is unchanged; it now names the projection as the one
  addition.
- **`AS/runtime/recovery/annotation/ports.ts`.** `flowScope(projectId, flowId)`
  becomes `flowForRecovery(projectId, flowId): Promise<{ scope: AutomationStudioFlowScope; metadata?: JsonObject | undefined } | undefined>`.
  The doc comment says this is the parent Flow, whose stored metadata the
  subflow graph that ran does not carry. That is what C3 needs in order to
  read `bootstrapInstructedConsequences`.
- **`AS/runtime/recovery/annotation/annotate.ts`.** One line changes:
  `const scope = (await ports.flowForRecovery(…))?.scope;`. An unreadable Flow
  still yields no scope, so the exploration is still skipped. Metadata is not
  read yet; C3 will read it.
- **Tests that supply the port** now supply `flowForRecovery`:
  `recovery/annotation/tests/annotate.test.ts` (the "no scope" case still
  answers `undefined`), `recovery/annotation/tests/iteration-guards.test.ts`,
  and `AS/runtime/tests/deepseek-recovery-requests.test.ts`.
- **New `AS/runtime/flow-bootstrap/tests/review-projection.test.ts`.** It has
  five tests that fix the projection's current output: patch entries, metadata
  and bindings for a proposed build; `appliedTo` and the application summary
  for an applied build, with `parentBefore` left out; refusal of a record that
  carries recording provenance; and accounting that is trimmed, bounded, or
  refused. The function had no direct test before. CF will extend it.
- **`.structure-baseline.json`.** `pnpm structure:baseline` changed
  `service.ts` from 6381 to 6275, with 1 entry lowered and 0 removed.
- **Not moved: the provider resolution.** The design's C0 also moves
  `service.ts:391-420` to a new `llm/provider-resolution.ts`. That move is
  already done at t027's tip: `AutomationStudioLlmProviderResolution` lives in
  `AS/runtime/llm/resolver-contract.ts`, and `service.ts` only re-exports it.
  The brief also leaves it out. C3 should edit `resolver-contract.ts` rather
  than create `provider-resolution.ts`.
- **Line endings.** Git Bash `sed -i` rewrote `service.ts` and the barrel with
  LF line endings. I converted them, and the new module, back to CRLF to match
  this checkout (`core.autocrlf=true`). Git normalizes either way.

## Commands run and observed results

- **Moved-code identity.** I compared `git show HEAD:…/service.ts`, lines
  5961-6068 with CR removed, against `review-projection.ts` lines 18-125 with
  `export ` removed. `diff` printed nothing: the 108 lines are identical.
- **Early build.** `pnpm --filter fluxiq build` in Core exited 0. The `dist`
  output contains `flow-bootstrap/review-projection.js`, and `ports.d.ts`
  names `flowForRecovery`.
- **Structure audit before the baseline update.** `node scripts/structure-audit.mjs`
  printed `passed (170 warning(s), 361 baselined)` and `1 baseline entries can be lowered`.
- **Live proof, run first.** In the downstream t048 worktree I ran
  `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t048 pnpm lab:campaign social-scheduler-week-ahead --max-attempts 1`.
  It exited 0. The instance label only keeps builds in ignored directories.
  - The campaign was `2026-09-21T19-09-50-688Z`, from 19:09:50 to 19:12:42
    (about 2 min 52 s). The run was `run-mubme2r4-81910603`, under
    `test-runs/instances/t048/`.
  - Verdict `passed`, `oracleVerdict` `passed`. The created Flow has 5 nodes:
    `web.browser.navigate` ×1, `web.dom.select` ×3, `web.dom.extract_list` ×1.
    The route used the fallback Subflow `subflow.bootstrap.46d882a455f5c79b.main`.
  - `evaluation.json` gives `extraction[0]`: `expectedRecords` 14,
    `observedRecords` 14, `matchedRecords` 14.
  - `snapshots/live-llm.json` gives `build.providerCalls` 5 and
    `observed.calls` 5. `build.outcome` is `proposed`; `build.failure` and
    `build.permissionRequest` are `null`. The build accounting is 52,809 tokens
    and $0.02380. `evidenceLoop` shows 5 decisions and 5 tool calls
    (`web.detect_repeating_structure`, `web.enter_field`,
    `web.inspect_current_page`).
  - `snapshots/flow-lane.json` gives `review` =
    `{ adaptationId: "adaptation.bootstrap.b8d76aac-…", appliedMutationCount: 2 }`.
    The Lab's client reads `appliedMutationCount` as the length of `appliedTo`
    (`TR/existing-fluxiq-control.ts:449`) on the adaptation that Core's review
    action returns. That adaptation is `bootstrapAdaptationAsFlowAdaptation`.
    So approve and apply both went through the moved projection, and it
    reported the Router plus one Subflow, as expected.
  - **Why the campaign says 6 calls.** The campaign counts 6 calls, 55,137
    tokens and $0.02507, labelled `spendSource: build+repair`. The sixth call
    is in `live-llm.json` `repair.observed`: one
    `automation-studio.loop-verification.v1` call, 2,328 tokens, $0.00128,
    `validationOk: true`. It was made during the playback, which ran under a
    `diagnose_and_adapt` grant, and `flow-lane.json` records it as
    `resultVerification: "confirmed"`. The playback had
    `runtimePatchAttempts: []` and `adaptationIds: []`, so the 14 records came
    from the Flow's own steps. The model was still asked once, to confirm the
    result.
- **First combined test run.** From `packages/fluxiq`:
  `npx vitest run` over service-bootstrap, service-flows, recovery/annotation,
  the projection test and deepseek-recovery-requests. It printed 16 files
  failed and 16 passed; 29 tests failed and 179 passed. Every failure was a
  timeout or a Windows `EBUSY`/`ENOTEMPTY` error while deleting a temp
  directory. The machine was saturated at the time: 49 `node` processes and
  CPU load at 100%.
- **Recovery annotation, projection and deepseek-recovery-requests tests.**
  `npx vitest run …/recovery/annotation …/flow-bootstrap/tests/review-projection.test.ts …/tests/deepseek-recovery-requests.test.ts`:
  9 files, 80 tests, all passed. The 5 projection tests passed.
- **Service-bootstrap, one file at a time.** `npx vitest run --no-file-parallelism …/tests/service-bootstrap`:
  10 files, 68 tests, all passed, in 131.6 s.
- **Service-flows, one file at a time.** `npx vitest run --no-file-parallelism …/tests/service-flows`:
  11 files passed and 2 failed; 57 tests passed and 3 failed, in 449 s. All
  three failures were timeouts:
  - `instruction-readiness` "finds one active applicable instruction beyond an
    unfiltered 100-item page…" (15 s limit);
  - `scale-pages` "persists Flow expansion summaries with paged run and
    adaptation detail reads" (15 s limit);
  - `scale-pages` "keeps large project summary pages free of hydrated detail
    payloads" (60 s limit).
- **The same two files run alone.** Both passed. `instruction-readiness`:
  1 test, 10,000 ms. `scale-pages`: 3 tests at 8,065 ms, 13,429 ms and
  1,344 ms. These are timeouts under load, not fixes. The first scale-pages
  test takes about half of its 15 s limit even with the machine to itself.
- **`pnpm check` in Core** exited 0. `structure:test` passed 182 of 182 and
  `task:test` passed 20 of 20. The audit printed `passed (170 warning(s), 361 baselined)`.
  `check` finished (`Done`) for `packages/contracts`,
  `packages/client-gateway-websocket`, `packages/fluxiq` and `apps/web`.
- **`pnpm build` in Core** exited 0. contracts, fluxiq and
  client-gateway-websocket compiled with `tsc`. `apps/web`: `next build`
  reported "Compiled successfully in 35.4s" and generated 16 of 16 static
  pages.

## Not verified

- **The renamed port was not exercised live.** In the live run the recovery
  path made only the verification call. No patch was requested, so
  `flowForRecovery` was never called. It is covered only by the annotation and
  deepseek-recovery-requests tests.
- **No model-free replay.** I did not run a keyless `pnpm lab replay` of the
  created Flow; the brief did not ask for one. The playback in this run made
  one result-verification call, as described above.
- **Timeouts not compared with HEAD.** I did not check whether the three
  service-flows timeouts also happen at HEAD under the same load. The moved
  code is identical, and importing it through a barrel changes no runtime
  work, so I attribute them to machine load. That attribution is inferred, not
  measured.
- **No full suites were run.** Downstream checks were not run either, since
  nothing downstream changed.

## Open questions or contradictions found

1. **Test outside the annotation folder.** `AS/runtime/tests/deepseek-recovery-requests.test.ts`
   supplies the recovery ports, so the rename forced a one-line edit there. I
   counted it among "their tests"; it lives outside `recovery/annotation/tests/`.
2. **Two new public names.** `runtime/index.ts` re-exports
   `flow-bootstrap/index.ts` with `export *`, so `bootstrapAdaptationAsFlowAdaptation`
   and `sanitizedBootstrapAccounting` are now part of the program's runtime
   surface. They are the moved code, as the brief allows. No test pins the
   export surface. The names keep their old form, without an `automationStudio`
   prefix. CF may want to rename them when it extends the projection.
3. **Provider resolution already moved.** The design's C0 row and the
   shared-file table name a new `llm/provider-resolution.ts`. It already exists
   as `llm/resolver-contract.ts`, so C3's file list should name that file.
4. **Re-merging `dev`.** This worktree is a speculative base at t027's tip.
   When it re-merges `dev` after t027 lands, any `service.ts` difference
   between the landed t027 and this base will need resolving against the
   108-line removal and the port binding. It may also change the ratchet
   figure; re-run `pnpm structure:baseline` after that merge.
