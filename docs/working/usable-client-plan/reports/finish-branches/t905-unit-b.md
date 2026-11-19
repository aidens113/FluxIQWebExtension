# t905 unit B: trusted producer/service adapter

Worker report, brief `finish-branches/t905-unit-b`. Core tree `fxwork/t905/!FluxIQ`, branch `task/t905-result-ledger`, HEAD `b854b86c0`. No git mutation; changes are in the working tree for the lead.

## Outcome

Done. Root graph-entry inputs now seal only through the service's durable input owner with an authenticated origin per assembled layer; absent provenance stays unknown. Causal tests went red (10 failed / 7 passed) then green. The brief's directory run, check and unchanged audit pass. `vitest related` ran 646 files: 4421 passed, 4 failed, 1 skipped. The 4 failures are on paths B does not touch (see Not verified).

## What B authenticates, and what stays unknown

- A root entry seals only when its exact effective dictionary is the overlay of the layers the run assembled (`inherited`, then `caller`), and every layer's declared origin authenticates. Trusted service code declares the origin. Nothing is inferred from a value's shape or from it looking nonsecret.
  - `request`: the operation's own authenticated channel. In flow-run, that is the caller's `inputs` read by `caller/options.ts`.
  - `revision`: a root input from an earlier run. It is reopened through the owner as the current head of its slot, under the same project, task and principal, and its execution copy must exactly equal the layer.
- Each layer is issued in its own owner slot (`<entry producer>.<role>`), and those revisions are the entry's ordered producers, checked at publication and again at completion.
  - Scope authority admits only the run's own project, task and principal.
  - Secrecy says `nonsecret` only for exactly the authenticated layer values, or exactly their overlay plus the issued producers. It says `active` under any run-secret context.
  - Every origin is checked before the first write, so an unknown origin writes nothing.
- Unknown, and the run continues ordinarily:
  - `origin_unverified` (new code in `runtime/input-basis/contracts/unknown.ts`): a layer with no origin, an unattributed key, non-empty root `declaredInputDefaults` (executable-owned, and no defaults producer exists), or a revision whose stored values differ.
  - `stale`: a stale or foreign revision.
  - `active_secrets`: an active secret context.
  - `resume_state_unverified`: a seeded continuation.
  - `unverified_frame`: a non-root frame.
  - `fork_unverified`: every child fork, because no durable child-occurrence slot or callee-to-executable correspondence exists.
- Flow-run's engine-inherited layer has no declared origin. It is `{}` in production (trial environment), so it is not listed. If it ever carries values, the entry is `origin_unverified`.

## Files and why (Core `packages/fluxiq/src` unless noted)

- New `framework/automation-service/service/input-basis/execution/`:
  - `origin.ts`, `layer.ts`, `entry.ts`: the declared-provenance types.
  - `producers.ts`: layer slots, origin checks, producer owners and secrecy.
  - `authority.ts`: implements the engine's `AutomationStudioInputUseAuthority`.
  - `executions.ts`: opens one engine session per run. `AutomationStudioInputUseExecutions.of(service)` is the typed seam.
  - `index.ts`, plus `tests/authority.test.ts` (8 tests). `input-basis/index.ts` re-exports these.
