# t342 — live lane A baseline on the restored creation path

Lead: t342-lane-a (lead). Worktree `fxwork/t342` (downstream 0a0f4979, Core e76e1775, branch
`task/t342-lane-a-baseline`). Instance `t342-slot-2`, slot 2, workspace `t342-a`. 2026-10-07, 19:52-20:12 UTC
(off-peak). Run debug: `docs/working/language-driven-flow-loop-plan/debugs/run-muyj5f0b-02fcd351.md`.

## In plain English

**Blocked. Nothing was built and nothing was spent.** The Lab started the one allowed lane A run, built the Core
panel and started Core. Then, as it should, it asked the running Core to prove which build it is before anything
costs money. Core said it could not, so the Lab stopped there: no project, no browser, no chat message, no model
call, $0.

Why Core could not say: when the Lab builds the Core panel for a run, it compiles Core from its source files instead
of using Core's built library. Only the built library carries the stamp that names the build, so a panel compiled
from source always answers "unavailable". This has been true since the build-identity check landed (t302). It was
never caught because the identity proofs used a stand-in server rather than the real panel, and t338's checks were
dry runs, which never start Core. It blocks every Lab run that talks to Core, paid or free: lanes A-D, saved-Flow
replays and provider-free Flow runs. I confirmed that with one free Flow run, which failed the same way.

I tried the fix on a scratch copy, without touching the repository. The same build, told not to read Core's source,
embeds the correct stamp, identical to the built library's. The fix belongs in the Lab's panel staging (below).

Because no build ran, there is no judge-versus-oracle comparison, cost per build, UI review, replay or second run to
report. The brief says to stop when a Lab or setup defect blocks the run itself, so I did not relaunch.

## What happened

| Time (UTC) | Step | Evidence |
| --- | --- | --- |
| 19:54 | Rebuilt Core libraries; downstream `pnpm build`: all current by stamp | `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` -> three `reuse`; `pnpm build` -> every step `reuse` |
| 19:54 | Claimed slot 2 | `lab-slots/slot-2/owner` = `{"task":"t342","lane":"A","instance":"t342-slot-2",...}` |
| 19:54 | Campaign dry run | one spawned command, with `--authoring-mode legacy --llm-max-calls 48` |
| 19:55 | Lab `--dry-run` of that command | exit 0; `status ready`, `providerCallCount 0`, created-flow, chat entry, persistent-isolated, deepseek-flash, `coreAuthoringMode legacy`, maxCalls 48, $0.10, `permittedConsequences []`, instruction 219 chars sha256 `2e6f5e7d...a405` |
| 19:58:10 | Live guard | `{"lab":"live-guard","state":"admitted",...,"fingerprint":"sha256:3632d337..."}` |
| 19:58-20:00 | Lab built the Core panel and started Core | `logs/core-web-build.log` compiled in 37.0 s, exit 0; `logs/core.log` `Ready in 1518ms`, gateway bound |
| 20:00:01 | Identity gate | `get-runtime-build-identity (400): Executing Core runtime build identity is unavailable.` (`process.startup`) |
| 20:00:07 | Campaign end | totals `providerCalls 0`, `reportedCostUsd 0`; ledger `finish` verdict failed, cost null |

Guards at launch: no `STOP-balance`, no override files; downstream two documentation files behind local `dev`
(allowed), Core equal to `dev`; no earlier ledger lines for this instance.

## Cause B1 and the proposed fix

- Core refuses when `service.coreRuntimeBuildIdentity` is null
  (`!FluxIQ/packages/fluxiq/src/programs/automation-studio/api/handlers/diagnostics/runtime-identity.ts:13`). It is
  read once from the embedded literal in `packages/fluxiq/src/runtime/build-identity/read.ts`. That literal is a
  placeholder in source and stamped only in `dist` (`dist/runtime/build-identity/read.js`: schema 1, version 0.7.0,
  1,601 artifacts, digest `144d96fa65f8...`).
- The served panel's server chunk inlines the placeholder into the service:
  `coreRuntimeBuildIdentity=(function(){let e=JSON.parse('{"fluxiqRuntimeIdentityPlaceholder":302}')...` in
  `!FluxIQ/.tmp/core-web-build/3ba011561d28594c1b0f43ca/b-73645052870f/apps/web/.next/server/chunks/Users_osrs__FluxStuff_fxwork_t342_!FluxIQ_0f2cb6e9._.js`.
