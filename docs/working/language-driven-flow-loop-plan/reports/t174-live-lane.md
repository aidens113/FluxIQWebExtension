# t174 live lane (lane A: create & run, `lab-slots/slot-1`)

Tasks, in order:
1. crossborder-marketplace-hub-to-cart
2. bigbox-retail-pickup-cart
3. everything-store-kettle-to-cart
4. company-website-quote-request

The other live lanes:
- t193: B, self-repair, slot-2.
- t194: C, judge its own answer, slot-3.
- t195: D, control flow and consequential acts, slot-4.

Their fix logs are read before a cause is fixed here. The first lane to record a cause owns it.

## Fix log

| # | Fix | Files | Exposed by | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | A packed draft row shown as `did_not_work` no longer ends a build | Core `llm/evidence-loop/draft-shown.ts`, 2 tests | runs 6, 7, 10 | tests fail without the fix and pass with it (16/16, 8/8) | committed `befca2f`, in dev |
| F2 | The Lab's Core server maps stacks to their sources | `test-runner/src/core-web-build/server-process.ts` + test | run 10 | 2/2 | committed |
| F3 | Extension start: the guard waits for the worker's scope; connect has a 10 s deadline and a named failure; the start is traced | `test-runner/src/network-guard.ts`, `run-lifecycle/*`, `run-scenario/extension-*`; extension `gateway-session.ts`; Core `client-gateway-websocket/src/*` | runs 3, 5, 8, 9, 11, 12 | 1/10 clean starts before the fix, 10/10 after, and 10/10 again on the merged build | committed `50eb684` / `5903a1e7` |
| F4 | UI review in every run: page and panel PNGs at each moment, overlay samples and flicker counts | `test-runner/src/run-scenario/ui-review/**` (new), `run-scenario.ts` (line-neutral), `run-scenario/index.ts` | user rule, 2026-09-30 | ui-review 18/18; test-runner build 0; audit passed; provider-free Lab run passed, PNGs read | validated, uncommitted (overlaps t193's G2) |
| F5 | A step that only goes to the start location cannot answer a non-`open` instructed act (new reason `step_only_arrives`); completion passes the start location into the check | Core `flow-bootstrap/instructed-acts/{check,contracts}.ts`, `reachability/{step-goes-to-location.ts (new), start-step.ts, index.ts}`, `llm/harness-options/bootstrap-completion.ts`, and tests | runs 13 and 15 (navigation-only Flows accepted) | new cases failed first (instructed-acts 1 failed / 56, bootstrap-completion 1 failed / 25), then instructed-acts + reachability + harness-options 180/180 (re-run by the lead); fluxiq tsc 0; audit passed | validated; live re-test in run 17 |
| F6 | Instructed acts are also refused when:<br>- one step is claimed for a plural act (asked of by t195: "confirm everyone with five or more");<br>- an `optional` step is claimed (t195 run 2);<br>- a Flow claims a set or pick act with a step that only opens a chooser, and nothing claims the `create_new` consequence (bigbox run 16 cause 3). | Core `flow-bootstrap/instructed-acts/{check,contracts,instruction-acts}.ts` and tests | t195 runs; run 16 | Items 1 and 2 are done: new reasons `act_needs_repeat` and `step_is_optional`; tests failed first (10 failed / 78), then instructed-acts + reachability + harness-options 211/211 (re-run by the lead); tsc 0; audit passed. Item 3 was assessed as unsound without a domain-reported per-step change class (`reports/t174-w13-act-claims.md`). | validated (1, 2); 3 not built |
| F7 | A navigation that lands on a page that is itself a robot check reports `web.intervention.required` rather than success, so the build knows a person must answer it and stops re-navigating into it | extension `content/action-runtime/{challenge-evidence,index,results}.ts`, `content/message-handler.ts`, `shared/page-challenge-message.ts` (new), `runtime/{landed-challenge.ts (new), action-results.ts, action-runner.ts}`, and tests (`runtime/tests/navigate-action.test.ts` is new, split from `action-runner.test.ts`) | runs 15, 17 | extension suite: 3 failed before, then 1228/1228 (heavy.sh); the lead re-ran the built navigate-action 12/12, challenge-evidence 4/4 and action-runner 30/30; audit passed | validated (unit). **Open decision:** Core does not end the build to ask the person, and crossborder's reference steps press the check. See `reports/t174-w14-navigation-challenge.md`. |
| L1 | The Lab's call bound is the most its profile allows (`--llm-max-calls 64`; 65 was refused by the profile schema in run 14) until t193's cause B lands | the lane's launcher (scratchpad), not the repo | run 13 | - | temporary |

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

| 3 | `run-muna3yfq-a7d8a2a0` | everything-store-kettle-to-cart | none (facility) | Chromium crashed ("Page crashed") while opening the extension side panel, before the build; 0 calls. Cause not established. The machine-load explanation is withdrawn (user, 2026-09-30); root-causing as a product or Lab defect under t174-w7. (debug: `debugs/run-muna3yfq-a7d8a2a0.md`). | Re-run as run 4. Runs are now one at a time, each holding a `lab-slots` slot. | - |
| 4 | `run-munaiz76-7026748c` | everything-store-kettle-to-cart | 2 (exploration; 5 completions refused) | (a) Every completion's dry run reported draft steps 3 and 6 as `core.replay.unreproducible` (about 6 s each), in all 5 attempts, so no completion was accepted (worker t174-w2 is tracing this). (b) The loop asked for a 48th decision after the grant's 48 calls were spent (one by the instruction authority): `execution_grant_unavailable` / `uses_spent`. This is the known grant defect; t186 is removing grants. (c) The Lab reported `lab.generation_unfinished`: its request timed out at 300 s and it then polled only for a proposal, so the failure at 8m08s was never seen. Run 2 was very likely the same, not starvation. The build's first decision came 17 s after dispatch. | (b) Core `loop-limits/flow-bootstrap-evidence-loop.ts` reserves the authority's call and each allowed retry; `llm/resolver-contract.ts` carries `providerRetryCount` (tests: new case plus 4 updated expectations, 80/80). (c) worker t174-w1, Lab `http-control` + `build-proposal.ts`. The trace now also logs completion verdict codes. | (b) 157/157 loop, limit and grant tests; Core build exit 0 |

| 5 | `run-munbu244-4f4021a8` | bigbox-retail-pickup-cart | none (facility) | Same side-panel renderer crash as run 3; 0 calls (debug: `debugs/run-munbu244-4f4021a8.md`) | Lab: `run-scenario/extension-control-page.ts` opens the control page once more in a fresh tab after a renderer crash | 3/3 new tests; test-runner build ok; audit clean |
| 6 | `run-muncqlr0-3348202b` | bigbox-retail-pickup-cart | 2 (37 decisions, 2 completions refused) | Completion 1: `completion_profile_limit_exceeded`, which was the 240-character summary limit applied to the draft path untruncated, plus `cannot_reach_start_location`. Completion 2: `instructed_act_missing`, because the store switch reloads the page, the pick is never kept, and the build loops on act 1 (w3). The build then ended on an unrecognised throw about 50 ms after a tool call, mislabelled `pre_provider_validation_failed` (debug: `debugs/run-muncqlr0-3348202b.md`, by w3). | Core `llm/harness-options/bootstrap-completion.ts` `fromDraft` bounds the summary as `authoring/accept.ts` does. The throw's naming and stage: see run 7. The keep-across-reload defect (evidence-loop draft recording plus the domain click post-condition across a reload) is t175's area; reported. | 93/93 harness-options tests, including the new summary test and the reworked restored-step test |
| 7 | `run-munda7ub-d9214e3b` | crossborder-marketplace-hub-to-cart | 2 (22 decisions, 3 completions refused) | Completions refused `invalid_subflows` twice, then `instructed_act_missing`. The same unrecognised throw about 50 ms after a tool call (`act1`, `web.action.rejected.target_not_found`), again labelled `pre_provider_validation_failed`; the Lab then states "Core made none", which is false. | Core: `generation-failure/thrown-issue-codes.ts` publishes `thrown.<Class>` and `thrown.at:<Core file>:<line>` on an unrecognised throw (`flowBootstrapPhaseFailure` gains `thrown`). `service.ts` passes the error, and moves the build's running stage to `provider_output_validation` once a decision has returned (both on existing lines, since `service.ts` is at its line budget). | 350/350 generation-failure tests; accounting test updated |
| 8 | `run-mundl2j0-df8e4a32` | crossborder-marketplace-hub-to-cart | none (facility) | Extension pairing timed out, pre-approval, `connectionState: unreported`, 0 calls | - | - |
| 9 | `run-mundupr5-f1cde5aa` | crossborder-marketplace-hub-to-cart | none (facility) | Same pairing timeout. Reported to the supervisor. | - | - |

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

## Core `git merge dev` resolved (2026-09-29, before the commit)

Core `task/t174-live-lane` at `e8d3bfc`, merging dev `af385f7` (t182, t180, t178, t175, t183, t177). Four conflicts, resolved and staged with `git add` only:
- `apps/web/.../conversation/capabilities/catalog/running.ts`: dev's import line (a superset: adds t180's `getRuntimeRunControl`, `pauseRuntimeSession`, `resumeRuntimeSession`, `RuntimeRunControlAnswer`). The merged file is byte-identical to dev's, which already carried the lane's `get-flow-metadata-detail` change.
- `runtime/llm/harness/run.ts`: the lane's `grantRefusalReason` metadata line kept beside dev's `providerThrow`.
- `runtime/llm/provider-contract.ts`: the lane's `grant-refusal/` import and `grantRefusalReason` field kept (dropped when t186 lands). Also repaired six em dashes the lane's commit had turned into mojibake (`â€”`) in this file's doc comments; no other file in `259a11b..e8d3bfc` has it.
- `runtime/llm/harness-options/tests/bootstrap-completion.test.ts`: the lane's side. Its restored-step refusal uses an unregistered node, because the lane bounds an over-long draft summary instead of refusing it, so dev's long-summary trigger no longer refuses; the lane's summary-bounding test kept.

