# t414: paid-proof preparation for R4a and R4b (worker report)

Trees: downstream `C:/Users/osrs_/FluxStuff/fxwork/t414/!FluxIQWebExtension` and Core
`C:/Users/osrs_/FluxStuff/fxwork/t414/!FluxIQ`. Both are on `task/t414-paid-proof-prep`, and both HEADs equal their
local `dev` (downstream `e0a94e11`, Core `846866b2`). Nothing is committed. No paid command was run, and no model was
called.

## Outcome

Done.

- R4b needed no new catalog row: `crossborder-marketplace-hub-to-cart-basket-redesign-after-creation` already exists
  with `variantArmedAfterBuild: true`, and so does the bigbox alternative.
- R4a did need a row, and I added it. The existing `crossborder-marketplace-hub-to-cart-flash-deal` row arms the
  promotion only after the build, so the model would never meet it. The new row is
  `crossborder-marketplace-hub-to-cart-flash-deal-during-build`, which arms the promotion during the build as well.
- All three Lab commands answer `"status":"ready"` in their dry runs, with `providerCallCount: 0`.
- The live-run guards admit both paid commands with no refusals. I checked this against a copy of the spend ledger.
- Four blockers and risks remain; see "What would block them". Two matter most:
  - All four Lab slots are claimed by lanes A-D.
  - The R4a run may legitimately end without a handler.

## What changed and why

- `apps/scenario-lab/src/scenarios/crossborder-marketplace/live-tasks.ts`: new row
  `crossborder-marketplace-hub-to-cart-flash-deal-during-build`.
  - It uses the same instruction and judge as `-hub-to-cart`, with `variantId: "flash-deal"` and **no**
    `variantArmedAfterBuild`.
  - The doc comment says why the row exists. It also records that a candidate trial does not meet the promotion,
    because the trial starts from the site's reset and that reset clears every armed variant
    (`apps/scenario-lab/src/state-store.ts:55`, `#variants.clear()`).
- `apps/scenario-lab/src/scenarios/crossborder-marketplace/tests/live-tasks.test.ts`: a new test checks three things:
  - the row is the base row plus `variantId: "flash-deal"`;
  - it is not armed only after the build;
  - the variant exists.
- `apps/scenario-lab/src/scenarios/tests/realistic-site-live-tasks.test.ts`: this test lists every added realistic task
  and the catalog total. I added the new id and changed the total from 67 to 68. I had to edit this shared test
  because it pins the catalog's exact contents.

## The paid commands (for the user's approval; one attempt each, live supervisor watching)

**Slot.** `<N>` stands for the Lab slot the supervisor assigns (see Blockers). The instance name is new, so the
`loop`, `debug` and `unchanged` rules have no history for it.

**Credential and ceiling.** The paid runs read `DEEPSEEK_API_KEY` from the tree's `.env.local`. By design that file is
read for this one name even when `FLUXIQ_TEST_ENV_FILES=none` is set (`packages/test-runner/src/live-llm/provider-credential.ts`).
`.env.local` sets `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.10`.

**Bash form** (run from `C:/Users/osrs_/FluxStuff/fxwork/t414/!FluxIQWebExtension`).

R4a, a candidate creation that meets the flash deal during discovery:

```bash
FLUXIQ_LAB_INSTANCE=t414-slot-<N> pnpm lab run crossborder-marketplace --variant flash-deal --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart-flash-deal-during-build --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t414-r4a --replays 1
```

R4b, recommended: build on the base site, then play back with the basket redesign armed (in-run repair):

```bash
FLUXIQ_LAB_INSTANCE=t414-slot-<N> pnpm lab run crossborder-marketplace --variant basket-redesign --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart-basket-redesign-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t414-r4b --replays 1
```

R4b alternative, bigbox (also dry-run ready; see the risk under Blockers):

```bash
FLUXIQ_LAB_INSTANCE=t414-slot-<N> pnpm lab run bigbox-retail --variant redesigned-buy-box --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task bigbox-retail-pickup-cart-redesigned-after-creation --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t414-r4b-bigbox --replays 1
```

**PowerShell form.** Set the instance first with `$env:FLUXIQ_LAB_INSTANCE = 't414-slot-<N>'`, then run the same
`pnpm lab run ...` line. Afterwards, `Remove-Item Env:FLUXIQ_LAB_INSTANCE`.

These argument lists are exactly what `pnpm lab:campaign <task-id> --authoring-mode candidate --max-attempts 1 --
--target persistent-isolated --workspace <ws> --replays 1` prints for each task (dry run below). Running them through
the campaign instead also gives the summary row; `--max-attempts 1` keeps that to one attempt.

