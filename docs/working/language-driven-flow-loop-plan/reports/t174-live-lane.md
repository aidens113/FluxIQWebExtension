# t174 live lane

Worker lane t174, the only lane that runs live Lab runs. Trees:
`C:\Users\osrs_\FluxStuff\fxwork\t174\!FluxIQWebExtension` and its Core
`C:\Users\osrs_\FluxStuff\fxwork\t174\!FluxIQ`, both on `task/t174-live-lane`.
deepseek-flash, production profile, the brief's bounds (48k in / 8k out / 56k
per call, 48 calls, $0.25 per call).

## Runs

| # | Run | Task | Stage reached | Causes | Fix | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `run-mun5e1ie-5aeefbbd` (before this lane) | everything-store-kettle-to-cart | 2, first decision call | The execution grant refused the first call from inside `provider.runTask`. `provider-retry/call.ts` normalised the throw to `llm.provider_request_failed`, and `harness-failure.ts:212` published that as `flow_bootstrap.provider_transport_unknown`. Which of the grant's checks refused was lost: `validateClaimedGrant` threw a typed refusal with no reason, and `claimCall`, `ensureLiveAuthorization` and `commitCall` threw plain `Error`s. | Core: see "Fix 1" | 8 new tests fail with the fix reverted and pass with it |

| 2 | `run-mun8tgdh-36ae87a2` | everything-store-kettle-to-cart | 2 at most | Build ran 675 s and the Lab abandoned it (`lab.generation_unfinished`) with 1 call counted. It did not reproduce run 1's refusal. No record of where the time went (debug: `debugs/run-mun8tgdh-36ae87a2.md`). | Instrumentation: Core `llm/evidence-loop/progress-trace.ts`, enabled by `FLUXIQ_BUILD_PROGRESS_TRACE=1`. t177 applied to both trees as a working-tree patch (Core merged by hand in 5 files). | Trace test 3/3; affected suites 353/353; tsc, audit and build clean |

| 3 | `run-muna3yfq-a7d8a2a0` | everything-store-kettle-to-cart | none (facility) | Chromium crashed ("Page crashed") while opening the extension side panel, before the build; 0 calls. Probably memory: 3.4 GB of commit free when checked afterwards (debug: `debugs/run-muna3yfq-a7d8a2a0.md`). | Re-run as run 4. Runs are now one at a time, each holding a `lab-slots` slot. | - |
| 4 | `run-munaiz76-7026748c` | everything-store-kettle-to-cart | 2 (exploration; 5 completions refused) | (a) Every completion's dry run reported draft steps 3 and 6 as `core.replay.unreproducible` (about 6 s each), in all 5 attempts, so no completion was accepted (worker t174-w2 is tracing this). (b) The loop asked for a 48th decision after the grant's 48 calls were spent (one by the instruction authority): `execution_grant_unavailable` / `uses_spent`. This is the known grant defect; t186 is removing grants. (c) The Lab reported `lab.generation_unfinished`: its request timed out at 300 s and it then polled only for a proposal, so the failure at 8m08s was never seen. Run 2 was very likely the same, not starvation. The build's first decision came 17 s after dispatch. | (b) Core `loop-limits/flow-bootstrap-evidence-loop.ts` reserves the authority's call and each allowed retry; `llm/resolver-contract.ts` carries `providerRetryCount` (tests: new case plus 4 updated expectations, 80/80). (c) worker t174-w1, Lab `http-control` + `build-proposal.ts`. The trace now also logs completion verdict codes. | (b) 157/157 loop, limit and grant tests; Core build exit 0 |