Of the 93 files both sides changed, 82 merged identical to both sides, 8 identical to the lane's side (dev's hunks were already hand-applied), `running.ts` identical to dev's, and `provider-contract.ts` and `runtime/service.ts` are true merges; `service.ts` was read hunk by hunk (lane: grant-code table moved to `FLOW_BOOTSTRAP_EXECUTION_GRANT_CODES`, stage after first decision, `error` passed on; dev: t180 run control, t182 recording-entry removal and index pruning).

Validation: `npx tsc --noEmit -p tsconfig.json` in Core `packages/fluxiq`, build slot b1: rc=0, no output, 42 s. `npx vitest run --minWorkers=1 --maxWorkers=2 .../harness-options/tests/bootstrap-completion.test.ts .../harness/tests/run.test.ts`: 2 files, 35/35 passed. Not run: apps/web tsc, full Core vitest.

## Fix 2: the unrecognised throw after a tool call (runs 6, 7, 10), found and fixed (Core)

**Cause.** `llm/evidence-loop/draft-shown.ts` measures the draft entry each decision is shown, and fails closed on a packed entry it does not recognise: `throw new Error("Cannot measure malformed or unknown packed draft shape")`. Its row check accepted only the three dispositions a step *keeps* (`kept`, `dropped`, `exploratory`). Dev's t175 (`98133e7`, "A build stops repeating amendments that change nothing") made the draft *show* a step whose effect did not apply as `did_not_work` (`flow-draft/entry.ts`, `shownDisposition`). So the first time a draft that holds a refused press outgrows the full object entry (4,000 bytes on the live profile) and is packed as `step_rows_v1`, the measurement throws. The call is at `llm/evidence-loop.ts:562`, inside the pre-decision `try` whose catch rethrows under `propagateDecisionErrors: true` (`service.ts:1580`). The build then ends as a bare `Error`, with no frame, before `decide start` for the next iteration. That matches run 10 exactly: `tool end ... c18 ... target_unobserved` at 00:52:48.948, then nothing until the failure at 49.091. Runs 6 and 7 have the same signature: a bare `Error` about 50 ms after a tool call, late in a long draft that held refused presses. Every test step had `effectApplied: true`, so no test ever built a packed entry holding a `did_not_work` row. Located by reading the path between `tool end` and `decide start`: the only explicit `throw new Error` there is this one, and the run's `thrown.Error` rules out a runtime `TypeError`. Then reproduced. The bundled chunk in `.tmp/core-web-build/.../chunks/ssr/...facbe425._.js` carries the same minified check (`"kept"===a[5]||"dropped"===a[5]||"exploratory"===a[5]`, `function qO(){throw Error("Cannot measure malformed...")}`).

