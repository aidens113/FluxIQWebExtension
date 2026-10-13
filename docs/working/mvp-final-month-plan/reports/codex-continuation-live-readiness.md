# Codex Continuation Live Readiness

Status: Discovery complete; launch preparation required
Created: 2026-10-13
Last updated: 2026-10-13
Owner: codex-t516 worker
Scope: Current lane/slot state, instruction-created gate commands, build/guard prerequisites and remaining breadth.

## Recommended first preparation

Use the clean paired `fxwork/t418` tree for the crossborder instruction-created gate, with slot 3 explicitly reassigned by the supervisor after t520/t521 freeze/integration. It has no ahead commits or dirty files on either side, so both sides can fast-forward to their local dev. Preserve all other lanes. This is a preparation recommendation, not authorization to launch or change the slot owner.

No process starts/stops, tests, builds, paid/provider calls, merges, commits or shared-document edits were performed. Read-only inspection took place around 22:02 UTC on October 13. Only this report was written. Main delivered pair inspected: downstream `7b416b99`, Core `63692096`; upcoming prerequisite commits are deliberately not assumed present. At report freeze the supervisor reported t520 downstream merged, Core finish in progress and t521 UI isolated; no further source discovery or launch was performed.

## Lane and slot inspection

| Lane tree | Downstream HEAD | Ahead/behind local dev | Dirty | Core HEAD | Core ahead/behind |
| --- | --- | --- | --- | --- | --- |
| t262 | dc82c3e7 | 30/52 | One untracked report, docs only | a1e249ab | 0/24 |
| t275 | 172c50e6 | 31/59 | Clean | a1e249ab | 0/24 |
| t342 | 394dfff8 | 2/59 | Clean | a1e249ab | 0/24 |
| t451 | 389580de | 31/59 | Clean | a1e249ab | 0/24 |
| t418 | 5a33299b | 0/59 | Clean | a1e249ab | 0/24 |

All ahead changes in t262/t275/t342/t451 are documentation, not production code. t262's untracked `docs/working/adaptation-and-breadth-plan/reports/codex-replay-investigation.md` must be preserved before any merge; the same report exists on dev, so a blind merge can collide. t418 avoids that conflict. Main's unrelated `.clinerules/fluxiq.md` edit and supervisor working-document edits were left untouched; Core main was clean.

Slot reservation files still name 1=t451, 2=t342, 3=t262, 4=t275. Each `owner` JSON has `task`, `lane`, `instance`, `pid`, `claimedAt`; its PID is unset, so there is no owner process identity to verify. Process snapshots found no persistent Node/browser process associated with retained lane trees or a Lab launcher; transient tool processes are not a running Lab. This is point-in-time evidence, not permission to steal a lease. No STOP-balance file exists; that alone does not establish provider credit availability.

No dedicated transition command for these `lab-slots/slot-N/owner` reservation files was found. The bench machine-cell slot manager uses a separate `owner.json`/ticket/liveness protocol and must not be applied to this lease. The supervisor's next written prep brief should authorize the transition explicitly: recheck current processes/owner, preserve the old owner JSON externally, record task/lane/instance/claimedAt for the new reservation (PID remains unknown until a real launch identity exists), and retain old lane directories/profiles. Do not use process termination or profile deletion to reclaim it.

## Previous-run debug prerequisites

All four existing instance labels have zero starts in the preceding 30 minutes. Latest finish and debug presence:

| Instance | Latest run | Verdict | Debug present in original lane |
| --- | --- | --- | --- |
| t451-slot-1 | run-mv6v2hx5-f448e662 | Failed | Yes |
| t342-slot-2 | run-mv6v2kzn-d593231f | Failed | Yes |
| t262-slot-3 | run-mv6v2g3l-a865ead7 | Passed, not gate | Yes |
| t275-slot-4 | run-mv6v2jh4-69244ffb | Failed | Yes |

For the recommended slot 3 transition, the exact prior debug is:

`C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mv6v2g3l-a865ead7.md`.