| 5 | `run-munbu244-4f4021a8` | bigbox-retail-pickup-cart | none (facility) | Same side-panel renderer crash as run 3; 0 calls; 2.8 GB of commit free at launch (debug: `debugs/run-munbu244-4f4021a8.md`) | Lab: `run-scenario/extension-control-page.ts` opens the control page once more in a fresh tab after a renderer crash | 3/3 new tests; test-runner build ok; audit clean |
| 6 | `run-muncqlr0-3348202b` | bigbox-retail-pickup-cart | 2 (37 decisions, 2 completions refused) | Completion 1: `completion_profile_limit_exceeded`, which was the 240-character summary limit applied to the draft path untruncated, plus `cannot_reach_start_location`. Completion 2: `instructed_act_missing`, because the store switch reloads the page, the pick is never kept, and the build loops on act 1 (w3). The build then ended on an unrecognised throw about 50 ms after a tool call, mislabelled `pre_provider_validation_failed` (debug: `debugs/run-muncqlr0-3348202b.md`, by w3). | Core `llm/harness-options/bootstrap-completion.ts` `fromDraft` bounds the summary as `authoring/accept.ts` does. The throw's naming and stage: see run 7. The keep-across-reload defect (evidence-loop draft recording plus the domain click post-condition across a reload) is t175's area; reported. | 93/93 harness-options tests, including the new summary test and the reworked restored-step test |
| 7 | `run-munda7ub-d9214e3b` | crossborder-marketplace-hub-to-cart | 2 (22 decisions, 3 completions refused) | Completions refused `invalid_subflows` twice, then `instructed_act_missing`. The same unrecognised throw about 50 ms after a tool call (`act1`, `web.action.rejected.target_not_found`), again labelled `pre_provider_validation_failed`; the Lab then states "Core made none", which is false. | Core: `generation-failure/thrown-issue-codes.ts` publishes `thrown.<Class>` and `thrown.at:<Core file>:<line>` on an unrecognised throw (`flowBootstrapPhaseFailure` gains `thrown`). `service.ts` passes the error, and moves the build's running stage to `provider_output_validation` once a decision has returned (both on existing lines, since `service.ts` is at its line budget). | 350/350 generation-failure tests; accounting test updated |
| 8 | `run-mundl2j0-df8e4a32` | crossborder-marketplace-hub-to-cart | none (facility) | Extension pairing timed out, pre-approval, `connectionState: unreported`, 0 calls | - | - |
| 9 | `run-mundupr5-f1cde5aa` | crossborder-marketplace-hub-to-cart | none (facility) | Same pairing timeout. Commit free about 2.4 GB; other lanes were running test suites and a Lab dry-run. Reported to the supervisor. | - | - |

| 10 | `run-mune0xh1-2470406a` | crossborder-marketplace-hub-to-cart | 2 | Paired normally on the same builds as runs 8 and 9, so those pairing timeouts were not a pairing regression. The build again ended on an unrecognised throw right after a tool call (`c18`, `web.action.rejected.target_unobserved`). It is now correctly `provider_output_validation_failed` / attempted / received, with `issueCodes: ["thrown.Error"]`. The frame code is missing: Next bundles Core into `.next` chunks whose paths do not contain `automation-studio`, so `thrown-issue-codes.ts` finds no frame. | Not yet: see Next step | - |