**Fix.** The reader accepts every shown disposition (`SHOWN_DISPOSITIONS`, including `did_not_work`), and still fails closed on anything else. `flow-draft/entry.ts` belongs to t189 and was not touched.

**Tests (fail with the fix reverted, pass with it).**
- `llm/evidence-loop/tests/draft-shown.test.ts`: the producer builds a packed entry through every shown disposition and draft state; plus a fail-closed case for an unknown disposition. 16/16.
- `llm/tests/evidence-loop-draft-shown.test.ts`: a loop whose draft holds refused presses and is packed goes on deciding and completes. 8/8.
- With the old reader, both new cases fail: `Cannot measure malformed or unknown packed draft shape`, and `result.ok` is false.

**Frames under Next's bundle (Lab).** The frame code was missing because `next start` runs minified chunks. Turbopack writes a `.map` beside each chunk with `turbopack:///[project]/...` sources. The Lab's Core server now runs with `NODE_OPTIONS` plus `--enable-source-maps` (`packages/test-runner/src/core-web-build/server-process.ts`; test `core-web-build/tests/server-process.test.ts`), so `thrown.at:` and every stack in `core.log` name the source line. Checked with an esbuild bundle remapped to turbopack-style sources: without the flag, the frame is `chunk.js:1:58` and no code is produced; with it, the frame is `at malformed (turbopack:///[project]/.../automation-studio/runtime/llm/draft-shown.ts:6:9)` and `thrown-issue-codes.ts`'s pattern yields `runtime/llm/draft-shown.ts:6`. Not yet seen in a live `next start`.