It describes the bigbox drift being absorbed by fingerprints, not a crossborder gate pass. Copy/preserve that debug in t418's canonical debug directory during authorized prep; do not rename an instance solely to evade an existing failure/debug guard. Preserve the original debug and run bundle. If using a new legitimate `t418-slot-3` instance, its empty ledger history does not excuse reading the inherited slot's prior result.

Owning guard seams: `scripts/lab/live-guards/{admit-live-run,live-launch,ledger-queries}.mjs`; `rules/{debug,unchanged,loop,behind-dev,balance}.mjs`. Do not invoke `admitLiveRun` for discovery: it reconciles/writes the ledger. The unchanged rule compares actual source fingerprints; documentation alone does not count as a fix. Every retained lane currently lacks production dev commits, so the behind-dev guard is a real blocker until synchronization. No override file is needed or recommended.

## Build identity findings

Existing host receipts match their own old lane source inputs (zero mismatches). They do not represent current dev:

| Tree | Host source inputs differing from current dev | Core stamped source inputs differing from current dev |
| --- | --- | --- |
| t262 | 7 | 87 |
| t275 | 11 | 74 |
| t342 | 11 | 68 |
| t451 | 11 | 68 |
| t418 | 11 | 68 |

These are source-input mismatch counts, not recovered loaded-process identities. Core identity reader normalization and complete artifact/input inventory checks remain the real launcher gate. Shared host receipts and runner CLI exist in all trees; t418 has no per-instance host/extension copy for the proposed new instance yet. The artifacts must be rebuilt/copied against the synchronized pair, not trusted from mere existence.

Owning identity paths are `packages/fluxiq/dist/runtime-build-identity.json`, `domain/dist/host/web-panel-host.mjs.identity.json`, per-instance `domain/.lab-instances/<instance>/host/` and extension `build-info.json`. The host/Core/extension identity validators refuse stale/incomplete provenance before provider dispatch. No source or artifact hashes were printed.

## Narrow preparation commands, not executed

After the supervisor integrates/freezes required generic t520/t521 work, in the clean t418 pair:

```powershell
git -C 'C:/Users/osrs_/FluxStuff/fxwork/t418/!FluxIQ' merge --ff-only dev
git -C 'C:/Users/osrs_/FluxStuff/fxwork/t418/!FluxIQWebExtension' merge --ff-only dev
```

Re-read both statuses and heads. Do not run these fast-forward commands against the divergent documentation lanes. Build only the required public Core libraries first, from t418 Core:

```powershell
pnpm.cmd --filter @fluxiq/contracts --filter fluxiq build
```

Then configure the selected downstream lane's launch environment:

```powershell
$env:FLUXIQ_TEST_ENV_FILES='none'
$env:FLUXIQ_TEST_TARGET='persistent-isolated'
$env:FLUXIQ_LLM_RUN_COST_CEILING_USD='0.25'
$env:FLUXIQ_LAB_INSTANCE='t418-slot-3'
$env:FLUXIQ_LAB_CORE_BRANCH='task/t418-paid-proofs'
$env:FLUXIQ_DEMO_HEADLESS='false'
```

The existing Lab launcher build phase already sequences scenario/dependencies, host, extension and runner builds, deduplicates shared steps and copies the per-instance host. Use its build/cache path rather than a whole test/build sweep. `scripts/lab/prelude/build-phase.mjs` is the owning order; `scripts/lab/core/build/{entries,stale,watch}.mjs` verifies existence, staleness and quiescence. Isolated Core web publication is separately inspected by the dry run and built through its owning cache when needed. Compilation is not live qualification.

The provider-free created-task preflight, from t418 downstream, is the paid command below with `--dry-run` appended. It should report `status: ready`, `providerCallCount: 0`, chat entry, correct task/variant/judgement and candidate readiness. `cli.ts:127` returns before topology, browser or provider calls; the wrapper can build prerequisites. This discovery did not run it.

## Exact instruction-created gate commands

Use this complete common command shape, replacing only scenario/task/workspace/instance for the rows below. The profile/provider placeholders in old retirement help are unnecessary here because the actual supported values are known.

```powershell
pnpm.cmd lab run crossborder-marketplace --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart-basket-redesign-after-creation --target persistent-isolated --workspace adapt-crossborder-1 --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 64 --llm-max-run-tokens 48000000
```