Also in this stretch:
- Downstream dev `9e02625a` (t184 scenario fixes, t183, t181) and Core dev `3e10e7b` (t175, t178) were merged into both working trees, file by file, as three-way merges (no commits). Only `adaptation-host.ts` needed a real merge; the other conflicts were CRLF/LF differences.
- Domain `node-run/replay.ts`: an ambiguous replay target is `core.replay.failed`, not `unreproducible` (w2's finding and test `replay-ambiguous-target.test.ts`).
- Lab ordering defect noted: the staleness guard checks a Lab instance's extension build before the build step that refreshes it, so an instance run needs `FLUXIQ_LAB_ALLOW_STALE_BUILD=1`, which is safe because the rebuild follows.

## Fix 1: a refused grant is named, not recorded as a transport failure (Core)

- `runtime/llm/grant-refusal/` (new leaf directory, moved from `execution/grant-refusal.ts`): `refusal.ts` keeps the four grant codes and adds an optional `reason`. `call-refusal.ts` holds 14 closed reasons, each under one of the four codes: grant_gone, lease_expired, uses_spent, cancelled, call_in_progress, cost_exhausted, tokens_exhausted, reveal_unavailable, revoked_in_flight, scope_mismatch, request_exceeds_grant, session_invalid, key_changed, flow_changed. The directory has no imports, because the provider contract reads it and `execution/` imports the provider contract.
- `runtime/llm/execution/grants.ts`: every throw on a granted call now raises a refusal with its reason. Each throw was replaced on its own line, and the file is at 795 of the 800 lines its budget allows.
- `runtime/llm/provider-contract.ts`: `normalizedAutomationStudioLlmProviderFailure` returns the grant's code and reason, with `not_attempted`. The one exception is `revoked_in_flight`, which returns attempted and received.
- `runtime/llm/harness/run.ts`: puts the reason in the diagnostic's metadata.
- `flow-bootstrap/generation-failure/`: `harness-failure.ts` projects the refusal to `flow_bootstrap.execution_grant_*` at `provider_resolution`, with issue code `llm.execution_grant.<reason>` and no accounting. A revocation during the provider's answer becomes the new `flow_bootstrap.execution_grant_revoked_in_flight` at `provider_request`; its rule is in `codes.ts` and `failure-state.ts`. The four-code table moved from `service.ts` to `harness-vocabulary.ts`.
- Two module-cycle regressions were found and fixed on the way. Importing the refusal through the `execution/` or `llm/` barrel left vite-node's `export *` copy of `runAutomationStudioLlmHarness` undefined, so every build test failed `flow_bootstrap.internal_error`. Both edges now import the leaf `grant-refusal/` barrel.
- Tests: `llm/execution/tests/grant-call-refusal.test.ts` (a real grant, fetch never reached) and `flow-bootstrap/generation-failure/tests/grant-refused-call.test.ts` (the projection and a parse round trip). All 8 fail with the normaliser and projection reverted and pass with them. Execution-grant suites: 81/81. `tsc --noEmit` clean, structure audit clean (baseline lowered), `pnpm --filter fluxiq build` exit 0.

This fix names the refusal. It does not say which check refused in run 1; run 2 answers that from its own record.

## Checkpoint 2026-09-30 ~00:55 UTC (machine restart for the pagefile)

No live run in flight, and no lab slot held. Every edit is saved in the two worktrees. Nothing is committed; workers cannot commit.

### Uncommitted state, and whose it is

Both trees also carry **dev content applied as working-tree three-way merges, not commits**: t177 (Core `8243a50`, downstream `c721ce9c`), then Core dev `3e10e7b` (t175, t178, t183) and downstream dev `9e02625a` (t184, t183, t181, t178, t175). To integrate: commit t174's own files (below) on `task/t174-live-lane`, then `git merge origin/dev` in each repository; git will find the dev hunks already present. Only Core `apps/web/.../adaptations/adaptation-host.ts` needed a real textual merge.

**t174's own changes, Core** (`C:\Users\osrs_\FluxStuff\fxwork\t174\!FluxIQ`):
- Grant refusals named (superseded when t186 removes grants): `runtime/llm/grant-refusal/{refusal.ts (moved from execution/grant-refusal.ts), call-refusal.ts, index.ts}`, `llm/execution/{grants.ts, index.ts}`, `llm/index.ts`, `llm/provider-contract.ts`, `llm/harness/run.ts` (grantRefusalReason metadata, merged beside t177's providerThrow), `flow-bootstrap/generation-failure/{harness-failure.ts, harness-vocabulary.ts, codes.ts, failure-state.ts}`, `runtime/service.ts` (table moved to harness-vocabulary). Tests: `llm/execution/tests/grant-call-refusal.test.ts`, `generation-failure/tests/grant-refused-call.test.ts`.
- Build progress trace: `llm/evidence-loop/progress-trace.ts` (+ index export, hooked at `llm/evidence-loop.ts:165`, line-neutral); test `llm/evidence-loop/tests/progress-trace.test.ts`. Enabled with `FLUXIQ_BUILD_PROGRESS_TRACE=1`.
- Loop leaves the grant its authority and retry calls: `loop-limits/flow-bootstrap-evidence-loop.ts`, `llm/resolver-contract.ts` (`providerRetryCount`); tests `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`, `llm/evidence-loop/tests/stall-guard.test.ts`. Moot once t186 removes grants.
- Unrecognised throw named and staged: `generation-failure/thrown-issue-codes.ts` (+ index export), `generation-failure/phase-failure.ts` (`thrown` argument), `runtime/service.ts` (catch passes the error; after the first decision the running stage is `provider_output_validation`); tests `generation-failure/tests/thrown-issue-codes.test.ts`, `tests/service-bootstrap/tests/accounting.test.ts` (setup-throw expectation).
- Draft summary bounded: `llm/harness-options/bootstrap-completion.ts` (`fromDraft`); test `llm/harness-options/tests/bootstrap-completion.test.ts`.
- `.structure-baseline.json`: lowered only.

**t174's own changes, downstream** (`C:\Users\osrs_\FluxStuff\fxwork\t174\!FluxIQWebExtension`):
- Long generation request (w1): `packages/test-runner/src/http-control/{index.ts, long-request.ts, tests/long-request.test.ts}`, `packages/test-runner/src/flow-lane/creation/{build-proposal.ts, tests/build-proposal.test.ts}`.
- Control page reopened after a renderer crash: `packages/test-runner/src/run-scenario/extension-control-page.ts`, `run-scenario/index.ts`, `run-scenario.ts` (`extensionControlPage`), test `run-scenario/tests/extension-control-page.test.ts`.
- Ambiguous replay target is `failed`: `domain/src/runtime/llm-evidence/node-run/replay.ts`; test `domain/src/runtime/llm-evidence/node-run/tests/replay-ambiguous-target.test.ts` (by w2). **The full domain suite has not been run since this change.**
- Docs: this report, `reports/t174-w1-long-generation-request.md`, `reports/t174-w2-unreproducible.md`, `reports/t174-w3-bigbox-refusals.md`, and `debugs/run-{mun5e1ie-5aeefbbd, mun8tgdh-36ae87a2, muna3yfq-a7d8a2a0, munaiz76-7026748c, munbu244-4f4021a8, muncqlr0-3348202b}.md`. Runs 7 to 10 have no debug file yet.

### Validation not yet done

- Full Core `fluxiq` vitest suite after all edits and merges (only the affected directories were run: generation-failure 350/350, harness-options 93/93, loop-limits + evidence-loop + execution-grant 157/157, execution 81/81).
- Full domain suite (`pnpm --filter @fluxiq-web-extension/domain test`), and downstream `pnpm check`.

### Exact next step

1. After the restart: `pnpm --filter fluxiq build` in Core, then the domain and extension builds downstream, and a dry-run. Re-run `run-mune0xh1`'s scenario (`crossborder-marketplace-hub-to-cart`) holding slot-1, launched with `live-run.sh`: it sets `FLUXIQ_LAB_ALLOW_STALE_BUILD=1`, `FLUXIQ_LAB_INSTANCE=t174-slot-1` and `FLUXIQ_BUILD_PROGRESS_TRACE=1`. The launcher is in the lane's scratchpad; its command line is the brief's template with those three variables set.
2. **Blocking cause to fix first:** the build ends on an unrecognised `Error` right after a tool call (runs 6, 7 and 10; bigbox and crossborder). Make `thrown-issue-codes.ts` find the frame under Next's bundle (match `fluxiq` / `.next/server/chunks` paths and keep the module name), or log the throw's class and first frame through the progress trace. Then fix the throw at its owning line. Candidates, all after `executeTool` returns in `llm/evidence-loop.ts`: `draftRecord`, `automationStudioLlmEvidenceRerunReplaced`, `recordRow`, `noProgress`, or an ended loop's `keeper.exhausted` (`flow-bootstrap/incomplete-draft/keeper.ts`, where `kept()` runs outside its `try`).
3. Then the completion-refusal causes: `invalid_subflows` (crossborder), `instructed_act_missing` after a reloading click loses the kept step (bigbox; t189 and t175 own it), and everything-store kettle's refused completions (codes now traced).