**Structure.** Core audit failed after the dev merge: `service.ts` was 4,536 lines against the lane's lowered baseline of 4,535. Dev's t180/t182 added one net line; dev's own baseline is 4,558. Fixed by deleting the doubled blank line the lane's grant-table removal had left at `service.ts:333`. Core `node scripts/structure-audit.mjs`: passed. Downstream audit: passed.

## Validation after Fix 2 (2026-09-30)

Worker t174-w5 (`reports/t174-w5-validation.md`) ran every command under build slot b1:
- Core `pnpm --filter fluxiq build`: exit 0.
- Domain `pnpm --filter @fluxiq-web-extension/domain test`: 884/884.
- Downstream `pnpm check`: exit 0.
- Downstream `pnpm build`: exit 0.
- `server-process.test.js`: 2/2.
- Core full `npx vitest run`: exit 1, 65 of 4,458 failed in 32 files, 874 s. Both slots were busy at the time. The failures fall into three groups:
  - **accounting.test.ts (4) and catalog.test.ts (1): this lane's change, now fixed.** Each diagnostic now carries `issueCodes: ["thrown.Error", "thrown.at:<file>:<line>"]` from `thrown-issue-codes.ts`, which is the intended behaviour: a test double's throw is named by its test-file line, and the plan refusal by `runtime.service.ts:<line>`. The expectations were updated with `expect.stringMatching` on the frame. Re-run alone with `--minWorkers=1 --maxWorkers=2`: 17/17. Both files' other failures pass when run alone, so they were load timeouts.
  - **deepseek-bootstrap-exploration.test.ts (4 real): caused by this lane's run-4 change (b), not fixed.** Re-run alone, the same 4 fail. With `maxCalls` 20, 26 and 8, the loop gets 3 fewer decisions: 17 against 20, 23 against 26, and so the creations that needed those decisions fail. That is exactly the `reserved = 1 + providerRetryCount` subtraction in `loop-limits/flow-bootstrap-evidence-loop.ts`. The reservation is grant-driven: it sizes the loop to what the grant will allow. It runs against the no-grants rule, it reserves retries that only happen on a fault, and t186 removes grants anyway. The correct action is to revert it: restore `loop-limits/flow-bootstrap-evidence-loop.ts`, `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`, `llm/evidence-loop/tests/stall-guard.test.ts` and `llm/resolver-contract.ts` to `259a11b`. Dev never touched these files, and their current content is committed in `e8d3bfc`. **The permission classifier denied that restore twice ("Irreversible Local Destruction"), so it is left for the supervisor or user.** Until then, those 4 tests fail and live builds keep 45 decisions instead of 48.
  - **About 50 timeouts** (15/30/60 s, plus EBUSY/ENOTEMPTY on SQLite temp files) under load. Not re-run: the supervisor said not to re-run the full suite under load.