- The cause is `packages/test-runner/src/core-web-build/workspace.ts:36`, which copies Core's `tsconfig.base.json`
  verbatim into the staged workspace. Its `paths` map `fluxiq`, `fluxiq/*` and `@fluxiq/contracts*` to `src/**.ts`,
  and Turbopack follows them. Without them, `apps/web/node_modules/fluxiq` (a link to Core's package, every export
  pointing at `dist`) would be used. The Lab's expectation is built from `dist`
  (`run-scenario/browser-session/core-identity/expected.ts:9,15`).
- Reproduction (free): `FLUXIQ_LAB_INSTANCE=<any> FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run
  basic-form --flow` -> `run-muyjgsoh-71c3b3f4`, the same 400. No Lab run on this machine has ever written
  `snapshots/running-core-identity.json`.
- Probe of the fix (free, scratch copy `!FluxIQ/.tmp/p1`, no repository file edited): the same staging with only
  those `paths` removed, then `next build --turbopack` with the Lab's build environment. The build exited 0, no
  server chunk contains the placeholder, and the service chunk embeds the stamped identity with digest
  `144d96fa65f8`, the same as `dist`.

Proposed fix, for a separate Lab brief (downstream `packages/test-runner/src/core-web-build/`):

1. `workspace.ts` `prepareWebWorkspace`: write the staged `tsconfig.base.json` with the `fluxiq`, `fluxiq/*` and
   `@fluxiq/contracts*` paths removed, so the panel resolves Core through its package exports to the stamped `dist`.
2. `key.ts:9`: raise `BUILD_LAYOUT_VERSION` from 2 to 3. `inputs.ts` hashes Core's real tsconfig, which the fix does not
   change, so without this the published source-built panel (key `3ba01156...`) would be reused.
3. `prepare.ts` `buildAndPublish`: before `markBuildComplete`, refuse to publish when any `.next/server/**/*.js`
   contains `fluxiqRuntimeIdentityPlaceholder`, with a message that names it. This fails at build time instead of
   with a 400 at run time.
4. Tests in `core-web-build/tests/` for 1-3. Then run a provider-free Flow-lane run, which must write all four
   `running-{core,host,server-adapter,build}-identity.json` snapshots before any paid run. The host, server-adapter
   and extension gates have never run in a real topology either, so they may show further defects.

The alternative is changing Core's own `apps/web` tsconfig or Next config. That also changes Core's development
build. The Lab staging is narrower and matches the facility doc's statement that the panel key covers the libraries'
`dist`.

## Other findings

- **B2, wrong blame in the campaign.** It said this deterministic Core 400 "can" be "this machine's memory fault ...
  only a retry tells them apart" (`scripts/lab/live-campaign/lab-run/ram-fault.mjs`). That contradicts the standing
  rule that live failures are product or Lab defects. An HTTP answer from Core control is not a crash. Proposal:
  exclude failures caused by a Core control HTTP response from the memory-fault classification, and name the
  endpoint and status.
- **B3, the dry run's panel key misleads.** The dry run reported key `a22a7ea3e56527de2aaf3183`, but the run built
  `3ba011561d28594c1b0f43ca`. Likely cause, not confirmed: the gateway server artifact the key covers is generated
  only by a real run.
- **B4, no free rehearsal before paying.** A dry run never starts Core, so it cannot catch identity, host or
  topology defects. A provider-free Flow-lane run (about 25 s with a cached panel) does. Proposal: make it part of the
  campaign's preflight whenever Core or the Lab changed since the last admitted run.

## Not measured, not run

- Judge versus oracle, cost per build, calls, steps: no build ran.
- UI review (chat, overlay, panel): the browser never launched (`ui review: 0 moment(s)`).
- Replay and second independent creation run: not reached.
- Running extension and domain-host identities: the Core gate refused first, so the host, server-adapter and
  extension checks never ran.

## Guard and slot state left behind

- Ledger: one `start` and `finish` for `t342-slot-2` (verdict failed, cost null). The debug exists under the run id,
  which satisfies the `debug` guard. The `unchanged` guard refuses this instance and task until source changes; the
  fix will change the fingerprint. `loop`: one start in the window.
- Slot 2 is still claimed by t342 (lane A).
- Scratch output to delete when no longer needed: `fxwork/t342/!FluxIQ/.tmp/p1` (probe build, about 210 MB, ignored)
  and the Lab's published source-built panel under `fxwork/t342/!FluxIQ/.tmp/core-web-build/3ba01156...`.