**Output limit.** `--llm-max-output-tokens 8000` does not cap the model's reply. Core sends no `max_tokens`
(`runtime/llm/deepseek/request-body.ts`, t254, the user's 2026-10-03 rule). The number is only what the
context-window check sets aside for the reply.

## Replay commands (zero calls, no spend)

`--replays 1` already replays the applied Flow once inside the paid invocation, with no model. The separate,
later-invocation proof is below. Take `<project-id>` and `<flow-id>` from the build's
`snapshots/creation-context.json` (or `snapshots/flow-lane.json`). The replay arms the task's variant itself
(`saved-flow-replay/replay-saved-flow.ts:171`).

```bash
env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t414-slot-<N> pnpm lab replay crossborder-marketplace --workspace t414-r4a --project <project-id> --flow <flow-id> --instruction-task crossborder-marketplace-hub-to-cart-flash-deal-during-build
env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t414-slot-<N> pnpm lab replay crossborder-marketplace --workspace t414-r4b --project <project-id> --flow <flow-id> --instruction-task crossborder-marketplace-hub-to-cart-basket-redesign-after-creation
```

`FLUXIQ_TEST_ENV_FILES=none` is required. Without it the resolved environment includes `.env.local`'s key, and the
replay refuses before it starts (`replay-saved-flow.ts:119-122`, `cli.ts:56`).

## Commands run and observed results

All of the dry runs below were run with `env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none`.

**Core rebuild.** `pnpm build` in the t414 Core ran contracts, fluxiq, client-gateway-websocket and web. It exited 0,
and `web:build` rebuilt from scratch (`"no stamp"`, 134 s).

**Downstream rebuild.** `pnpm --filter @fluxiq-web-extension/<p> build` for each package:

| Package | Exit | Build cache |
| --- | --- | --- |
| domain | 0 | `reuse`, after `core-build: ... is current with its source` |
| extension | 0 | `reuse` |
| scenario-lab | 0 | `build`, because its inputs changed |
| test-runner | 0 | `reuse` |

The Lab prelude of the first dry run also rebuilt the instance outputs. Its `rebuilt` list was `scenario-lab:build`,
`domain:host-build` and `extension:build`; its `reused` list was `test-contracts`, `domain`, `test-evidence` and
`test-runner`.

**Tests.**

- `node --test` on the four scenarios-level test files plus crossborder's `live-tasks` and `scenario` tests, run from
  scenario-lab's `dist`: 40 tests, 40 pass, 0 fail.
- `node --test scripts/lab/live-campaign/tests/*.test.mjs`: 24 pass, 0 fail.
- `node --test` on test-runner's `dist/flow-lane/creation/tests/{instruction-task,permission-point,request}.test.js`:
  23 pass, 0 fail.

**Campaign dry run.**

- Command: `node scripts/lab/live-campaign.mjs --dry-run --no-build --authoring-mode candidate --max-attempts 1 <the
  three task ids> -- --target persistent-isolated --workspace t414-WS --replays 1`.
- Output: `# 3 task(s)` and the three `pnpm lab run` lines above (only the workspace differs).
- With `FLUXIQ_LAB_INSTANCE` set and `--no-build`, it fails instead, because the instance's catalog is not built yet.
  I ran it without an instance.

**R4a dry run.**

- Command: `FLUXIQ_LAB_INSTANCE=t414-dry node scripts/lab/run-lab.mjs run crossborder-marketplace --variant flash-deal ...
  --workspace t414-r4a --replays 1 --dry-run`. It exited 0.
- My first attempt used `--workspace t414-WS`, which was refused because workspace names must be lowercase.
- It printed:
  `{"status":"ready","providerCallCount":0,"lane":"created-flow","buildEntry":"chat","target":"persistent-isolated","request":{"taskId":"crossborder-marketplace-hub-to-cart-flash-deal-during-build",...,"variantId":"flash-deal","judgement":{"judgeBy":"playback-goal","goalId":"hub-in-cart"}...},"live":{...,"model":"deepseek-flash","coreDefaultModel":"deepseek-flash","coreAuthoringMode":"candidate","task":"create-flow","purpose":"build_and_adapt","authorized":{"maxCalls":48,...,"maxEstimatedCostUsd":0.1,"maxTotalEstimatedCostUsd":0.1},"permittedConsequences":[],"credentialSource":{"name":"DEEPSEEK_API_KEY","from":".env.local"}},"candidateTrial":{"trialRunner":true,"startReset":true,"source":"lab-plan"},"coreWeb":{"key":"b842994f0b7a854face65a43","cached":false}}`.

**R4b dry runs.** Both exited 0 and are identical in shape to R4a's:

| Task | Variant | Goal | `buildEntry` | `coreAuthoringMode` | `candidateTrial` | Ceiling | Provider calls |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `...basket-redesign-after-creation` | `basket-redesign` | `hub-in-cart` | chat | candidate | `trialRunner` and `startReset` true | 0.1 | 0 |
| `bigbox-retail-pickup-cart-redesigned-after-creation` | `redesigned-buy-box` | `build-pickup-cart` | chat | candidate | `trialRunner` and `startReset` true | 0.1 | 0 |

**Guard preflight.** The runner skips the guards on `--dry-run`, so I checked them another way.

- Method:
  1. I copied `lab-slots/spend-ledger.jsonl` into my scratchpad.
  2. I called `admitLiveRun` from `scripts/lab/live-guards/` with `slotsDirectory` pointed at that copy, using the
     exact paid argument lists.
  3. The instances were `t414-r4a` and `t414-r4b`, with no `--dry-run`.
- Both answered `"refusals":[]` and `"overridden":[]`. The fingerprint was
  `sha256:1269574e2f0b63aec487a129e8f02f0ee919ff4380d0d6e3a9176c025b81347d`, which includes the uncommitted catalog
  row.
- `lab-slots/` has no `STOP-balance` and no `OVERRIDE-*` files.
- The real ledger's last line is still lane A's 2026-10-09T08:38 finish, so nothing I ran wrote to it.

**Headed browser.** `run-scenario/browser-session/launch-browser.ts:32` hard-codes `headless = false`.

## Guidance and in-run repair (the two questions)

- **Candidate-mode guidance includes t388's handler and part format: yes.**
  - `runtime/flow-bootstrap/candidate/authoring-loop.ts:39`, in the t414 Core, puts
    `AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT` into the `core.submit_candidate` tool's `flow` description, after the
    format, act and loop texts.
  - That constant (`plan/flow-script-format.ts:405`) covers parts, `call:`, `start at:`, `checkpoint:`, `done when:`,
    facts, `on <event> [for ... | everywhere]` handlers and `then:`.
  - It includes the interruption rule and "write a handler only for an interruption you met".
  - It has three worked examples: a permit portal, a weather network and a room planner. None of them mirrors a
    realistic scenario.
- **In-run repair is enabled for the playback's intent: yes.**
  - The Lab plays a created Flow back with `runIntent: "explore_and_adapt"` (`live-llm/live-llm-run.ts:91`,
    `CREATED_FLOW_REPAIR_PURPOSE`) in `fully_adaptive` mode.
  - Core's `service.ts:2559-2562` turns that into an LLM-run context with `invokeLlm`, `createAdaptations` and
    `promoteAdaptations` all true. It then calls `bindAutomationStudioInRunRepair`.
  - `repairsInRun` (`service/runtime-session/in-run-repair.ts:93-96`) withholds the callback only in three cases:
    `diagnosis_only`, `diagnose_and_adapt`, or a dry-run adaptation. So `repairIncident` is supplied.
  - The build itself (`build_and_adapt`) is a different path.
  - If anyone runs R4b as `--llm-task adapt` (`diagnose_and_adapt`), in-run repair would **not** be supplied.

## Expected evidence for a pass

**R4a.**

- `snapshots/live-llm.json` shows:
  - `coreAuthoringMode: candidate`, model `deepseek-flash`, chat entry;
  - per-build spend at or under $0.10, with `buildsOverCeiling` 0.
- In the step logs (`steps/NNNN-*`):
  - an exploration page view shows the flash-deal promotion over the item page;
  - a `core.submit_candidate` script holds an `on <event> ...` handler, or a `part`/`call:`, or a `start at:` entry.
- `flow-lane.json` shows:
  - the candidate promoted after trial yeses;
  - the saved Flow carries handler nodes, a part Subflow, or `fluxiq.entry` metadata.
- Playback with `flash-deal` armed holds `hub-in-cart`: 3 hubs in the cart, the coupon collected, nothing bought.
  - The run detail shows the handler firing (a handler record in `detail.recovery`), or else shows the
    `clearedLayers` rung.
- The in-run replay and the later `lab replay` both show:
  - 0 provider calls, 0 interventions and 0 harness activations;
  - the content hash unchanged;
  - the goal held.

**R4b.**

- The build passes its trial on the base site.
- The playback with `basket-redesign` armed fails the add-to-cart step with `web.target.not_found` after the first
  attempt plus 3 retries. The step has no On Fail path, so this is a true failure.
- Exactly one in-run repair request follows: `runtime_patch` at `implement`, with a `replace_unit` or a target patch
  re-pointing the press at "Add to basket", never "Buy now".
- The overlay's re-attempt succeeds, and the **same run id** carries on to the end. Its `inRunRepairs` receipt is on
  the detail.
- The chat shows the "Fixing a step" card.
- The judged end applies the adaptation (`judged_whole_run`), with zero model calls for any retry.
- The replays, with `basket-redesign` armed: 0 calls, the goal held, and the hash equal to the post-fix saved hash.

## Expected cost

The ledger's recent crossborder hub-to-cart chat builds cost:

- passes: $0.021 and $0.045;
- failures: $0.021 to $0.091.

The bigbox `store-remembered` runs cost $0.043 and $0.075.

- **R4a:** about $0.02-0.09, held to the $0.10 build ceiling. Playback calls a model only on a true failure. Core's
  result-verification calls are billed outside the run budget, but they are small.
- **R4b:** a build of about $0.02-0.09, plus one in-run repair from its own per-run purse (at most $0.10, likely
  $0.01-0.03). The worst case is about $0.20 plus verification calls. The replays cost $0.

## What would block them

1. **No free Lab slot.**
   - `lab-slots/slot-1` to `slot-4` are claimed by t274 (lane C), t342 (lane A), t262 (lane B) and t275 (lane D).
   - The supervisor must assign a slot, or free one, and fill in `<N>`.
   - The guards do not enforce slot ownership. The four-run limit is the user's rule.
2. **The catalog row is uncommitted.**
   - The paid run must launch from a tree that holds it and still contains `dev`.
   - If `dev` advances first, merge it and rebuild (the `behind-dev` rule).
   - The source fingerprint changes with any source edit, which is harmless for a new instance.
3. **R4a may pass but prove nothing (risk, not verified).** Three things make a handler less likely:
   - **The guidance steers towards an optional step.** It says an interruption met at one place is an
     `optional: yes` step, and a handler is for several places or a loop. In `flash-deal` mode the promotion opens
     once per visit, 1.5 s after an item page loads, and stays gone once closed (`state/mutate.ts:52`). The model may
     therefore write an optional step, which is not a part, entry or handler.
   - **Automatic clearing may hide the promotion from the model.** The extension's rung-0 clearing runs in the
     content action runtime for every action, exploration included (`content/action-runtime/recovery/record.ts`,
     `clearedLayers`). It may press the close glyph before the model ever needs to act.
   - **Candidate trials never meet the promotion.** They start from `/__control/reset`, which disarms the variant,
     so only discovery and playback meet it.

   The approver should know that a passing run may hold an optional step and no handler. Deciding whether that meets
   R4a, or whether to pick a variant that recurs on several pages, is the supervisor's call.
4. **The bigbox R4b alternative may prove nothing.**
   - Under `redesigned-buy-box`, Add to cart keeps its wording and loses only its test id.
   - A candidate whose target resolves by role and name can therefore pass with no repair, and no model call.
   - Crossborder's `basket-redesign` renames the control to "Add to basket", so a true failure is likelier there.
     That is why I recommend it.
5. **The guards will hold any rerun.**
   - After each paid run, its debug (`docs/working/language-driven-flow-loop-plan/debugs/<runId>.md`) must exist
     before the same instance launches again.
   - A failed run on unchanged source is refused.

## Not verified

- **Running-identity admission.** The Lab checks the running identities of Core, the domain host and the server
  adapter at launch, before any dispatch. A dry run starts no Core, so no identity was asserted. The dry runs only
  confirmed that Core's build is current and that the host was rebuilt with its identity companion.
- **Pairing, browser and topology.** None of these started in a dry run.
- **`lab replay`.** I did not run it, because it starts a topology and has no dry-run mode. Its zero-call design is
  read from source.
- **What the model will do.** Whether it meets or writes a handler for the flash deal, and whether R4b's playback hits
  a true failure, cannot be known without the paid run.
- **Test scope.** I did not run the full scenario-lab suite, any structure audit, or typechecks beyond the builds.

## Open questions or contradictions found

1. R4a's wording says the model meets the interruption "in discovery or trial". Candidate trials can never meet a
   Lab variant, because the D1 start hook is the plain `/__control/reset` (`test-runner/src/environment.ts:148`) and
   that reset clears all arms. If trials should meet it, the hook would have to re-arm the task's variant. That is
   Lab source, which I do not own.
2. The current candidate guidance makes `optional: yes` the expected answer to a one-place interruption, which
   conflicts with R4a's "holds a part, an entry or a handler" on this site. See Blocker 3.
3. The dry run reported `credentialSource ... from .env.local` even with the key unset and
   `FLUXIQ_TEST_ENV_FILES=none`. This is the designed behaviour for `--live-llm`: the key value is read into memory
   and never logged. A dry run still makes no provider call (`providerCallCount: 0`).