- Debug files for runs 7-10 by worker t174-w4 (`reports/t174-w4-debugs-7-10.md`): `debugs/run-{munda7ub-d9214e3b, mundl2j0-df8e4a32, mundupr5-f1cde5aa, mune0xh1-2470406a}.md`. The worker corrected the gap after run 7's tool call to 27 ms, not about 50. Open, and not in this lane: the Lab counts 0 calls for run 7 and 1 for run 10, although a throw came after 22 and 17 decisions.

## Runs 11 and 12 (2026-09-30), the first on the Fix 2 builds

| # | Run | Task | Stage reached | Causes | Fix | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | `run-munhpy2m-036e9572` | crossborder-marketplace-hub-to-cart | none (facility) | The first `fluxiq.connect` got no answer in 15 s (`connectionState: unreported`, so `lastStatus` was never set), after a 175 s run-up the bundle cannot time. (debug: `debugs/run-munhpy2m-036e9572.md`). | Launcher now keeps the full Lab log | - |
| 12 | `run-muni3pdr-80225d3f` | same | none (facility) | 11 s in, `page.goto` of `sidepanel/index.html` gave `net::ERR_ABORTED` ("frame was detached"); the opener retries only renderer crashes (debug: `debugs/run-muni3pdr-80225d3f.md`). | Not yet | - |

The extension's start has now failed in 6 of 9 launches (runs 3, 5, 8, 9, 11 and 12). No provider call was spent in any of them. This is now the blocking cause, ahead of the build's own. Two findings to act on next:
- (a) Reproduce the extension start with no provider (Playwright, this extension build) and time the worker, the control page and the first connect.
- (b) `waitForOpen` in Core `packages/client-gateway-websocket/src/transport.ts:151` has no deadline, so an unopened socket leaves `fluxiq.connect` unanswered forever. This is a product defect in its own right.
Candidate causes: the t182 background changes, new in runs 11 and 12. Cause not established. The machine-load explanation is withdrawn (user, 2026-09-30); root-causing as a product or Lab defect under t174-w7.

Core `npx tsc --noEmit -p tsconfig.json` after the accounting/catalog test edits (heavy.sh, b1): rc=0, no output.

## Fix 3: the extension start (runs 3, 5, 8, 9, 11, 12), root-caused by t174-w7 (Lab)

**Cause: the Lab's own network guard.** `packages/test-runner/src/network-guard.ts` `proveWorker` `evaluate`d a canary `fetch()` into the extension's service worker the moment Playwright announced the worker. That was before the worker's global scope existed: an evaluate there saw `setTimeout is not defined`. The `fetch()` killed the extension renderer (`Target.targetCrashed`, `STATUS_BREAKPOINT`, 180–273 ms after the worker started). Chromium then never restarted the worker, so every later `fluxiq.connect` went unanswered (runs 8, 9, 11). A side panel loading in the same process showed `Page crashed` (runs 3, 5) or `ERR_ABORTED` (run 12). The machine was not the cause. The load explanation is withdrawn from the Runs rows and debugs (worker t174-w8), and w6's machine-load sampling was removed.