- `service/runtime-session/graph-options.ts`: carries a run's `inputUse` port. Any extra field the engine adds to a native dispatch now reaches `native.execute` as a fifth argument. The engine and every wrapper add none today (traced through replay-scope, dispatch-watch, run-gate and settled-calls), so the call is unchanged. Tests: +2 in `tests/graph-options.test.ts`.
- `service/answer-first/flow-run/ports.ts`: an optional `inputUse { open(entry), observed(observation) }`.
- `flow-run.ts`: opens the session in `gatedOptions` over exactly the layers it assembles, then reads the observation from the real executed trace, closes the session in `finally`, and reports. With no port there is no session and no await. Tests: `flow-run/tests/input-use.test.ts` (2).
- `service.ts`: **unchanged.** Adding a field and an import took it to 4307 lines against a 4304 "never grow" baseline and failed the audit. The seam now reads only the service's public `projectPaths`, `projects` and `runDatasets`.
- Docs: `docs/architecture/runtime-ownership.md` (the brief's `automation-studio/runtime-ownership.md` does not exist) and `docs/architecture/automation-studio/persistence.md`.
- Left alone: engine/**, generation-catch.ts, extension tree, baselines. Dataset retirement and `deleteRunDatasets` were not touched, so no "superseded" method was added.

## Red / green evidence and commands

All commands ran from `packages/fluxiq` through `heavy-slot.mjs run`. Logs are in the session scratchpad.

1. `t905b-red` (stub authority, no wiring): vitest on `input-basis/execution`, `graph-options.test.ts` and `flow-run/tests/input-use.test.ts`. Exit 1: 10 failed / 7 passed, 72.4 s.
   - The failures were real causal ones: the stub returned `authority_unavailable` instead of a seal, the port was not carried, the native extra field was dropped, and flow-run reported nothing.
   - The 7 passes were the 5 old graph-options tests plus the seeded and active-secret cases, which the engine already refuses.
2. `t905b-green1`: own tests, then check. Vitest exit 0: 5 files, 70/70 (owner 34, store 19, authority 8, graph-options 7, flow-run input-use 2). Check exit 2: one test-only TS2554 (`child` took no parameter). Fixed.
3. `t905b-gate`:
   - The brief's dirs (`service/input-basis`, `service/runtime-session`, `service/answer-first`, `src/runtime/input-basis`, `src/engine/automation`, at one worker): exit 0, 289/289 files, 2254/2254 tests, 30 min. This includes the captured-row guard tests.
   - `vitest related`: exit 134 with no test run. Vitest's main process hit the 2 GB V8 heap while walking all 2637 test graphs.
   - Check: exit 0.
   - Audit: exit 1, 4 violations, all mine: 2 `as never`, 2 packed test lines, and service.ts +3 lines. Fixed with typed stubs, split lines, and moving the seam out of service.ts.
4. `t905b-gate2`:
   - Own areas (`input-basis`, `runtime/input-basis`, `graph-options.test.ts`, the whole `flow-run`): exit 0, 26 files, 227/227.
   - `pnpm.cmd --filter fluxiq check`: exit 0.
   - `node scripts/structure-audit.mjs`: exit 0, "passed (554 warning(s), 909 baselined)". No baseline change.
   - `vitest related --run <all 12 changed sources> --dir src/<d> --passWithNoTests` with `NODE_OPTIONS=--max-old-space-size=4096`, one top-level dir at a time:

     | Dir | Files | Tests | Exit |
     | --- | --- | --- | --- |
     | framework | 428 | 2996 passed, 3 failed, 1 skipped | 1 |
     | runtime | 94 | 804/804 | 0 |
     | programs | 112 | 543/543 | 0 |
     | platform | 2 | 6/6 | 0 |
     | server | 5 | 43 passed, 1 failed | 1 |
     | flows | 3 | 23/23 | 0 |
     | tests | 2 | 6/6 | 0 |

     engine, client-gateway, ui, components, io and api-contracts had no related tests (exit 0).

## Not verified

- The 4 `related` failures were not rerun on an unchanged tree, because that needs a git checkout or stash, which I may not do.
  - `subflow-trial/tests/run.test.ts` A11 ("Cannot read properties of undefined (reading 'lease')"): pre-existing. `dev` commit 255d606ab, which is not in this branch, fixes exactly this test after t911.
  - `service-flows/tests/runs.test.ts` and `scale-pages.test.ts` ("event timestamp must be a non-negative integer"): fixture run details saved through `saveFlowRunDetail` into the runtime stream store. No graph runs, and none of my files is on that path. Cause not traced.
  - `server/fluxnode-api/tests/sdk-acceptance.test.ts` test 3: the second answer holds only "Clockmaking", not both titles. That is the answer-first result feed across check rounds, with no input-use port, and the native forwarding is a no-op there. Cause not traced; it may belong to this branch's own result-ledger work.
- No production caller opts in yet. `answer-first/attempt/flow-stage.ts` is outside B's paths and still passes no `inputUse`. Nothing consumes observations, and admission and judging are unchanged.
- Child forks, node-use, defaults producers, secret continuity, and live browser or Lab behaviour are not covered.

## What C1 must plug into

- Add the optional `node?(capture, signal)` method to `AutomationStudioInputUseServiceAuthority`. Its producers come from `AutomationStudioInputUseProducers` (issued layer revisions plus `entryOwner()`), never from IDs or pointers.
- Native consumption: whatever per-attempt field C puts on the `nativeNodeExecutor` request already reaches `native.execute` as its fifth argument (`graph-options.ts`, `NativeForwarding`). C2 adds the matching parameter in `native-node-runtime.ts`.
- Production hookup for the lead: in `flow-stage.ts`, pass `inputUse: { open: entry => AutomationStudioInputUseExecutions.of(service).open(scope, entry), observed }`. The scope must come from authenticated owners: the project, the attempt's task id, and the caller or person principal.