| Site | Explicit task | Workspace round 1 | Intended original slot |
| --- | --- | --- | --- |
| crossborder-marketplace | crossborder-marketplace-hub-to-cart-basket-redesign-after-creation | adapt-crossborder-1 | 3 |
| everything-store | everything-store-first-page-plus-earbuds-deal-wheel | adapt-store-1 | 1 |
| social-network-feed | social-network-feed-group-post-regrouped-after-creation | adapt-social-1 | 4 |

Store/social use the same common flags with their scenario/task/workspace. After a passing round, use round-2 workspaces on the same frozen pair. No bare `--flow`, `--direct-api-build` or model-reset-only flag: ordinary instruction chat generation and the real build reset are required. A counted run still needs P1-P7, including a real diagnosis/repair, judged successful application, changed saved Flow, zero-call in-run replay, UI review and debug. Drift absorbed with no repair is not a gate count.

For later-session reuse, unset any process provider credential in a scoped way, set `FLUXIQ_TEST_ENV_FILES=none`, preserve the same instance/workspace/Core branch and run:

```powershell
pnpm.cmd lab replay crossborder-marketplace --workspace adapt-crossborder-1 --project <project-id-from-build> --flow <flow-id-from-build> --instruction-task crossborder-marketplace-hub-to-cart-basket-redesign-after-creation
```

Save/restore the process environment credential without printing it if it was present; do not delete stored Core Secret Keys or edit env files. Replay refuses a nonblank provider credential before Core/browser startup. It must retain the active instruction created by the build. Receipt requirements include successful run, exact independent goal/dataset, unchanged saved Flow, explicit zero provider accounting, empty/non-omitted provider call list, no interventions/harness, and unchanged stored key identities. Missing accounting is unknown, not zero. Base-task replays are observation-only and do not replace the drift reuse gate.

## Breadth reruns

Use the same instruction-created common flags with an explicit task and fresh persistent workspace; for breadth, normal creation qualification and separate provider-free replay are scored independently of adaptation. Latest failed attempts:

| Task | Latest run | Original instance | Remaining cause/proof needed |
| --- | --- | --- | --- |
| local-classifieds-bike-search | run-mv6qrcdu-a31b44b8 | t262-slot-3 | Element observation/select handling; fresh exact dataset proof |
| auction-marketplace-kestrel-auctions | run-mv6qrbgx-06151cdb | t451-slot-1 | Stacked layers and record-output/sort validation; fresh exact dataset proof |
| company-website-gas-engineers | run-mv6qrcln-2e194a12 | t275-slot-4 | Covering-layer dismissal; fresh exact dataset proof |
| job-board-remote-rust-roles | run-mv6v2kzn-d593231f | t342-slot-2 | Unrequested output column/judge feedback; no passing breadth claim |

The plan names the first three as the immediate pending reruns; job-board also remains unqualified despite its later rerun. Run task dry-run preflights after synchronization, preserve/read each prior debug and never feed oracle columns/values or scripted targets to product guidance. The task's authored instruction is already the proper authority. Slot 2 can carry breadth concurrently after separate ownership preparation; do not silently consume another retained slot.

## t519 compatibility and concrete blockers

No genuine t519 incompatibility was identified for existing instruction-created gate paths: task text is typed into real chat and saved as active instructions; supplemental recording is optional, and no standalone manual recording is required by these builds. The public created-Flow/explicit task command remains available. Retired bare-Flow controls and legacy saved automations without active task text are intentionally refused; do not restore them or inject fixture goals into old saved Flows.

First-launch prerequisites still required: integrate/freeze the generic SQLite prerequisite and other actually needed generic work; synchronize the selected pair; explicitly transition slot ownership; carry prior debug; rebuild and inspect complete source/artifact identities; obtain provider-free task readiness; verify provider credential availability without exposing it; retain live supervision and the $0.25 ceiling. Actual provider balance, first fresh gate behavior, web build readiness after synchronization and paid model correctness are unverified. No override, cleanup, user-panel management or additional recording-only replay is justified by this discovery.
