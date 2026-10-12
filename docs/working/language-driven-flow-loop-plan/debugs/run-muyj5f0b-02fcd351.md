# Run debug — run-muyj5f0b-02fcd351 (lane A baseline after t338, t342-slot-2)

Written as `run-pending-t342-slot-2-a.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-07 ~19:58 UTC, off-peak).

## Header

Lane A, baseline after t338 (the first lane A run since round 4 and since round 5 was cancelled). Task
`crossborder-marketplace-hub-to-cart` (scenario `crossborder-marketplace`, kind form, judged by playback goal
`hub-in-cart`, unchanged since round 4). Instance `t342-slot-2`, slot 2 (claimed 19:54:21 UTC), persistent workspace
`t342-a` (new), tree `fxwork/t342/!FluxIQWebExtension` at 0a0f4979 (branch `task/t342-lane-a-baseline`; local `dev`
95d02a99 is two documentation files ahead, which the behind-dev guard allows), Core `fxwork/t342/!FluxIQ` at e76e1775
(= Core dev). Both trees clean. Authoring mode `legacy` (Core `FLUXIQ_AUTHORING_MODE`, chosen by the campaign).
No `STOP-balance`, no override files.

Previous lane A runs: round 1 `run-muw60unq-591e23bd` (origin unread; fixed), round 2 `run-muwaobm2-882cadd9`
(amend/rerun loop; fixed), round 3 `run-mux6n7m4-8273e7a0` (passed; replays 0 calls) and `run-mux74k5q-1c3c2127`
(failed: C1-C3, fixed in t281), round 4 `run-muxkzdjw-31a13429` (failed: C1 input of an unrun step applied by an
`add`, C2 checked rerun retargeted a lasting step; fixed in t262/t294, Core `e9b7d691`). Round 4 also ran a stale
extension background (R4-1, fixed in downstream `411e4b90`), so this is the first lane A run on a current background.

## Expectations (written before launch)

Instruction, verbatim (219 characters, sha256 `2e6f5e7d...a405`, same as round 4):

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the
> 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything.

Acts the reader must give: `a1` put with choices `a1.quantity` three, `a1.colour` Space Grey, `a1.version` 7-in-1,
`a1.origin` Spain; `a2` collect.

Command (the campaign's; `--max-attempts 1`, so no second paid attempt):

```text
FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 --authoring-mode legacy -- --target persistent-isolated --workspace t342-a
```

Dry-runs (19:54-19:55 UTC): the campaign printed one spawned command (`pnpm lab run crossborder-marketplace
--live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode legacy
--llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart --llm-max-input-tokens 992000
--llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated
--workspace t342-a`); that command with `--dry-run` exited 0: `status ready`, `providerCallCount 0`, lane
created-flow, buildEntry chat, persistent-isolated, deepseek-flash, `coreDefaultModel` deepseek-flash,
`coreAuthoringMode` legacy, maxCalls 48, maxEstimatedCostUsd 0.1 (= maxTotalEstimatedCostUsd),
permittedConsequences [], key `DEEPSEEK_API_KEY` from `.env.local`, instruction 219 characters, `coreWeb.cached`
false (the live run builds the Core web panel first). The prelude rebuilt the instance's scenario-lab, domain host
and extension builds; Core libraries and the downstream packages were current by their build stamps.

Actions a correct Flow takes, in order:

1. Navigate to the Farbazaar start page.
2. Dismiss the welcome popup and the consent layer (optional steps).
3. Search for the Voltbay USB-C hub and open the Voltbay Official Store item.
4. Space Grey is preselected: no press in the Flow (a press un-chooses it), or only one that leaves it chosen from a
   fresh page.
5. 7-in-1 (claims `a1.version`) and Spain (claims `a1.origin`), each performed in the build test.
6. Collect the store coupon (`a2`).
7. Quantity 3 (`a1.quantity`), a real performed setting (typed or set, not a check).
8. Add to cart (`a1`), once, after the choices; never Buy now, never checkout.

Exact oracle facts (playback goal `hub-in-cart` plus final state `NOTHING_BOUGHT`):

| Fact | Subject | Expected |
| --- | --- | --- |
| cart-line | mini-cart-line text | Voltbay hub line: Voltbay Official Store, Space Grey, 7-in-1, ships from Spain, × 3 |
| store-coupons | coupon flyout text | Voltbay Official Store coupon collected |
| cart-count | mini-cart-count | `Cart (3)` |
| orders-shipped | orders summary | `Orders to be shipped (0)` |

Wrong plausible answers: China origin; coupon but empty cart; wrong store, colour, version or quantity; Buy now
pressed; an unfinished draft called a saved Flow; a candidate draft (t330 behaviour) where legacy should apply.

New on this source since round 4, each to be checked in the debug:

- R5-1 legacy authoring (t338): chat create-here builds, judges, applies and says the automation is ready on a pass.
  **Must be seen:** `coreAuthoringMode: legacy` in `snapshots/live-llm.json`; never "Saved a candidate draft".
- R5-2 acceptance fence (t296): the build is accepted only on a confirmed second affirmative judge verdict;
  unsupported held-repair shapes are refused before applying.
- R5-3 running identities (t297, t302, t305, t310): `snapshots/running-{core,host,server-adapter,build}-identity.json`
  verified before the chat send.
- R5-4 current extension background (R4-1 fix): the Lab forgot the cached worker; Next-page-era background code runs.
- R5-5 typed browser fixes (t301, t303, t306, t315, t319, t321): the quantity typing is observed live and settles;
  navigation outcomes are recognised; no typing-liveness failure.
- R5-6 Stop control (t298) shown in the chat during the build (UI).
- R5-7 command binding (t311, t327): no result settles a command from the wrong session; no such error in
  `logs/core.log`.
- R5-8 requests OFF (t324): no direct-request step.
- R5-9 round-4 fixes in the baseline (Core `e9b7d691`): input rewrites refused (`settings_rewrite_run`), checked
  reruns keep their control (C2b), no row words without records, settled endings stay settled.
- Open from round 4, to watch: C1b (a choice claim on a step that acts on another object stands).

Cost: under $0.10 per build; at most 48 build calls.

UI checkpoints (round-4 set):

- U1 start: the instruction as a user turn in the new project's chat; composer at the bottom; no previous thread.
- U2 mid-build: one assistant message per step with its reason; action cards with icon, target and outcome; edit
  cards say what changed; repeated refusals folded; a Stop control.
- U3 overlay: shown from the send; visible whenever FluxIQ works; text matching the panel; never "Couldn't fix your
  Flow" on a creation build.
- U4 words: no step numbers, "the judge", page-view syntax (`quantity field ="1"`), "made a value ... vary", rerun
  lines without a control name; no quote cut inside a word; no "no rows would be stored" on a cart task.
- U5 ending: whole and plain; a pass says the Flow is saved and ready; a failure never overstates.
- U6 playback: run status, each step's card, Add to cart done, result shown.

Replays (only on a pass): one `lab replay` on `t342-a` with the build's project and Flow ids (from
`snapshots/creation-context.json`), no provider key in the environment: zero provider calls, zero interventions, zero
harness activations, unchanged Flow hash, goal held. Then a second independent live creation run on the same pair.
If the first run fails: debug and stop, no further paid run.

## Result (written by the t342 lane lead from the run folder, 2026-10-07 ~20:10 UTC)

**Blocked before the build: no model call, no browser, $0.** The Lab refused the run at its Core identity gate,
which runs before project setup, browser launch, chat and any provider call. Nothing in "Expectations" above was
exercised; the judge, oracle, cost per build and UI could not be measured.

How far it got (`logs/`, `summary.json`, ledger):

1. 19:58:10 live guard `admitted` (fingerprint `sha256:3632d337...`); ledger `start` `launch-muyj5bjv-d9633c11`.
2. 19:58:15 run `run-muyj5f0b-02fcd351` opened; the Lab staged and built the Core web panel (Turbopack, compiled in
   37.0 s, exit 0; published key `3ba011561d28594c1b0f43ca`, attempt `b-73645052870f`); the gateway server artifact
   was generated.
3. Core started (`Ready in 1518ms`; client gateway WebSocket bound); scenario lab ready.
4. 20:00:01 `get-runtime-build-identity` answered 400 "Executing Core runtime build identity is unavailable."
   (`process.startup`). Run finalized 20:00:02; ledger `finish` verdict failed, cost null; campaign totals
   `providerCalls 0`, `reportedCostUsd 0`. UI review: 0 moments (no browser). `steps/`: empty.

### Cause B1 — the Lab's production panel runs Core compiled from source, whose identity is never stamped

- Core answers 400 when `service.coreRuntimeBuildIdentity` is null
  (`packages/fluxiq/src/programs/automation-studio/api/handlers/diagnostics/runtime-identity.ts:13`). The service sets
  it once from `readCoreRuntimeBuildIdentity()` (`runtime/service.ts:388`), which returns null unless the embedded
  literal in `packages/fluxiq/src/runtime/build-identity/read.ts` was replaced by the build generator. In source the
  literal is the placeholder `{"fluxiqRuntimeIdentityPlaceholder":302}`; only `dist/runtime/build-identity/read.js` is
  stamped (here: schema 1, version 0.7.0, 1,601 artifacts, digest `144d96fa65f8...`).
- The served panel's server chunks contain the placeholder, inlined into the service
  (`.next/server/chunks/Users_osrs__FluxStuff_fxwork_t342_!FluxIQ_0f2cb6e9._.js`:
  `coreRuntimeBuildIdentity=(function(){let e=JSON.parse('{"fluxiqRuntimeIdentityPlaceholder":302}')...`).
- Why: the Lab stages the panel with Core's `tsconfig.base.json` copied verbatim
  (`packages/test-runner/src/core-web-build/workspace.ts:36`), whose `paths` map `fluxiq`, `fluxiq/*` and
  `@fluxiq/contracts*` to `packages/*/src/**.ts`. Turbopack honours tsconfig `paths`, so the build compiles Core from
  `src` instead of resolving `node_modules/fluxiq` (a link to Core's package, whose exports all point at `dist`). The
  Lab's expectation hashes `dist` (`run-scenario/browser-session/core-identity/expected.ts:9,15`), so even a stamped
  source build would not match.
- Probe (provider-free, scratch copy in `fxwork/t342/!FluxIQ/.tmp/p1`, no repository file edited): the same staging
  with only those `paths` entries removed, the same `next build --turbopack` and the Lab's build environment ->
  exit 0; 0 server chunks contain the placeholder; the service chunk embeds
  `{"schema":1,"protocol":"fluxiq.core-runtime-identity.v1","version":"0.7.0",...}` with digest `144d96fa65f8`, the
  `dist` stamp's digest.
- Breadth: `requiresCoreRuntimeIdentity` is `live || flowLane || control !== undefined`, so every Lab run with Core
  control is refused. A provider-free `node scripts/lab/run-lab.mjs run basic-form --flow` (20:06:57-20:07:22,
  `run-muyjgsoh-71c3b3f4`) failed with the identical 400. No Lab run anywhere on this machine has a
  `snapshots/running-core-identity.json`. The t302 proof used synthetic loopback transport, not a running Next panel
  (`reports/p0-core-runtime-identity.md:57`), and t338 validated with dry runs, which never start Core.

Fix proposal (Lab; separate brief): in `prepareWebWorkspace` write the staged `tsconfig.base.json` without the
`fluxiq`/`fluxiq/*`/`@fluxiq/contracts*` paths; bump `BUILD_LAYOUT_VERSION` (`core-web-build/key.ts:9`) so the
src-built panel already published under key `3ba01156...` is never reused; refuse to publish a build whose
`.next/server` holds the placeholder (`prepare.ts` `buildAndPublish`, before `markBuildComplete`). Then a
provider-free Flow-lane run must write all four `running-*-identity.json` snapshots before any paid run; the host,
server-adapter and extension gates have never run in a real topology either.

### Other findings

- B2: the campaign called this deterministic Core 400 possibly "this machine's memory fault ... only a retry tells
  them apart" (`scripts/lab/live-campaign/lab-run/ram-fault.mjs`). An HTTP answer from Core control is not a crash;
  it should be reported as a defect, never as the machine.
- B3: the dry run reported Core web key `a22a7ea3e56527de2aaf3183` (`cached: false`) while the run built and published
  `3ba011561d28594c1b0f43ca`; the dry run's key does not predict the run's. Likely because the gateway server artifact
  the key covers is generated only by a real run (unconfirmed).

Not run: replays and the second creation run (no pass). No relaunch: the cause is in the Lab's build, not the
product under test, and the `unchanged` guard would refuse this instance and task until source changes.