**Evidence** (w7's isolation matrix, provider-free, headed, crossborder-marketplace, 3–5 starts per variant; `reports/t174-w7-extension-start-cause.md`):
- Canary only: 0/3 clean.
- No guard: 3/3.
- Routes without the canary: 3/3.
- Canary 3 s later: 3/3.
- Before the fix: 1/10. After: 10/10. One full provider-free `lab run` also passed.
- All measured on the build before t185.

**Fix.**
- The guard waits for the worker's scope (`typeof setTimeout/fetch`) before its canary. A worker whose scope never readies becomes a `service-worker` violation, never a fetch.
- The connect path now has a deadline and a named failure. Core `packages/client-gateway-websocket/src/transport.ts`: `connect()` waits at most `CLIENT_GATEWAY_OPEN_TIMEOUT_MS` (10 s), else `FluxIQClientGatewayOpenError` with `open_timeout` / `open_failed` / `closed_before_open` (new `open-error.ts`).
- The extension's `gateway-session.ts` names that code in `lastError`, and a superseded attempt no longer fails the live one.
- The Lab's pre-approval timeout publishes `connectFailure`. A retried control page must bring the worker back, or the start fails at once as `extension.worker`.
- New `run-scenario/extension-start-trace/`: CDP target lifecycle, worker and page console, and the Lab's timed steps, screened, written as `extension-start.local.json`.

**Validation (re-run by the lead).**
- Core `client-gateway-websocket` `transport.test.ts`: 6/6.
- Lab `node --test` on the network-guard, extension-control-page, pair-extension and pairing-status-wait tests: 51/51. Extension-start-trace: 4/4. The dist was newer than every changed source.
- Extension `gateway-session.test.mjs` (built after the source edit): 5/5.
- Downstream structure audit: passed.
- w7 also reports the extension suite 1155/1155 and test-runner 1600/1603 through heavy.sh.
- `runner-wiring.test.ts` #11 fails, but it is a pre-existing stale pin: its `runRedactionScopes({...})` string matches neither HEAD nor the tree.

**Not verified:** the fix on the merged build with t185, which changes `background/connection.ts`. So the ten-start probe is re-run after the merge. Core's gateway integration doc and the package README do not yet mention `openTimeoutMs` or `FluxIQClientGatewayOpenError`.

**Known and owned elsewhere:** the 3-call grant reservation in `loop-limits/flow-bootstrap-evidence-loop.ts` and its 4 failing `deepseek-bootstrap-exploration` tests, resolved by t186's grant removal. Core's structure audit counts `service.ts` at 4,536 against 4,535 after the t188 merge.

## Merge of dev with t185, t186, t188, t189 and t190 (both trees), resolved

Core, where dev's grant removal wins:
- **Grant files deleted:**
  - `llm/execution/{grants.ts, index.ts, tests/grant-call-refusal.test.ts}`
  - `llm/grant-refusal/{call-refusal.ts, index.ts, refusal.ts}`
  - `generation-failure/tests/grant-refused-call.test.ts`
- **Taken whole from dev:**
  - `llm/resolver-contract.ts`
  - `loop-limits/flow-bootstrap-evidence-loop.ts` and its test (the 3-call reservation is gone)
  - `llm/evidence-loop/tests/stall-guard.test.ts`
  - `generation-failure/{codes, failure-state, harness-failure, harness-vocabulary}.ts`, `llm/harness/run.ts` and `llm/provider-contract.ts` (the lane's grant naming, including `grantRefusalReason`)
  - `llm/index.ts`
  - `.structure-baseline.json` (the lane's copy had lost three of dev's entries)
  - `adaptation-host.ts` (EOL only)
- **Kept from the lane:**
  - `llm/evidence-loop.ts` is t189's structure with the progress-trace hook on existing lines: 668 lines, the same as dev.
  - `service.ts` is dev's plus the lane's two line-neutral changes, the stage after the first decision and the `error` passed to `flowBootstrapPhaseFailure`. It is 4,480 lines, under the baseline.
  - `accounting.test.ts` is dev's plus the `threwHere` case.
  - `progress-trace.test.ts` sample codes are now non-grant codes.
- `grantRefusalReason`, `grant-refusal` and the Flow Bootstrap grant codes no longer appear anywhere under `packages/fluxiq/src` or `apps/web/src`.
- Core structure audit: passed. It says one entry could be lowered, which is not recorded here.

Downstream:
- `run-scenario.ts`: the import is the union of t185's `openLivePanel` and the lane's start-trace names. `launchBrowser` is dev's two lines, with `startTrace.attach` on the second. The file is 705 lines against dev's 706.
- `build-proposal.ts`: dev's grant-free payload with `permittedConsequences`, plus the lane's `longRequest: true` held to the build deadline.
- Downstream structure audit: passed.

**Validation of the merge (heavy.sh).**

| Check | Result |
| --- | --- |
| Core `packages/fluxiq` `tsc --noEmit` | rc 0, 25 s |
| Core `apps/web` `tsc --noEmit` | rc 0, 35 s |
| Core vitest `runtime/llm`, `runtime/loop-limits`, `flow-bootstrap/generation-failure` | 1 failure of 1,008 at first (fix below); after the fix, that file 8/8 and `progress-trace.test.ts` 4/4 |
| Core `client-gateway-websocket` vitest | rc 0 |
| Downstream test-runner `build` | rc 2 at first (fix below), then rc 0 |
| Downstream test-runner `check` | rc 0 |
| `node --test` on build-proposal, network-guard and extension-control-page | 46/46 |

Two lane tests needed fixing after the merge:
- **`llm/tests/evidence-loop-draft-shown.test.ts`**: its first run failed because it read the first packed entry, which after t189 is the decision history (`decision_rows_v1`). It now looks for the draft's own `step_rows_v1` in the last decision's evidence.
- **`build-proposal.test.ts`** (the lane's three long-request tests): the first build failed because they authorized with `{ grantId }`. They now use t186's `{ permittedConsequences: [] }`.

## Ten-start probe on the merged build (Core `4d126f6`, downstream `a7d83e17`, with t185)

w7's probe (`scratchpad/t174w7-probe.mjs`, the Lab's own start path, provider-free, headed, crossborder-marketplace, slot-1), after building Core `contracts`, `client-gateway-websocket` and `fluxiq` plus the `t174-w7` instance: **10/10 clean**, 0 `cdp.crashed`. Runs `run-munmghv4-cc033166` … `run-munmkkp7-dec8d046`. From control page to paired took 200–240 ms, and the connect answered in 41–76 ms after being sent. Start 1's topology took 98 s because it included the Core web rebuild; the others took 8.4–13.5 s.

## Run 13 (`run-munmmj5n-52d8a67d`), the first live build since the restart that proposed a Flow

Debug: `debugs/run-munmmj5n-52d8a67d.md` (worker t174-w10).
- **Start:** the extension started cleanly and the live panel opened (`[lab] live panel: side-panel (verified open)`).
- **Build:** 62 decisions plus the instruction authority's call, 63 in all, $0.109. The build was refused `instructed_act_missing` at iterations 15, 51 and 57, then accepted at 62 with an 8-step dry run. An adaptation was created.
- **Failure:** the Lab then failed the run `performance.budget` ("63 provider calls against --llm-max-calls 48") before playback.

Causes:
- **A. The Flow's configured call limit is ignored.** Since t186, the session-key resolver returns fixed defaults and never reads `llmExecutionSettings.maxCalls`, so the loop runs to its 64-decision ceiling. **Owned by t193**, which recorded it first as its cause B, with a worker dispatched. Until that lands, lane A's launcher passes `--llm-max-calls 65`, the loop's own 64 plus the authority, so that the Lab judges the Flow instead of a limit Core does not apply.
- **B. The accepted Flow has no click.** The accepted plan (draft steps d36, d39-d42, d45, d46) is all `web.output.browser-navigate`. The only add-to-cart click, at iteration 49, was rejected `target_not_a_handle` and never retried. Iterations 16-42 were 21 navigations to the item page, each batch then withdrawn by an amendment. The instructed-acts check refused three times, then accepted a navigation-only plan. Unowned by another live lane so far; lane A investigates it after run 14's playback shows what the Flow does.
- **C. Decision efficiency:** six `amend_draft` in a row (43-48), and repeated navigations that made no progress. This is the evidence-loop no-progress guard's area.

**UI review tooling (worker t174-w9, `reports/t174-w9-ui-review.md`).**
- New `packages/test-runner/src/run-scenario/ui-review/`, hooked into `run-scenario.ts` line-neutrally (706 lines).
- At `start`, `mid-build` (every ~20 s), `flow-run`, `end` and `failure` it saves PNGs of the scenario tab and of the real side panel. The panel is captured through its own DevTools target.
- Each moment also samples `<fluxiq-activity-overlay>` for about 3 s at 5 Hz: presence, visibility, text (shadow root included), phase, and counts of text changes and presence toggles.
- Output sits beside the bundle, never in it: `<runs dir>/<runId>.ui-review.local.json` and `<runId>.ui-review.local/`.
- **Validation:**
  - `ui-review` tests: 18/18, re-run by the lead.
  - Test-runner build: exit 0.
  - Downstream audit: passed.
  - Provider-free `lab run crossborder-marketplace`: passed (`run-munnzfiz-58c009b1`). The lead opened its start panel PNG; it shows the real side panel.
  - The overlay was absent in every window of that run: 0 of 16 samples present. That run never had FluxIQ acting.
- **Overlap to route:** t193's report records the same missing screenshots as its cause G2, with a worker dispatched. t174-w9's module is done and validated, so one of the two should stand.

## Runs 14-17 (2026-09-30)

| # | Run | Task | Stage reached | Causes | Fix |
| --- | --- | --- | --- | --- | --- |
| 14 | (no run id) | crossborder-marketplace-hub-to-cart | none | The Lab profile refused `--llm-max-calls 65` (the maximum is 64) | L1 changed to 64 |
| 15 | `run-munoeac4-33c17306` | crossborder-marketplace-hub-to-cart | **4, the Flow ran** | The build took 14 decisions and $0.024. It accepted a 2-step Flow of navigations to the start URL. Core's verification refuted it (`does_not_answer_request`). Repair then made 3 diagnoses and refused `runtime_patch_goal_unachievable`. The build navigated blind, and the page it landed on was the scenario's robot check. Debug: `debugs/run-munoeac4-33c17306.md`, with UI review. | F5, F7 |
| 16 | `run-munore4o-c84cfa29` | bigbox-retail-pickup-cart | **4, the Flow ran** | Playback step 2 was `blocked_by_dialog` under the consent dialog (t195 F1). The dry run's reset keeps the consent choice. The instructed-acts check accepted a Flow with no store pick. The amendment at 41 withdrew needed steps. `rerun` hit `unexpected_input_keys`. Repair hit `target_unanchored`. Debug: `debugs/run-munore4o-c84cfa29.md`, with UI review. | F6; the others are routed in the debug |
| 17 | `run-munp80f5-c31ea417` | crossborder-marketplace-hub-to-cart | 2 | F5 held: every completion that claimed navigations was refused. But the model only ever navigated (11 navigations, 0 presses), mostly onto the robot check (`route.ts`: every third search load since the last check serves it). It then asked to complete 8 times in a row and ended `evidence_unusable_decision`. | F7; the model's navigate-only exploration stays open |

**UI review findings for t191** (runs 15-17; the evidence is in the two debugs' "UI review" sections):
- **U1:** raw tool ids and node ids are shown to the person ("Using core.run_node", "Running step 1 of 7: node.bootstrap…").
- **U2:** the headline is repeated as the sub-line.
- **U3:** the overlay covers the page's bottom-right controls: consent buttons and chat widgets.
- **U4:** the panel says "RIGHT NOW: Done" mid-build, during repair and after a failure.
- **U5:** "Add an AI model key: To do" is shown while a live build works.
- **U6:** a control name is joined without a space in the "Clicking" line.
- **U7:** the phase changes up to 1.0 times per second (5 text changes in 3 s in run 15, window 8), and the overlay drops out on each navigation (presence toggles).
- **U8:** repair looks like building, and a failure is not left on screen.
- **U9:** nothing tells the person that a robot check is waiting for them.

| 18 | `run-munpwa5r-e7aefe04` | bigbox-retail-pickup-cart | **4, the Flow ran** | With F5 the build made 48 decisions and 49 calls ($0.090) and built a 9-node Flow: 1 navigate, 7 clicks, 1 type. Playback was `blocked_by_dialog` at step 2 under the consent dialog, as in run 16 (t195's F1 fixes that and arrives at this round). The harness made 3 interventions. Full debug pending. | t195 F1 at the merge |
